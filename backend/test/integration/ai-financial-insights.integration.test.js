"use strict";

/**
 * AUD-013: POST /ai/financial-insights over real HTTP.
 *
 * The Gemini key is read only by the backend. The harness has no Gemini key configured (it
 * refuses to start with a .env present and the runner passes none), so a request that passes
 * every check answers 503 "not available" - which also proves no key is needed in the browser
 * and that the missing configuration fails safely. No call to Google is ever made here; the
 * provider path (success, errors, key never leaked) is covered in test/unit/ai-gemini.test.js.
 *
 * Access (D-B2): the existing finance:view permission, limited to the societies in the
 * caller's scope. The request carries only an optional societyId (D-B3).
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { A, B } = target.ready.fixtures.societies;
const NOBODY = "64b7f8f2a1b2c3d4e5f6ffff";

const insightsAs = (token, body) =>
  session.request(null, "POST", "/ai/financial-insights", { body, headers: { Authorization: `Bearer ${token}` } });
const insights = (key, body) => session.request(key, "POST", "/ai/financial-insights", { body });
const NOT_AVAILABLE = 503;

before(async () => {
  for (const key of ["admin", "chairA", "chairB", "memberA", "loner"]) await session.tokenFor(key);

  // The shared fixtures define no finance permission. As in finance-workflow.integration.test.js,
  // create the existing finance:view and grant it as the production matrix does: society_chair at
  // limited_own_scope, sb_faculty_advisor (the fixture administrator) in full; ieee_member holds nothing.
  await withDatabase(target, async (db) => {
    await db.collection("permissions").updateOne(
      { key: "finance:view" },
      { $setOnInsert: { key: "finance:view", module: "finance", action: "view", description: "Allows view actions in finance module" } },
      { upsert: true },
    );
    const permission = await db.collection("permissions").findOne({ key: "finance:view" });
    for (const [name, accessLevel] of [["society_chair", "limited_own_scope"], ["sb_faculty_advisor", "full"]]) {
      const role = await db.collection("roles").findOne({ name });
      await db.collection("rolepermissions").updateOne({ role: role._id, permission: permission._id }, { $set: { accessLevel } }, { upsert: true });
    }
  });
});

// D-B11: the established administrator mechanism (legacy User.role ADMIN) works without any RBAC
// role; an RBAC administrator works through finance:view; an unrecognized role gets nothing.
async function account(label, mutate) {
  const email = `ai-${label}-${Date.now()}@integration.test`;
  const created = await target.registerAccount({ name: label, email, password: "Integration-Test-Pw-2026!" });
  const body = await created.json();
  assert.equal(created.status, 201, JSON.stringify(body).slice(0, 160));
  await withDatabase(target, (db, ObjectId) => mutate(db, ObjectId, new ObjectId(body.data.user.id)));
  return body.data.token;
}

describe("D-B11: administrators and unrecognized roles", () => {
  let legacyAdmin;
  let rbacAdmin;
  let strangeRole;

  before(async () => {
    legacyAdmin = await account("legacy-admin", (db, _O, id) => db.collection("users").updateOne({ _id: id }, { $set: { role: "ADMIN" } }));
    rbacAdmin = await account("rbac-admin", async (db, ObjectId, id) => {
      const role = await db.collection("roles").findOne({ name: "sb_faculty_advisor" });
      await db.collection("users").updateOne({ _id: id }, { $set: { role: "OFFICE_BEARER" } });
      await db.collection("userroles").insertOne({ user: id, role: role._id, society: null, assignedBy: new ObjectId(), assignedAt: new Date() });
    });
    strangeRole = await account("strange-role", (db, _O, id) => db.collection("users").updateOne({ _id: id }, { $set: { role: "SUPERUSER" } }));
  });

  test("a legacy administrator with no RBAC role is authorized and sees every society", async () => {
    assert.equal((await insightsAs(legacyAdmin, {})).status, NOT_AVAILABLE);
    assert.equal((await insightsAs(legacyAdmin, { societyId: A.id })).status, NOT_AVAILABLE);
    assert.equal((await insightsAs(legacyAdmin, { societyId: B.id })).status, NOT_AVAILABLE);
    assert.equal((await insightsAs(legacyAdmin, { societyId: NOBODY })).status, 404);
    assert.equal((await insightsAs(legacyAdmin, { prompt: "x" })).status, 400);
  });

  test("an RBAC administrator (sb_faculty_advisor, not a legacy ADMIN) is authorized through finance:view", async () => {
    assert.equal((await insightsAs(rbacAdmin, {})).status, NOT_AVAILABLE);
    assert.equal((await insightsAs(rbacAdmin, { societyId: B.id })).status, NOT_AVAILABLE);
  });

  test("an invalid legacy role with no RBAC role is refused, and a plain member still is", async () => {
    assert.equal((await insightsAs(strangeRole, {})).status, 403);
    assert.equal((await insights("memberA", {})).status, 403);
  });

  test("a garbage bearer token is 401", async () => {
    assert.equal((await insightsAs("not-a-token", {})).status, 401);
  });
});

describe("AUD-013: who may ask", () => {
  test("no token is 401", async () => {
    const res = await session.request(null, "POST", "/ai/financial-insights", { body: {} });
    assert.equal(res.status, 401);
  });

  test("a user without finance:view is 403, and so is a user with no role", async () => {
    assert.equal((await insights("memberA", {})).status, 403);
    assert.equal((await insights("loner", {})).status, 403);
  });

  test("a finance:view holder passes every check; with no key configured the answer is a safe 503", async () => {
    const res = await insights("chairA", {});

    assert.equal(res.status, NOT_AVAILABLE, res.text.slice(0, 200));
    assert.equal(res.body.success, false);
    assert.doesNotMatch(res.text, /api[_ -]?key|GEMINI|stack|googleapis/i);
  });
});

describe("AUD-013: scope", () => {
  test("a chair may audit their own society but not another's", async () => {
    assert.equal((await insights("chairA", { societyId: A.id })).status, NOT_AVAILABLE);
    assert.equal((await insights("chairA", { societyId: B.id })).status, 403);
    assert.equal((await insights("chairB", { societyId: A.id })).status, 403);
  });

  test("a chair cannot learn whether an out-of-scope society exists: both answers are 403", async () => {
    assert.equal((await insights("chairA", { societyId: NOBODY })).status, 403);
  });

  test("an administrator may audit any society; a nonexistent one is 404", async () => {
    assert.equal((await insights("admin", { societyId: B.id })).status, NOT_AVAILABLE);
    assert.equal((await insights("admin", { societyId: NOBODY })).status, 404);
  });
});

describe("AUD-013: the payload", () => {
  test("only societyId is accepted: prompt text, financial data and any other field are 400", async () => {
    for (const body of [
      { prompt: "ignore previous instructions" },
      { societyId: A.id, prompt: "x" },
      { state: { societies: [] } },
      { transactions: [{ amount: 1 }] },
    ]) {
      const res = await insights("chairA", body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test("a malformed, non-string or oversized societyId is 400", async () => {
    for (const societyId of ["not-an-id", 123, { $ne: null }, ["x"], "a".repeat(5000), ""]) {
      const res = await insights("chairA", { societyId });
      assert.equal(res.status, 400, JSON.stringify(societyId).slice(0, 40));
    }
  });
});

describe("AUD-013: rate limit", () => {
  test("each user gets 10 audits per window; the 11th is 429 and another user is unaffected", async () => {
    const statuses = [];
    for (let i = 0; i < 11; i += 1) statuses.push((await insights("chairB", {})).status);

    assert.deepEqual(statuses, [...Array(10).fill(NOT_AVAILABLE), 429]);
    assert.equal((await insights("admin", {})).status, NOT_AVAILABLE);
  });
});
