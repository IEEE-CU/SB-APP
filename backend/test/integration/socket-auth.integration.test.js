"use strict";

/**
 * Socket.IO authentication over the real server (Phase 1: socketAuth.js,
 * presenceService.js token-lifetime handling).
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 * Tokens are never printed.
 */

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const { requireHarnessTarget, deleteDisposableUser } = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { createSocketTracker } = require("./helpers/socket-client");
const { TEST_JWT_SECRET, TEST_PASSWORD } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const session = createSession(target);
const tracker = createSocketTracker();
const { users, channels } = target.ready.fixtures;

after(() => tracker.closeAll());

const connect = (options) => tracker.connect(target.baseUrl, options);
const sign = (payload, options = {}) =>
  jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: "1h", ...options });

describe("handshake rejection", () => {
  test("no token is rejected", async () => {
    const result = await connect({});

    assert.equal(result.ok, false);
    assert.equal(result.error, "Authentication error: Token required");
  });

  test("an invalid token is rejected", async () => {
    for (const token of ["not-a-jwt", "a.b.c", ""]) {
      const result = await connect({ token });
      assert.equal(result.ok, false, `connected with token "${token}"`);
      assert.match(result.error, /Authentication error: (Invalid token|Token required)/);
    }
  });

  test("a token signed with another secret is rejected", async () => {
    const forged = jwt.sign({ id: users.admin.id, role: "ADMIN" }, "another-secret-of-adequate-length", {
      expiresIn: "1h",
    });

    const result = await connect({ token: forged });

    assert.equal(result.ok, false);
    assert.equal(result.error, "Authentication error: Invalid token");
  });

  test("an already-expired token is rejected", async () => {
    const expired = sign({ id: users.chairA.id, role: "OFFICE_BEARER" }, { expiresIn: -30 });

    const result = await connect({ token: expired });

    assert.equal(result.ok, false);
    assert.equal(result.error, "Authentication error: Invalid token");
  });

  test("a validly signed token for a deleted user is rejected", async () => {
    const email = `socket-deleted-${Date.now()}@integration.test`;
    const registration = await target.api("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Disposable Socket User", email, password: TEST_PASSWORD }),
    });
    const registered = await registration.json();
    assert.equal(registration.status, 201);
    const userId = registered.data.user.id;
    const token = sign({ id: userId, role: "OFFICE_BEARER" });

    // Control: the same token connects while the user exists.
    const whileExists = await connect({ token });
    assert.equal(whileExists.ok, true, "token was not usable before deletion");
    await whileExists.client.close();

    assert.equal(await deleteDisposableUser(target, userId, email), 1);

    const result = await connect({ token });

    assert.equal(result.ok, false, "a deleted user's token opened a socket");
    assert.equal(result.error, "Authentication error: Invalid token");
  });
});

describe("handshake acceptance", () => {
  test("a valid token for an existing fixture user connects and can use the protocol", async () => {
    const result = await connect({ token: await session.tokenFor("chairA") });

    assert.equal(result.ok, true, result.error);
    assert.equal(typeof result.client.sid, "string");

    // Acknowledgement round trip proves authenticated event handling works.
    const own = await result.client.emitWithAck("channel:join", channels.A.id);
    assert.deepEqual(own, { success: true });
  });

  test("the server stays healthy after the rejected handshakes", async () => {
    const res = await target.api("/health");
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.db, "connected");
  });
});

describe("token expiry on a live socket", () => {
  test("the server disconnects the socket when its JWT expires, and refuses further use", async () => {
    const token = sign({ id: users.memberA.id, role: "OFFICE_BEARER" }, { expiresIn: 3 });
    const { exp } = jwt.decode(token);

    const result = await connect({ token });
    assert.equal(result.ok, true, result.error);
    const client = result.client;

    // Control: the socket works before expiry.
    assert.deepEqual(await client.emitWithAck("channel:join", channels.A.id), {
      success: true,
    });

    // Real elapsed time: the server must close the connection at/after exp.
    const startedAt = Date.now();
    await client.waitForClose(10_000);
    const closedAfterMs = Date.now() - startedAt;

    assert.equal(client.closed, true, "socket is still open after its token expired");
    assert.ok(
      client.closedAt / 1000 >= exp - 1,
      `closed ${Math.round(exp - client.closedAt / 1000)} s before the token's exp`,
    );
    assert.ok(closedAfterMs < 9_000, `disconnect took ${closedAfterMs} ms`);

    // Further application events are impossible on the closed socket.
    assert.throws(() => client.emit("channel:join", channels.A.id), /not open/);
    await assert.rejects(client.emitWithAck("channel:join", channels.A.id), /not open/);

    // The expired token cannot open a new socket either.
    const again = await connect({ token });
    assert.equal(again.ok, false);
    assert.equal(again.error, "Authentication error: Invalid token");
  });

  test("an expired socket no longer receives events for rooms it had joined", async () => {
    const shortLived = sign({ id: users.memberA.id, role: "OFFICE_BEARER" }, { expiresIn: 2 });
    const control = await connect({ token: await session.tokenFor("chairA") });
    const expiring = await connect({ token: shortLived });
    assert.equal(control.ok && expiring.ok, true);
    await control.client.emitWithAck("channel:join", channels.A.id);
    assert.deepEqual(await expiring.client.emitWithAck("channel:join", channels.A.id), {
      success: true,
    });

    await expiring.client.waitForClose(8_000);
    const controlMark = control.client.mark();
    const posted = await session.request("chairA", "POST", `/channels/${channels.A.id}/messages`, {
      body: { body: "after-expiry message" },
    });
    assert.equal(posted.status, 201);

    // Positive control: a still-valid member receives it...
    const seen = await control.client.waitFor(
      "message:new",
      (m) => m.body === "after-expiry message",
      3000,
      controlMark,
    );
    assert.equal(seen.channelId, channels.A.id);
    // ...the expired socket's log has nothing from after its expiry.
    const late = expiring.client.events.filter(
      (e) => e.event === "message:new" && e.args[0].body === "after-expiry message",
    );
    assert.equal(late.length, 0);
  });
});
