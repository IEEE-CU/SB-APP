// NEW-07 / AUD-035 and NEW-11 for society terms, without a server or a database.
//
// Read policy: administrators and users of the same society may list terms; any other caller
// is 403 before the database is queried. Budget fields need the existing finance:view
// permission held for that society; chair/treasurer e-mails are administrator-only.
// Creation waits for SocietyTerm.init() (the unique index) and is closed with 503 if the index
// cannot be built.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const TERM = "64b7f8f2a1b2c3d4e5f6d001";

let resolved;
let calls;
let initImpl;
let storedTerm;
let societyExists;

function stubModule(relPath, exportsValue) {
  const file = require.resolve(path.join(__dirname, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsValue };
}

const makeTerm = () => {
  const data = {
    id: TERM,
    society: SOCIETY_A,
    academicYear: "2026-27",
    status: "OPEN",
    allocatedBudget: 500,
    openingBalance: 40,
    closingBalance: 30,
    chair: { id: "u1", name: "Chair", email: "chair@example.test" },
    treasurer: { id: "u2", name: "Treasurer", email: "treasurer@example.test" },
    handoverChecklist: { reportsSubmitted: false },
  };
  return {
    ...data,
    handoverChecklist: { ...data.handoverChecklist },
    toJSON: () => JSON.parse(JSON.stringify(data)),
    save: async () => {},
  };
};

beforeEach(() => {
  calls = { inits: 0, creates: [], finds: [], populates: [], audits: [], permissionLookups: 0, societyLookups: [] };
  societyExists = true;
  initImpl = async () => {};
  storedTerm = makeTerm();
  resolved = {
    role: "society_chair",
    scope: { type: "society", societyId: SOCIETY_A },
    permissions: { "finance:view": "limited_own_scope" },
  };

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => {
      calls.permissionLookups += 1;
      return resolved;
    },
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });
  stubModule("../../src/models/AuditLog.js", {
    create: async (doc) => {
      calls.audits.push(doc);
      return doc;
    },
  });
  // D-21: creation first checks that the society exists.
  stubModule("../../src/models/Society.js", {
    exists: async (query) => {
      calls.societyLookups.push(query);
      return societyExists ? { _id: query._id } : null;
    },
  });
  stubModule("../../src/models/SocietyTerm.js", {
    init: () => {
      calls.inits += 1;
      return initImpl();
    },
    create: async (doc) => {
      calls.creates.push(doc);
      return { _id: TERM, ...doc };
    },
    find: (query) => {
      calls.finds.push(query);
      const chain = {
        populate: (field, select) => {
          calls.populates.push([field, select]);
          return chain;
        },
        sort: async () => [storedTerm],
      };
      return chain;
    },
    findOne: async () => storedTerm,
  });
  delete require.cache[require.resolve("../../src/middleware/rbac.js")];
  delete require.cache[require.resolve("../../src/routes/societies.js")];
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

// Runs the route's own handler stack (the shared authenticate layer is router-level).
async function call(method, routePath, { user, id = SOCIETY_A, body = {} }) {
  const router = require("../../src/routes/societies.js");
  const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]);
  assert.ok(layer, `no ${method} ${routePath}`);
  const req = { user, params: { id, termId: TERM }, body, query: {}, headers: {}, ip: "127.0.0.1", socket: {} };
  const res = mockRes();
  let error = null;
  for (const handlerLayer of layer.route.stack) {
    if (res.sent || error) break;
    await new Promise((resolve) => {
      Promise.resolve(handlerLayer.handle(req, res, (err) => {
        if (err) error = err;
        resolve();
      })).then(() => resolve(), (err) => {
        error = err;
        resolve();
      });
    });
  }
  return { res, error };
}

const list = (options) => call("get", "/:id/terms", options);
const create = (options) => call("post", "/:id/terms", options);
const handover = (options) => call("patch", "/:id/terms/:termId/handover", options);

const userIn = (societyId, role = "OFFICE_BEARER") => ({ _id: "caller", role, societyId });
const admin = () => userIn(null, "ADMIN");
const BUDGET_KEYS = ["allocatedBudget", "openingBalance", "closingBalance"];

// ---- scope ----------------------------------------------------------------------------

test("list: a user of the same society gets the terms", async () => {
  const { res } = await list({ user: userIn(SOCIETY_A) });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.length, 1);
  assert.deepEqual(calls.finds, [{ society: SOCIETY_A }]);
});

test("list: a populated society reference on the caller is understood", async () => {
  const { res } = await list({ user: userIn({ _id: SOCIETY_A, name: "A" }) });

  assert.equal(res.statusCode, 200);
});

test("list: another society, no society or a client-named society is 403 and nothing is read", async () => {
  for (const societyId of [SOCIETY_B, null, undefined, "", { _id: null }]) {
    const { res } = await list({ user: userIn(societyId) });

    assert.equal(res.statusCode, 403, JSON.stringify(societyId));
    assert.equal(res.body.message, "Access restricted to your own society");
    assert.equal(res.body.data, undefined);
  }
  assert.deepEqual(calls.finds, []);
  assert.equal(calls.permissionLookups, 0);
});

test("list: an administrator reads any society", async () => {
  for (const id of [SOCIETY_A, SOCIETY_B]) {
    const { res } = await list({ user: admin(), id });

    assert.equal(res.statusCode, 200, id);
  }
});

test("list: a malformed society id is 400 for everyone and never reaches the database", async () => {
  for (const user of [userIn(SOCIETY_A), admin()]) {
    for (const id of ["not-an-id", "abcdefghijkl", `${SOCIETY_A}0`, "undefined"]) {
      const { res } = await list({ user, id });

      assert.equal(res.statusCode, 400, id);
    }
  }
  assert.deepEqual(calls.finds, []);
});

// ---- budgets ----------------------------------------------------------------------------

test("budgets: finance:view for the caller's own society shows them", async () => {
  const { res } = await list({ user: userIn(SOCIETY_A) });

  const term = res.body.data[0];
  assert.deepEqual(BUDGET_KEYS.map((k) => term[k]), [500, 40, 30]);
});

test("budgets: a missing, 'none' or unrecognized finance:view hides them", async () => {
  for (const permissions of [{}, { "finance:view": "none" }, { "finance:view": "bogus" }, { "finance:view": 1 }, { "events:view": "full" }]) {
    resolved = { ...resolved, permissions };

    const { res } = await list({ user: userIn(SOCIETY_A) });

    assert.equal(res.statusCode, 200);
    for (const key of BUDGET_KEYS) assert.equal(key in res.body.data[0], false, `${key} with ${JSON.stringify(permissions)}`);
    assert.equal(res.body.data[0].academicYear, "2026-27");
  }
});

test("budgets: a society-scoped grant for another society does not count", async () => {
  resolved = { ...resolved, scope: { type: "society", societyId: SOCIETY_B } };

  const { res } = await list({ user: userIn(SOCIETY_A) });

  assert.equal(res.statusCode, 200);
  for (const key of BUDGET_KEYS) assert.equal(key in res.body.data[0], false);
});

test("budgets: a society-scoped role without a society hides them; a global scope shows them", async () => {
  resolved = { ...resolved, scope: { type: "society", societyId: null } };
  const hidden = await list({ user: userIn(SOCIETY_A) });
  resolved = { role: "sb_faculty_advisor", scope: { type: "global", societyId: null }, permissions: { "finance:view": "full" } };
  const shown = await list({ user: admin() });

  assert.equal("allocatedBudget" in hidden.res.body.data[0], false);
  assert.equal(shown.res.body.data[0].allocatedBudget, 500);
});

test("budgets: the legacy ADMIN role alone grants nothing without finance:view", async () => {
  resolved = { role: "guest", scope: { type: "none", societyId: null }, permissions: {} };

  const { res } = await list({ user: admin() });

  assert.equal(res.statusCode, 200);
  assert.equal("allocatedBudget" in res.body.data[0], false);
});

// ---- e-mails ----------------------------------------------------------------------------

test("emails: only administrators receive chair and treasurer e-mail addresses, and only they are loaded", async () => {
  resolved = { role: "sb_faculty_advisor", scope: { type: "global", societyId: null }, permissions: { "finance:view": "full" } };
  const asAdmin = await list({ user: admin() });
  const adminPopulates = calls.populates.slice();
  calls.populates = [];
  const asMember = await list({ user: userIn(SOCIETY_A) });

  assert.equal(asAdmin.res.body.data[0].chair.email, "chair@example.test");
  assert.equal(asAdmin.res.body.data[0].treasurer.email, "treasurer@example.test");
  assert.deepEqual(adminPopulates, [["chair", "name email"], ["treasurer", "name email"]]);
  assert.equal(asMember.res.body.data[0].chair.name, "Chair");
  assert.equal(JSON.stringify(asMember.res.body).includes("@example.test"), false);
  assert.deepEqual(calls.populates, [["chair", "name"], ["treasurer", "name"]]);
});

test("emails: a term without a chair or treasurer is shaped without error", async () => {
  const term = makeTerm();
  term.toJSON = () => ({ id: TERM, academicYear: "2026-27", chair: null, treasurer: null, allocatedBudget: 1 });
  storedTerm = term;

  const { res, error } = await list({ user: userIn(SOCIETY_A) });

  assert.equal(error, null);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].chair, null);
});

// ---- handover response --------------------------------------------------------------------

test("handover: the response honours the same budget protection (caller holds settings:edit, not finance:view)", async () => {
  resolved = { ...resolved, permissions: { "settings:edit": "limited_own_scope" } };

  const { res } = await handover({ user: userIn(SOCIETY_A), body: { notes: "n" } });

  assert.equal(res.statusCode, 200);
  assert.equal("allocatedBudget" in res.body.data, false);
  assert.equal(storedTerm.handoverChecklist.notes, "n");

  const router = require("../../src/routes/societies.js");
  const layer = router.stack.find((l) => l.route && l.route.path === "/:id/terms/:termId/handover");
  assert.equal(layer.route.stack.length, 3, "society guard + permission check + handler (D-23)");
});

// ---- handover authorization (D-23) ----------------------------------------------------------

test("handover: a user of the society without settings:edit is 403 and nothing is written", async () => {
  resolved = { ...resolved, role: "society_member", permissions: { "settings:edit": "none" } };

  const { res } = await handover({ user: userIn(SOCIETY_A), body: { notes: "changed", status: "ARCHIVED_TERM" } });

  assert.equal(res.statusCode, 403);
  assert.equal(storedTerm.handoverChecklist.notes, undefined);
  assert.equal(storedTerm.status, "OPEN");
  assert.deepEqual(calls.audits, []);
});

test("handover: a missing or malformed permission level is refused (fails closed)", async () => {
  for (const level of [undefined, "", "bogus", null, 3]) {
    resolved = { ...resolved, permissions: { "settings:edit": level } };
    const { res } = await handover({ user: userIn(SOCIETY_A), body: { notes: "x" } });
    assert.equal(res.statusCode, 403, String(level));
  }
  assert.equal(storedTerm.handoverChecklist.notes, undefined);
});

test("handover: another society's user, even holding settings:edit, is refused by the society guard", async () => {
  resolved = { ...resolved, permissions: { "settings:edit": "limited_own_scope" } };

  const { res } = await handover({ user: userIn(SOCIETY_B), id: SOCIETY_A, body: { notes: "x" } });

  assert.equal(res.statusCode, 403);
  assert.equal(storedTerm.handoverChecklist.notes, undefined);
  assert.equal(calls.permissionLookups, 0, "denied by scope before any permission lookup");
});

test("handover: a body societyId or record id cannot redirect the check (the society in the URL decides)", async () => {
  resolved = { ...resolved, permissions: { "settings:edit": "limited_own_scope" } };

  const { res } = await handover({ user: userIn(SOCIETY_B), id: SOCIETY_A, body: { societyId: SOCIETY_B, notes: "x" } });

  assert.equal(res.statusCode, 403);
});

test("handover: a holder of settings:edit in the society is allowed; an administrator needs no RBAC role", async () => {
  resolved = { ...resolved, permissions: { "settings:edit": "limited_own_scope" } };
  const chair = await handover({ user: userIn(SOCIETY_A), body: { reportsSubmitted: true } });
  assert.equal(chair.res.statusCode, 200);
  assert.equal(storedTerm.handoverChecklist.reportsSubmitted, true);

  resolved = { role: null, scope: { type: "none" }, permissions: {} };
  const lookupsBefore = calls.permissionLookups;
  const adminCall = await handover({ user: admin(), body: { notes: "admin note" } });
  assert.equal(adminCall.res.statusCode, 200);
  assert.equal(storedTerm.handoverChecklist.notes, "admin note");
  // The handler's response shaping does one lookup of its own; a non-administrator would add a second one
  // for the settings:edit check (the chair call above did).
  assert.equal(calls.permissionLookups - lookupsBefore, 1, "an administrator skips the settings:edit lookup");
});

test("handover: unrelated fields are preserved when only some are sent", async () => {
  resolved = { ...resolved, permissions: { "settings:edit": "limited_own_scope" } };

  const { res } = await handover({ user: userIn(SOCIETY_A), body: { notes: "only notes" } });

  assert.equal(res.statusCode, 200);
  assert.equal(storedTerm.handoverChecklist.notes, "only notes");
  assert.equal(storedTerm.handoverChecklist.reportsSubmitted, false);
  assert.equal(storedTerm.status, "OPEN");
});

// ---- nonexistent society (D-21) -------------------------------------------------------------

test("create: a nonexistent society is 404 before the index wait, with nothing written or audited", async () => {
  societyExists = false;

  const { res } = await create({ user: admin(), body: { academicYear: "2027-28" } });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.deepEqual(calls.societyLookups, [{ _id: SOCIETY_A }]);
  assert.equal(calls.inits, 0, "the index is not awaited for a society that does not exist");
  assert.deepEqual(calls.creates, []);
  assert.deepEqual(calls.audits, []);
});

test("create: a malformed society id is 400 and no lookup, index wait or write happens", async () => {
  for (const id of ["not-an-id", "123", "64b7f8f2a1b2c3d4e5f6b00z", ""]) {
    const { res } = await create({ user: admin(), id, body: { academicYear: "2027-28" } });
    assert.equal(res.statusCode, 400, id);
  }
  assert.deepEqual(calls.societyLookups, []);
  assert.equal(calls.inits, 0);
  assert.deepEqual(calls.creates, []);
});

test("create: an existing society still creates the term after the index is ready", async () => {
  const { res } = await create({ user: admin(), body: { academicYear: "2027-28" } });

  assert.equal(res.statusCode, 201);
  assert.equal(calls.inits, 1);
  assert.equal(calls.creates.length, 1);
});

// ---- index readiness (NEW-11) -------------------------------------------------------------------

test("create: nothing is written until the unique index is ready", async () => {
  let release;
  initImpl = () => new Promise((resolve) => (release = resolve));

  const pending = create({ user: admin(), body: { academicYear: "2027-28" } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.creates.length, 0, "a term was written before the index was ready");
  assert.equal(calls.inits, 1);

  release();
  const { res } = await pending;
  assert.equal(res.statusCode, 201);
  assert.equal(calls.creates.length, 1);
});

test("create: if the index cannot be built, creation is closed: 503, nothing written or audited", async () => {
  initImpl = async () => {
    throw new Error("E11000 duplicate key building unique index");
  };
  const realError = console.error;
  console.error = () => {};
  let outcome;
  try {
    outcome = await create({ user: admin(), body: { academicYear: "2027-28" } });
  } finally {
    console.error = realError;
  }

  assert.equal(outcome.res.statusCode, 503);
  assert.equal(outcome.res.body.success, false);
  assert.deepEqual(calls.creates, []);
  assert.deepEqual(calls.audits, []);
});

test("reads never wait for the index", async () => {
  initImpl = () => new Promise(() => {});

  const { res } = await list({ user: userIn(SOCIETY_A) });

  assert.equal(res.statusCode, 200);
  assert.equal(calls.inits, 0);
});

test("the SocietyTerm model is loaded when the router is, not on the first request", () => {
  let loaded = false;
  const file = require.resolve("../../src/models/SocietyTerm.js");
  require.cache[file] = {
    id: file,
    filename: file,
    loaded: true,
    get exports() {
      loaded = true;
      return {};
    },
  };
  delete require.cache[require.resolve("../../src/routes/societies.js")];

  require("../../src/routes/societies.js");

  assert.equal(loaded, true);
});
