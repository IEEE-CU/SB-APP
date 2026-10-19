"use strict";

/**
 * AUD-029 over HTTP and Socket.IO: the default society of GET/POST /channels, and the
 * consistency of channel list, channel detail, messages and room joins.
 *
 * Every channel and message route checks isSocietyInScope(...) against the caller's
 * RBAC scope, except the branch that picked a society on the caller's behalf: that one
 * used User.societyId - or the FIRST SOCIETY IN THE DATABASE - with no scope check. A
 * role whose scope is "none" was refused by every other route yet received a channel
 * list there (reproduced on a throwaway harness before the fix).
 *
 * Policy:
 *   - a society named in the request must be in scope (403) - unchanged;
 *   - a society chosen on the caller's behalf is held to the same check (403);
 *   - with no society of their own, callers whose scope covers every society (the
 *     global advisor, branch-wide roles) keep the first-society default; any other
 *     caller gets an empty list, never another society's channels;
 *   - messages and Socket.IO channel rooms stay on the same boundary.
 *
 * Fixtures: admin (global scope), chairA / memberA (society A), chairB (society B), loner
 * (no role, no society); channels A and B ("general"); one conversation between chairA
 * and memberA. Society A is the first society in the database. Disposable users
 * (inserted directly, removed afterwards): branchNoSociety (student_branch scope, no
 * society), noneNoSociety (scope "none", no society), noneWithSocietyB (scope "none",
 * User.societyId = B). Their roles hold community_hub:view and :create.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const { requireHarnessTarget, deleteDisposableUser, withDatabase } = require("./helpers/target");
const { createSocketTracker } = require("./helpers/socket-client");
const { TEST_PASSWORD, USERS } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const { users, societies, channels, conversation } = target.ready.fixtures;
const A = societies.A.id;
const B = societies.B.id;

const RUN = Date.now();
const MISSING = "64b7f8f2a1b2c3d4e5f6ffff";
const DISPOSABLE = {
  branchNoSociety: { scope: "student_branch", society: null },
  noneNoSociety: { scope: "none", society: null },
  noneWithSocietyB: { scope: "none", society: B },
};
const ids = {};
const tokens = {};
const tracker = createSocketTracker();

const emailOf = (key) => (USERS[key] ? USERS[key].email : `channels-${key.toLowerCase()}-${RUN}@integration.test`);

async function tokenFor(key) {
  if (tokens[key]) return tokens[key];
  const res = await fetch(`${target.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailOf(key), password: TEST_PASSWORD }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `login failed for ${key}`);
  tokens[key] = body.data.token;
  return tokens[key];
}
async function call(key, method, route, body) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${await tokenFor(key)}`;
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed, text };
}
const channelCount = () => withDatabase(target, (db) => db.collection("channels").countDocuments({}));
const messageCount = (channelId) =>
  withDatabase(target, (db, ObjectId) => db.collection("messages").countDocuments({ channelId: new ObjectId(channelId) }));
const societiesOf = (res) => [...new Set(res.body.data.map((c) => String(c.societyId)))];

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const view = await db.collection("permissions").findOne({ key: "community_hub:view" });
    const create = await db.collection("permissions").findOne({ key: "community_hub:create" });
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    for (const [key, spec] of Object.entries(DISPOSABLE)) {
      const role = await db.collection("roles").insertOne({
        name: `it_channels_${key.toLowerCase()}`, displayName: key, level: "office_bearer", scope: spec.scope,
        description: "Integration role", isSystemRole: false, createdAt: now, updatedAt: now,
      });
      await db.collection("rolepermissions").insertMany([
        { role: role.insertedId, permission: view._id, accessLevel: "limited_own_scope" },
        { role: role.insertedId, permission: create._id, accessLevel: "limited_own_scope" },
      ]);
      const user = await db.collection("users").insertOne({
        email: emailOf(key), password: hash, name: key, role: "OFFICE_BEARER",
        societyId: spec.society ? new ObjectId(spec.society) : null, createdAt: now, updatedAt: now,
      });
      ids[key] = String(user.insertedId);
      await db.collection("userroles").insertOne({
        user: user.insertedId, role: role.insertedId, society: null, assignedBy: new ObjectId(users.admin.id), assignedAt: now,
      });
    }
  });
});

after(async () => {
  await tracker.closeAll();
  await withDatabase(target, (db, ObjectId) =>
    db.collection("userroles").deleteMany({ user: { $in: Object.values(ids).map((id) => new ObjectId(id)) } }),
  );
  for (const key of Object.keys(DISPOSABLE)) await deleteDisposableUser(target, ids[key], emailOf(key));
});

// ---- authentication ------------------------------------------------------------------------

describe("anonymous callers", () => {
  test("are 401 on the list, create, detail and messages", async () => {
    const before = await channelCount();

    for (const [method, route, body] of [
      ["GET", "/channels"],
      ["POST", "/channels", { name: "anon" }],
      ["GET", `/channels/${channels.A.id}`],
      ["GET", `/channels/${channels.A.id}/messages`],
      ["POST", `/channels/${channels.A.id}/messages`, { body: "x" }],
    ]) {
      const res = await call(null, method, route, body);

      assert.equal(res.status, 401, `${method} ${route}`);
    }
    assert.equal(await channelCount(), before);
  });
});

// ---- the default society ---------------------------------------------------------------------

describe("the default society of GET /channels", () => {
  test("users with a society get exactly their own society's channels", async () => {
    for (const [key, society] of [["chairA", A], ["memberA", A], ["chairB", B]]) {
      const res = await call(key, "GET", "/channels");

      assert.equal(res.status, 200, key);
      assert.deepEqual(societiesOf(res), [society], key);
      assert.ok(res.body.count >= 1);
    }
  });

  test("a scope-none role with no society gets an empty list, not the first society's channels (the AUD-029 fallback)", async () => {
    const res = await call("noneNoSociety", "GET", "/channels");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true, count: 0, data: [] });
    assert.ok(!res.text.includes(channels.A.id) && !res.text.includes(A));
  });

  test("a scope-none role with a society of their own is refused, as on every other channel route", async () => {
    const res = await call("noneWithSocietyB", "GET", "/channels");

    assert.equal(res.status, 403);
    assert.equal(res.body.data, undefined);
    assert.ok(!res.text.includes(channels.B.id));
  });

  test("a user with no role is refused by RBAC", async () => {
    const res = await call("loner", "GET", "/channels");

    assert.equal(res.status, 403);
  });

  test("callers whose scope covers every society keep the first-society default (behavior kept; decision pending)", async () => {
    const admin = await call("admin", "GET", "/channels");
    const branch = await call("branchNoSociety", "GET", "/channels");

    assert.equal(admin.status, 200);
    assert.deepEqual(societiesOf(admin), [A]);
    assert.equal(branch.status, 200);
    assert.deepEqual(societiesOf(branch), [A]);
  });

  test("a society named in the request must be in scope, and a global caller can name any", async () => {
    const own = await call("chairB", "GET", `/channels?societyId=${B}`);
    const foreign = await call("chairB", "GET", `/channels?societyId=${A}`);
    const noneOwn = await call("noneWithSocietyB", "GET", `/channels?societyId=${B}`);
    const admin = await call("admin", "GET", `/channels?societyId=${B}`);
    const branch = await call("branchNoSociety", "GET", `/channels?societyId=${B}`);

    assert.equal(own.status, 200);
    assert.equal(foreign.status, 403);
    assert.equal(noneOwn.status, 403);
    assert.deepEqual(societiesOf(admin), [B]);
    assert.deepEqual(societiesOf(branch), [B]);
  });

  test("malformed and nonexistent society references are refused or empty, never another society's data", async () => {
    const malformedUser = await call("chairA", "GET", "/channels?societyId=not-an-object-id");
    const malformedAdmin = await call("admin", "GET", "/channels?societyId=not-an-object-id");
    const missingUser = await call("chairA", "GET", `/channels?societyId=${MISSING}`);
    const missingAdmin = await call("admin", "GET", `/channels?societyId=${MISSING}`);

    assert.equal(malformedUser.status, 403);
    assert.equal(malformedAdmin.status, 400);
    assert.equal(malformedAdmin.body.message, "Invalid ID format.");
    assert.equal(missingUser.status, 403);
    assert.equal(missingAdmin.status, 200);
    assert.deepEqual(missingAdmin.body.data, []);
  });
});

// ---- the same boundary on every other path ------------------------------------------------------

describe("detail, messages and rooms stay on the same boundary", () => {
  test("a scope-none caller is refused every channel and message route, for both societies", async () => {
    for (const key of ["noneNoSociety", "noneWithSocietyB"]) {
      for (const channel of [channels.A, channels.B]) {
        const before = await messageCount(channel.id);

        const detail = await call(key, "GET", `/channels/${channel.id}`);
        const read = await call(key, "GET", `/channels/${channel.id}/messages`);
        const write = await call(key, "POST", `/channels/${channel.id}/messages`, { body: `intrusion by ${key}` });

        assert.equal(detail.status, 403, `${key} detail`);
        assert.equal(read.status, 403, `${key} read`);
        assert.equal(write.status, 403, `${key} write`);
        assert.equal(await messageCount(channel.id), before, "a message was written");
      }
    }
  });

  test("society users read and write messages only in their own society's channel", async () => {
    const text = `hello ${RUN}`;

    const own = await call("chairA", "POST", `/channels/${channels.A.id}/messages`, { body: text });
    const read = await call("chairA", "GET", `/channels/${channels.A.id}/messages`);
    const foreignWrite = await call("chairB", "POST", `/channels/${channels.A.id}/messages`, { body: "nope" });
    const foreignRead = await call("chairB", "GET", `/channels/${channels.A.id}/messages`);

    assert.equal(own.status, 201, own.text.slice(0, 160));
    assert.equal(read.status, 200);
    assert.ok(read.body.data.some((m) => m.body === text));
    assert.equal(foreignWrite.status, 403);
    assert.equal(foreignRead.status, 403);
  });

  test("an administrator reads messages in either society (existing access)", async () => {
    const a = await call("admin", "GET", `/channels/${channels.A.id}/messages`);
    const b = await call("admin", "GET", `/channels/${channels.B.id}/messages`);

    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
  });

  test("malformed and nonexistent channel ids are a clean 400 / 404", async () => {
    const malformed = await call("chairA", "GET", "/channels/not-an-object-id");
    const missing = await call("chairA", "GET", `/channels/${MISSING}`);

    assert.equal(malformed.status, 400);
    assert.equal(missing.status, 404);
  });

  test("Socket.IO channel rooms use the same boundary", async () => {
    const connect = async (key) => {
      const result = await tracker.connect(target.baseUrl, { token: await tokenFor(key) });
      assert.equal(result.ok, true, `${key}: ${result.error}`);
      return result.client;
    };
    const join = (client, channel) => client.emitWithAck("channel:join", channel.id);

    assert.deepEqual(await join(await connect("chairA"), channels.A), { success: true });
    assert.deepEqual(await join(await connect("chairA"), channels.B), { success: false });
    assert.deepEqual(await join(await connect("admin"), channels.B), { success: true });
    for (const key of ["noneNoSociety", "noneWithSocietyB"]) {
      const client = await connect(key);
      assert.deepEqual(await join(client, channels.A), { success: false }, `${key} A`);
      assert.deepEqual(await join(client, channels.B), { success: false }, `${key} B`);
    }
  });
});

// ---- creating channels --------------------------------------------------------------------------

describe("the default society of POST /channels", () => {
  test("a scope-none caller cannot create a channel in their own User.societyId by omitting the society", async () => {
    const before = await channelCount();

    const res = await call("noneWithSocietyB", "POST", "/channels", { name: `it-none-${RUN}` });

    assert.equal(res.status, 403);
    assert.equal(await channelCount(), before);
  });

  test("a society user creates in their own society, and a foreign society is refused", async () => {
    const ok = await call("chairA", "POST", "/channels", { name: `it-own-${RUN}` });
    const foreign = await call("chairA", "POST", "/channels", { name: `it-foreign-${RUN}`, societyId: B });

    assert.equal(ok.status, 201, ok.text.slice(0, 160));
    assert.equal(String(ok.body.data.societyId), A);
    assert.equal(foreign.status, 403);
  });

  test("a global caller must name a society, and can name any (unchanged)", async () => {
    const unnamed = await call("admin", "POST", "/channels", { name: `it-admin-unnamed-${RUN}` });
    const named = await call("admin", "POST", "/channels", { name: `it-admin-named-${RUN}`, societyId: B });

    assert.equal(unnamed.status, 400);
    assert.equal(named.status, 201, named.text.slice(0, 160));
    assert.equal(String(named.body.data.societyId), B);
  });
});

// ---- conversations are participant-only, so their fallback discloses nothing ------------------------------

describe("conversations", () => {
  test("a caller only ever lists conversations they take part in", async () => {
    const chairA = await call("chairA", "GET", "/conversations");
    const chairB = await call("chairB", "GET", "/conversations");
    const none = await call("noneNoSociety", "GET", "/conversations");

    assert.equal(chairA.status, 200);
    assert.ok(chairA.body.data.some((c) => c.id === conversation.id));
    assert.deepEqual(chairB.body.data, []);
    assert.deepEqual(none.body.data, []);
    assert.ok(!none.text.includes(users.memberA.id) && !chairB.text.includes(users.memberA.id));
  });

  test("the server stays healthy", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});
