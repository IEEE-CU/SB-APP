"use strict";

/**
 * AUD-022 follow-up over HTTP: who may READ an announcement by id.
 *
 * GET /announcements/:id used to return any announcement to any authenticated user
 * while GET /announcements filtered by audience and society. Both now use one rule
 * (visibilityFilter in routes/announcements.js):
 *   - administrators see everything;
 *   - office bearers see ALL, LEADERSHIP, and SOCIETY announcements of their own
 *     society; nothing else (including announcements with a missing or unknown
 *     audience);
 *   - an announcement the caller may not see is a 404, identical to a nonexistent
 *     one, so an id reveals nothing.
 * Visibility is about the audience, not the creator; the AUD-022 ownership checks on
 * PATCH/DELETE are unchanged.
 *
 * Fixtures: admin; chairA and memberA (society A); chairB (society B); loner (no
 * society). In this application every non-administrator has the legacy role
 * OFFICE_BEARER, so "LEADERSHIP" announcements are visible to all of them. Records are
 * inserted directly, including incomplete legacy ones.
 *
 * A user with no society sees ALL and LEADERSHIP announcements only. They never see a
 * SOCIETY announcement, in particular not one whose society is null or missing (an
 * orphaned record): they have no society to match, and the record belongs to none.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { users, societies } = target.ready.fixtures;
const A = societies.A.id;
const B = societies.B.id;

const RUN = Date.now();
const MISSING = "64b7f8f2a1b2c3d4e5f6ffff";
const USER_KEYS = ["admin", "chairA", "memberA", "chairB", "loner"];

const seeded = {}; // name -> { id, title, message }

const get = (key, route) => session.request(key, "GET", route);
const nameOf = (title) => Object.keys(seeded).find((n) => seeded[n].title === title);

async function visibleByList(key) {
  const res = await get(key, "/announcements?limit=100");
  assert.equal(res.status, 200, `${key} list: ${res.text.slice(0, 160)}`);
  return new Set(res.body.data.map((a) => nameOf(a.title)).filter(Boolean));
}
async function visibleByDetail(key) {
  const visible = new Set();
  for (const [name, record] of Object.entries(seeded)) {
    const res = await get(key, `/announcements/${record.id}`);
    assert.ok([200, 404].includes(res.status), `${key} ${name}: ${res.status}`);
    if (res.status === 200) visible.add(name);
  }
  return visible;
}
const sorted = (set) => [...set].sort();

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const record = (name, fields) => ({
      title: `vis-${RUN}-${name}`,
      message: `SECRET-BODY-${RUN}-${name}`,
      senderName: "Seeded Sender",
      date: now,
      createdAt: now,
      updatedAt: now,
      ...fields,
    });
    const defs = {
      all: { targetAudience: "ALL", societyId: null },
      leadership: { targetAudience: "LEADERSHIP", societyId: null },
      societyA: { targetAudience: "SOCIETY", societyId: new ObjectId(A) },
      societyB: { targetAudience: "SOCIETY", societyId: new ObjectId(B) },
      // incomplete legacy records
      societyNullSociety: { targetAudience: "SOCIETY", societyId: null },
      societyNoSocietyField: { targetAudience: "SOCIETY" },
      noAudience: { societyId: new ObjectId(A) },
      unknownAudience: { targetAudience: "SECRET", societyId: new ObjectId(A) },
    };
    for (const [name, fields] of Object.entries(defs)) {
      const doc = record(name, fields);
      const inserted = await db.collection("announcements").insertOne(doc);
      seeded[name] = { id: String(inserted.insertedId), title: doc.title, message: doc.message };
    }
  });
});

after(async () => {
  await withDatabase(target, (db, ObjectId) =>
    db.collection("users").updateOne({ _id: new ObjectId(users.chairA.id) }, { $set: { societyId: new ObjectId(A) } }),
  );
});

// ---- well-formed announcements -----------------------------------------------------

describe("who can read which announcement by id", () => {
  const EXPECTED = {
    chairA: ["all", "leadership", "societyA"],
    memberA: ["all", "leadership", "societyA"],
    chairB: ["all", "leadership", "societyB"],
    loner: ["all", "leadership"],
  };

  for (const [key, names] of Object.entries(EXPECTED)) {
    test(`${key} can read ${names.join(", ")} and nothing restricted for others`, async () => {
      for (const name of ["all", "leadership", "societyA", "societyB"]) {
        const res = await get(key, `/announcements/${seeded[name].id}`);

        assert.equal(res.status, names.includes(name) ? 200 : 404, `${key} -> ${name}: ${res.text.slice(0, 160)}`);
      }
    });
  }

  test("an administrator can read every announcement, in every society", async () => {
    for (const name of Object.keys(seeded)) {
      const res = await get("admin", `/announcements/${seeded[name].id}`);

      assert.equal(res.status, 200, name);
      assert.equal(res.body.data.title, seeded[name].title);
    }
  });

  test("another society's announcement cannot be read by id, and nothing of it leaks", async () => {
    const res = await get("chairB", `/announcements/${seeded.societyA.id}`);

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { success: false, message: "Announcement not found" });
    assert.ok(!res.text.includes(seeded.societyA.title) && !res.text.includes(seeded.societyA.message));
    assert.ok(!res.text.includes(A), "the society id leaked");
  });

  test("a society-less user cannot read a society's announcement by id", async () => {
    for (const name of ["societyA", "societyB"]) {
      const res = await get("loner", `/announcements/${seeded[name].id}`);

      assert.equal(res.status, 404, name);
      assert.ok(!res.text.includes(seeded[name].message));
    }
  });
});

// ---- incomplete legacy records ---------------------------------------------------------

describe("announcements with incomplete audience metadata", () => {
  test("a missing or unknown audience is visible only to administrators", async () => {
    for (const name of ["noAudience", "unknownAudience"]) {
      for (const key of ["chairA", "memberA", "chairB", "loner"]) {
        const res = await get(key, `/announcements/${seeded[name].id}`);

        assert.equal(res.status, 404, `${key} -> ${name}`);
      }
      assert.equal((await get("admin", `/announcements/${seeded[name].id}`)).status, 200, name);
    }
  });

  test("a SOCIETY announcement with no society is hidden from users who have a society", async () => {
    for (const name of ["societyNullSociety", "societyNoSocietyField"]) {
      for (const key of ["chairA", "memberA", "chairB"]) {
        const res = await get(key, `/announcements/${seeded[name].id}`);

        assert.equal(res.status, 404, `${key} -> ${name}`);
      }
      assert.equal((await get("admin", `/announcements/${seeded[name].id}`)).status, 200, name);
    }
  });
});

// ---- users without a society ---------------------------------------------------------------

describe("users without a society", () => {
  const ORPHANS = ["societyNullSociety", "societyNoSocietyField"];

  test("the list shows ALL and LEADERSHIP only, and no orphaned SOCIETY announcement", async () => {
    const visible = await visibleByList("loner");

    assert.deepEqual(sorted(visible), ["all", "leadership"]);
    for (const name of ORPHANS) assert.ok(!visible.has(name), name);
  });

  test("a SOCIETY announcement with a null or missing society is the same 404 as a nonexistent one", async () => {
    const missing = await get("loner", `/announcements/${MISSING}`);

    for (const name of ORPHANS) {
      const res = await get("loner", `/announcements/${seeded[name].id}`);

      assert.equal(res.status, 404, name);
      assert.deepEqual(res.body, missing.body, name);
      assert.ok(!res.text.includes(seeded[name].title) && !res.text.includes(seeded[name].message), name);
    }
  });

  test("they can still read ALL and LEADERSHIP announcements by id", async () => {
    for (const name of ["all", "leadership"]) {
      const res = await get("loner", `/announcements/${seeded[name].id}`);

      assert.equal(res.status, 200, name);
      assert.equal(res.body.data.title, seeded[name].title);
    }
  });

  test("every other record with a society or an incomplete audience stays hidden from them", async () => {
    for (const name of ["societyA", "societyB", "noAudience", "unknownAudience"]) {
      const res = await get("loner", `/announcements/${seeded[name].id}`);

      assert.equal(res.status, 404, name);
    }
  });

  test("administrators still see the orphaned records, and users with a society still do not", async () => {
    for (const name of ORPHANS) {
      assert.equal((await get("admin", `/announcements/${seeded[name].id}`)).status, 200, name);
      assert.ok((await visibleByList("admin")).has(name), name);
      for (const key of ["chairA", "memberA", "chairB"]) {
        assert.equal((await get(key, `/announcements/${seeded[name].id}`)).status, 404, `${key} -> ${name}`);
      }
    }
  });
});

// ---- the detail and the list agree -----------------------------------------------------

describe("the detail and the list apply the same rule", () => {
  for (const key of USER_KEYS) {
    test(`${key}: an announcement is readable by id exactly when the list shows it`, async () => {
      const byList = await visibleByList(key);
      const byDetail = await visibleByDetail(key);

      assert.deepEqual(sorted(byDetail), sorted(byList), `${key}: list=${sorted(byList)} detail=${sorted(byDetail)}`);
    });
  }

  test("the list's filtering is unchanged for users who have a society", async () => {
    assert.deepEqual(sorted(await visibleByList("chairA")), ["all", "leadership", "societyA"]);
    assert.deepEqual(sorted(await visibleByList("chairB")), ["all", "leadership", "societyB"]);
    assert.deepEqual(sorted(await visibleByList("admin")), Object.keys(seeded).sort());
    assert.deepEqual(sorted(await visibleByList("loner")), ["all", "leadership"]);
    assert.deepEqual(sorted(await visibleByList("memberA")), ["all", "leadership", "societyA"]);
  });
});

// ---- ids, authentication, response shape --------------------------------------------------

describe("ids, authentication and the response", () => {
  test("a malformed id is a clean 400 and a nonexistent id is a 404 identical to a hidden one", async () => {
    const malformed = await get("chairA", "/announcements/not-an-object-id");
    const missing = await get("chairA", `/announcements/${MISSING}`);
    const hidden = await get("chairA", `/announcements/${seeded.societyB.id}`);

    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.message, "Invalid ID format.");
    assert.equal(missing.status, 404);
    assert.deepEqual(hidden.body, missing.body);
  });

  test("anonymous callers get 401 on the detail and the list", async () => {
    const detail = await session.request(null, "GET", `/announcements/${seeded.all.id}`);
    const list = await session.request(null, "GET", "/announcements");

    assert.equal(detail.status, 401);
    assert.equal(list.status, 401);
    assert.ok(!detail.text.includes(seeded.all.message));
  });

  test("an authorized caller gets the unchanged response shape", async () => {
    const res = await get("chairA", `/announcements/${seeded.societyA.id}`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
    for (const field of ["id", "title", "message", "content", "senderName", "targetAudience", "date", "societyId"]) {
      assert.ok(field in res.body.data, field);
    }
    assert.equal(res.body.data.content, seeded.societyA.message);
    assert.equal(res.body.data.societyId.name, "Integration Society A");
  });
});

// ---- ownership is separate from visibility, and unchanged ----------------------------------

describe("ownership and visibility are separate", () => {
  test("a creator who is no longer in the announcement's society cannot read it by id", async () => {
    const created = await session.request("chairA", "POST", "/announcements", {
      body: { title: `vis-${RUN}-owned`, message: "owned", targetAudience: "SOCIETY", societyId: A },
    });
    assert.equal(created.status, 201, created.text.slice(0, 200));
    const id = created.body.data.id;
    assert.equal((await get("chairA", `/announcements/${id}`)).status, 200);

    await withDatabase(target, (db, ObjectId) =>
      db.collection("users").updateOne({ _id: new ObjectId(users.chairA.id) }, { $set: { societyId: new ObjectId(B) } }),
    );
    try {
      const asCreator = await get("chairA", `/announcements/${id}`);
      assert.equal(asCreator.status, 404, "ownership granted read access");
    } finally {
      await withDatabase(target, (db, ObjectId) =>
        db.collection("users").updateOne({ _id: new ObjectId(users.chairA.id) }, { $set: { societyId: new ObjectId(A) } }),
      );
    }
    assert.equal((await get("chairA", `/announcements/${id}`)).status, 200);
  });

  test("the AUD-022 mutation rules still apply", async () => {
    const created = await session.request("chairA", "POST", "/announcements", {
      body: { title: `vis-${RUN}-mutation`, message: "m", targetAudience: "SOCIETY", societyId: A },
    });
    const id = created.body.data.id;

    const byOther = await session.request("chairB", "PATCH", `/announcements/${id}`, { body: { title: "Hijacked" } });
    const deleteByOther = await session.request("chairB", "DELETE", `/announcements/${id}`);
    const byOwner = await session.request("chairA", "PATCH", `/announcements/${id}`, { body: { title: "Edited" } });
    const deleteByOwner = await session.request("chairA", "DELETE", `/announcements/${id}`);

    assert.equal(byOther.status, 403);
    assert.equal(deleteByOther.status, 403);
    assert.equal(byOwner.status, 200, byOwner.text.slice(0, 200));
    assert.equal(deleteByOwner.status, 200);
  });

  test("the server stays healthy", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});
