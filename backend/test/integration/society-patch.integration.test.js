"use strict";

/**
 * PATCH /societies/:id over HTTP (routes/societies.js): persistence (AUD-026) and
 * authorization.
 *
 * Persistence: the handler used to assign name/description/type/budget and reply
 * without saving. It now validates the editable paths and saves. Every claim is
 * checked against the stored document in the harness's disposable database, and
 * a later GET, not just the response.
 *
 * Authorization, in this order, both before anything is read or written:
 *   1. society scope - an administrator, or a user whose User.societyId is the
 *      URL's society (unchanged);
 *   2. the existing RBAC permission settings:edit. The seed matrix and
 *      docs/rbac-matrix.json grant it to sb_faculty_advisor, society_faculty_advisor,
 *      society_chair and sb_chair, and to no other role.
 * The shared fixtures define neither the settings permissions nor any grant, so
 * the setup below adds exactly what the production seed provides: the
 * settings:edit permission and its assignment to society_chair. ieee_member (the
 * fixture member) is deliberately given nothing, as in production.
 *
 * Budget: applied only for administrators, as on the admin-only PATCH /:id/budget;
 * any other caller's budget value is ignored (never stored, never echoed).
 *
 * Fixtures: chairA (society_chair, society A), memberA (ieee_member, society A),
 * chairB (society_chair, society B), loner (no society, no role), admin
 * (sb_faculty_advisor).
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, readDocument, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { societies } = target.ready.fixtures;
const A = societies.A.id;
const B = societies.B.id;

const RUN = Date.now();
const MISSING = "64b7f8f2a1b2c3d4e5f6ffff";
let legacyId; // a society whose stored roster entry is invalid (missing required fields)

const patch = (userKey, id, body) => session.request(userKey, "PATCH", `/societies/${id}`, { body });
const stored = (id) => readDocument(target, "societies", id);
const read = (userKey, id) => session.request(userKey, "GET", `/societies/${id}`);

/** The fields a PATCH must never touch. */
const untouched = (doc) => ({
  _id: String(doc._id),
  shortName: doc.shortName,
  logoUrl: doc.logoUrl,
  advisorSignatureUrl: doc.advisorSignatureUrl,
  createdAt: doc.createdAt.toISOString(),
  officeBearers: JSON.stringify(doc.officeBearers),
  members: JSON.stringify(doc.members),
});

before(async () => {
  await withDatabase(target, async (db) => {
    const now = new Date();

    // Explicit RBAC setup, mirroring the production seed matrix: the permission
    // exists (the super-admin resolver grants every existing permission) and
    // society_chair holds it at limited_own_scope. ieee_member gets nothing.
    await db.collection("permissions").updateOne(
      { key: "settings:edit" },
      {
        $setOnInsert: {
          key: "settings:edit",
          module: "settings",
          action: "edit",
          description: "Allows edit actions in settings module",
        },
      },
      { upsert: true },
    );
    const permission = await db.collection("permissions").findOne({ key: "settings:edit" });
    const chairRole = await db.collection("roles").findOne({ name: "society_chair" });
    await db.collection("rolepermissions").updateOne(
      { role: chairRole._id, permission: permission._id },
      { $set: { accessLevel: "limited_own_scope" } },
      { upsert: true },
    );

    const legacy = await db.collection("societies").insertOne({
      name: `Legacy ${RUN}`,
      shortName: `LEG${String(RUN).slice(-6)}`,
      type: "SOCIETY",
      budget: 0,
      description: "",
      officeBearers: [],
      members: [{ name: "Entry without the required email, ieeeId and grade" }],
      createdAt: now,
      updatedAt: now,
    });
    legacyId = String(legacy.insertedId);
  });
});

describe("a permitted update is persisted", () => {
  test("an office bearer's name, description and type are stored and read back", async () => {
    const before = await stored(A);

    const res = await patch("chairA", A, {
      name: `Renamed A ${RUN}`,
      description: "Updated description",
      type: "AFFINITY_GROUP",
    });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, `Renamed A ${RUN}`);
    const after = await stored(A);
    assert.equal(after.name, `Renamed A ${RUN}`);
    assert.equal(after.description, "Updated description");
    assert.equal(after.type, "AFFINITY_GROUP");
    assert.ok(after.updatedAt > before.updatedAt, "updatedAt did not advance, so nothing was written");
    assert.deepEqual(untouched(after), untouched(before));
    assert.equal(after.budget, before.budget);

    // A subsequent read returns the stored values.
    const again = await read("chairA", A);
    assert.equal(again.status, 200, again.text.slice(0, 200));
    assert.equal(again.body.data.name, `Renamed A ${RUN}`);
    assert.equal(again.body.data.description, "Updated description");
    assert.equal(again.body.data.type, "AFFINITY_GROUP");
  });

  test("the response envelope is unchanged", async () => {
    const res = await patch("chairA", A, { description: `envelope ${RUN}` });

    assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
  });

  test("a partial update changes only the fields sent", async () => {
    const before = await stored(A);

    const res = await patch("chairA", A, { description: `only description ${RUN}` });

    assert.equal(res.status, 200);
    const after = await stored(A);
    assert.equal(after.description, `only description ${RUN}`);
    assert.equal(after.name, before.name);
    assert.equal(after.type, before.type);
    assert.equal(after.budget, before.budget);
  });

  test("an administrator can update any society", async () => {
    const res = await patch("admin", B, { name: `Admin renamed B ${RUN}` });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal((await stored(B)).name, `Admin renamed B ${RUN}`);
    assert.equal((await read("chairB", B)).body.data.name, `Admin renamed B ${RUN}`);
  });

  test("an invalid roster entry elsewhere in the document does not block a rename", async () => {
    const res = await patch("admin", legacyId, { name: `Legacy renamed ${RUN}` });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    const after = await stored(legacyId);
    assert.equal(after.name, `Legacy renamed ${RUN}`);
    assert.equal(after.members.length, 1, "the roster was altered");
  });
});

describe("protected fields cannot be overwritten", () => {
  test("only the permitted fields change, whatever else the body carries", async () => {
    const before = await stored(A);

    const raw = JSON.stringify({
      name: `Protected ${RUN}`,
      _id: MISSING,
      id: MISSING,
      shortName: "HACKED",
      logoUrl: "https://evil.test/logo.png",
      advisorSignatureUrl: "https://evil.test/signature.png",
      officeBearers: [{ name: "Evil", position: "Chair", email: "evil@example.test" }],
      members: [],
      createdAt: "2001-01-01T00:00:00.000Z",
      updatedAt: "2001-01-01T00:00:00.000Z",
      __v: 99,
      isNew: true,
      _doc: { name: "Hijacked" },
      balance: 123456,
    }).replace(/^\{/, '{"__proto__":{"name":"Polluted"},');
    const res = await session.request("chairA", "PATCH", `/societies/${A}`, {
      raw,
      headers: { "Content-Type": "application/json" },
    });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    const after = await stored(A);
    assert.equal(after.name, `Protected ${RUN}`);
    assert.deepEqual(untouched(after), untouched(before));
    assert.equal(after.budget, before.budget);
    assert.equal(await stored(MISSING), null, "a document was created from the body's _id");
    assert.equal(({}).name, undefined, "Object.prototype was polluted");
  });
});

describe("budget follows the existing policy (no new policy)", () => {
  test("an administrator's budget change through this route is stored", async () => {
    const res = await patch("admin", A, { budget: 4321 });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal((await stored(A)).budget, 4321);
    assert.equal((await read("admin", A)).body.data.budget, 4321);
  });

  test("an office bearer's budget value is ignored: not stored, not echoed, other fields still saved", async () => {
    const before = await stored(A);

    const res = await patch("chairA", A, { name: `Budget attempt ${RUN}`, budget: 999999 });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal(res.body.data.budget, before.budget);
    const after = await stored(A);
    assert.equal(after.budget, before.budget);
    assert.equal(after.name, `Budget attempt ${RUN}`);
  });

  test("a body claiming administrator rights does not unlock the budget", async () => {
    const before = await stored(A);

    await patch("chairA", A, { budget: 1, role: "ADMIN", isAdmin: true, user: { role: "ADMIN" } });

    assert.equal((await stored(A)).budget, before.budget);
  });

  test("the dedicated admin-only budget route is unchanged", async () => {
    const asChair = await session.request("chairA", "PATCH", `/societies/${A}/budget`, { body: { budget: 7 } });
    const asAdmin = await session.request("admin", "PATCH", `/societies/${A}/budget`, { body: { budget: 5000 } });

    assert.equal(asChair.status, 403);
    assert.equal(asAdmin.status, 200);
    assert.equal((await stored(A)).budget, 5000);
  });
});

describe("rejected updates change nothing", () => {
  test("an invalid value is a 400 and nothing, including the valid fields sent with it, is stored", async () => {
    const before = await stored(A);

    for (const body of [
      { name: `Should not persist ${RUN}`, type: "NOT_A_TYPE" },
      { name: "" },
      { name: { $ne: "" } },
      { name: ["a"] },
      { description: { a: 1 }, name: `Should not persist ${RUN}` },
    ]) {
      const res = await patch("chairA", A, body);

      assert.equal(res.status, 400, `${JSON.stringify(body)}: ${res.text.slice(0, 200)}`);
      assert.equal(res.body.success, false);
    }
    const after = await stored(A);
    assert.equal(after.name, before.name);
    assert.equal(after.description, before.description);
    assert.equal(after.type, before.type);
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
  });

  test("a negative administrator budget is a 400 and the same request's other fields are not stored", async () => {
    const before = await stored(A);

    const res = await patch("admin", A, { name: `Should not persist ${RUN}`, budget: -5 });

    assert.equal(res.status, 400, res.text.slice(0, 300));
    const after = await stored(A);
    assert.equal(after.name, before.name);
    assert.equal(after.budget, before.budget);
  });

  test("the validation error keeps the application's error contract", async () => {
    const res = await patch("chairA", A, { type: "NOT_A_TYPE" });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "Validation Error");
    assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
  });

  test("the server stays healthy after the rejected requests", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});

describe("authorization is unchanged and denied callers change nothing", () => {
  test("another society's office bearer is 403 and the society is untouched", async () => {
    const before = await stored(B);

    const chairAOnB = await patch("chairA", B, { name: "Hijack", description: "Hijack" });
    const chairBOnA = await patch("chairB", A, { name: "Hijack" });

    assert.equal(chairAOnB.status, 403);
    assert.equal(chairAOnB.body.message, "Access restricted to your own society only.");
    assert.equal(chairBOnA.status, 403);
    const after = await stored(B);
    assert.equal(after.name, before.name);
    assert.equal(after.description, before.description);
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
  });

  test("a caller with no society is 403", async () => {
    const before = await stored(A);

    const res = await patch("loner", A, { name: "Hijack" });

    assert.equal(res.status, 403);
    assert.equal((await stored(A)).name, before.name);
  });

  test("anonymous and invalid-token requests are 401", async () => {
    const before = await stored(A);

    const anonymous = await session.request(null, "PATCH", `/societies/${A}`, { body: { name: "x" } });
    const badToken = await session.request(null, "PATCH", `/societies/${A}`, {
      body: { name: "x" },
      headers: { Authorization: "Bearer not-a-real-token" },
    });

    assert.equal(anonymous.status, 401);
    assert.equal(badToken.status, 401);
    assert.equal((await stored(A)).name, before.name);
  });

  test("a malformed id is 403 for an office bearer and a clean 400 for an administrator", async () => {
    const chair = await patch("chairA", "not-an-object-id", { name: "x" });
    const adminRes = await patch("admin", "not-an-object-id", { name: "x" });

    assert.equal(chair.status, 403);
    assert.equal(adminRes.status, 400);
    assert.equal(adminRes.body.message, "Invalid ID format.");
  });

  test("a nonexistent society is 403 for an office bearer and 404 for an administrator, with nothing created", async () => {
    const before = await withDatabase(target, (db) => db.collection("societies").countDocuments({}));

    const chair = await patch("chairA", MISSING, { name: "x" });
    const adminRes = await patch("admin", MISSING, { name: "x" });

    assert.equal(chair.status, 403);
    assert.equal(adminRes.status, 404);
    assert.equal(adminRes.body.message, "Society not found");
    assert.equal(await withDatabase(target, (db) => db.collection("societies").countDocuments({})), before);
  });
});

describe("RBAC: settings:edit on top of the society scope", () => {
  test("a same-society member without settings:edit is 403 PERMISSION_DENIED and nothing changes", async () => {
    const before = await stored(A);

    const res = await patch("memberA", A, {
      name: `Member attempt ${RUN}`,
      description: "Member attempt",
      type: "COUNCIL",
      budget: 1,
    });

    assert.equal(res.status, 403, res.text.slice(0, 300));
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "PERMISSION_DENIED");
    assert.equal(res.body.data, undefined);
    const after = await stored(A);
    assert.equal(after.name, before.name);
    assert.equal(after.description, before.description);
    assert.equal(after.type, before.type);
    assert.equal(after.budget, before.budget);
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
    assert.deepEqual(untouched(after), untouched(before));
  });

  test("the permission is checked before the payload: invalid input from a member is 403, not 400", async () => {
    const res = await patch("memberA", A, { type: "NOT_A_TYPE", name: "" });

    assert.equal(res.status, 403);
  });

  test("a foreign society's chair holds settings:edit but is still denied by the society scope", async () => {
    const before = await stored(A);

    const res = await patch("chairB", A, { name: `Foreign attempt ${RUN}`, budget: 1 });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, "Access restricted to your own society only.");
    const after = await stored(A);
    assert.equal(after.name, before.name);
    assert.equal(after.budget, before.budget);
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
  });

  test("a society-less user is denied, and so is one with no role", async () => {
    const before = await stored(A);

    const res = await patch("loner", A, { name: `Society-less attempt ${RUN}` });

    assert.equal(res.status, 403);
    assert.equal((await stored(A)).name, before.name);
  });

  test("the authorized chair can update the metadata (the permission is what unlocks it)", async () => {
    const res = await patch("chairA", A, { description: `Chair with settings:edit ${RUN}` });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal((await stored(A)).description, `Chair with settings:edit ${RUN}`);
  });

  test("the authorized chair's metadata is stored while a budget in the same request is not", async () => {
    const before = await stored(A);

    const res = await patch("chairA", A, {
      name: `Chair with budget attempt ${RUN}`,
      type: "COUNCIL",
      budget: 777777,
    });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal(res.body.data.budget, before.budget);
    const after = await stored(A);
    assert.equal(after.name, `Chair with budget attempt ${RUN}`);
    assert.equal(after.type, "COUNCIL");
    assert.equal(after.budget, before.budget);
  });

  test("an administrator keeps cross-society access through the RBAC model", async () => {
    const res = await patch("admin", B, { description: `Admin via RBAC ${RUN}` });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal((await stored(B)).description, `Admin via RBAC ${RUN}`);
  });

  test("the dedicated budget route stays administrator-only, even for a chair holding settings:edit", async () => {
    const before = await stored(A);

    const chair = await session.request("chairA", "PATCH", `/societies/${A}/budget`, { body: { budget: 123 } });
    const member = await session.request("memberA", "PATCH", `/societies/${A}/budget`, { body: { budget: 123 } });
    const admin = await session.request("admin", "PATCH", `/societies/${A}/budget`, { body: { budget: 6000 } });

    assert.equal(chair.status, 403);
    assert.equal(member.status, 403);
    assert.equal(admin.status, 200);
    assert.notEqual(before.budget, 6000);
    assert.equal((await stored(A)).budget, 6000);
  });

  test("malformed ids and invalid payloads keep their established behavior for an authorized chair", async () => {
    const malformed = await patch("chairA", "not-an-object-id", { name: "x" });
    const invalid = await patch("chairA", A, { type: "NOT_A_TYPE" });

    assert.equal(malformed.status, 403); // the scope guard rejects a non-matching id first
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.message, "Validation Error");
  });
});
