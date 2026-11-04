"use strict";

/**
 * AUD-007B over HTTP and WebSocket: a successful password change or administrator reset ends
 * every session issued before it, closes the user's live sockets on every device, and (for the
 * self-service change) returns a replacement token that keeps the current client signed in.
 *
 * Before: after either operation the old token still authenticated (200) until it expired and
 * the user's sockets stayed connected. Now User.passwordChangedAt is stamped atomically with the
 * new hash and checked, in whole seconds, by authenticate and authenticateSocket using the user
 * record they already load.
 *
 * Fixtures: admin (ADMIN), chairA and memberA (society A; memberA's account has NEVER changed
 * its password, so it has no marker - the "existing user" case). Disposable accounts are created
 * by the fixture administrator (public registration is closed) and given a society and the
 * ieee_member role directly in the harness database so they can join channels and type.
 *
 * Each disposable account is created with a fresh registration and the registration limiter
 * allows 10 per window, so this file creates at most 6. Failed password attempts count against
 * the auth limiter (10 per window): this file makes at most 6.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { createSocketTracker } = require("./helpers/socket-client");
const { TEST_JWT_SECRET, TEST_PASSWORD, USERS } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const session = createSession(target);
const tracker = createSocketTracker();
const { users, societies, channels } = target.ready.fixtures;

after(() => tracker.closeAll());

const RUN = Date.now();
const OLD_PASSWORD = "the-original-password-123456";
const NEW_PASSWORD = "the-second-password-98765432";
let counter = 0;

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
const claims = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
const storedUser = (id) => withDatabase(target, (db, ObjectId) => db.collection("users").findOne({ _id: new ObjectId(id) }));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A disposable member of society A: account, society, ieee_member role. */
async function memberAccount(label) {
  const email = `rev-${label}-${RUN}-${++counter}@integration.test`;
  const created = await target.registerAccount({ name: `Revocation ${label}`, email, password: OLD_PASSWORD });
  const body = await created.json();
  assert.equal(created.status, 201, JSON.stringify(body).slice(0, 160));
  const id = body.data.user.id;
  await withDatabase(target, async (db, ObjectId) => {
    const role = await db.collection("roles").findOne({ name: "ieee_member" });
    await db.collection("users").updateOne({ _id: new ObjectId(id) }, { $set: { societyId: new ObjectId(societies.A.id) } });
    await db.collection("userroles").insertOne({
      user: new ObjectId(id),
      role: role._id,
      society: new ObjectId(societies.A.id),
      assignedBy: new ObjectId(users.admin.id),
      assignedAt: new Date(),
    });
  });
  return { id, email, token: body.data.token };
}
async function connectWith(token) {
  const result = await tracker.connect(target.baseUrl, { token });
  return result;
}
async function connected(token) {
  const result = await connectWith(token);
  assert.equal(result.ok, true, `could not connect: ${result.error}`);
  return result.client;
}
const closes = async (client, timeout = 4000) => {
  try {
    await client.waitForClose(timeout);
    return true;
  } catch {
    return false;
  }
};

describe("an account whose password never changed is unaffected", () => {
  test("it has no marker and its existing token and a fresh login both work", async () => {
    const stored = await storedUser(users.memberA.id);
    const token = await session.tokenFor("memberA");

    assert.equal("passwordChangedAt" in stored, false);
    assert.equal((await raw("GET", "/auth/me", token)).status, 200);
    assert.equal((await raw("GET", "/auth/me", jwt.sign({ id: users.memberA.id, role: "OFFICE_BEARER" }, TEST_JWT_SECRET, { expiresIn: "1h", noTimestamp: true }))).status, 200, "a token without iat must keep working for an account without a marker");
  });
});

describe("self-service password change", () => {
  let u;
  let phone;
  let laptop;
  let bystander;
  let watcher;
  let beforeChange;

  test("setup: two devices of the user, an unrelated user's socket, and a society watcher", async () => {
    u = await memberAccount("self");
    phone = await connected(u.token);
    laptop = await connected(u.token);
    bystander = await connected(await session.tokenFor("memberA"));
    watcher = await connected(await session.tokenFor("chairA"));
    for (const client of [phone, laptop, watcher]) assert.deepEqual(await client.emitWithAck("channel:join", channels.A.id), { success: true });
    assert.deepEqual(await phone.emitWithAck("room:join", { channelId: channels.A.id }), { success: true });
    assert.deepEqual(await watcher.emitWithAck("room:join", { channelId: channels.A.id }), { success: true });
    assert.equal((await raw("GET", "/auth/me", u.token)).status, 200);
    beforeChange = Date.now();
  });

  test("a wrong current password or a too-short new password changes nothing: token, sockets and marker intact", async () => {
    const wrong = await raw("POST", "/auth/change-password", u.token, { currentPassword: "not-the-password-xxxxxxx", newPassword: NEW_PASSWORD });
    const weak = await raw("POST", "/auth/change-password", u.token, { currentPassword: OLD_PASSWORD, newPassword: "short" });
    const malformed = await raw("POST", "/auth/change-password", u.token, { currentPassword: {}, newPassword: NEW_PASSWORD });

    assert.equal(wrong.status, 401);
    assert.equal(weak.status, 400);
    assert.equal(malformed.status, 400);
    for (const res of [wrong, weak, malformed]) assert.equal(res.text.includes('"token"'), false, "a failed change returned a token");
    assert.equal((await raw("GET", "/auth/me", u.token)).status, 200);
    assert.equal(phone.closed, false);
    assert.equal(laptop.closed, false);
    assert.equal("passwordChangedAt" in (await storedUser(u.id)), false);
  });

  test("the change succeeds, keeps the existing response fields and adds a replacement token", async () => {
    const res = await raw("POST", "/auth/change-password", u.token, { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.json.success, true);
    assert.equal(res.json.message, "Password updated successfully");
    assert.equal(typeof res.json.data.token, "string");
    u.replacement = res.json.data.token;
    const stored = await storedUser(u.id);
    assert.ok(stored.passwordChangedAt instanceof Date);
    assert.ok(stored.passwordChangedAt.getTime() >= beforeChange - 1000);
    assert.equal(stored.password.startsWith("$2"), true);
  });

  test("the old token is refused over HTTP; the replacement is accepted and has the normal claims and lifetime", async () => {
    const old = await raw("GET", "/auth/me", u.token);
    const fresh = await raw("GET", "/auth/me", u.replacement);

    assert.equal(old.status, 401);
    assert.equal(old.json.success, false);
    assert.equal(fresh.status, 200);
    assert.equal(fresh.json.user.email, u.email);
    const c = claims(u.replacement);
    assert.equal(c.id, u.id);
    assert.equal(c.role, "OFFICE_BEARER");
    assert.equal(c.exp - c.iat, 3600, "the harness lifetime is 1h; the replacement must not extend it");
    assert.equal("passwordChangedAt" in fresh.json.user, false, "the marker must not be exposed");
    // a protected operation, not just /auth/me
    assert.equal((await raw("GET", `/societies/${societies.A.id}/notes`, u.token)).status, 401);
    assert.equal((await raw("GET", `/societies/${societies.A.id}/notes`, u.replacement)).status, 200);
  });

  test("every socket of the user, on every device, was closed; the unrelated socket is still connected", async () => {
    assert.equal(await closes(phone), true, "the phone socket stayed connected");
    assert.equal(await closes(laptop), true, "the laptop socket stayed connected");
    assert.equal(bystander.closed, false);
    assert.deepEqual(await bystander.emitWithAck("channel:join", channels.A.id), { success: true });
  });

  test("a revoked socket can no longer send typing or canvas events", async () => {
    assert.throws(() => phone.emit("typing:start", { channelId: channels.A.id }), /not open|closed/);
    assert.throws(() => phone.emit("canvas:draw", { channelId: channels.A.id, stroke: { points: [1] } }), /not open|closed/);
  });

  test("the old token cannot open a new socket; the replacement can and works normally", async () => {
    const refused = await connectWith(u.token);
    assert.equal(refused.ok, false);
    assert.match(String(refused.error), /Authentication error/);

    const again = await connected(u.replacement);
    assert.deepEqual(await again.emitWithAck("channel:join", channels.A.id), { success: true });
    assert.deepEqual(await again.emitWithAck("room:join", { channelId: channels.A.id }), { success: true });
    const mark = watcher.mark();
    again.emit("canvas:draw", { channelId: channels.A.id, stroke: { points: [1, 2] } });
    await watcher.waitFor("canvas:draw", () => true, 3000, mark);
  });

  test("the new password logs in (immediately), the old one does not", async () => {
    const good = await raw("POST", "/auth/login", null, { email: u.email, password: NEW_PASSWORD });
    const bad = await raw("POST", "/auth/login", null, { email: u.email, password: OLD_PASSWORD });

    assert.equal(good.status, 200, good.text.slice(0, 160));
    assert.equal(bad.status, 401);
    assert.equal((await raw("GET", "/auth/me", good.json.data.token)).status, 200, "a login in the second of the change produced an unusable token");
  });

  test("same-second issuance cannot bypass revocation: a token with the marker's own second is refused, the next second is accepted", async () => {
    const stored = await storedUser(u.id);
    const markerSec = Math.floor(stored.passwordChangedAt.getTime() / 1000);
    const at = (iat) => jwt.sign({ id: u.id, role: "OFFICE_BEARER", iat }, TEST_JWT_SECRET, { expiresIn: "1h" });

    assert.equal((await raw("GET", "/auth/me", at(markerSec))).status, 401);
    assert.equal((await raw("GET", "/auth/me", at(markerSec - 1))).status, 401);
    assert.equal((await raw("GET", "/auth/me", at(markerSec + 1))).status, 200);
    assert.equal(claims(u.replacement).iat > markerSec, true);
  });

  test("missing iat is refused for an account with a marker; invalid, expired and wrongly signed tokens remain refused", async () => {
    const noIat = jwt.sign({ id: u.id, role: "OFFICE_BEARER" }, TEST_JWT_SECRET, { expiresIn: "1h", noTimestamp: true });
    const expired = jwt.sign({ id: u.id, role: "OFFICE_BEARER", iat: Math.floor(Date.now() / 1000) + 5 }, TEST_JWT_SECRET, { expiresIn: -30 });
    const wrongSecret = jwt.sign({ id: u.id, role: "OFFICE_BEARER", iat: Math.floor(Date.now() / 1000) + 5 }, "another-secret-of-adequate-length-xxxxxxxx", { expiresIn: "1h" });

    for (const [name, token] of Object.entries({ noIat, expired, wrongSecret, malformed: "not.a.jwt" })) {
      assert.equal((await raw("GET", "/auth/me", token)).status, 401, name);
    }
  });
});

describe("administrator password reset", () => {
  let t;
  let first;
  let second;
  let bystander;

  test("setup: the target has two live sockets, another user has one", async () => {
    t = await memberAccount("reset");
    first = await connected(t.token);
    second = await connected(t.token);
    bystander = await connected(await session.tokenFor("chairA"));
    assert.equal((await raw("GET", "/auth/me", t.token)).status, 200);
  });

  test("failed resets (not an administrator, too-short password, unknown user) revoke and disconnect nobody", async () => {
    const asMember = await raw("POST", `/users/${t.id}/reset-password`, await session.tokenFor("memberA"), { newPassword: NEW_PASSWORD });
    const weak = await raw("POST", `/users/${t.id}/reset-password`, await session.tokenFor("admin"), { newPassword: "short" });
    const unknown = await raw("POST", "/users/64b7f8f2a1b2c3d4e5f6ffff/reset-password", await session.tokenFor("admin"), { newPassword: NEW_PASSWORD });

    assert.equal(asMember.status, 403);
    assert.equal(weak.status, 400);
    assert.equal(unknown.status, 404);
    assert.equal((await raw("GET", "/auth/me", t.token)).status, 200);
    assert.equal(first.closed, false);
    assert.equal(second.closed, false);
    assert.equal("passwordChangedAt" in (await storedUser(t.id)), false);
  });

  test("a successful reset keeps its response, stamps the marker, refuses the old token and closes both sockets", async () => {
    const res = await raw("POST", `/users/${t.id}/reset-password`, await session.tokenFor("admin"), { newPassword: NEW_PASSWORD });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.json.success, true);
    assert.match(res.json.message, /^Password reset for /);
    assert.equal(res.text.includes('"token"'), false, "the administrator must not receive the user's token");
    assert.ok((await storedUser(t.id)).passwordChangedAt instanceof Date);
    assert.equal((await raw("GET", "/auth/me", t.token)).status, 401);
    assert.equal(await closes(first), true);
    assert.equal(await closes(second), true);
    assert.equal(bystander.closed, false, "an unrelated user's socket was disconnected");
    assert.deepEqual(await bystander.emitWithAck("channel:join", channels.A.id), { success: true });
  });

  test("the old token cannot reconnect; the target signs in with the new password; the old password fails", async () => {
    const refused = await connectWith(t.token);
    assert.equal(refused.ok, false);

    const good = await raw("POST", "/auth/login", null, { email: t.email, password: NEW_PASSWORD });
    const bad = await raw("POST", "/auth/login", null, { email: t.email, password: OLD_PASSWORD });
    assert.equal(good.status, 200, good.text.slice(0, 160));
    assert.equal(bad.status, 401);
    assert.equal((await raw("GET", "/auth/me", good.json.data.token)).status, 200);
    const reconnected = await connected(good.json.data.token);
    assert.deepEqual(await reconnected.emitWithAck("channel:join", channels.A.id), { success: true });
  });

  test("other users' tokens and the administrator's own session are unaffected", async () => {
    assert.equal((await raw("GET", "/auth/me", await session.tokenFor("chairA"))).status, 200);
    assert.equal((await raw("GET", "/users", await session.tokenFor("admin"))).status, 200);
  });
});

describe("existing contracts around passwords and sessions", () => {
  test("login, registration policy and the unified failure response are unchanged", async () => {
    const ok = await raw("POST", "/auth/login", null, { email: USERS.chairA.email, password: TEST_PASSWORD });
    const unknown = await raw("POST", "/auth/login", null, { email: "nobody@integration.test", password: "whatever-password-123" });
    const anonymousRegister = await raw("POST", "/auth/register", null, { name: "x", email: "x@integration.test", password: OLD_PASSWORD });

    assert.equal(ok.status, 200);
    assert.equal(unknown.status, 401);
    assert.equal(unknown.json.message, "Invalid email or password");
    assert.equal(anonymousRegister.status, 401);
  });

  test("the permission matrix still ends live room membership (AUD-007)", async () => {
    const member = await connected(await session.tokenFor("memberA"));
    assert.deepEqual(await member.emitWithAck("channel:join", channels.A.id), { success: true });
    await sleep(0);
    const revoke = await raw("POST", "/role-permissions", await session.tokenFor("admin"), { role: "ieee_member", permission: "community_hub:view", accessLevel: "none" });
    assert.equal(revoke.status, 200);
    assert.deepEqual(await member.emitWithAck("channel:join", channels.A.id), { success: false });
    await raw("POST", "/role-permissions", await session.tokenFor("admin"), { role: "ieee_member", permission: "community_hub:view", accessLevel: "limited_own_scope" });
    await member.close();
  });
});
