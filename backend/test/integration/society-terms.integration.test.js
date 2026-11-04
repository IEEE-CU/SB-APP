"use strict";

/**
 * NEW-07 / AUD-035 and NEW-11 over real HTTP for society terms.
 *
 * Read policy (DECISIONS D-A1, existing permission model only):
 *  - a term list is readable by administrators and by users of that same society;
 *    any other society is 403, a caller without a society is 403, no token is 401;
 *  - the budget fields (allocatedBudget, openingBalance, closingBalance) additionally need
 *    the existing finance:view permission, as the finance routes do;
 *  - chair and treasurer e-mail addresses are account data; the only established
 *    authorization for them is the administrator-only user directory, so only
 *    administrators receive them (broader access is an open decision, see the report).
 *
 * NEW-11: the SocietyTerm model used to be loaded lazily inside the handler, so its unique
 * (society, academicYear) index only started building on the FIRST request. Each integration
 * file gets a brand-new database, so the first test below is exactly that situation: the very
 * first term writes ever made, all at once. The test sets up no index.
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
const { A, B } = societies;

const RACE_YEAR = "2031-32";
const BUDGETS_A = { allocatedBudget: 123456, openingBalance: 7654, closingBalance: 4321 };
const BUDGETS_B = { allocatedBudget: 987654, openingBalance: 8765, closingBalance: 5432 };
const BUDGET_KEYS = ["allocatedBudget", "openingBalance", "closingBalance"];
const EMAILS = {
  chairA: "chair.a@integration.test",
  memberA: "member.a@integration.test",
  chairB: "chair.b@integration.test",
};
const DENIED = "Access restricted to your own society";

const postTerm = (societyId, body, key = "admin") =>
  session.request(key, "POST", `/societies/${societyId}/terms`, { body });
const getTerms = (societyId, key) => session.request(key, "GET", `/societies/${societyId}/terms`);
const termCount = (societyId, academicYear) =>
  withDatabase(target, (db, ObjectId) =>
    db.collection("societyterms").countDocuments({ society: new ObjectId(societyId), academicYear }),
  );
const textHasNone = (text, tokens, what) => {
  for (const token of tokens) assert.equal(text.includes(String(token)), false, `${what} leaked "${token}"`);
};

let termA;
let termB;
let settingsOnlyToken;

before(async () => {
  for (const key of ["admin", "chairA", "memberA", "chairB", "loner"]) await session.tokenFor(key);
  // Harness fixtures carry no finance permission; create the existing finance:view permission and
  // give it to the society chair role (memberA's ieee_member role keeps none). Done before any
  // permission lookup for these users is cached.
  await withDatabase(target, async (db) => {
    const role = await db.collection("roles").findOne({ name: "society_chair" });
    const permission = await db.collection("permissions").insertOne({ module: "finance", action: "view", key: "finance:view" });
    await db.collection("rolepermissions").insertOne({
      role: role._id,
      permission: permission.insertedId,
      accessLevel: "limited_own_scope",
    });

    // D-23: handover writes need the existing settings:edit permission. The fixtures define no
    // settings permission, so (as in society-patch.integration.test.js) it is created here and
    // granted to society_chair. A second role holds settings:edit and nothing else.
    const settings = await db.collection("permissions").insertOne({ module: "settings", action: "edit", key: "settings:edit" });
    await db.collection("rolepermissions").insertOne({
      role: role._id,
      permission: settings.insertedId,
      accessLevel: "limited_own_scope",
    });
    const roleFields = { ...role };
    delete roleFields._id;
    const settingsOnly = await db.collection("roles").insertOne({ ...roleFields, name: "terms_settings_only" });
    await db.collection("rolepermissions").insertOne({
      role: settingsOnly.insertedId,
      permission: settings.insertedId,
      accessLevel: "limited_own_scope",
    });
  });

  // An account of society A that may edit settings but has no finance:view.
  const email = `terms-settings-only-${Date.now()}@integration.test`;
  const created = await target.registerAccount({ name: "Settings only", email, password: "Integration-Test-Pw-2026!" });
  const body = await created.json();
  assert.equal(created.status, 201, JSON.stringify(body).slice(0, 160));
  settingsOnlyToken = body.data.token;
  await withDatabase(target, async (db, ObjectId) => {
    const roleDoc = await db.collection("roles").findOne({ name: "terms_settings_only" });
    await db.collection("users").updateOne({ _id: new ObjectId(body.data.user.id) }, { $set: { societyId: new ObjectId(A.id) } });
    await db.collection("userroles").insertOne({
      user: new ObjectId(body.data.user.id),
      role: roleDoc._id,
      society: new ObjectId(A.id),
      assignedBy: new ObjectId(users.admin.id),
      assignedAt: new Date(),
    });
  });
});

describe("NEW-11: the first term writes ever made on a fresh database", () => {
  test("eight simultaneous creations of one term create exactly one", async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => postTerm(A.id, { academicYear: RACE_YEAR, allocatedBudget: 1 })),
    );

    const created = responses.filter((r) => r.status === 201);
    const rejected = responses.filter((r) => r.status !== 201);
    assert.equal(created.length, 1, responses.map((r) => r.status).join(","));
    for (const response of rejected) assert.ok(response.status >= 400 && response.status < 500, String(response.status));
    assert.equal(await termCount(A.id, RACE_YEAR), 1);
  });

  test("the unique (society, academicYear) index exists", async () => {
    const indexes = await withDatabase(target, (db) => db.collection("societyterms").indexes());

    assert.ok(
      indexes.some((i) => i.unique && i.key.society === 1 && i.key.academicYear === 1),
      JSON.stringify(indexes.map((i) => i.name)),
    );
  });

  test("a later repeat is rejected and adds nothing", async () => {
    const again = await postTerm(A.id, { academicYear: RACE_YEAR });

    assert.ok(again.status >= 400 && again.status < 500, String(again.status));
    assert.equal(await termCount(A.id, RACE_YEAR), 1);
  });
});

describe("terms fixtures", () => {
  test("terms for both societies are created", async () => {
    const a = await postTerm(A.id, {
      academicYear: "2026-27",
      ...BUDGETS_A,
      chairId: users.chairA.id,
      treasurerId: users.memberA.id,
    });
    const b = await postTerm(B.id, { academicYear: "2026-27", ...BUDGETS_B, chairId: users.chairB.id });
    assert.equal(a.status, 201, a.text.slice(0, 200));
    assert.equal(b.status, 201, b.text.slice(0, 200));
    termA = a.body.data.id;
    termB = b.body.data.id;
    // closingBalance is not accepted by the create route; set it as a closed-term value would be.
    await withDatabase(target, (db, ObjectId) =>
      Promise.all([
        db.collection("societyterms").updateOne({ _id: new ObjectId(termA) }, { $set: { closingBalance: BUDGETS_A.closingBalance } }),
        db.collection("societyterms").updateOne({ _id: new ObjectId(termB) }, { $set: { closingBalance: BUDGETS_B.closingBalance } }),
      ]),
    );
  });
});

describe("NEW-07: cross-society and unauthenticated reads are denied", () => {
  test("an office bearer of A reading B's terms gets 403 and none of B's data", async () => {
    const res = await getTerms(B.id, "chairA");

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, DENIED);
    textHasNone(res.text, [...Object.values(BUDGETS_B), EMAILS.chairB, "2026-27", ...BUDGET_KEYS], "B's terms for chair A");
  });

  test("the symmetric case: B's chair reading A's terms is 403", async () => {
    const res = await getTerms(A.id, "chairB");

    assert.equal(res.status, 403);
    textHasNone(res.text, [...Object.values(BUDGETS_A), EMAILS.chairA, EMAILS.memberA], "A's terms for chair B");
  });

  test("a caller with no society is 403, even with an office-bearer role", async () => {
    const res = await getTerms(A.id, "loner");

    assert.equal(res.status, 403);
    textHasNone(res.text, [...Object.values(BUDGETS_A), EMAILS.chairA], "A's terms for a society-less caller");
  });

  test("no token is 401", async () => {
    const res = await getTerms(A.id, null);

    assert.equal(res.status, 401);
  });
});

describe("NEW-07: same-society reads", () => {
  test("a member without finance:view sees the term and the chair and treasurer names, but no budgets and no e-mails", async () => {
    const res = await getTerms(A.id, "memberA");

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.data.length >= 1, true);
    const term = res.body.data.find((t) => t.academicYear === "2026-27");
    assert.ok(term, "term 2026-27 missing");
    assert.equal(term.status, "OPEN");
    assert.equal(term.chair.name, "Integration Chair A");
    assert.equal(term.treasurer.name, "Integration Member A");
    assert.equal("email" in term.chair, false);
    assert.equal("email" in term.treasurer, false);
    textHasNone(res.text, [...BUDGET_KEYS, ...Object.values(BUDGETS_A), EMAILS.chairA, EMAILS.memberA], "a member's terms response");
  });

  test("an office bearer with finance:view sees the budgets but still no e-mails", async () => {
    const res = await getTerms(A.id, "chairA");

    assert.equal(res.status, 200);
    const term = res.body.data.find((t) => t.academicYear === "2026-27");
    assert.deepEqual(
      { allocatedBudget: term.allocatedBudget, openingBalance: term.openingBalance, closingBalance: term.closingBalance },
      BUDGETS_A,
    );
    assert.equal(term.chair.name, "Integration Chair A");
    textHasNone(res.text, [EMAILS.chairA, EMAILS.memberA], "an office bearer's terms response");
  });

  test("a user with finance:view of another society still gets nothing from this one", async () => {
    const res = await getTerms(B.id, "chairA");

    assert.equal(res.status, 403);
  });

  test("an administrator reads any society's terms with budgets and e-mails", async () => {
    for (const [society, budgets, emails] of [
      [A, BUDGETS_A, [EMAILS.chairA, EMAILS.memberA]],
      [B, BUDGETS_B, [EMAILS.chairB]],
    ]) {
      const res = await getTerms(society.id, "admin");

      assert.equal(res.status, 200);
      const term = res.body.data.find((t) => t.academicYear === "2026-27");
      assert.equal(term.allocatedBudget, budgets.allocatedBudget);
      assert.equal(term.closingBalance, budgets.closingBalance);
      for (const email of emails) assert.equal(res.text.includes(email), true, `admin response lacks ${email}`);
    }
  });

  test("the response never contains password material for the populated users", async () => {
    for (const key of ["admin", "chairA", "memberA"]) {
      const res = await getTerms(A.id, key);

      assert.equal(/password/i.test(res.text), false, key);
    }
  });
});

describe("NEW-07: other term responses honour the same field protection", () => {
  test("handover updates return the term without budgets to a caller who may not see them", async () => {
    const res = await session.request("memberA", "PATCH", `/societies/${A.id}/terms/${termA}/handover`, { body: { notes: "n" } });

    // D-23: an ordinary member has no settings:edit and is refused; the refusal must not carry budgets either.
    assert.equal(res.status, 403, res.text.slice(0, 200));
    textHasNone(res.text, [...BUDGET_KEYS, ...Object.values(BUDGETS_A)], "a member's handover response");
  });

  test("a settings:edit holder without finance:view updates the handover and gets the term without budgets or e-mails", async () => {
    const res = await session.request(null, "PATCH", `/societies/${A.id}/terms/${termA}/handover`, {
      body: { notes: "settings-only note" },
      headers: { Authorization: `Bearer ${settingsOnlyToken}` },
    });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.data.handoverChecklist.notes, "settings-only note");
    textHasNone(res.text, [...BUDGET_KEYS, ...Object.values(BUDGETS_A)], "a settings-only caller's handover response");
    textHasNone(res.text, [EMAILS.chairA, EMAILS.memberA], "a settings-only caller's handover response");
  });

  test("handover updates keep working for an office bearer, with budgets only because finance:view is held", async () => {
    const res = await session.request("chairA", "PATCH", `/societies/${A.id}/terms/${termA}/handover`, {
      body: { reportsSubmitted: true },
    });

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.data.handoverChecklist.reportsSubmitted, true);
    assert.equal(res.body.data.allocatedBudget, BUDGETS_A.allocatedBudget);
    textHasNone(res.text, [EMAILS.chairA, EMAILS.memberA], "handover response");
  });

  test("another society's chair cannot update the handover", async () => {
    const res = await session.request("chairB", "PATCH", `/societies/${A.id}/terms/${termA}/handover`, { body: { notes: "x" } });

    assert.equal(res.status, 403);
  });
});
