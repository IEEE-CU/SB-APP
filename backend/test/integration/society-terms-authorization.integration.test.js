"use strict";

/**
 * D-23 and D-21 for society terms over real HTTP.
 *
 * D-23 - PATCH /societies/:id/terms/:termId/handover. Before: the only guard was the society-scope
 * check, so every account of the society (every non-administrator is a legacy OFFICE_BEARER) could
 * change the handover checklist and the term status. Now it also needs the existing RBAC
 * permission settings:edit (the rule PATCH /societies/:id uses; the matrix grants it to
 * society_chair, society_faculty_advisor, sb_chair and sb_faculty_advisor). Administrators
 * (legacy User.role ADMIN) pass without an RBAC role. The term is looked up within the society
 * in the URL, so a term id cannot be used across societies.
 *
 * D-21 - POST /societies/:id/terms for a nonexistent society is a 404 and writes nothing; a
 * malformed society id is a 400. Duplicate and concurrent creation behavior is unchanged (see
 * society-terms.integration.test.js).
 *
 * The shared fixtures define no settings permission, so (as in society-patch.integration.test.js)
 * the file sets up settings:edit and grants it to society_chair; ieee_member keeps nothing.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { societies } = target.ready.fixtures;
const { A, B } = societies;

const RUN = Date.now();
const NOBODY = "64b7f8f2a1b2c3d4e5f6ffff";
let termA;
let termB;
let legacyAdmin;

const handover = (key, societyId, termId, body) =>
  session.request(key, "PATCH", `/societies/${societyId}/terms/${termId}/handover`, { body });
const handoverAs = (token, societyId, termId, body) =>
  session.request(null, "PATCH", `/societies/${societyId}/terms/${termId}/handover`, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
const storedTerm = (id) =>
  withDatabase(target, (db, ObjectId) => db.collection("societyterms").findOne({ _id: new ObjectId(id) }));
const handoverAudits = (termId) =>
  withDatabase(target, (db) =>
    db.collection("auditlogs").countDocuments({ action: "UPDATE_TERM_HANDOVER", "details.termId": { $in: [termId, new (require("mongodb").ObjectId)(termId)] } }),
  );
const termRows = (societyId) =>
  withDatabase(target, (db, ObjectId) => db.collection("societyterms").countDocuments({ society: new ObjectId(societyId) }));
const creationAudits = (societyId) =>
  withDatabase(target, (db) =>
    db.collection("auditlogs").countDocuments({ action: "CREATE_SOCIETY_TERM", "details.societyId": societyId }),
  );

before(async () => {
  for (const key of ["admin", "chairA", "memberA", "chairB", "loner"]) await session.tokenFor(key);

  await withDatabase(target, async (db) => {
    await db.collection("permissions").updateOne(
      { key: "settings:edit" },
      { $setOnInsert: { key: "settings:edit", module: "settings", action: "edit", description: "Allows edit actions in settings module" } },
      { upsert: true },
    );
    const permission = await db.collection("permissions").findOne({ key: "settings:edit" });
    const chairRole = await db.collection("roles").findOne({ name: "society_chair" });
    await db.collection("rolepermissions").updateOne(
      { role: chairRole._id, permission: permission._id },
      { $set: { accessLevel: "limited_own_scope" } },
      { upsert: true },
    );
  });

  // The terms are created through the real route (also exercising the existing-society path).
  const a = await session.request("admin", "POST", `/societies/${A.id}/terms`, { body: { academicYear: `2040-${RUN}` } });
  const b = await session.request("admin", "POST", `/societies/${B.id}/terms`, { body: { academicYear: `2041-${RUN}` } });
  assert.equal(a.status, 201, a.text.slice(0, 200));
  assert.equal(b.status, 201, b.text.slice(0, 200));
  termA = String(a.body.data.id || a.body.data._id);
  termB = String(b.body.data.id || b.body.data._id);

  // A legacy administrator with NO RBAC role at all.
  const email = `terms-legacy-admin-${RUN}@integration.test`;
  const created = await target.registerAccount({ name: "Legacy admin", email, password: "Integration-Test-Pw-2026!" });
  const body = await created.json();
  assert.equal(created.status, 201, JSON.stringify(body).slice(0, 160));
  await withDatabase(target, (db, ObjectId) =>
    db.collection("users").updateOne({ _id: new ObjectId(body.data.user.id) }, { $set: { role: "ADMIN" } }),
  );
  legacyAdmin = body.data.token;
});

describe("D-23: who may change a term's handover", () => {
  test("a holder of settings:edit in the society (the chair) can; only the sent fields change and an audit row is written", async () => {
    const before = await storedTerm(termA);
    const audits = await handoverAudits(termA);

    const res = await handover("chairA", A.id, termA, { reportsSubmitted: true, notes: "chair note" });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    const after = await storedTerm(termA);
    assert.equal(after.handoverChecklist.reportsSubmitted, true);
    assert.equal(after.handoverChecklist.notes, "chair note");
    assert.equal(after.handoverChecklist.balanceReconciled, before.handoverChecklist.balanceReconciled);
    assert.equal(after.handoverChecklist.assetsTransferred, before.handoverChecklist.assetsTransferred);
    assert.equal(after.status, before.status);
    assert.equal(after.allocatedBudget, before.allocatedBudget);
    assert.equal(String(after.society), A.id);
    assert.equal(await handoverAudits(termA), audits + 1);
  });

  test("administrators can: the fixture administrator and a legacy ADMIN with no RBAC role", async () => {
    const viaFixture = await handover("admin", A.id, termA, { assetsTransferred: true });
    const viaLegacy = await handoverAs(legacyAdmin, A.id, termA, { balanceReconciled: true });

    assert.equal(viaFixture.status, 200, viaFixture.text.slice(0, 160));
    assert.equal(viaLegacy.status, 200, viaLegacy.text.slice(0, 160));
    const after = await storedTerm(termA);
    assert.equal(after.handoverChecklist.assetsTransferred, true);
    assert.equal(after.handoverChecklist.balanceReconciled, true);
  });

  test("an ordinary member of the society (no settings:edit) is 403: nothing is written or audited", async () => {
    const before = await storedTerm(termA);
    const audits = await handoverAudits(termA);

    const res = await handover("memberA", A.id, termA, { notes: "member tampering", status: "ARCHIVED_TERM" });

    assert.equal(res.status, 403, res.text.slice(0, 200));
    assert.deepEqual(await storedTerm(termA), before);
    assert.equal(await handoverAudits(termA), audits);
  });

  test("a user with no society and no role is 403, and no token is 401", async () => {
    const before = await storedTerm(termA);

    const loner = await handover("loner", A.id, termA, { notes: "x" });
    const anonymous = await session.request(null, "PATCH", `/societies/${A.id}/terms/${termA}/handover`, { body: { notes: "x" } });

    assert.equal(loner.status, 403);
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await storedTerm(termA), before);
  });

  test("another society's chair (who does hold settings:edit) is refused on this society", async () => {
    const before = await storedTerm(termA);

    const plain = await handover("chairB", A.id, termA, { notes: "foreign" });
    const withBodySociety = await handover("chairB", A.id, termA, { notes: "foreign", societyId: B.id });

    assert.equal(plain.status, 403);
    assert.equal(withBodySociety.status, 403);
    assert.deepEqual(await storedTerm(termA), before);
  });

  test("a term id cannot be used across societies: the term is looked up inside the society of the URL", async () => {
    const beforeA = await storedTerm(termA);
    const beforeB = await storedTerm(termB);

    const bChairWithATerm = await handover("chairB", B.id, termA, { notes: "cross" });
    const aChairWithBTerm = await handover("chairA", A.id, termB, { notes: "cross" });

    assert.equal(bChairWithATerm.status, 404);
    assert.equal(aChairWithBTerm.status, 404);
    assert.deepEqual(await storedTerm(termA), beforeA);
    assert.deepEqual(await storedTerm(termB), beforeB);
  });

  test("malformed society or term ids are refused without a write or a server error", async () => {
    const before = await storedTerm(termA);

    const badSociety = await handover("chairA", "not-an-id", termA, { notes: "x" });
    const badTermAsAdmin = await handover("admin", A.id, "not-an-id", { notes: "x" });
    const unknownTermAsChair = await handover("chairA", A.id, NOBODY, { notes: "x" });

    assert.equal(badSociety.status, 403, "a non-admin cannot name a society other than their own");
    assert.equal(badTermAsAdmin.status, 400);
    assert.equal(unknownTermAsChair.status, 404);
    assert.deepEqual(await storedTerm(termA), before);
  });
});

describe("D-21: terms need an existing society", () => {
  test("a nonexistent society is 404 and nothing is created or audited", async () => {
    const audits = await creationAudits(NOBODY);

    const res = await session.request("admin", "POST", `/societies/${NOBODY}/terms`, { body: { academicYear: "2050-51" } });

    assert.equal(res.status, 404, res.text.slice(0, 200));
    assert.equal(res.body.success, false);
    assert.equal(await termRows(NOBODY), 0);
    assert.equal(await creationAudits(NOBODY), audits);
  });

  test("a malformed society id is 400", async () => {
    const res = await session.request("admin", "POST", "/societies/not-an-id/terms", { body: { academicYear: "2050-51" } });

    assert.equal(res.status, 400, res.text.slice(0, 200));
  });

  test("the route is still administrator-only: a chair gets 403 whether or not the society exists", async () => {
    const existing = await session.request("chairA", "POST", `/societies/${A.id}/terms`, { body: { academicYear: "2052-53" } });
    const missing = await session.request("chairA", "POST", `/societies/${NOBODY}/terms`, { body: { academicYear: "2052-53" } });
    const anonymous = await session.request(null, "POST", `/societies/${NOBODY}/terms`, { body: { academicYear: "2052-53" } });

    assert.equal(existing.status, 403);
    assert.equal(missing.status, 403, "existence must not be revealed to a non-administrator");
    assert.equal(anonymous.status, 401);
  });

  test("an existing society still creates a term, and a repeated year is still refused with no extra row", async () => {
    const year = `2060-${RUN}`;
    const first = await session.request("admin", "POST", `/societies/${B.id}/terms`, { body: { academicYear: year } });
    const rowsAfterFirst = await termRows(B.id);
    const repeat = await session.request("admin", "POST", `/societies/${B.id}/terms`, { body: { academicYear: year } });

    assert.equal(first.status, 201, first.text.slice(0, 200));
    assert.equal(repeat.status, 400, repeat.text.slice(0, 200));
    assert.equal(await termRows(B.id), rowsAfterFirst);
  });
});
