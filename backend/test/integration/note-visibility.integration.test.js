"use strict";

/**
 * AUD-032 over HTTP: Note.isPublic decides who may READ a note.
 *
 * Before the fix the list and GET /:noteId returned every note of the society to anyone
 * with community_hub:view, and any caller with community_hub:edit/delete could change or
 * delete another user's private note. Now (routes/notes.js):
 *   - public notes (isPublic true, or the field missing): every caller that passes the
 *     permission and society checks;
 *   - private notes (false; also null, which is treated as private): the author and
 *     administrators only; anyone else gets the same 404 as for a missing note;
 *   - the list and the detail share one rule; mutations still need the existing
 *     community_hub permissions and society scope; visibility changes need author/admin.
 *
 * Fixtures: admin (global advisor); chairA (full hub permissions, society A); memberA
 * (hub view/create only, society A); chairB (society B). Notes are inserted directly,
 * including legacy ones with a missing or null isPublic.
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
const seeded = {}; // name -> id

const call = (key, method, route, body) => session.request(key, method, route, body === undefined ? {} : { body });
const titleOf = (name) => `note-${RUN}-${name}`;
const nameOf = (title) => Object.keys(seeded).find((n) => titleOf(n) === title);

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const oid = (id) => new ObjectId(id);
    const defs = {
      publicByMember: { societyId: A, authorId: users.memberA.id, isPublic: true },
      privateByMember: { societyId: A, authorId: users.memberA.id, isPublic: false },
      privateByChair: { societyId: A, authorId: users.chairA.id, isPublic: false },
      legacyMissing: { societyId: A, authorId: users.memberA.id }, // no isPublic field
      legacyNull: { societyId: A, authorId: users.memberA.id, isPublic: null },
      publicB: { societyId: B, authorId: users.chairB.id, isPublic: true },
      privateB: { societyId: B, authorId: users.chairB.id, isPublic: false },
    };
    for (const [name, def] of Object.entries(defs)) {
      const result = await db.collection("notes").insertOne({
        title: titleOf(name),
        content: `SECRET-${RUN}-${name}`,
        societyId: oid(def.societyId),
        channelId: null,
        authorId: oid(def.authorId),
        ...(def.isPublic !== undefined ? { isPublic: def.isPublic } : {}),
        createdAt: now,
        updatedAt: now,
      });
      seeded[name] = String(result.insertedId);
    }
  });
});

after(async () => {
  await withDatabase(target, (db) => db.collection("notes").deleteMany({ title: new RegExp(`^note-${RUN}-`) }));
});

const rawNote = (name) =>
  withDatabase(target, (db, ObjectId) => db.collection("notes").findOne({ _id: new ObjectId(seeded[name]) }));

async function listed(key, societyId) {
  const res = await call(key, "GET", `/societies/${societyId}/notes`);
  assert.equal(res.status, 200, `${key} list: ${res.text.slice(0, 160)}`);
  assert.equal(res.body.count, res.body.data.length);
  return new Set(res.body.data.map((n) => nameOf(n.title)).filter(Boolean));
}
async function readable(key, societyId) {
  const visible = new Set();
  for (const [name, id] of Object.entries(seeded)) {
    const res = await call(key, "GET", `/societies/${societyId}/notes/${id}`);
    assert.ok([200, 403, 404].includes(res.status), `${key} ${name}: ${res.status}`);
    if (res.status === 200) visible.add(name);
  }
  return visible;
}
const sorted = (set) => [...set].sort();

describe("who can read which note", () => {
  const SOCIETY_A_PUBLIC = ["legacyMissing", "publicByMember"];
  const EXPECTED = {
    memberA: [...SOCIETY_A_PUBLIC, "privateByMember", "legacyNull"], // their own, incl. the null legacy one
    chairA: [...SOCIETY_A_PUBLIC, "privateByChair"],
    admin: [...SOCIETY_A_PUBLIC, "privateByMember", "privateByChair", "legacyNull"],
  };

  for (const [key, expected] of Object.entries(EXPECTED)) {
    test(`${key}: the list shows exactly the permitted notes of society A`, async () => {
      assert.deepEqual(sorted(await listed(key, A)), [...expected].sort());
    });
    test(`${key}: reading by id shows exactly the same notes as the list`, async () => {
      assert.deepEqual(sorted(await readable(key, A)), sorted(await listed(key, A)));
    });
  }

  test("the administrator sees society B notes too, private ones included", async () => {
    assert.deepEqual(sorted(await listed("admin", B)), ["privateB", "publicB"]);
  });

  test("a hidden private note is a 404 identical to a nonexistent one", async () => {
    const hidden = await call("chairA", "GET", `/societies/${A}/notes/${seeded.privateByMember}`);
    const missing = await call("chairA", "GET", `/societies/${A}/notes/${MISSING}`);

    assert.equal(hidden.status, 404);
    assert.deepEqual(hidden.body, missing.body);
    assert.equal(hidden.text.includes("SECRET"), false);
  });

  test("a user outside the society cannot read its notes, public or private", async () => {
    const list = await call("chairB", "GET", `/societies/${A}/notes`);
    const publicNote = await call("chairB", "GET", `/societies/${A}/notes/${seeded.publicByMember}`);
    const privateNote = await call("chairB", "GET", `/societies/${A}/notes/${seeded.privateByMember}`);

    assert.equal(list.status, 403);
    assert.equal(publicNote.status, 403);
    assert.ok([403, 404].includes(privateNote.status));
    assert.equal(privateNote.text.includes("SECRET"), false);
    assert.equal(list.text.includes("SECRET"), false);
  });

  test("anonymous requests are rejected", async () => {
    assert.equal((await call(null, "GET", `/societies/${A}/notes`)).status, 401);
    assert.equal((await call(null, "GET", `/societies/${A}/notes/${seeded.publicByMember}`)).status, 401);
  });

  test("response shapes are unchanged", async () => {
    const list = await call("chairA", "GET", `/societies/${A}/notes`);
    const detail = await call("chairA", "GET", `/societies/${A}/notes/${seeded.publicByMember}`);

    assert.deepEqual(Object.keys(list.body).sort(), ["count", "data", "success"]);
    assert.deepEqual(Object.keys(detail.body).sort(), ["data", "success"]);
    assert.equal(detail.body.data.authorId.email, "member.a@integration.test");
  });
});

describe("mutations", () => {
  test("a user who may not see a private note cannot update or delete it, and nothing changes", async () => {
    const before = await rawNote("privateByMember");

    const put = await call("chairA", "PUT", `/societies/${A}/notes/${seeded.privateByMember}`, { title: "hijacked", isPublic: true });
    const del = await call("chairA", "DELETE", `/societies/${A}/notes/${seeded.privateByMember}`);

    assert.equal(put.status, 404);
    assert.equal(del.status, 404);
    const after = await rawNote("privateByMember");
    assert.equal(after.title, before.title);
    assert.equal(after.isPublic, false);
  });

  test("a user who may see a note still needs the edit and delete permissions", async () => {
    const put = await call("memberA", "PUT", `/societies/${A}/notes/${seeded.privateByMember}`, { title: "x" });
    const del = await call("memberA", "DELETE", `/societies/${A}/notes/${seeded.privateByMember}`);

    assert.equal(put.status, 403);
    assert.equal(del.status, 403);
    assert.ok(await rawNote("privateByMember"));
  });

  test("a non-author cannot change the visibility of a public note they can edit", async () => {
    const res = await call("chairA", "PUT", `/societies/${A}/notes/${seeded.publicByMember}`, { isPublic: false });

    assert.equal(res.status, 403);
    assert.equal((await rawNote("publicByMember")).isPublic, true);
  });

  test("a non-boolean isPublic is rejected", async () => {
    const res = await call("chairA", "PUT", `/societies/${A}/notes/${seeded.privateByChair}`, { isPublic: "yes" });

    assert.equal(res.status, 400);
    assert.equal((await rawNote("privateByChair")).isPublic, false);
  });

  test("the author can publish their own private note, and then others can read it", async () => {
    const res = await call("chairA", "PUT", `/societies/${A}/notes/${seeded.privateByChair}`, { isPublic: true });
    assert.equal(res.status, 200, res.text.slice(0, 160));

    assert.equal((await call("memberA", "GET", `/societies/${A}/notes/${seeded.privateByChair}`)).status, 200);
  });

  test("create takes authorship from the session and ignores a forged author, society and defaults to public", async () => {
    const res = await call("chairA", "POST", `/societies/${A}/notes`, {
      title: titleOf("created"),
      content: "c",
      authorId: users.chairB.id,
    });
    assert.equal(res.status, 201, res.text.slice(0, 160));
    seeded.created = res.body.data._id;

    const stored = await rawNote("created");
    assert.equal(String(stored.authorId), users.chairA.id);
    assert.equal(stored.isPublic, true);
    assert.equal((await call("chairA", "POST", `/societies/${B}/notes`, { title: "x" })).status, 403);
    assert.equal((await call("chairA", "POST", `/societies/${A}/notes`, { title: "x", isPublic: null })).status, 400);
  });

  test("the author can delete their own note; an administrator can delete any", async () => {
    assert.equal((await call("chairA", "DELETE", `/societies/${A}/notes/${seeded.created}`)).status, 200);
    assert.equal((await call("admin", "DELETE", `/societies/${A}/notes/${seeded.privateByMember}`)).status, 200);
    assert.equal(await rawNote("privateByMember"), null);
  });
});
