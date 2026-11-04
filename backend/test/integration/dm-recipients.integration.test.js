"use strict";

/**
 * AUD-033 over HTTP: who a non-administrator can find and start a direct message with.
 *
 * The Community recipient picker used GET /users, which is administrator-only, so ordinary
 * members had nobody to pick. GET /api/v1/conversations/recipients is the scoped replacement:
 * the members of the CALLER'S OWN society (taken from the authenticated user's own record, never
 * from the request), excluding the caller, as { id, name } only. GET /users is unchanged.
 * POST /conversations independently refuses any recipient outside the caller's society, so the
 * list is a convenience and not the control.
 *
 * Fixtures: admin (global advisor); chairA and memberA (society A, hub view/create); chairB
 * (society B); loner (no society, no role). Extra disposable users are created below.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { users, societies } = target.ready.fixtures;
const A = societies.A.id;
const B = societies.B.id;

const RUN = Date.now();
const PASSWORD = "dm-recipients-password-12345";
let peerA; // second member of society A (name "Zed Peer A")
let peerB; // member of society B
let roamer; // holds the member role but has NO society
let lonelyMember; // a member of a society where nobody else is
let lonelyToken;

async function makeUser(label, { societyId = null, role = null } = {}) {
  const email = `dm-${label}-${RUN}@integration.test`;
  const created = await target.registerAccount({ name: `Zed ${label}`, email, password: PASSWORD });
  const body = await created.json();
  assert.equal(created.status, 201, JSON.stringify(body).slice(0, 160));
  const id = body.data.user.id;
  await withDatabase(target, async (db, ObjectId) => {
    if (societyId) await db.collection("users").updateOne({ _id: new ObjectId(id) }, { $set: { societyId: new ObjectId(societyId) } });
    if (role) {
      const roleDoc = await db.collection("roles").findOne({ name: role });
      await db.collection("userroles").insertOne({
        user: new ObjectId(id), role: roleDoc._id, society: societyId ? new ObjectId(societyId) : null,
        assignedBy: new ObjectId(users.admin.id), assignedAt: new Date(),
      });
    }
  });
  return { id, email, name: `Zed ${label}`, token: body.data.token };
}

const list = (key, query = "") => session.request(key, "GET", `/conversations/recipients${query}`);
const names = (res) => res.body.data.map((u) => u.name);
const ids = (res) => res.body.data.map((u) => u.id);

before(async () => {
  peerA = await makeUser("peerA", { societyId: A });
  peerB = await makeUser("peerB", { societyId: B });
  roamer = await makeUser("roamer", { role: "ieee_member" });
  const emptySociety = await withDatabase(target, async (db) => {
    const now = new Date();
    const inserted = await db.collection("societies").insertOne({ name: `DM empty ${RUN}`, shortName: `D${String(RUN).slice(-6)}`, createdAt: now, updatedAt: now });
    return String(inserted.insertedId);
  });
  lonelyMember = await makeUser("lonely", { societyId: emptySociety, role: "ieee_member" });
  lonelyToken = lonelyMember.token;
});

describe("the recipient list", () => {
  test("a member sees exactly the other members of their own society", async () => {
    const res = await list("memberA");

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, res.body.data.length);
    assert.deepEqual(ids(res).sort(), [users.chairA.id, peerA.id].sort());
    assert.ok(!ids(res).includes(users.memberA.id), "the caller was listed");
  });

  test("no one from another society, no administrator and no society-less account is listed", async () => {
    const res = await list("memberA");

    for (const excluded of [users.chairB.id, peerB.id, users.admin.id, users.loner.id, roamer.id]) assert.ok(!ids(res).includes(excluded), excluded);
    const other = await list("chairB");
    assert.deepEqual(ids(other).sort(), [peerB.id].sort());
  });

  test("a society id in the query string cannot widen or redirect the result", async () => {
    const asMember = await list("memberA", `?societyId=${B}`);
    const withArray = await list("memberA", `?societyId[]=${B}&societyId[]=${A}`);
    const forged = await list("memberA", `?societyId[$ne]=${A}`);

    for (const res of [asMember, withArray, forged]) {
      assert.equal(res.status, 200, res.text.slice(0, 160));
      assert.deepEqual(ids(res).sort(), [users.chairA.id, peerA.id].sort());
    }
  });

  test("each entry is { id, name } and nothing else; no e-mail, role, society or secret appears anywhere", async () => {
    const res = await list("memberA");

    for (const entry of res.body.data) assert.deepEqual(Object.keys(entry).sort(), ["id", "name"]);
    assert.equal(/@integration\.test|password|\$2[aby]\$|passwordChangedAt|societyId|role|token/i.test(res.text.replace(/"success"/g, "")), false, res.text.slice(0, 300));
  });

  test("results are sorted by name", async () => {
    const res = await list("memberA");

    assert.deepEqual(names(res), [...names(res)].sort((a, b) => a.localeCompare(b)));
  });
});

describe("search", () => {
  test("a name fragment narrows the list, case-insensitively, inside the caller's society only", async () => {
    const res = await list("memberA", "?q=PEERa");
    const crossSociety = await list("memberA", "?q=peerB");

    assert.deepEqual(ids(res), [peerA.id]);
    assert.deepEqual(ids(crossSociety), []);
  });

  test("regular-expression characters are treated as text, not as a pattern", async () => {
    for (const q of [".*", "(", "[a-z]+", "\\", "a|b", "^Zed"]) {
      const res = await list("memberA", `?q=${encodeURIComponent(q)}`);

      assert.equal(res.status, 200, `${q}: ${res.text.slice(0, 120)}`);
      if (q !== "^Zed") assert.deepEqual(ids(res), [], q);
    }
  });

  test("over-long or non-text search input is a 400, never a server error", async () => {
    const tooLong = await list("memberA", `?q=${"x".repeat(51)}`);
    const object = await list("memberA", "?q[a]=1");

    assert.equal(tooLong.status, 400);
    assert.ok([200, 400].includes(object.status), `${object.status}`);
    assert.equal(object.text.includes(users.chairB.id), false);
  });

  test("a blank search is the full scoped list", async () => {
    const res = await list("memberA", "?q=%20%20");

    assert.deepEqual(ids(res).sort(), [users.chairA.id, peerA.id].sort());
  });
});

describe("who may ask", () => {
  test("anonymous requests are rejected", async () => {
    assert.equal((await list(null)).status, 401);
  });

  test("an account without the community permission is denied, like the rest of Community", async () => {
    const res = await list("loner");

    assert.equal(res.status, 403);
    assert.equal(res.text.includes("@integration.test"), false);
  });

  test("an account holding the role but with no society is refused (no scope) and never sees the global directory", async () => {
    const res = await session.request(null, "GET", "/conversations/recipients", {
      headers: { Authorization: `Bearer ${roamer.token}` },
    });

    assert.equal(res.status, 403, res.text.slice(0, 160));
    assert.equal(res.text.includes("@integration.test"), false);
    assert.equal(Array.isArray(res.body.data), false);
  });

  test("a member alone in their society gets an empty list", async () => {
    const res = await session.request(null, "GET", "/conversations/recipients", {
      headers: { Authorization: `Bearer ${lonelyToken}` },
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });

  test("a global administrator has no society, so the scoped list is empty - administrators use GET /users", async () => {
    const recipients = await list("admin");
    const directory = await session.request("admin", "GET", "/users");

    assert.equal(recipients.status, 200);
    assert.deepEqual(recipients.body.data, []);
    assert.equal(directory.status, 200);
    assert.ok(directory.body.data.length >= 5);
  });
});

describe("the user directory stays administrator-only", () => {
  test("anonymous 401, members 403 (with no user data), the administrator 200", async () => {
    assert.equal((await session.request(null, "GET", "/users")).status, 401);
    for (const key of ["memberA", "chairA", "chairB", "loner"]) {
      const res = await session.request(key, "GET", "/users");
      assert.equal(res.status, 403, key);
      assert.equal(res.text.includes("@integration.test"), false, `${key} received user data`);
    }
    assert.equal((await session.request("admin", "GET", "/users")).status, 200);
  });
});

describe("starting a conversation is limited to the same scope, however the request is made", () => {
  const start = (key, body) => session.request(key, "POST", "/conversations", { body });
  const count = () => withDatabase(target, (db) => db.collection("conversations").countDocuments({}));

  test("a listed recipient can be messaged (the list and the creation rule agree)", async () => {
    const res = await start("memberA", { recipientId: peerA.id });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    const viaClientShape = await start("memberA", { participantIds: [peerA.id] });
    assert.equal(viaClientShape.status, 201);
    assert.equal(String(viaClientShape.body.data.id), String(res.body.data.id));
  });

  test("a crafted request for someone outside the society is refused and creates nothing", async () => {
    const before = await count();
    const attempts = [
      { recipientId: users.chairB.id },
      { recipientId: peerB.id },
      { recipientId: peerB.id, societyId: B },
      { recipientId: peerB.id, societyId: A },
      { participantIds: [peerB.id] },
      { recipientId: roamer.id },
      { recipientId: users.loner.id },
    ];
    for (const body of attempts) {
      const res = await start("memberA", body);
      assert.ok([403, 404].includes(res.status), `${JSON.stringify(body)} -> ${res.status} ${res.text.slice(0, 120)}`);
    }
    assert.equal(await count(), before);
  });

  test("an unknown recipient is a 404 and a malformed one a 400", async () => {
    assert.equal((await start("memberA", { recipientId: "64b7f8f2a1b2c3d4e5f6ffff" })).status, 404);
    assert.equal((await start("memberA", { recipientId: "not-an-id" })).status, 400);
  });
});
