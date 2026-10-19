// AUD-005 finance workflow (routes/transactions.js and the balance aggregates).
//
// The real router and the real permission/scope middleware run; the permission
// resolver, audit logger and the Transaction / Society models' database calls are
// stubbed, so no database or server is involved. Database-level behavior (the
// conditional updates, the unique reversal indexes, concurrency) is covered by
// test/integration/finance-workflow.integration.test.js.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");

const CALLER = "64b7f8f2a1b2c3d4e5f6a001";
const OTHER = "64b7f8f2a1b2c3d4e5f6a002";
const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const TX = "64b7f8f2a1b2c3d4e5f6c001";
const TX2 = "64b7f8f2a1b2c3d4e5f6c002";
const MISSING = "64b7f8f2a1b2c3d4e5f6c0ff";

const Transaction = require("../../src/models/Transaction");
const Society = require("../../src/models/Society");
const original = {
  find: Transaction.find,
  findById: Transaction.findById,
  findOne: Transaction.findOne,
  findOneAndUpdate: Transaction.findOneAndUpdate,
  findOneAndDelete: Transaction.findOneAndDelete,
  create: Transaction.create,
  aggregate: Transaction.aggregate,
  societyExists: Society.exists,
};

let docs; // id -> transaction document (plain object)
let calls;
let resolved;
let updateResult; // what findOneAndUpdate resolves to (null = lost the race)
let deleteResult;
let createError;

function stubModule(relPath, exportsValue) {
  const file = require.resolve(path.join(__dirname, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsValue };
}
function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}

const tx = (extra = {}) => ({
  _id: TX,
  societyId: SOCIETY_A,
  type: "EXPENSE",
  amount: 100,
  category: "Workflow",
  description: "d",
  approvalStatus: "PENDING",
  createdBy: OTHER,
  approvedBy: null,
  ...extra,
});

const thenable = (value) => {
  const chain = { populate: () => chain, then: (a, b) => Promise.resolve(value).then(a, b) };
  return chain;
};

beforeEach(() => {
  docs = { [TX]: tx(), [TX2]: tx({ _id: TX2, societyId: SOCIETY_B }) };
  calls = { updates: [], deletes: [], creates: [], finds: [], findOnes: [], aggregates: [], audits: [] };
  updateResult = "winner";
  deleteResult = "removed";
  createError = null;
  resolved = { role: "r", scope: { type: "society", societyId: SOCIETY_A }, permissions: {} };

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", {
    logAudit: async (entry) => {
      calls.audits.push(entry);
    },
  });
  delete require.cache[require.resolve("../../src/middleware/rbac.js")];
  const authFile = require.resolve(path.join(__dirname, "../../src/middleware/auth.js"));
  delete require.cache[authFile];
  const auth = require(authFile);
  require.cache[authFile] = {
    id: authFile,
    filename: authFile,
    loaded: true,
    exports: { ...auth, authenticate: (req, res, next) => next() },
  };

  Society.exists = async (query) => (String(query._id) === SOCIETY_A || String(query._id) === SOCIETY_B ? { _id: query._id } : null);
  Transaction.findById = (id) => thenable(docs[String(id)] || null);
  Transaction.findOne = async (filter) => {
    calls.findOnes.push(filter);
    return Object.values(docs).find((d) => Object.entries(filter).every(([k, v]) => (v && v.$in ? v.$in.includes(d[k]) : String(d[k]) === String(v)))) || null;
  };
  Transaction.find = (filter) => {
    calls.finds.push(filter);
    const chain = { populate: () => chain, sort: () => chain, limit: async () => Object.values(docs) };
    return chain;
  };
  Transaction.findOneAndUpdate = async (filter, update) => {
    calls.updates.push({ filter, update });
    return updateResult === null ? null : { ...docs[String(filter._id)], ...update.$set, _id: filter._id };
  };
  Transaction.findOneAndDelete = async (filter) => {
    calls.deletes.push(filter);
    return deleteResult === null ? null : docs[String(filter._id)];
  };
  Transaction.create = async (doc) => {
    calls.creates.push(doc);
    if (createError) throw createError;
    const created = { _id: TX2, ...doc };
    docs[TX2] = created;
    return created;
  };
  Transaction.aggregate = async (pipeline) => {
    calls.aggregates.push(pipeline);
    return [];
  };
});

test.after(() => {
  Object.assign(Transaction, {
    find: original.find,
    findById: original.findById,
    findOne: original.findOne,
    findOneAndUpdate: original.findOneAndUpdate,
    findOneAndDelete: original.findOneAndDelete,
    create: original.create,
    aggregate: original.aggregate,
  });
  Society.exists = original.societyExists;
});

function mockRes() {
  const res = { statusCode: 200, body: null, sent: false };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    res.sent = true;
    return res;
  };
  return res;
}

async function run(routerPath, method, routePath, { user, params = {}, body = {}, query = {} }) {
  const router = freshLoad(routerPath);
  const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]);
  assert.ok(layer, `no ${method} ${routePath}`);
  const req = {
    user,
    params,
    body,
    query,
    method: method.toUpperCase(),
    originalUrl: `/api/v1/transactions${routePath}`,
    ip: "127.0.0.1",
    headers: {},
    socket: {},
  };
  const res = mockRes();
  let error = null;
  for (const handlerLayer of layer.route.stack) {
    if (res.sent || error) break;
    await new Promise((resolve) => {
      Promise.resolve(handlerLayer.handle(req, res, (err) => {
        if (err) error = err;
        resolve();
      })).then(() => {
        if (res.sent) resolve();
      }, (err) => {
        error = err;
        resolve();
      });
    });
  }
  return { res, error, req };
}
const tr = (method, routePath, options) => run("../../src/routes/transactions.js", method, routePath, options);

const grant = (...keys) => {
  resolved = { ...resolved, permissions: Object.fromEntries(keys.map((k) => [k, "limited_own_scope"])) };
};
const user = (extra = {}) => ({ _id: CALLER, role: "OFFICE_BEARER", societyId: SOCIETY_A, ...extra });
const admin = () => user({ role: "ADMIN", societyId: null });

// ---- every route is guarded by exactly the right permission -----------------------

const ROUTES = [
  ["get", "/", "finance:view", {}],
  ["get", "/society/:societyId", "finance:view", { params: { societyId: SOCIETY_A } }],
  ["get", "/:id", "finance:view", { params: { id: TX } }],
  ["post", "/", "finance:create", { body: { societyId: SOCIETY_A, type: "INCOME", amount: 1, category: "c", description: "d" } }],
  ["put", "/:id", "finance:edit", { params: { id: TX }, body: { amount: 1 } }],
  ["delete", "/:id", "finance:delete", { params: { id: TX } }],
  ["patch", "/:id/approve", "finance:approve", { params: { id: TX } }],
  ["patch", "/:id/reject", "finance:approve", { params: { id: TX } }],
  ["post", "/:id/reverse", "finance:edit", { params: { id: TX }, body: {} }],
];

test("the router has no route other than the nine guarded ones", () => {
  const router = freshLoad("../../src/routes/transactions.js");
  const found = router.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0]} ${l.route.path}`);

  assert.deepEqual(found.sort(), ROUTES.map(([m, p]) => `${m} ${p}`).sort());
});

for (const [method, routePath, permission, options] of ROUTES) {
  test(`${method.toUpperCase()} ${routePath}: denied without ${permission}, even to an administrator or with every other permission`, async () => {
    const others = ["finance:view", "finance:create", "finance:edit", "finance:delete", "finance:approve"].filter((k) => k !== permission);
    for (const [label, who] of [["admin", admin()], ["member", user()]]) {
      for (const keys of [[], others]) {
        grant(...keys);
        calls = { ...calls, creates: [], updates: [], deletes: [] };

        const { res } = await tr(method, routePath, { user: who, ...options });

        assert.equal(res.statusCode, 403, `${label} with ${JSON.stringify(keys)}`);
        assert.equal(res.body.error.code, "PERMISSION_DENIED");
        assert.deepEqual(calls.creates, []);
        assert.deepEqual(calls.updates, []);
        assert.deepEqual(calls.deletes, []);
      }
    }
  });

  test(`${method.toUpperCase()} ${routePath}: ${permission} alone gets past the permission check`, async () => {
    grant(permission);

    const { res } = await tr(method, routePath, { user: admin(), ...options });

    assert.notEqual(res.statusCode, 403, res.body && JSON.stringify(res.body).slice(0, 120));
  });
}

// ---- creation -----------------------------------------------------------------------

test("create: PENDING, createdBy is the caller, and server fields in the body are ignored", async () => {
  grant("finance:create");

  const { res } = await tr("post", "/", {
    user: user(),
    body: {
      societyId: SOCIETY_A,
      type: "INCOME",
      amount: 5,
      category: "c",
      description: "d",
      approvalStatus: "APPROVED",
      approvedBy: OTHER,
      createdBy: OTHER,
      decidedBy: OTHER,
      decidedAt: "2001-01-01",
      reversalOf: TX,
    },
  });

  assert.equal(res.statusCode, 201);
  assert.equal(calls.creates.length, 1);
  const created = calls.creates[0];
  assert.equal(created.approvalStatus, "PENDING");
  assert.equal(String(created.createdBy), CALLER);
  for (const field of ["approvedBy", "decidedBy", "decidedAt", "reversalOf"]) {
    assert.equal(created[field], undefined, field);
  }
});

test("create: a non-admin who names no society gets their own (societyAccess injects it as an ObjectId)", async () => {
  grant("finance:create");
  const own = new mongoose.Types.ObjectId(SOCIETY_A);

  const { res } = await tr("post", "/", {
    user: user({ societyId: own }),
    body: { type: "INCOME", amount: 5, category: "c", description: "d" },
  });

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(String(calls.creates[0].societyId), SOCIETY_A);
});

test("create: invalid, unknown and foreign societies create nothing", async () => {
  grant("finance:create");
  const body = (societyId) => ({ societyId, type: "INCOME", amount: 5, category: "c", description: "d" });

  const malformed = await tr("post", "/", { user: admin(), body: body("not-an-object-id") });
  const arrayId = await tr("post", "/", { user: admin(), body: body([SOCIETY_A]) });
  const missing = await tr("post", "/", { user: admin(), body: body(MISSING) });
  const foreign = await tr("post", "/", { user: user(), body: body(SOCIETY_B) });
  const adminNone = await tr("post", "/", { user: admin(), body: { type: "INCOME", amount: 5, category: "c", description: "d" } });

  assert.equal(malformed.res.statusCode, 400);
  assert.equal(arrayId.res.statusCode, 400);
  assert.equal(missing.res.statusCode, 404);
  assert.equal(foreign.res.statusCode, 403);
  assert.equal(adminNone.res.statusCode, 400);
  assert.deepEqual(calls.creates, []);
});

// ---- approval ------------------------------------------------------------------------

test("approve: a different user approves; approver, decision-maker and timestamp are the caller", async () => {
  grant("finance:approve");

  const { res } = await tr("patch", "/:id/approve", { user: user(), params: { id: TX } });

  assert.equal(res.statusCode, 200);
  const { filter, update } = calls.updates[0];
  assert.deepEqual(filter, { _id: TX, approvalStatus: "PENDING" });
  assert.equal(update.$set.approvalStatus, "APPROVED");
  assert.equal(String(update.$set.approvedBy), CALLER);
  assert.equal(String(update.$set.decidedBy), CALLER);
  assert.ok(update.$set.decidedAt instanceof Date);
  // (the permission middleware logs its own access_check entry first)
  assert.ok(calls.audits.some((entry) => entry.action === "finance_transaction_approved" && String(entry.user) === CALLER));
});

test("approve: a non-administrator cannot approve their own transaction", async () => {
  grant("finance:approve");
  docs[TX] = tx({ createdBy: CALLER });

  const { res } = await tr("patch", "/:id/approve", { user: user(), params: { id: TX } });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "You cannot approve a transaction you created");
  assert.deepEqual(calls.updates, []);
});

test("approve: an administrator holding finance:approve may approve their own", async () => {
  grant("finance:approve");
  docs[TX] = tx({ createdBy: CALLER });

  const { res } = await tr("patch", "/:id/approve", { user: admin(), params: { id: TX } });

  assert.equal(res.statusCode, 200);
  assert.equal(String(calls.updates[0].update.$set.decidedBy), CALLER);
});

test("approve: a legacy record without createdBy has no creator to compare against", async () => {
  grant("finance:approve");
  docs[TX] = tx({ createdBy: undefined });

  const { res } = await tr("patch", "/:id/approve", { user: user(), params: { id: TX } });

  assert.equal(res.statusCode, 200);
});

test("approve and reject: only PENDING transactions; the transition is conditional on PENDING", async () => {
  grant("finance:approve");
  for (const status of ["APPROVED", "REJECTED"]) {
    docs[TX] = tx({ approvalStatus: status });
    for (const routePath of ["/:id/approve", "/:id/reject"]) {
      const { res } = await tr("patch", routePath, { user: admin(), params: { id: TX } });

      assert.equal(res.statusCode, 409, `${status} ${routePath}`);
    }
  }
  assert.deepEqual(calls.updates, []);

  docs[TX] = tx();
  updateResult = null; // someone else decided between the read and the update
  const lost = await tr("patch", "/:id/approve", { user: user(), params: { id: TX } });
  assert.equal(lost.res.statusCode, 409);
  assert.deepEqual(calls.updates.at(-1).filter, { _id: TX, approvalStatus: "PENDING" });
});

test("reject: records the decision-maker and sets no approver", async () => {
  grant("finance:approve");

  const { res } = await tr("patch", "/:id/reject", { user: user(), params: { id: TX } });

  assert.equal(res.statusCode, 200);
  const set = calls.updates[0].update.$set;
  assert.equal(set.approvalStatus, "REJECTED");
  assert.equal(String(set.decidedBy), CALLER);
  assert.equal("approvedBy" in set, false);
});

test("decisions: another society is 403, a malformed id 400, an unknown id 404; nothing is written", async () => {
  grant("finance:approve");

  const foreign = await tr("patch", "/:id/approve", { user: user(), params: { id: TX2 } });
  const malformed = await tr("patch", "/:id/approve", { user: user(), params: { id: "bad" } });
  const missing = await tr("patch", "/:id/approve", { user: user(), params: { id: MISSING } });

  assert.equal(foreign.res.statusCode, 403);
  assert.equal(malformed.res.statusCode, 400);
  assert.equal(missing.res.statusCode, 404);
  assert.deepEqual(calls.updates, []);
});

test("approving a reversal requires the transaction it reverses to still be approved", async () => {
  grant("finance:approve");
  docs[TX2] = tx({ _id: TX2, societyId: SOCIETY_A, reversalOf: TX, createdBy: OTHER });
  docs[TX] = tx({ approvalStatus: "REJECTED" });

  const { res } = await tr("patch", "/:id/approve", { user: user(), params: { id: TX2 } });

  assert.equal(res.statusCode, 409);
  assert.deepEqual(calls.updates, []);
});

// ---- edit and delete -------------------------------------------------------------------

test("edit: only PENDING; the update is conditional on PENDING; protected fields are never set", async () => {
  grant("finance:edit");

  const { res } = await tr("put", "/:id", {
    user: user(),
    params: { id: TX },
    body: { amount: 7, type: "INCOME", approvalStatus: "APPROVED", approvedBy: OTHER, createdBy: OTHER, societyId: SOCIETY_B },
  });

  assert.equal(res.statusCode, 200);
  const { filter, update } = calls.updates[0];
  assert.deepEqual(filter, { _id: TX, approvalStatus: "PENDING" });
  assert.deepEqual(Object.keys(update.$set).sort(), ["amount", "type"]);
});

test("edit: approved, rejected and reversal records cannot be edited", async () => {
  grant("finance:edit");
  for (const doc of [tx({ approvalStatus: "APPROVED" }), tx({ approvalStatus: "REJECTED" }), tx({ reversalOf: TX2 })]) {
    docs[TX] = doc;

    const { res } = await tr("put", "/:id", { user: user(), params: { id: TX }, body: { amount: 1 } });

    assert.equal(res.statusCode, 409);
  }
  assert.deepEqual(calls.updates, []);
});

test("delete: only PENDING; approved and rejected records are never removed", async () => {
  grant("finance:delete");
  for (const status of ["APPROVED", "REJECTED"]) {
    docs[TX] = tx({ approvalStatus: status });

    const { res } = await tr("delete", "/:id", { user: admin(), params: { id: TX } });

    assert.equal(res.statusCode, 409, status);
  }
  assert.deepEqual(calls.deletes, []);

  docs[TX] = tx();
  const ok = await tr("delete", "/:id", { user: user(), params: { id: TX } });
  assert.equal(ok.res.statusCode, 200);
  assert.deepEqual(calls.deletes[0], { _id: TX, approvalStatus: "PENDING" });

  deleteResult = null;
  const lost = await tr("delete", "/:id", { user: user(), params: { id: TX } });
  assert.equal(lost.res.statusCode, 409);
});

// ---- reversal -------------------------------------------------------------------------

test("reverse: builds an opposite, same-amount, same-society PENDING record linked to the original", async () => {
  grant("finance:edit");
  docs[TX] = tx({ approvalStatus: "APPROVED", type: "EXPENSE", amount: 90 });

  const { res } = await tr("post", "/:id/reverse", {
    user: user(),
    params: { id: TX },
    body: { reason: "entered twice", amount: 1, type: "EXPENSE", societyId: SOCIETY_B, approvalStatus: "APPROVED", createdBy: OTHER },
  });

  assert.equal(res.statusCode, 201);
  const created = calls.creates[0];
  assert.equal(created.type, "INCOME");
  assert.equal(created.amount, 90);
  assert.equal(String(created.societyId), SOCIETY_A);
  assert.equal(created.approvalStatus, "PENDING");
  assert.equal(String(created.createdBy), CALLER);
  assert.equal(String(created.reversalOf), TX);
  assert.equal(created.notes, "entered twice");
  assert.equal(calls.updates.length, 0, "the original was modified");
});

test("reverse: only approved, non-reversal transactions, once", async () => {
  grant("finance:edit");
  for (const doc of [tx({ approvalStatus: "PENDING" }), tx({ approvalStatus: "REJECTED" }), tx({ approvalStatus: "APPROVED", reversalOf: TX2 })]) {
    docs[TX] = doc;

    const { res } = await tr("post", "/:id/reverse", { user: user(), params: { id: TX }, body: {} });

    assert.equal(res.statusCode, 409);
  }
  docs[TX] = tx({ approvalStatus: "APPROVED" });
  docs[TX2] = tx({ _id: TX2, reversalOf: TX, approvalStatus: "PENDING" });
  const duplicate = await tr("post", "/:id/reverse", { user: user(), params: { id: TX }, body: {} });
  assert.equal(duplicate.res.statusCode, 409);
  assert.deepEqual(calls.creates, []);
});

test("reverse: a duplicate that slips past the check is stopped by the unique index (409)", async () => {
  grant("finance:edit");
  docs[TX] = tx({ approvalStatus: "APPROVED" });
  createError = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });

  const { res } = await tr("post", "/:id/reverse", { user: user(), params: { id: TX }, body: {} });

  assert.equal(res.statusCode, 409);
});

test("reverse: another society, a malformed or unknown id, and a bad reason are refused", async () => {
  grant("finance:edit");
  docs[TX] = tx({ approvalStatus: "APPROVED" });
  docs[TX2] = tx({ _id: TX2, societyId: SOCIETY_B, approvalStatus: "APPROVED" });

  const foreign = await tr("post", "/:id/reverse", { user: user(), params: { id: TX2 }, body: {} });
  const malformed = await tr("post", "/:id/reverse", { user: user(), params: { id: "bad" }, body: {} });
  const missing = await tr("post", "/:id/reverse", { user: user(), params: { id: MISSING }, body: {} });
  const badReason = await tr("post", "/:id/reverse", { user: user(), params: { id: TX }, body: { reason: { a: 1 } } });
  const longReason = await tr("post", "/:id/reverse", { user: user(), params: { id: TX }, body: { reason: "x".repeat(501) } });

  assert.equal(foreign.res.statusCode, 403);
  assert.equal(malformed.res.statusCode, 400);
  assert.equal(missing.res.statusCode, 404);
  assert.equal(badReason.res.statusCode, 400);
  assert.equal(longReason.res.statusCode, 400);
  assert.deepEqual(calls.creates, []);
});

// ---- reads ---------------------------------------------------------------------------

test("reads: another society's item is 403, and the approvalStatus filter is validated", async () => {
  grant("finance:view");

  const foreign = await tr("get", "/:id", { user: user(), params: { id: TX2 } });
  const bad = await tr("get", "/society/:societyId", { user: user(), params: { societyId: SOCIETY_A }, query: { approvalStatus: "BOGUS" } });
  const good = await tr("get", "/society/:societyId", { user: user(), params: { societyId: SOCIETY_A }, query: { approvalStatus: "PENDING" } });

  assert.equal(foreign.res.statusCode, 403);
  assert.equal(bad.res.statusCode, 400);
  assert.equal(good.res.statusCode, 200);
  assert.equal(calls.finds.at(-1).approvalStatus, "PENDING");
});

// ---- every aggregation counts approved transactions only -------------------------------

const firstMatch = (pipeline) => pipeline.find((stage) => stage.$match).$match;

test("the society balance aggregation matches APPROVED only", async () => {
  const savedFind = Society.find;
  const savedCount = Society.countDocuments;
  try {
    Society.find = () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [{ _id: SOCIETY_A, budget: 10, officeBearers: [], members: [] }] }) }) }) });
    Society.countDocuments = async () => 1;

    const { res } = await run("../../src/routes/societies.js", "get", "/", { user: admin() });

    assert.equal(res.statusCode, 200);
  } finally {
    Society.find = savedFind;
    Society.countDocuments = savedCount;
  }

  assert.equal(calls.aggregates.length, 1);
  assert.equal(firstMatch(calls.aggregates[0]).approvalStatus, "APPROVED");
});

test("both dashboard aggregations match APPROVED only", async () => {
  const lean = (value) => ({ lean: async () => value, sort: () => lean(value), limit: () => lean(value), populate: () => lean(value) });
  const Event = require("../../src/models/Event");
  const Project = require("../../src/models/Project");
  const CalendarEvent = require("../../src/models/CalendarEvent");
  const saved = { society: Society.find, findById: Society.findById, eventCount: Event.countDocuments, eventFind: Event.find, projectAgg: Project.aggregate, projectFind: Project.find, cal: CalendarEvent.find };
  try {
    Society.find = () => lean([{ _id: SOCIETY_A, budget: 10, members: [], officeBearers: [] }]);
    Society.findById = () => lean({ _id: SOCIETY_A, budget: 10, members: [], officeBearers: [] });
    Event.countDocuments = async () => 0;
    Event.find = () => lean([]);
    Project.aggregate = async () => [];
    Project.find = () => lean([]);
    CalendarEvent.find = () => lean([]);
    Transaction.find = () => lean([]);

    const overall = await run("../../src/routes/dashboard.js", "get", "/", { user: admin() });
    const society = await run("../../src/routes/dashboard.js", "get", "/society/:societyId", { user: admin(), params: { societyId: SOCIETY_A } });

    assert.equal(overall.res.statusCode, 200, JSON.stringify(overall.res.body));
    assert.equal(society.res.statusCode, 200, JSON.stringify(society.res.body));
  } finally {
    Society.find = saved.society;
    Society.findById = saved.findById;
    Event.countDocuments = saved.eventCount;
    Event.find = saved.eventFind;
    Project.aggregate = saved.projectAgg;
    Project.find = saved.projectFind;
    CalendarEvent.find = saved.cal;
  }

  assert.equal(calls.aggregates.length, 2);
  for (const pipeline of calls.aggregates) assert.equal(firstMatch(pipeline).approvalStatus, "APPROVED");
});
