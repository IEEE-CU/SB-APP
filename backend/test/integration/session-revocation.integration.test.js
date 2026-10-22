"use strict";

/**
 * AUD-007 over HTTP and WebSocket: what happens to an already-issued token or an already
 * connected socket when the account or its authorization changes.
 *
 * Verified (and pinned here) over the real server:
 *   - a valid token works; expired, wrongly signed, malformed, unsigned and subject-less tokens
 *     are refused; the role CLAIM inside a token is ignored (the role comes from the user record);
 *   - HTTP: a deleted user's token is refused at once (the user is loaded on every request), and
 *     a permission revoked through the matrix API is refused on the very next request;
 *   - sockets (fixed here): after a matrix edit the user's live sockets lose the channel rooms
 *     they are no longer allowed in BEFORE the API answers, so they stop receiving messages;
 *     re-joining is refused; restoring the permission allows joining again; a socket whose user
 *     was deleted is disconnected; other users' sockets are untouched.
 *
 * NOT covered, deliberately (see the batch report): tokens issued before a password change or
 * reset stay valid until they expire - there is no revocation mechanism to test.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { createSocketTracker } = require("./helpers/socket-client");
const { TEST_JWT_SECRET } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const session = createSession(target);
const tracker = createSocketTracker();
const { users, channels } = target.ready.fixtures;

after(() => tracker.closeAll());

const RUN = Date.now();
let counter = 0;
const unique = (label) => `${label} #${++counter} ${RUN}`;

async function raw(method, route, token, body) {
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text };
}
const setPermission = async (role, permission, accessLevel) =>
  raw("POST", "/role-permissions", await session.tokenFor("admin"), { role, permission, accessLevel });
async function connectAs(userKey) {
  const result = await tracker.connect(target.baseUrl, { token: await session.tokenFor(userKey) });
  assert.equal(result.ok, true, `${userKey} could not connect: ${result.error}`);
  return result.client;
}
const joinChannel = (client) => client.emitWithAck("channel:join", channels.A.id);
async function post(userKey, text) {
  const res = await session.request(userKey, "POST", `/channels/${channels.A.id}/messages`, { body: { body: text } });
  assert.equal(res.status, 201, res.text.slice(0, 160));
}
const received = async (client, text, mark, timeout = 1500) => {
  try {
    await client.waitFor("message:new", (m) => m && m.body === text, timeout, mark);
    return true;
  } catch {
    return false;
  }
};
const sign = (payload, secret = TEST_JWT_SECRET, options = { expiresIn: "1h" }) => jwt.sign(payload, secret, options);

describe("HTTP: which tokens are accepted", () => {
  test("a valid token works", async () => {
    const res = await raw("GET", "/auth/me", await session.tokenFor("memberA"));

    assert.equal(res.status, 200);
    assert.equal(res.json.user.email, "member.a@integration.test");
  });

  test("expired, wrongly signed, malformed, unsigned and subject-less tokens are refused", async () => {
    const id = users.memberA.id;
    const tokens = {
      expired: sign({ id, role: "OFFICE_BEARER" }, TEST_JWT_SECRET, { expiresIn: -60 }),
      wrongSecret: sign({ id, role: "OFFICE_BEARER" }, "another-secret-of-adequate-length-for-hs256"),
      malformed: "not.a.jwt",
      empty: "",
      unsigned: `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id, role: "ADMIN" })).toString("base64url")}.`,
      noSubject: sign({ role: "ADMIN" }),
      unknownUser: sign({ id: "64b7f8f2a1b2c3d4e5f6ffff", role: "ADMIN" }),
    };
    for (const [name, token] of Object.entries(tokens)) {
      const res = await raw("GET", "/auth/me", token);

      assert.equal(res.status, 401, `${name}: ${res.status} ${res.text.slice(0, 100)}`);
      assert.equal(res.text.includes("integration.test"), false, `${name} leaked a profile`);
    }
  });

  test("the role claim inside a valid token is ignored: it cannot make a user an administrator", async () => {
    const forged = sign({ id: users.memberA.id, role: "ADMIN" });

    const asAdminRoute = await raw("GET", "/users", forged);
    const me = await raw("GET", "/auth/me", forged);

    assert.equal(asAdminRoute.status, 403);
    assert.equal(me.json.user.role, "OFFICE_BEARER");
  });

  test("an accepted token does not bypass society scope or permissions", async () => {
    const token = await session.tokenFor("memberA");

    const otherSociety = await raw("GET", `/societies/${target.ready.fixtures.societies.B.id}/notes`, token);
    const noPermission = await raw("GET", "/roles", token);

    assert.equal(otherSociety.status, 403);
    assert.equal(noPermission.status, 403);
  });
});

describe("HTTP: changes to the account or its authorization take effect at once", () => {
  test("a deleted user's token is refused on the next request", async () => {
    const created = await target.registerAccount({ name: "To Delete", email: `delete-${RUN}@integration.test`, password: "a-long-password-for-deletion-1" });
    const body = await created.json();
    const token = body.data.token;
    assert.equal((await raw("GET", "/auth/me", token)).status, 200);

    await withDatabase(target, (db, ObjectId) => db.collection("users").deleteOne({ _id: new ObjectId(body.data.user.id) }));

    assert.equal((await raw("GET", "/auth/me", token)).status, 401);
  });
});

describe("sockets: a revoked permission ends delivery before the API answers", () => {
  test("positive control: a joined member receives channel messages", async () => {
    const memberA = await connectAs("memberA");
    assert.deepEqual(await joinChannel(memberA), { success: true });
    const text = unique("before revocation");
    const mark = memberA.mark();

    await post("chairA", text);

    assert.equal(await received(memberA, text, mark), true);
    await memberA.close();
  });

  test("after community_hub:view is revoked for the role, the live socket stops receiving, re-join is refused, restoring works", async () => {
    const memberA = await connectAs("memberA");
    const chairA = await connectAs("chairA");
    assert.deepEqual(await joinChannel(memberA), { success: true });
    assert.deepEqual(await joinChannel(chairA), { success: true });

    const revoke = await setPermission("ieee_member", "community_hub:view", "none");
    assert.equal(revoke.status, 200, revoke.text.slice(0, 160));
    assert.equal((await raw("GET", `/channels/${channels.A.id}/messages`, await session.tokenFor("memberA"))).status, 403, "HTTP was not refused");

    const text = unique("after revocation");
    const markMember = memberA.mark();
    const markChair = chairA.mark();
    await post("chairA", text);

    assert.equal(await received(chairA, text, markChair, 3000), true, "an unaffected user stopped receiving");
    assert.equal(await received(memberA, text, markMember), false, "a revoked user's live socket still received the message");
    assert.deepEqual(await joinChannel(memberA), { success: false });

    const restore = await setPermission("ieee_member", "community_hub:view", "limited_own_scope");
    assert.equal(restore.status, 200, restore.text.slice(0, 160));
    assert.deepEqual(await joinChannel(memberA), { success: true });
    const again = unique("after restore");
    const markAgain = memberA.mark();
    await post("chairA", again);
    assert.equal(await received(memberA, again, markAgain, 3000), true);
    await Promise.all([memberA.close(), chairA.close()]);
  });

  test("the typing/canvas relay room is released too", async () => {
    const memberA = await connectAs("memberA");
    const chairA = await connectAs("chairA");
    assert.deepEqual(await memberA.emitWithAck("room:join", { channelId: channels.A.id }), { success: true });
    assert.deepEqual(await chairA.emitWithAck("room:join", { channelId: channels.A.id }), { success: true });

    await setPermission("ieee_member", "community_hub:view", "none");
    const mark = memberA.mark();
    chairA.emit("canvas:draw", { channelId: channels.A.id, stroke: { points: [1, 2] } });
    let leaked = true;
    try {
      await memberA.waitFor("canvas:draw", () => true, 1200, mark);
    } catch {
      leaked = false;
    }
    await setPermission("ieee_member", "community_hub:view", "limited_own_scope");

    assert.equal(leaked, false, "a revoked user still received canvas events");
    await Promise.all([memberA.close(), chairA.close()]);
  });

  test("a socket whose user was deleted is disconnected at the next matrix change", async () => {
    const created = await target.registerAccount({ name: "Socket Gone", email: `gone-${RUN}@integration.test`, password: "a-long-password-for-sockets-1" });
    const body = await created.json();
    const result = await tracker.connect(target.baseUrl, { token: body.data.token });
    assert.equal(result.ok, true);
    const client = result.client;
    await withDatabase(target, (db, ObjectId) => db.collection("users").deleteOne({ _id: new ObjectId(body.data.user.id) }));

    const touch = await setPermission("ieee_member", "community_hub:create", "limited_own_scope");

    assert.equal(touch.status, 200, touch.text.slice(0, 160));
    await client.waitForClose(3000);
    assert.equal(client.closed, true);
  });
});
