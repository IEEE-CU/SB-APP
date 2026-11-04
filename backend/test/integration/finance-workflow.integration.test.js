"use strict";

/**
 * AUD-005 over HTTP: the finance approval workflow and ledger integrity
 * (routes/transactions.js, models/Transaction.js, balance/dashboard aggregates).
 *
 * Policy under test:
 *   - every route needs the matching RBAC permission (finance:view / create / edit
 *     / delete / approve) on top of the society scope; the legacy User.role never
 *     grants a permission, and administrators cannot bypass a missing one;
 *   - new transactions are PENDING, createdBy is the caller, and approvalStatus /
 *     createdBy / approvedBy in the body are ignored;
 *   - PENDING -> APPROVED | REJECTED, once; two concurrent decisions cannot both win;
 *   - a creator cannot approve their own transaction, except an administrator who
 *     also holds finance:approve;
 *   - only PENDING transactions can be edited or deleted; an APPROVED one is never
 *     changed or removed - it is offset by a reversal (a separate PENDING record,
 *     opposite type, same amount, linked through reversalOf) that goes through the
 *     same approval and can exist at most once;
 *   - balances and dashboards count APPROVED transactions only.
 *
 * The shared fixtures define no finance permissions, so the setup below adds
 * exactly what the production seed (src/scripts/seed.js, docs/rbac-matrix.json)
 * defines: the five finance permissions; society_chair holds finance:* at
 * limited_own_scope; society_treasurer holds finance:* at limited_own_scope with
 * finance:approve at "approval"; vice chair, secretary and webmaster hold
 * finance:view only; ieee_member holds nothing; sb_faculty_advisor (the fixture
 * administrator) holds everything. Disposable users are inserted directly (bcrypt
 * hash) in the harness's disposable database and removed afterwards.
 *
 * Fixtures: admin (sb_faculty_advisor), chairA (society_chair, society A), chairB,
 * memberA (ieee_member, society A), loner (no society, no role).
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
const FINANCE_ACTIONS = ["view", "create", "edit", "delete", "approve"];

// Disposable users: key -> { role (legacy User.role), society, roleName (RBAC role) }.
const DISPOSABLE = {
  treasurerA: { role: "OFFICE_BEARER", society: A, roleName: "society_treasurer" },
  treasurer2A: { role: "OFFICE_BEARER", society: A, roleName: "society_treasurer" },
  treasurerB: { role: "OFFICE_BEARER", society: B, roleName: "society_treasurer" },
  viceChairA: { role: "OFFICE_BEARER", society: A, roleName: "society_vice_chair" },
  secretaryA: { role: "OFFICE_BEARER", society: A, roleName: "society_secretary" },
  webmasterA: { role: "OFFICE_BEARER", society: A, roleName: "society_webmaster" },
  adminNoRole: { role: "ADMIN", society: null, roleName: null },
  adminMemberRole: { role: "ADMIN", society: null, roleName: "ieee_member" },
};
// The login lowercases e-mail addresses, so disposable users are stored lowercase.
const emailOf = (key) => (USERS[key] ? USERS[key].email : `finance-${key.toLowerCase()}-${RUN}@integration.test`);
const ids = {}; // disposable key -> user id
const tokens = {};
let legacy; // { approved, pending, rejected } raw seeded records

const idOf = (key) => (USERS[key] ? users[key].id : ids[key]);

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

/** key = fixture or disposable user key, or null for an anonymous request. */
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
  withDatabase(target, (db, ObjectId) => db.collection("transactions").findOne({ _id: new ObjectId(String(id)) }));
const transactionCount = () => withDatabase(target, (db) => db.collection("transactions").countDocuments({}));
const reversalsOf = (id) =>
  withDatabase(target, (db, ObjectId) =>
    db.collection("transactions").find({ reversalOf: new ObjectId(String(id)) }).toArray(),
  );

/** Everything about a record that must never change once approved. */
const approvedSnapshot = (doc) =>
  JSON.stringify({
    societyId: String(doc.societyId),
    type: doc.type,
    amount: doc.amount,
    category: doc.category,
    description: doc.description,
    date: doc.date,
    approvalStatus: doc.approvalStatus,
    approvedBy: String(doc.approvedBy),
    decidedBy: String(doc.decidedBy),
    decidedAt: doc.decidedAt,
    createdBy: String(doc.createdBy),
    reversalOf: doc.reversalOf ? String(doc.reversalOf) : null,
  });

let counter = 0;
const draft = (extra = {}) => ({
  type: "EXPENSE",
  amount: 100,
  category: "Workflow",
  description: `workflow-${RUN}-${++counter}`,
  ...extra,
});

/** Creates a PENDING transaction through the API and returns its id. */
async function createPending(key, extra = {}) {
  const res = await call(key, "POST", "/transactions", draft(extra));
  assert.equal(res.status, 201, `could not create a pending transaction as ${key}: ${res.text.slice(0, 200)}`);
  return res.body.data.id;
}
/** Creates and approves (by someone else) and returns the id. */
async function createApproved(creator = "chairA", approver = "treasurerA", extra = {}) {
  const id = await createPending(creator, extra);
  const res = await call(approver, "PATCH", `/transactions/${id}/approve`);
  assert.equal(res.status, 200, `could not approve as ${approver}: ${res.text.slice(0, 200)}`);
  return id;
}

/** budget + approved income - approved expense, computed from the database. */
async function expectedBalance(societyId) {
  return withDatabase(target, async (db, ObjectId) => {
    const society = await db.collection("societies").findOne({ _id: new ObjectId(societyId) });
    const rows = await db
      .collection("transactions")
      .aggregate([
        { $match: { societyId: new ObjectId(societyId), approvalStatus: "APPROVED" } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ])
      .toArray();
    const sum = (type) => (rows.find((r) => r._id === type) || { total: 0 }).total;
    return society.budget + sum("INCOME") - sum("EXPENSE");
  });
}
async function reportedBalance(societyId) {
  const res = await call("admin", "GET", "/societies");
  return res.body.data.find((s) => s.id === societyId).balance;
}

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();

    // Permissions and role grants, mirroring the production seed.
    const perm = {};
    for (const action of FINANCE_ACTIONS) {
      await db.collection("permissions").updateOne(
        { key: `finance:${action}` },
        {
          $setOnInsert: {
            key: `finance:${action}`,
            module: "finance",
            action,
            description: `Allows ${action} actions in finance module`,
          },
        },
        { upsert: true },
      );
      perm[action] = await db.collection("permissions").findOne({ key: `finance:${action}` });
    }
    const role = async (name, displayName) => {
      await db.collection("roles").updateOne(
        { name },
        {
          $setOnInsert: {
            name,
            displayName,
            level: "office_bearer",
            scope: "society",
            description: "Integration role",
            isSystemRole: false,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
      return db.collection("roles").findOne({ name });
    };
    const grant = (roleDoc, action, accessLevel) =>
      db.collection("rolepermissions").updateOne(
        { role: roleDoc._id, permission: perm[action]._id },
        { $set: { accessLevel } },
        { upsert: true },
      );

    const chair = await db.collection("roles").findOne({ name: "society_chair" });
    for (const action of FINANCE_ACTIONS) await grant(chair, action, "limited_own_scope");
    const treasurer = await role("society_treasurer", "Society Treasurer");
    for (const action of FINANCE_ACTIONS) await grant(treasurer, action, action === "approve" ? "approval" : "limited_own_scope");
    for (const [name, label] of [
      ["society_vice_chair", "Society Vice Chair"],
      ["society_secretary", "Society Secretary"],
      ["society_webmaster", "Society Webmaster"],
    ]) {
      await grant(await role(name, label), "view", "limited_own_scope");
    }

    // Disposable users (direct insert; bcrypt hash of the harness test password).
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    for (const [key, spec] of Object.entries(DISPOSABLE)) {
      const inserted = await db.collection("users").insertOne({
        email: emailOf(key),
        password: hash,
        name: `Finance ${key}`,
        role: spec.role,
        societyId: spec.society ? new ObjectId(spec.society) : null,
        createdAt: now,
        updatedAt: now,
      });
      ids[key] = String(inserted.insertedId);
      if (spec.roleName) {
        const roleDoc = await db.collection("roles").findOne({ name: spec.roleName });
        await db.collection("userroles").insertOne({
          user: inserted.insertedId,
          role: roleDoc._id,
          society: spec.society ? new ObjectId(spec.society) : null,
          assignedBy: new ObjectId(users.admin.id),
          assignedAt: now,
        });
      }
    }

    // Legacy records, created before the workflow: none of createdBy, decidedBy,
    // decidedAt or reversalOf.
    const legacyDoc = (approvalStatus, extra = {}) => ({
      societyId: new ObjectId(A),
      type: "INCOME",
      amount: 250,
      category: "Legacy",
      description: `legacy-${approvalStatus}-${RUN}`,
      date: new Date("2025-01-01T00:00:00Z"),
      approvalStatus,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
      ...extra,
    });
    const approved = await db.collection("transactions").insertOne(legacyDoc("APPROVED", { approvedBy: new ObjectId(users.chairA.id) }));
    const pending = await db.collection("transactions").insertOne(legacyDoc("PENDING"));
    const rejected = await db.collection("transactions").insertOne(legacyDoc("REJECTED"));
    legacy = { approved: String(approved.insertedId), pending: String(pending.insertedId), rejected: String(rejected.insertedId) };
  });
});

after(async () => {
  await withDatabase(target, (db, ObjectId) =>
    db.collection("userroles").deleteMany({ user: { $in: Object.values(ids).map((id) => new ObjectId(id)) } }),
  );
  for (const key of Object.keys(ids)) await deleteDisposableUser(target, ids[key], emailOf(key));
});

// ---- existing data is untouched ------------------------------------------------

describe("legacy records", () => {
  test("keep their ids and statuses, and approved-only balances use them correctly", async () => {
    const approved = await stored(legacy.approved);
    const pending = await stored(legacy.pending);
    const rejected = await stored(legacy.rejected);

    assert.equal(approved.approvalStatus, "APPROVED");
    assert.equal(pending.approvalStatus, "PENDING");
    assert.equal(rejected.approvalStatus, "REJECTED");
    for (const doc of [approved, pending, rejected]) {
      assert.equal(doc.createdBy, undefined);
      assert.equal(doc.decidedBy, undefined);
      assert.equal(doc.reversalOf, undefined);
    }
    // 250 approved income counts; the pending and rejected 250 do not.
    assert.equal(await reportedBalance(A), 1000 + 250);
  });

  test("a legacy record can be read through the API", async () => {
    const res = await call("chairA", "GET", `/transactions/${legacy.approved}`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.data.approvalStatus, "APPROVED");
    assert.equal(res.body.data.createdBy, undefined);
  });
});

// ---- authorization ---------------------------------------------------------------

describe("authorization: anonymous", () => {
  test("every route is 401 and nothing changes", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);
    const count = await transactionCount();

    for (const [method, route, body] of [
      ["GET", "/transactions"],
      ["GET", `/transactions/society/${A}`],
      ["GET", `/transactions/${id}`],
      ["POST", "/transactions", draft({ societyId: A })],
      ["PUT", `/transactions/${id}`, { amount: 1 }],
      ["DELETE", `/transactions/${id}`],
      ["PATCH", `/transactions/${id}/approve`],
      ["PATCH", `/transactions/${id}/reject`],
      ["POST", `/transactions/${id}/reverse`, {}],
    ]) {
      const res = await call(null, method, route, body);

      assert.equal(res.status, 401, `${method} ${route}`);
    }
    assert.equal(await transactionCount(), count);
    assert.deepEqual(await stored(id), before);
  });
});

describe("authorization: no finance permission", () => {
  test("members and users with no role cannot read or write, whatever their legacy role", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);
    const count = await transactionCount();

    for (const key of ["memberA", "loner"]) {
      for (const [method, route, body] of [
        ["GET", `/transactions/society/${A}`],
        ["GET", `/transactions/${id}`],
        ["POST", "/transactions", draft({ societyId: A })],
        ["PUT", `/transactions/${id}`, { amount: 1 }],
        ["DELETE", `/transactions/${id}`],
        ["PATCH", `/transactions/${id}/approve`],
        ["PATCH", `/transactions/${id}/reject`],
        ["POST", `/transactions/${id}/reverse`, {}],
      ]) {
        const res = await call(key, method, route, body);

        assert.equal(res.status, 403, `${key} ${method} ${route}`);
      }
    }
    assert.equal(await transactionCount(), count);
    assert.deepEqual(await stored(id), before);
  });

  test("vice chair, secretary and webmaster can read but not write", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);
    const count = await transactionCount();

    for (const key of ["viceChairA", "secretaryA", "webmasterA"]) {
      const list = await call(key, "GET", `/transactions/society/${A}`);
      const one = await call(key, "GET", `/transactions/${id}`);
      assert.equal(list.status, 200, `${key} list: ${list.text.slice(0, 160)}`);
      assert.equal(one.status, 200, `${key} item`);

      for (const [method, route, body] of [
        ["POST", "/transactions", draft({ societyId: A })],
        ["PUT", `/transactions/${id}`, { amount: 1 }],
        ["DELETE", `/transactions/${id}`],
        ["PATCH", `/transactions/${id}/approve`],
        ["PATCH", `/transactions/${id}/reject`],
        ["POST", `/transactions/${id}/reverse`, {}],
      ]) {
        const res = await call(key, method, route, body);

        assert.equal(res.status, 403, `${key} ${method} ${route}`);
        assert.equal(res.body.error.code, "PERMISSION_DENIED");
      }
    }
    assert.equal(await transactionCount(), count);
    assert.deepEqual(await stored(id), before);
  });

  test("an administrator cannot bypass a missing permission", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);
    const count = await transactionCount();

    for (const key of ["adminNoRole", "adminMemberRole"]) {
      for (const [method, route, body] of [
        ["GET", "/transactions"],
        ["GET", `/transactions/society/${A}`],
        ["GET", `/transactions/${id}`],
        ["POST", "/transactions", draft({ societyId: A })],
        ["PUT", `/transactions/${id}`, { amount: 1 }],
        ["DELETE", `/transactions/${id}`],
        ["PATCH", `/transactions/${id}/approve`],
        ["PATCH", `/transactions/${id}/reject`],
        ["POST", `/transactions/${id}/reverse`, {}],
      ]) {
        const res = await call(key, method, route, body);

        assert.equal(res.status, 403, `${key} ${method} ${route}`);
      }
    }
    assert.equal(await transactionCount(), count);
    assert.deepEqual(await stored(id), before);
  });

  test("D-36: a legacy administrator who chaired a SocietyTerm sees only that society's transactions", async () => {
    const termId = await withDatabase(target, async (db, ObjectId) => {
      const { insertedId } = await db.collection("societyterms").insertOne({
        society: new ObjectId(A),
        academicYear: `D36-${RUN}`,
        chair: new ObjectId(idOf("adminNoRole")),
        allocatedBudget: 0,
        openingBalance: 0,
        closingBalance: 0,
        status: "OPEN",
        handoverChecklist: { reportsSubmitted: false, balanceReconciled: false, assetsTransferred: false, notes: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return insertedId;
    });
    try {
      const idA = await createPending("chairA", { societyId: A });
      const idB = await createPending("chairB", { societyId: B });

      const list = await call("adminNoRole", "GET", "/transactions");
      assert.equal(list.status, 200, list.text.slice(0, 200));
      assert.ok(list.body.data.every((t) => String(t.societyId?.id ?? t.societyId) === A), "only society A's transactions");
      assert.ok(list.body.data.some((t) => String(t.id) === String(idA)), "society A's own transaction is included");

      const ownSociety = await call("adminNoRole", "GET", `/transactions/society/${A}`);
      assert.equal(ownSociety.status, 200);
      const foreignSociety = await call("adminNoRole", "GET", `/transactions/society/${B}`);
      assert.equal(foreignSociety.status, 403);

      const ownTx = await call("adminNoRole", "GET", `/transactions/${idA}`);
      assert.equal(ownTx.status, 200);
      const foreignTx = await call("adminNoRole", "GET", `/transactions/${idB}`);
      assert.equal(foreignTx.status, 403);

      // The exception is view-only (D-36): mutating still needs the real permission.
      const create = await call("adminNoRole", "POST", "/transactions", draft({ societyId: A }));
      assert.equal(create.status, 403);
    } finally {
      await withDatabase(target, (db, ObjectId) => db.collection("societyterms").deleteOne({ _id: new ObjectId(String(termId)) }));
    }
  });

  test("the all-societies list stays administrator-only, in addition to finance:view", async () => {
    const chair = await call("chairA", "GET", "/transactions");
    const treasurer = await call("treasurerA", "GET", "/transactions");
    const admin = await call("admin", "GET", "/transactions");

    assert.equal(chair.status, 403);
    assert.equal(treasurer.status, 403);
    assert.equal(admin.status, 200, admin.text.slice(0, 200));
    assert.ok(admin.body.data.length >= 3);
  });
});

describe("authorization: society isolation", () => {
  test("another society's treasurer, who holds every permission, is denied by the scope", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);
    const count = await transactionCount();

    for (const [method, route, body] of [
      ["GET", `/transactions/society/${A}`],
      ["GET", `/transactions/${id}`],
      ["POST", "/transactions", draft({ societyId: A })],
      ["PUT", `/transactions/${id}`, { amount: 1 }],
      ["DELETE", `/transactions/${id}`],
      ["PATCH", `/transactions/${id}/approve`],
      ["PATCH", `/transactions/${id}/reject`],
      ["POST", `/transactions/${id}/reverse`, {}],
    ]) {
      const res = await call("treasurerB", method, route, body);

      assert.equal(res.status, 403, `${method} ${route}: ${res.text.slice(0, 160)}`);
    }
    assert.equal(await transactionCount(), count);
    assert.deepEqual(await stored(id), before);
  });

  test("a society-less user holding no role cannot reach any society", async () => {
    const res = await call("loner", "POST", "/transactions", draft({ societyId: A }));

    assert.equal(res.status, 403);
  });
});

// ---- creation --------------------------------------------------------------------

describe("creation", () => {
  test("a new transaction is PENDING, created by the caller, with no approver", async () => {
    const res = await call("chairA", "POST", "/transactions", draft({ societyId: A }));

    assert.equal(res.status, 201, res.text.slice(0, 300));
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.approvalStatus, "PENDING");
    const doc = await stored(res.body.data.id);
    assert.equal(doc.approvalStatus, "PENDING");
    assert.equal(String(doc.createdBy), users.chairA.id);
    assert.equal(doc.approvedBy, null);
    assert.equal(doc.decidedBy, undefined);
    assert.equal(doc.decidedAt, undefined);
    assert.equal(doc.reversalOf, undefined);
    assert.equal(String(doc.societyId), A);
  });

  test("client-supplied createdBy, approvedBy, approvalStatus and decision fields are ignored", async () => {
    const res = await call(
      "chairA",
      "POST",
      "/transactions",
      draft({
        societyId: A,
        approvalStatus: "APPROVED",
        approvedBy: users.admin.id,
        createdBy: users.admin.id,
        decidedBy: users.admin.id,
        decidedAt: "2001-01-01T00:00:00.000Z",
        reversalOf: legacy.approved,
      }),
    );

    assert.equal(res.status, 201, res.text.slice(0, 300));
    const doc = await stored(res.body.data.id);
    assert.equal(doc.approvalStatus, "PENDING");
    assert.equal(doc.approvedBy, null);
    assert.equal(String(doc.createdBy), users.chairA.id);
    assert.equal(doc.decidedBy, undefined);
    assert.equal(doc.decidedAt, undefined);
    assert.equal(doc.reversalOf, undefined);
  });

  test("creation does not change the approved balance", async () => {
    const before = await reportedBalance(A);

    await createPending("chairA", { type: "INCOME", amount: 5000 });
    await createPending("treasurerA", { type: "EXPENSE", amount: 5000 });

    assert.equal(await reportedBalance(A), before);
  });

  test("the society defaults to the caller's; an administrator must name one", async () => {
    const own = await call("chairA", "POST", "/transactions", draft());
    const adminNone = await call("admin", "POST", "/transactions", draft());
    const adminNamed = await call("admin", "POST", "/transactions", draft({ societyId: B }));

    assert.equal(own.status, 201, own.text.slice(0, 200));
    assert.equal(String((await stored(own.body.data.id)).societyId), A);
    assert.equal(adminNone.status, 400);
    assert.equal(adminNone.body.message, "Society ID is required");
    assert.equal(adminNamed.status, 201, adminNamed.text.slice(0, 200));
    assert.equal(String((await stored(adminNamed.body.data.id)).societyId), B);
  });

  test("invalid and unauthorized societies create nothing", async () => {
    const count = await transactionCount();

    const foreign = await call("chairA", "POST", "/transactions", draft({ societyId: B }));
    const malformed = await call("admin", "POST", "/transactions", draft({ societyId: "not-an-object-id" }));
    const arrayId = await call("admin", "POST", "/transactions", draft({ societyId: [A] }));
    const missing = await call("admin", "POST", "/transactions", draft({ societyId: MISSING }));

    assert.equal(foreign.status, 403);
    assert.equal(malformed.status, 400);
    assert.equal(arrayId.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(await transactionCount(), count);
  });

  test("invalid amounts and missing fields are still rejected", async () => {
    const count = await transactionCount();

    const negative = await call("chairA", "POST", "/transactions", draft({ amount: -5 }));
    const noCategory = await call("chairA", "POST", "/transactions", { type: "INCOME", amount: 1, description: "x" });

    assert.equal(negative.status, 400);
    assert.equal(noCategory.status, 400);
    assert.equal(await transactionCount(), count);
  });
});

// ---- approval and rejection ------------------------------------------------------

describe("approval", () => {
  test("a treasurer approves another user's transaction; the decision-maker is recorded", async () => {
    const id = await createPending("chairA", { type: "INCOME", amount: 40 });
    const before = await reportedBalance(A);

    const res = await call("treasurerA", "PATCH", `/transactions/${id}/approve`);

    assert.equal(res.status, 200, res.text.slice(0, 300));
    assert.equal(res.body.data.approvalStatus, "APPROVED");
    const doc = await stored(id);
    assert.equal(doc.approvalStatus, "APPROVED");
    assert.equal(String(doc.approvedBy), idOf("treasurerA"));
    assert.equal(String(doc.decidedBy), idOf("treasurerA"));
    assert.ok(doc.decidedAt instanceof Date);
    assert.equal(String(doc.createdBy), users.chairA.id, "the creator changed");
    assert.equal(await reportedBalance(A), before + 40);
  });

  test("the global faculty advisor (administrator) can decide transactions of any society", async () => {
    const inA = await createPending("chairA");
    const inB = await createPending("chairB");

    const a = await call("admin", "PATCH", `/transactions/${inA}/approve`);
    const b = await call("admin", "PATCH", `/transactions/${inB}/reject`);

    assert.equal(a.status, 200, a.text.slice(0, 200));
    assert.equal(b.status, 200, b.text.slice(0, 200));
    assert.equal(String((await stored(inA)).decidedBy), users.admin.id);
    assert.equal((await stored(inB)).approvalStatus, "REJECTED");
  });

  test("a chair, who holds finance:approve through the finance:* grant, can approve a treasurer's transaction", async () => {
    const id = await createPending("treasurerA");

    const res = await call("chairA", "PATCH", `/transactions/${id}/approve`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(String((await stored(id)).decidedBy), users.chairA.id);
  });

  test("callers without finance:approve are denied and nothing changes", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);

    for (const key of ["memberA", "viceChairA", "secretaryA", "webmasterA", "adminNoRole"]) {
      const approve = await call(key, "PATCH", `/transactions/${id}/approve`);
      const reject = await call(key, "PATCH", `/transactions/${id}/reject`);

      assert.equal(approve.status, 403, key);
      assert.equal(reject.status, 403, key);
    }
    assert.deepEqual(await stored(id), before);
  });

  test("a non-administrator cannot approve their own transaction", async () => {
    for (const key of ["chairA", "treasurerA"]) {
      const id = await createPending(key);
      const before = await stored(id);

      const res = await call(key, "PATCH", `/transactions/${id}/approve`);

      assert.equal(res.status, 403, key);
      assert.equal(res.body.message, "You cannot approve a transaction you created");
      assert.deepEqual(await stored(id), before);
    }
  });

  test("an administrator holding finance:approve may approve their own transaction", async () => {
    const id = await createPending("admin", { societyId: A });

    const res = await call("admin", "PATCH", `/transactions/${id}/approve`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    const doc = await stored(id);
    assert.equal(doc.approvalStatus, "APPROVED");
    assert.equal(String(doc.createdBy), users.admin.id);
    assert.equal(String(doc.decidedBy), users.admin.id);
  });

  test("the administrator exception does not extend to an administrator without the permission", async () => {
    // adminNoRole has the legacy ADMIN role but no finance:approve (and cannot even create).
    const id = await createPending("admin", { societyId: A });
    const before = await stored(id);

    const res = await call("adminNoRole", "PATCH", `/transactions/${id}/approve`);

    assert.equal(res.status, 403);
    assert.deepEqual(await stored(id), before);
  });

  test("another society's approver, a malformed id and an unknown id change nothing", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);
    const count = await transactionCount();

    const foreign = await call("treasurerB", "PATCH", `/transactions/${id}/approve`);
    const malformed = await call("treasurerA", "PATCH", "/transactions/not-an-object-id/approve");
    const missing = await call("treasurerA", "PATCH", `/transactions/${MISSING}/approve`);

    assert.equal(foreign.status, 403);
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.message, "Invalid ID format.");
    assert.equal(missing.status, 404);
    assert.deepEqual(await stored(id), before);
    assert.equal(await transactionCount(), count);
  });

  test("a legacy pending record without a creator can be decided by an approver", async () => {
    const res = await call("treasurerA", "PATCH", `/transactions/${legacy.pending}/approve`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal((await stored(legacy.pending)).approvalStatus, "APPROVED");
  });
});

describe("rejection", () => {
  test("rejecting records the decision-maker, sets no approver, and leaves the balance alone", async () => {
    const id = await createPending("chairA", { type: "INCOME", amount: 777 });
    const before = await reportedBalance(A);

    const res = await call("treasurerA", "PATCH", `/transactions/${id}/reject`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    const doc = await stored(id);
    assert.equal(doc.approvalStatus, "REJECTED");
    assert.equal(String(doc.decidedBy), idOf("treasurerA"));
    assert.ok(doc.decidedAt instanceof Date);
    assert.equal(doc.approvedBy, null);
    assert.equal(await reportedBalance(A), before);
  });
});

describe("state transitions and concurrency", () => {
  test("a transaction can be decided only once", async () => {
    const approved = await createApproved();
    const rejected = await createPending("chairA");
    await call("treasurerA", "PATCH", `/transactions/${rejected}/reject`);
    const beforeApproved = await stored(approved);
    const beforeRejected = await stored(rejected);

    const again = await call("treasurer2A", "PATCH", `/transactions/${approved}/approve`);
    const flip = await call("treasurer2A", "PATCH", `/transactions/${approved}/reject`);
    const revive = await call("treasurer2A", "PATCH", `/transactions/${rejected}/approve`);
    const rereject = await call("treasurer2A", "PATCH", `/transactions/${rejected}/reject`);

    for (const res of [again, flip, revive, rereject]) assert.equal(res.status, 409, res.text.slice(0, 160));
    assert.deepEqual(await stored(approved), beforeApproved);
    assert.deepEqual(await stored(rejected), beforeRejected);
  });

  test("two concurrent approvals: exactly one succeeds, and the record shows the winner", async () => {
    const id = await createPending("chairA");

    const results = await Promise.all([
      call("treasurerA", "PATCH", `/transactions/${id}/approve`),
      call("admin", "PATCH", `/transactions/${id}/approve`),
      call("treasurer2A", "PATCH", `/transactions/${id}/approve`),
    ]);

    const winners = results.filter((r) => r.status === 200);
    assert.equal(winners.length, 1, results.map((r) => r.status).join(","));
    assert.equal(results.filter((r) => r.status === 409).length, 2);
    const doc = await stored(id);
    assert.equal(doc.approvalStatus, "APPROVED");
    assert.equal(String(doc.decidedBy), String(winners[0].body.data.approvedBy._id ?? winners[0].body.data.approvedBy.id));
    assert.equal(String(doc.approvedBy), String(doc.decidedBy));
  });

  test("a concurrent approval and rejection: exactly one wins and the state matches the winner", async () => {
    const id = await createPending("chairA", { type: "INCOME", amount: 321 });
    const before = await reportedBalance(A);

    const [approve, reject] = await Promise.all([
      call("treasurerA", "PATCH", `/transactions/${id}/approve`),
      call("treasurer2A", "PATCH", `/transactions/${id}/reject`),
    ]);

    assert.deepEqual([approve.status, reject.status].sort(), [200, 409]);
    const doc = await stored(id);
    const winnerApproved = approve.status === 200;
    assert.equal(doc.approvalStatus, winnerApproved ? "APPROVED" : "REJECTED");
    assert.equal(String(doc.decidedBy), idOf(winnerApproved ? "treasurerA" : "treasurer2A"));
    assert.equal(await reportedBalance(A), winnerApproved ? before + 321 : before);
  });

  test("an edit racing an approval cannot change an approved record", async () => {
    const id = await createPending("chairA", { amount: 100 });

    const [edit, approve] = await Promise.all([
      call("chairA", "PUT", `/transactions/${id}`, { amount: 999999 }),
      call("treasurerA", "PATCH", `/transactions/${id}/approve`),
    ]);

    assert.equal(approve.status, 200, approve.text.slice(0, 160));
    assert.ok([200, 409].includes(edit.status), `edit status ${edit.status}`);
    const doc = await stored(id);
    assert.equal(doc.approvalStatus, "APPROVED");
    // Whichever order they ran in, the amount is either the original or the edit
    // that landed BEFORE the approval - never an edit applied afterwards.
    if (edit.status === 409) assert.equal(doc.amount, 100);
  });
});

// ---- integrity of approved records -----------------------------------------------

describe("pending records: edit and delete", () => {
  test("a pending transaction can be edited by a finance:edit holder; the status and creator stay", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);

    const res = await call("treasurerA", "PUT", `/transactions/${id}`, {
      amount: 4321,
      category: "Edited",
      description: "edited description",
      type: "INCOME",
      approvalStatus: "APPROVED",
      approvedBy: users.admin.id,
      createdBy: users.admin.id,
    });

    assert.equal(res.status, 200, res.text.slice(0, 300));
    const doc = await stored(id);
    assert.equal(doc.amount, 4321);
    assert.equal(doc.category, "Edited");
    assert.equal(doc.type, "INCOME");
    assert.equal(doc.approvalStatus, "PENDING");
    assert.equal(doc.approvedBy, null);
    assert.equal(String(doc.createdBy), String(before.createdBy));
  });

  test("a pending transaction can be deleted by a finance:delete holder", async () => {
    const id = await createPending("chairA");

    const res = await call("treasurerA", "DELETE", `/transactions/${id}`);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(await stored(id), null);
  });

  test("invalid edits are rejected and change nothing", async () => {
    const id = await createPending("chairA");
    const before = await stored(id);

    const negative = await call("chairA", "PUT", `/transactions/${id}`, { amount: -1 });
    const badType = await call("chairA", "PUT", `/transactions/${id}`, { type: "TRANSFER", amount: 5 });
    const malformed = await call("chairA", "PUT", "/transactions/not-an-object-id", { amount: 1 });
    const missing = await call("chairA", "PUT", `/transactions/${MISSING}`, { amount: 1 });

    assert.equal(negative.status, 400);
    assert.equal(badType.status, 400);
    assert.equal(malformed.status, 400);
    assert.equal(missing.status, 404);
    assert.deepEqual(await stored(id), before);
  });
});

describe("approved and rejected records are immutable", () => {
  test("an approved transaction cannot be edited or hard-deleted, by anyone", async () => {
    const id = await createApproved("chairA", "treasurerA", { type: "INCOME", amount: 60 });
    const before = approvedSnapshot(await stored(id));
    const balance = await reportedBalance(A);

    for (const key of ["chairA", "treasurerA", "admin"]) {
      const edit = await call(key, "PUT", `/transactions/${id}`, {
        amount: 1,
        type: "EXPENSE",
        category: "Tampered",
        description: "Tampered",
        approvalStatus: "REJECTED",
      });
      const remove = await call(key, "DELETE", `/transactions/${id}`);

      assert.equal(edit.status, 409, `${key} edit`);
      assert.equal(remove.status, 409, `${key} delete`);
    }
    const after = await stored(id);
    assert.ok(after, "the approved record was removed");
    assert.equal(approvedSnapshot(after), before);
    assert.equal(await reportedBalance(A), balance);
  });

  test("a rejected transaction cannot be edited or deleted either", async () => {
    const id = await createPending("chairA");
    await call("treasurerA", "PATCH", `/transactions/${id}/reject`);
    const before = await stored(id);

    const edit = await call("chairA", "PUT", `/transactions/${id}`, { amount: 1 });
    const remove = await call("admin", "DELETE", `/transactions/${id}`);

    assert.equal(edit.status, 409);
    assert.equal(remove.status, 409);
    assert.deepEqual(await stored(id), before);
  });

  test("a legacy approved record is protected the same way", async () => {
    const before = await stored(legacy.approved);

    const edit = await call("chairA", "PUT", `/transactions/${legacy.approved}`, { amount: 1 });
    const remove = await call("admin", "DELETE", `/transactions/${legacy.approved}`);

    assert.equal(edit.status, 409);
    assert.equal(remove.status, 409);
    assert.deepEqual(await stored(legacy.approved), before);
  });
});

// ---- reversals -------------------------------------------------------------------

describe("reversals", () => {
  test("a reversal is a separate pending record linked to the original, which stays untouched", async () => {
    const id = await createApproved("chairA", "treasurerA", { type: "EXPENSE", amount: 90 });
    const original = approvedSnapshot(await stored(id));
    const balance = await reportedBalance(A);

    const res = await call("chairA", "POST", `/transactions/${id}/reverse`, { reason: "entered twice" });

    assert.equal(res.status, 201, res.text.slice(0, 300));
    const reversal = await stored(res.body.data.id);
    assert.equal(reversal.approvalStatus, "PENDING");
    assert.equal(String(reversal.reversalOf), id);
    assert.equal(reversal.type, "INCOME");
    assert.equal(reversal.amount, 90);
    assert.equal(String(reversal.societyId), A);
    assert.equal(String(reversal.createdBy), users.chairA.id);
    assert.equal(reversal.approvedBy, null);
    assert.equal(reversal.notes, "entered twice");
    assert.equal(approvedSnapshot(await stored(id)), original, "the original was modified");
    assert.equal(await reportedBalance(A), balance, "a pending reversal changed the balance");
  });

  test("an approved reversal cancels the original's effect on the balance", async () => {
    const start = await reportedBalance(A);
    const id = await createApproved("chairA", "treasurerA", { type: "EXPENSE", amount: 55 });
    assert.equal(await reportedBalance(A), start - 55);
    const reversal = (await call("chairA", "POST", `/transactions/${id}/reverse`, {})).body.data.id;

    const approved = await call("treasurerA", "PATCH", `/transactions/${reversal}/approve`);

    assert.equal(approved.status, 200, approved.text.slice(0, 200));
    assert.equal(await reportedBalance(A), start);
    assert.equal(await expectedBalance(A), start);
  });

  test("a reversal follows the approval rules: a non-admin creator cannot approve their own, an administrator can", async () => {
    const id = await createApproved();
    const mine = (await call("chairA", "POST", `/transactions/${id}/reverse`, {})).body.data.id;
    const own = await call("chairA", "PATCH", `/transactions/${mine}/approve`);
    assert.equal(own.status, 403);
    assert.equal((await stored(mine)).approvalStatus, "PENDING");

    const rejected = await call("treasurerA", "PATCH", `/transactions/${mine}/reject`);
    assert.equal(rejected.status, 200);

    const second = (await call("admin", "POST", `/transactions/${id}/reverse`, {})).body.data.id;
    const adminOwn = await call("admin", "PATCH", `/transactions/${second}/approve`);
    assert.equal(adminOwn.status, 200, adminOwn.text.slice(0, 200));
  });

  test("an original can be reversed only once, sequentially", async () => {
    const id = await createApproved();
    const first = await call("chairA", "POST", `/transactions/${id}/reverse`, {});
    assert.equal(first.status, 201);

    const pendingDuplicate = await call("treasurerA", "POST", `/transactions/${id}/reverse`, {});
    assert.equal(pendingDuplicate.status, 409);
    await call("treasurerA", "PATCH", `/transactions/${first.body.data.id}/approve`);
    const approvedDuplicate = await call("treasurerA", "POST", `/transactions/${id}/reverse`, {});
    assert.equal(approvedDuplicate.status, 409);

    assert.equal((await reversalsOf(id)).length, 1);
  });

  test("concurrent reversal requests create exactly one reversal", async () => {
    const id = await createApproved();

    const results = await Promise.all([
      call("chairA", "POST", `/transactions/${id}/reverse`, {}),
      call("treasurerA", "POST", `/transactions/${id}/reverse`, {}),
      call("admin", "POST", `/transactions/${id}/reverse`, {}),
      call("treasurer2A", "POST", `/transactions/${id}/reverse`, {}),
    ]);

    assert.equal(results.filter((r) => r.status === 201).length, 1, results.map((r) => r.status).join(","));
    assert.equal(results.filter((r) => r.status === 409).length, 3);
    assert.equal((await reversalsOf(id)).length, 1);
  });

  test("a rejected or deleted reversal frees the original for another attempt", async () => {
    const id = await createApproved();
    const first = (await call("chairA", "POST", `/transactions/${id}/reverse`, {})).body.data.id;
    await call("treasurerA", "PATCH", `/transactions/${first}/reject`);

    const retry = await call("chairA", "POST", `/transactions/${id}/reverse`, {});
    assert.equal(retry.status, 201, retry.text.slice(0, 200));
    const removed = await call("chairA", "DELETE", `/transactions/${retry.body.data.id}`);
    assert.equal(removed.status, 200);
    const again = await call("chairA", "POST", `/transactions/${id}/reverse`, {});
    assert.equal(again.status, 201, again.text.slice(0, 200));

    assert.equal((await stored(first)).approvalStatus, "REJECTED", "the rejected reversal was not kept");
  });

  test("only approved, non-reversal transactions can be reversed", async () => {
    const pending = await createPending("chairA");
    const rejected = await createPending("chairA");
    await call("treasurerA", "PATCH", `/transactions/${rejected}/reject`);
    const approved = await createApproved();
    const reversal = (await call("chairA", "POST", `/transactions/${approved}/reverse`, {})).body.data.id;
    await call("treasurerA", "PATCH", `/transactions/${reversal}/approve`);
    const count = await transactionCount();

    for (const target of [pending, rejected, reversal]) {
      const res = await call("chairA", "POST", `/transactions/${target}/reverse`, {});

      assert.equal(res.status, 409, target);
    }
    assert.equal(await transactionCount(), count);
  });

  test("a reversal's amount, type and society cannot be chosen by the client", async () => {
    const id = await createApproved("chairA", "treasurerA", { type: "INCOME", amount: 12 });

    const res = await call("chairA", "POST", `/transactions/${id}/reverse`, {
      amount: 1,
      type: "INCOME",
      societyId: B,
      approvalStatus: "APPROVED",
      createdBy: users.admin.id,
      reversalOf: legacy.approved,
    });

    assert.equal(res.status, 201, res.text.slice(0, 300));
    const doc = await stored(res.body.data.id);
    assert.equal(doc.amount, 12);
    assert.equal(doc.type, "EXPENSE");
    assert.equal(String(doc.societyId), A);
    assert.equal(doc.approvalStatus, "PENDING");
    assert.equal(String(doc.createdBy), users.chairA.id);
    assert.equal(String(doc.reversalOf), id);
  });

  test("invalid references, other societies and missing permissions are refused and create nothing", async () => {
    const id = await createApproved();
    const count = await transactionCount();

    const malformed = await call("chairA", "POST", "/transactions/not-an-object-id/reverse", {});
    const missing = await call("chairA", "POST", `/transactions/${MISSING}/reverse`, {});
    const foreign = await call("treasurerB", "POST", `/transactions/${id}/reverse`, {});
    const noPermission = await call("viceChairA", "POST", `/transactions/${id}/reverse`, {});
    const noRole = await call("memberA", "POST", `/transactions/${id}/reverse`, {});
    const badReason = await call("chairA", "POST", `/transactions/${id}/reverse`, { reason: { a: 1 } });

    assert.equal(malformed.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(foreign.status, 403);
    assert.equal(noPermission.status, 403);
    assert.equal(noRole.status, 403);
    assert.equal(badReason.status, 400);
    assert.equal(await transactionCount(), count);
  });

  test("a legacy approved record can be reversed", async () => {
    const res = await call("chairA", "POST", `/transactions/${legacy.approved}/reverse`, {});

    assert.equal(res.status, 201, res.text.slice(0, 300));
    assert.equal((await stored(legacy.approved)).approvalStatus, "APPROVED");
    assert.equal((await stored(res.body.data.id)).type, "EXPENSE");
  });

  test("a reversal itself cannot be edited", async () => {
    const id = await createApproved();
    const reversal = (await call("chairA", "POST", `/transactions/${id}/reverse`, {})).body.data.id;
    const before = await stored(reversal);

    const res = await call("chairA", "PUT", `/transactions/${reversal}`, { amount: 1 });

    assert.equal(res.status, 409);
    assert.deepEqual(await stored(reversal), before);
  });
});

// ---- balances and dashboards -----------------------------------------------------

describe("balances and dashboards count approved transactions only", () => {
  test("every path agrees with the approved-only figure computed from the database", async () => {
    // A mix of statuses across both societies.
    await createPending("chairA", { type: "INCOME", amount: 1000 });
    const rejected = await createPending("chairA", { type: "INCOME", amount: 2000 });
    await call("treasurerA", "PATCH", `/transactions/${rejected}/reject`);
    await createApproved("chairA", "treasurerA", { type: "INCOME", amount: 300 });
    await createApproved("chairA", "treasurerA", { type: "EXPENSE", amount: 120 });
    await createApproved("chairB", "treasurerB", { type: "INCOME", amount: 70 });

    const expectedA = await expectedBalance(A);
    const expectedB = await expectedBalance(B);

    assert.equal(await reportedBalance(A), expectedA, "GET /societies (A)");
    assert.equal(await reportedBalance(B), expectedB, "GET /societies (B)");

    const society = await call("chairA", "GET", `/dashboard/society/${A}`);
    assert.equal(society.status, 200, society.text.slice(0, 200));
    assert.equal(society.body.data.summary.balance, expectedA, "society dashboard summary");
    assert.equal(society.body.data.society.balance, expectedA, "society dashboard society");

    const overall = await call("admin", "GET", "/dashboard");
    assert.equal(overall.status, 200, overall.text.slice(0, 200));
    const totals = await withDatabase(target, async (db) => {
      const rows = await db
        .collection("transactions")
        .aggregate([{ $match: { approvalStatus: "APPROVED" } }, { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } }])
        .toArray();
      const get = (type) => rows.find((r) => r._id === type) || { total: 0, count: 0 };
      return { income: get("INCOME"), expense: get("EXPENSE") };
    });
    assert.equal(overall.body.data.summary.totalIncome, totals.income.total, "dashboard income");
    assert.equal(overall.body.data.summary.totalExpense, totals.expense.total, "dashboard expense");
    assert.equal(overall.body.data.summary.transactionCount, totals.income.count + totals.expense.count);
  });

  test("pending and rejected transactions stay visible to authorized users for workflow management", async () => {
    const pending = await createPending("chairA");
    const rejected = await createPending("chairA");
    await call("treasurerA", "PATCH", `/transactions/${rejected}/reject`);

    const all = await call("viceChairA", "GET", `/transactions/society/${A}?limit=1000`);
    const onlyPending = await call("viceChairA", "GET", `/transactions/society/${A}?approvalStatus=PENDING&limit=1000`);
    const invalid = await call("viceChairA", "GET", `/transactions/society/${A}?approvalStatus=BOGUS`);

    const idsOfAll = all.body.data.map((t) => t.id);
    assert.ok(idsOfAll.includes(pending) && idsOfAll.includes(rejected));
    assert.ok(onlyPending.body.data.length >= 1 && onlyPending.body.data.every((t) => t.approvalStatus === "PENDING"));
    assert.ok(onlyPending.body.data.some((t) => t.id === pending));
    assert.equal(invalid.status, 400);
  });
});

describe("regression: the existing response contracts", () => {
  test("list, item and create responses keep their envelopes", async () => {
    const id = await createPending("chairA");

    const list = await call("chairA", "GET", `/transactions/society/${A}`);
    const item = await call("chairA", "GET", `/transactions/${id}`);

    assert.deepEqual(Object.keys(list.body).sort(), ["count", "data", "success"]);
    assert.equal(list.body.count, list.body.data.length);
    assert.deepEqual(Object.keys(item.body).sort(), ["data", "success"]);
    assert.equal(item.body.data.id, id);
    assert.equal(item.body.data.societyId.name, "Integration Society A");
  });

  test("a malformed or unknown id on the item route is a clean 400 / 404", async () => {
    const malformed = await call("chairA", "GET", "/transactions/not-an-object-id");
    const missing = await call("chairA", "GET", `/transactions/${MISSING}`);

    assert.equal(malformed.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, "Transaction not found");
  });

  test("the server stays healthy", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});
