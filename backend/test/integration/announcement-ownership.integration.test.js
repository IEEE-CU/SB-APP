"use strict";

/**
 * AUD-022 over HTTP: announcement ownership (routes/announcements.js).
 *
 * Before the fix, ownership was `announcement.senderName === req.user.name`. A
 * display name is not an identity: names are not unique, and any user can change
 * their own through PATCH /users/:id, so any user able to edit or delete
 * announcements could take over anyone else's by sharing their name.
 *
 * Policy under test:
 *   - ownership is the server-assigned createdBy id (never taken from the body);
 *   - an administrator may change any announcement (unchanged); everyone else only
 *     their own; an announcement with no createdBy (created before the field
 *     existed) is administrator-only, with no fallback to the display name;
 *   - senderName is presentation only: administrators may set it, everyone else's
 *     is their own name, and it never changes ownership;
 *   - PATCH holds a non-administrator to the rules that apply on create (no "ALL",
 *     own society only);
 *   - the RBAC permissions announcements:create / edit / delete still apply.
 *
 * Fixtures: chairA (society_chair, society A), chairB (society B), memberA
 * (ieee_member, no announcement permissions), loner (no society or role), admin.
 * chairA2 is a disposable second society_chair in society A (inserted directly,
 * removed afterwards). Legacy announcements (no createdBy) are inserted directly.
 *
 * Every claim is checked against the stored documents. Needs a running harness:
 * TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const { requireHarnessTarget, deleteDisposableUser, withDatabase } = require("./helpers/target");
const { TEST_PASSWORD, USERS } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const { users, societies } = target.ready.fixtures;
const A = societies.A.id;
const B = societies.B.id;

const RUN = Date.now();
const MISSING = "64b7f8f2a1b2c3d4e5f6ffff";
const CHAIR_A_NAME = "Integration Chair A";
const CHAIR_B_NAME = "Integration Chair B";
const CHAIR_A2_EMAIL = `announcement-chair-a2-${RUN}@integration.test`;

let chairA2Id;
let legacy; // { society, leadership }
const tokens = {};

const emailOf = (key) => (key === "chairA2" ? CHAIR_A2_EMAIL : USERS[key].email);
const idOf = (key) => (key === "chairA2" ? chairA2Id : users[key].id);

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
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed, text };
}

const stored = (id) =>
  withDatabase(target, (db, ObjectId) => db.collection("announcements").findOne({ _id: new ObjectId(String(id)) }));
const announcementCount = () => withDatabase(target, (db) => db.collection("announcements").countDocuments({}));

let counter = 0;
const draft = (extra = {}) => ({
  title: `ownership-${RUN}-${++counter}`,
  message: "Body text",
  targetAudience: "SOCIETY",
  societyId: A,
  ...extra,
});
async function createAs(key, extra = {}) {
  const res = await call(key, "POST", "/announcements", draft(extra));
  assert.equal(res.status, 201, `could not create as ${key}: ${res.text.slice(0, 200)}`);
  return res.body.data.id;
}
/** The fields an unauthorized request must leave untouched. */
const snapshot = (doc) =>
  doc && JSON.stringify({ title: doc.title, message: doc.message, senderName: doc.senderName, createdBy: String(doc.createdBy), targetAudience: doc.targetAudience, societyId: String(doc.societyId) });
const rename = (key, name) => call(key, "PATCH", `/users/${idOf(key)}`, { name });

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    const inserted = await db.collection("users").insertOne({
      email: CHAIR_A2_EMAIL,
      password: hash,
      name: "Integration Chair A2",
      role: "OFFICE_BEARER",
      societyId: new ObjectId(A),
      createdAt: now,
      updatedAt: now,
    });
    chairA2Id = String(inserted.insertedId);
    const chairRole = await db.collection("roles").findOne({ name: "society_chair" });
    await db.collection("userroles").insertOne({
      user: inserted.insertedId,
      role: chairRole._id,
      society: new ObjectId(A),
      assignedBy: new ObjectId(users.admin.id),
      assignedAt: now,
    });

    // Legacy announcements: created before createdBy existed, so only a display name.
    const legacyDoc = (targetAudience, extra = {}) => ({
      title: `legacy-${targetAudience}-${RUN}`,
      message: "Created before createdBy existed",
      senderName: CHAIR_A_NAME,
      targetAudience,
      date: new Date("2025-01-01T00:00:00Z"),
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
      ...extra,
    });
    const society = await db.collection("announcements").insertOne(legacyDoc("SOCIETY", { societyId: new ObjectId(A) }));
    const leadership = await db.collection("announcements").insertOne(legacyDoc("LEADERSHIP", { societyId: null }));
    legacy = { society: String(society.insertedId), leadership: String(leadership.insertedId) };
  });
});

after(async () => {
  // Leave the fixture users' names as they were found.
  await rename("chairB", CHAIR_B_NAME);
  await withDatabase(target, (db, ObjectId) => db.collection("userroles").deleteOne({ user: new ObjectId(chairA2Id) }));
  await deleteDisposableUser(target, chairA2Id, CHAIR_A2_EMAIL);
});

// ---- authentication and RBAC are unchanged ---------------------------------------

describe("authentication and permissions", () => {
  test("anonymous callers cannot create, update or delete", async () => {
    const id = await createAs("chairA");
    const before = snapshot(await stored(id));
    const count = await announcementCount();

    const create = await call(null, "POST", "/announcements", draft());
    const update = await call(null, "PATCH", `/announcements/${id}`, { title: "x" });
    const remove = await call(null, "DELETE", `/announcements/${id}`);

    assert.equal(create.status, 401);
    assert.equal(update.status, 401);
    assert.equal(remove.status, 401);
    assert.equal(snapshot(await stored(id)), before);
    assert.equal(await announcementCount(), count);
  });

  test("users without announcement permissions cannot mutate", async () => {
    const id = await createAs("chairA");
    const before = snapshot(await stored(id));
    const count = await announcementCount();

    for (const key of ["memberA", "loner"]) {
      const create = await call(key, "POST", "/announcements", draft());
      const update = await call(key, "PATCH", `/announcements/${id}`, { title: "x" });
      const remove = await call(key, "DELETE", `/announcements/${id}`);

      for (const res of [create, update, remove]) assert.equal(res.status, 403, key);
    }
    assert.equal(snapshot(await stored(id)), before);
    assert.equal(await announcementCount(), count);
  });
});

// ---- creation assigns the owner on the server ---------------------------------------

describe("creation", () => {
  test("createdBy is the caller and the sender name is the caller's own, whatever the body says", async () => {
    const res = await call("chairA", "POST", "/announcements", draft({
      senderName: "Dean of Engineering",
      createdBy: users.admin.id,
      ownerId: users.admin.id,
      userId: users.admin.id,
    }));

    assert.equal(res.status, 201, res.text.slice(0, 300));
    const doc = await stored(res.body.data.id);
    assert.equal(String(doc.createdBy), users.chairA.id);
    assert.equal(doc.senderName, CHAIR_A_NAME);
    assert.equal(doc.ownerId, undefined);
    assert.equal(doc.userId, undefined);
  });

  test("impersonating another user's name on create does not work for a non-administrator", async () => {
    const res = await call("chairB", "POST", "/announcements", draft({
      societyId: B,
      senderName: CHAIR_A_NAME,
    }));

    assert.equal(res.status, 201, res.text.slice(0, 300));
    const doc = await stored(res.body.data.id);
    assert.equal(doc.senderName, CHAIR_B_NAME);
    assert.equal(String(doc.createdBy), users.chairB.id);
  });

  test("an administrator may post under an institutional sender name and is still the recorded creator", async () => {
    const res = await call("admin", "POST", "/announcements", draft({
      targetAudience: "ALL",
      societyId: undefined,
      senderName: "Dean of Engineering",
    }));

    assert.equal(res.status, 201, res.text.slice(0, 300));
    const doc = await stored(res.body.data.id);
    assert.equal(doc.senderName, "Dean of Engineering");
    assert.equal(String(doc.createdBy), users.admin.id);
  });

  test("the audience rules for office bearers are unchanged", async () => {
    const count = await announcementCount();

    const all = await call("chairA", "POST", "/announcements", draft({ targetAudience: "ALL" }));
    const foreign = await call("chairA", "POST", "/announcements", draft({ societyId: B }));
    const invalid = await call("chairA", "POST", "/announcements", draft({ targetAudience: "EVERYONE" }));
    const leadership = await call("chairA", "POST", "/announcements", draft({ targetAudience: "LEADERSHIP" }));

    assert.equal(all.status, 403);
    assert.equal(foreign.status, 403);
    assert.equal(invalid.status, 400);
    assert.equal(leadership.status, 201, leadership.text.slice(0, 200));
    assert.equal(await announcementCount(), count + 1);
  });
});

// ---- the creator and administrators keep their access ---------------------------------

describe("the creator and administrators", () => {
  test("the creator can update and delete their announcement", async () => {
    const id = await createAs("chairA");

    const update = await call("chairA", "PATCH", `/announcements/${id}`, { title: "Edited by creator", message: "New text" });
    assert.equal(update.status, 200, update.text.slice(0, 200));
    assert.equal((await stored(id)).title, "Edited by creator");
    assert.equal(update.body.data.content, "New text", "the content mapping is unchanged");

    const remove = await call("chairA", "DELETE", `/announcements/${id}`);
    assert.equal(remove.status, 200);
    assert.deepEqual(remove.body, { success: true, message: "Announcement deleted" });
    assert.equal(await stored(id), null);
  });

  test("an administrator can update and delete any announcement, in any society, without taking over ownership", async () => {
    const id = await createAs("chairA");

    const update = await call("admin", "PATCH", `/announcements/${id}`, { title: "Edited by admin", createdBy: users.admin.id });
    assert.equal(update.status, 200, update.text.slice(0, 200));
    const doc = await stored(id);
    assert.equal(doc.title, "Edited by admin");
    assert.equal(String(doc.createdBy), users.chairA.id, "an administrator's edit changed the owner");

    const remove = await call("admin", "DELETE", `/announcements/${id}`);
    assert.equal(remove.status, 200);
    assert.equal(await stored(id), null);
  });
});

// ---- the vulnerability: a matching display name is not ownership ----------------------

describe("a matching display name does not give ownership", () => {
  test("a user who renames themselves to the creator's name cannot update or delete (end to end)", async () => {
    const id = await createAs("chairA");
    const before = snapshot(await stored(id));

    const renamed = await rename("chairB", CHAIR_A_NAME); // the real profile endpoint
    assert.equal(renamed.status, 200, renamed.text.slice(0, 200));
    assert.equal(renamed.body.data.name, CHAIR_A_NAME);

    const update = await call("chairB", "PATCH", `/announcements/${id}`, { title: "Hijacked" });
    const remove = await call("chairB", "DELETE", `/announcements/${id}`);

    assert.equal(update.status, 403, update.text.slice(0, 200));
    assert.equal(remove.status, 403, remove.text.slice(0, 200));
    assert.equal(update.body.message, "You can only update your own announcements");
    assert.equal(snapshot(await stored(id)), before);
    assert.ok(await stored(id), "the announcement was deleted");

    await rename("chairB", CHAIR_B_NAME);
  });

  test("a user in the same society with an identical name cannot update or delete either", async () => {
    const id = await createAs("chairA");
    const before = snapshot(await stored(id));
    await rename("chairA2", CHAIR_A_NAME);

    const update = await call("chairA2", "PATCH", `/announcements/${id}`, { title: "Hijacked" });
    const remove = await call("chairA2", "DELETE", `/announcements/${id}`);

    assert.equal(update.status, 403);
    assert.equal(remove.status, 403);
    assert.equal(snapshot(await stored(id)), before);
  });

  test("the creator keeps their access after renaming themselves", async () => {
    const id = await createAs("chairA");
    await rename("chairA", "Pat Renamed Chair");

    const update = await call("chairA", "PATCH", `/announcements/${id}`, { title: "Still mine" });

    assert.equal(update.status, 200, update.text.slice(0, 200));
    assert.equal((await stored(id)).title, "Still mine");
    await rename("chairA", CHAIR_A_NAME);
  });

  test("changing senderName does not transfer ownership, and only an administrator can change it", async () => {
    const id = await createAs("chairA");

    const byOwner = await call("chairA", "PATCH", `/announcements/${id}`, { senderName: CHAIR_B_NAME });
    assert.equal(byOwner.status, 200);
    assert.equal((await stored(id)).senderName, CHAIR_A_NAME, "a non-administrator changed the sender name");

    const byAdmin = await call("admin", "PATCH", `/announcements/${id}`, { senderName: CHAIR_B_NAME });
    assert.equal(byAdmin.status, 200);
    assert.equal((await stored(id)).senderName, CHAIR_B_NAME);

    // The name now says "Integration Chair B", yet chair B is not the owner.
    const takeover = await call("chairB", "PATCH", `/announcements/${id}`, { title: "Hijacked" });
    assert.equal(takeover.status, 403);
    // ...and the real creator still is.
    const stillOwner = await call("chairA", "PATCH", `/announcements/${id}`, { title: "Mine" });
    assert.equal(stillOwner.status, 200);
  });

  test("forged owner or creator identifiers in the body cannot take over an announcement", async () => {
    const id = await createAs("chairA");
    const before = snapshot(await stored(id));
    const forged = { createdBy: users.chairB.id, ownerId: users.chairB.id, userId: users.chairB.id, owner: users.chairB.id, senderName: CHAIR_A_NAME };

    const byOther = await call("chairB", "PATCH", `/announcements/${id}`, { ...forged, title: "Hijacked" });
    assert.equal(byOther.status, 403);
    assert.equal(snapshot(await stored(id)), before);

    const byOwner = await call("chairA", "PATCH", `/announcements/${id}`, { ...forged, title: "Edited" });
    assert.equal(byOwner.status, 200);
    assert.equal(String((await stored(id)).createdBy), users.chairA.id, "ownership was transferred through the body");
    const afterTransfer = await call("chairB", "DELETE", `/announcements/${id}`);
    assert.equal(afterTransfer.status, 403);
    assert.ok(await stored(id));
  });
});

// ---- society boundaries ------------------------------------------------------------------

describe("society boundaries", () => {
  test("another society's office bearer cannot update or delete, whatever they are called", async () => {
    const id = await createAs("chairA");
    const before = snapshot(await stored(id));

    const update = await call("chairB", "PATCH", `/announcements/${id}`, { title: "Hijacked" });
    const remove = await call("chairB", "DELETE", `/announcements/${id}`);

    assert.equal(update.status, 403);
    assert.equal(remove.status, 403);
    assert.equal(snapshot(await stored(id)), before);
  });

  test("a creator cannot retarget their announcement to everyone or to another society", async () => {
    const id = await createAs("chairA");
    const before = snapshot(await stored(id));

    const toAll = await call("chairA", "PATCH", `/announcements/${id}`, { targetAudience: "ALL" });
    const toOther = await call("chairA", "PATCH", `/announcements/${id}`, { targetAudience: "SOCIETY", societyId: B });
    const societyOnly = await call("chairA", "PATCH", `/announcements/${id}`, { societyId: B });

    assert.equal(toAll.status, 403);
    assert.equal(toOther.status, 403);
    assert.equal(societyOnly.status, 403);
    assert.equal(snapshot(await stored(id)), before);
  });

  test("allowed retargeting still works, and an administrator may use ALL", async () => {
    const id = await createAs("chairA");

    const leadership = await call("chairA", "PATCH", `/announcements/${id}`, { targetAudience: "LEADERSHIP" });
    assert.equal(leadership.status, 200, leadership.text.slice(0, 200));
    assert.equal((await stored(id)).targetAudience, "LEADERSHIP");

    const everyone = await call("admin", "PATCH", `/announcements/${id}`, { targetAudience: "ALL" });
    assert.equal(everyone.status, 200, everyone.text.slice(0, 200));
    assert.equal((await stored(id)).targetAudience, "ALL");
  });
});

// ---- legacy announcements --------------------------------------------------------------------

describe("legacy announcements without a recorded owner", () => {
  test("do not become writable through a matching display name", async () => {
    const before = [snapshot(await stored(legacy.society)), snapshot(await stored(legacy.leadership))];

    for (const key of ["chairA", "chairA2", "chairB"]) {
      for (const id of [legacy.society, legacy.leadership]) {
        const update = await call(key, "PATCH", `/announcements/${id}`, { title: "Hijacked" });
        const remove = await call(key, "DELETE", `/announcements/${id}`);

        assert.equal(update.status, 403, `${key} update`);
        assert.equal(remove.status, 403, `${key} delete`);
        assert.match(update.body.message, /no recorded owner/);
      }
    }
    // chairA2 may have been renamed to the legacy sender name; chairA already has it.
    assert.deepEqual([snapshot(await stored(legacy.society)), snapshot(await stored(legacy.leadership))], before);
  });

  test("remain readable, and an administrator can still manage them without inventing an owner", async () => {
    const list = await call("chairA", "GET", "/announcements?limit=200");
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((a) => a.id === legacy.society));
    const detail = await call("chairA", "GET", `/announcements/${legacy.society}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.senderName, CHAIR_A_NAME);
    assert.equal(detail.body.data.createdBy, undefined);

    const update = await call("admin", "PATCH", `/announcements/${legacy.society}`, { title: "Fixed by admin" });
    assert.equal(update.status, 200, update.text.slice(0, 200));
    const doc = await stored(legacy.society);
    assert.equal(doc.title, "Fixed by admin");
    assert.equal(doc.createdBy, undefined, "an owner was invented");

    const remove = await call("admin", "DELETE", `/announcements/${legacy.leadership}`);
    assert.equal(remove.status, 200);
    assert.equal(await stored(legacy.leadership), null);
  });
});

// ---- ids and compatibility ---------------------------------------------------------------------

describe("ids and existing behavior", () => {
  test("malformed and unknown ids keep their established responses and change nothing", async () => {
    const count = await announcementCount();

    const patchBad = await call("chairA", "PATCH", "/announcements/not-an-object-id", { title: "x" });
    const deleteBad = await call("chairA", "DELETE", "/announcements/not-an-object-id");
    const patchMissing = await call("chairA", "PATCH", `/announcements/${MISSING}`, { title: "x" });
    const deleteMissing = await call("chairA", "DELETE", `/announcements/${MISSING}`);

    assert.equal(patchBad.status, 400);
    assert.equal(deleteBad.status, 400);
    assert.equal(patchMissing.status, 404);
    assert.equal(deleteMissing.status, 404);
    assert.equal(patchMissing.body.message, "Announcement not found");
    assert.equal(await announcementCount(), count);
  });

  test("the list and detail responses keep their shapes", async () => {
    const id = await createAs("chairA");

    const list = await call("chairA", "GET", "/announcements");
    const detail = await call("chairA", "GET", `/announcements/${id}`);

    assert.deepEqual(Object.keys(list.body).sort(), ["count", "data", "success"]);
    assert.equal(list.body.count, list.body.data.length);
    assert.deepEqual(Object.keys(detail.body).sort(), ["data", "success"]);
    for (const field of ["id", "title", "message", "content", "senderName", "targetAudience", "date"]) {
      assert.ok(field in detail.body.data, field);
    }
    assert.equal(detail.body.data.societyId.name, "Integration Society A");
  });

  test("the server stays healthy", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});
