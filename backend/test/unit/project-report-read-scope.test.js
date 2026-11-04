// AUD-021 (reads and creation): the report list, detail and by-project reads
// returned every society's reports to any authenticated user, and POST accepted
// a projectId from a different society than the report's.
//
// Policy under test:
//   list      administrators: any society (optional ?societyId=); everyone else is
//             forced to their own stored society, a society named in the query or
//             body is ignored, and a caller without a society is 403.
//   by-project non-admins: the project is resolved from the database and its
//             stored society must be the caller's, else 404 (same as nonexistent);
//             reports are also restricted to the caller's society; no society 403.
//   detail    out-of-scope (or society-less) is 404, indistinguishable from a
//             nonexistent report; administrators unrestricted.
//   create    the project must exist and its STORED society must equal the report's
//             society, for every caller including administrators.
//
// The real route stack and the real permission/scope middleware run; the
// permission resolver, audit logger and models are stubbed, so no database or
// server is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CALLER = "64b7f8f2a1b2c3d4e5f6a001";
const SOCIETY_A = "64b7f8f2a1b2c3d4e5f6b001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f6b002";
const PROJECT_A = "64b7f8f2a1b2c3d4e5f6d001";
const PROJECT_B = "64b7f8f2a1b2c3d4e5f6d002";
const MISSING_PROJECT = "64b7f8f2a1b2c3d4e5f6d0ff";
const REPORT_A = "64b7f8f2a1b2c3d4e5f6e001";
const REPORT_B = "64b7f8f2a1b2c3d4e5f6e002";
const MISSING_REPORT = "64b7f8f2a1b2c3d4e5f6e0ff";

let reports; // id -> { _id, societyId }
let projects; // id -> { _id, societyId }
let calls;
let resolved;

function stubModule(relPath, exportsValue) {
  const file = require.resolve(path.join(__dirname, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsValue };
}

function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}

beforeEach(() => {
  reports = {
    [REPORT_A]: { _id: REPORT_A, societyId: SOCIETY_A, title: "A report" },
    [REPORT_B]: { _id: REPORT_B, societyId: SOCIETY_B, title: "B report" },
  };
  projects = {
    [PROJECT_A]: { _id: PROJECT_A, societyId: SOCIETY_A },
    [PROJECT_B]: { _id: PROJECT_B, societyId: SOCIETY_B },
  };
  calls = { finds: [], counts: [], projectLookups: [], created: [], reportLookups: [] };
  resolved = {
    role: "society_chair",
    scope: { type: "society", societyId: SOCIETY_A },
    permissions: { "reports:create": "limited_own_scope" },
  };

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });
  delete require.cache[require.resolve("../../src/middleware/rbac.js")];
  delete require.cache[require.resolve("../../src/middleware/auth.js")];
  const auth = require("../../src/middleware/auth.js");
  stubModule("../../src/middleware/auth.js", { ...auth, authenticate: (req, res, next) => next() });

  stubModule("../../src/models/ProjectReport.js", {
    find: (filter) => {
      calls.finds.push(filter);
      const rows = Object.values(reports).filter(
        (r) => !filter.societyId || String(r.societyId) === String(filter.societyId),
      );
      const chain = { populate: () => chain, sort: () => chain, skip: () => chain, limit: async () => rows };
      // by-project awaits the chain right after sort()
      chain.sort = () => Object.assign(Promise.resolve(rows), chain, { then: (a, b) => Promise.resolve(rows).then(a, b) });
      return chain;
    },
    countDocuments: async (filter) => {
      calls.counts.push(filter);
      return Object.values(reports).filter(
        (r) => !filter.societyId || String(r.societyId) === String(filter.societyId),
      ).length;
    },
    findById: (id) => {
      calls.reportLookups.push(String(id));
      const doc = reports[String(id)] || null;
      const chain = { populate: () => chain, then: (a, b) => Promise.resolve(doc).then(a, b) };
      return chain;
    },
    create: async (doc) => {
      calls.created.push(doc);
      return { _id: "new-report", ...doc };
    },
  });
  stubModule("../../src/models/Project.js", {
    findById: (id) => {
      calls.projectLookups.push(String(id));
      const doc = projects[String(id)] || null;
      const chain = { select: () => chain, lean: async () => doc, then: (a, b) => Promise.resolve(doc).then(a, b) };
      return chain;
    },
  });
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

async function callRoute(method, routePath, { user, params = {}, body = {}, query = {} }) {
  const router = freshLoad("../../src/routes/projectReports.js");
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods[method],
  );
  assert.ok(layer, `no ${method} ${routePath}`);
  const req = {
    user,
    params,
    body,
    query,
    method: method.toUpperCase(),
    originalUrl: "/api/v1/project-reports",
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
  if (error) throw error;
  return res;
}

const list = (options) => callRoute("get", "/", options);
const byProject = (user, projectId) => callRoute("get", "/project/:projectId", { user, params: { projectId } });
const detail = (user, id) => callRoute("get", "/:id", { user, params: { id } });
const create = (user, body) => callRoute("post", "/", { user, body });

// chair() belongs to society A; chair(x) uses x as given, including undefined.
const chair = (...args) => ({
  _id: CALLER,
  id: CALLER,
  role: "OFFICE_BEARER",
  societyId: args.length ? args[0] : SOCIETY_A,
});
const admin = () => ({ _id: CALLER, id: CALLER, role: "ADMIN", societyId: null });

// ---- list -----------------------------------------------------------------------

test("list: a non-admin is forced to their own society and totals come from the same filter", async () => {
  const res = await list({ user: chair() });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.finds, [{ societyId: SOCIETY_A }]);
  assert.deepEqual(calls.counts, calls.finds, "count and rows use different filters");
  assert.equal(res.body.count, 1);
  assert.equal(res.body.meta.totalItems, 1);
  assert.deepEqual(Object.keys(res.body).sort(), ["count", "data", "meta", "success"]);
  assert.deepEqual(Object.keys(res.body.meta).sort(), ["limit", "page", "totalItems", "totalPages"]);
});

test("list: a society named by the caller cannot widen the scope", async () => {
  await list({
    user: chair(),
    query: { societyId: SOCIETY_B },
    body: { societyId: SOCIETY_B },
  });

  assert.deepEqual(calls.finds, [{ societyId: SOCIETY_A }]);
  assert.deepEqual(calls.counts, [{ societyId: SOCIETY_A }]);
});

test("list: a project filter is applied on top of the society scope", async () => {
  await list({ user: chair(), query: { projectId: PROJECT_B } });

  assert.deepEqual(calls.finds, [{ societyId: SOCIETY_A, projectId: PROJECT_B }]);
});

test("list: a populated society reference on the caller is understood", async () => {
  await list({ user: chair({ _id: SOCIETY_A, name: "A" }) });

  assert.deepEqual(calls.finds, [{ societyId: SOCIETY_A }]);
});

test("list: a caller without a society is 403 and nothing is read", async () => {
  for (const societyId of [null, undefined, "", { _id: null }]) {
    const res = await list({ user: chair(societyId), query: { societyId: SOCIETY_B } });

    assert.equal(res.statusCode, 403, JSON.stringify(societyId));
    assert.equal(res.body.data, undefined);
  }
  assert.deepEqual(calls.finds, []);
  assert.deepEqual(calls.counts, []);
});

test("list: an administrator reads across societies and may filter by any society", async () => {
  const all = await list({ user: admin() });
  const onlyB = await list({ user: admin(), query: { societyId: SOCIETY_B } });

  assert.equal(all.statusCode, 200);
  assert.equal(all.body.count, 2);
  assert.deepEqual(calls.finds, [{}, { societyId: SOCIETY_B }]);
  assert.equal(onlyB.body.count, 1);
});

test("list: pagination parameters are unchanged (page, limit, skip, totals)", async () => {
  const res = await list({ user: chair(), query: { page: "2", limit: "5" } });

  assert.equal(res.body.meta.page, 2);
  assert.equal(res.body.meta.limit, 5);
  assert.equal(res.body.meta.totalPages, 1);
});

// ---- by project -----------------------------------------------------------------

test("by-project: a project of the caller's society returns its reports, society-restricted", async () => {
  const res = await byProject(chair(), PROJECT_A);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.finds, [{ projectId: PROJECT_A, societyId: SOCIETY_A }]);
  assert.deepEqual(Object.keys(res.body).sort(), ["count", "data", "success"]);
});

test("by-project: a foreign project is 404 and no reports are queried", async () => {
  const res = await byProject(chair(), PROJECT_B);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Project not found");
  assert.equal(res.body.data, undefined);
  assert.deepEqual(calls.finds, []);
});

test("by-project: a nonexistent project looks identical to a foreign one", async () => {
  const missing = await byProject(chair(), MISSING_PROJECT);
  const foreign = await byProject(chair(), PROJECT_B);

  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.body, foreign.body);
});

test("by-project: a caller without a society cannot use it to bypass scope", async () => {
  for (const societyId of [null, undefined, ""]) {
    const res = await byProject(chair(societyId), PROJECT_A);

    assert.equal(res.statusCode, 403, JSON.stringify(societyId));
  }
  assert.deepEqual(calls.finds, []);
  assert.deepEqual(calls.projectLookups, []);
});

test("by-project: reports of another society attached to the caller's project are not returned", async () => {
  // Legacy inconsistent data: a society-B report pointing at society A's project.
  reports["64b7f8f2a1b2c3d4e5f6e003"] = { _id: "x", societyId: SOCIETY_B, projectId: PROJECT_A };

  const res = await byProject(chair(), PROJECT_A);

  assert.deepEqual(res.body.data.map((r) => String(r.societyId)), [SOCIETY_A]);
});

test("by-project: an administrator keeps cross-society access and is not restricted", async () => {
  const res = await byProject(admin(), PROJECT_B);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.finds, [{ projectId: PROJECT_B }]);
  assert.deepEqual(calls.projectLookups, []);
});

// ---- detail ---------------------------------------------------------------------

test("detail: an own-society report is returned", async () => {
  const res = await detail(chair(), REPORT_A);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.title, "A report");
});

test("detail: a foreign report is 404 and leaks nothing", async () => {
  const res = await detail(chair(), REPORT_B);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Report not found");
  assert.equal(res.body.data, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /B report/);
});

test("detail: a nonexistent report is the same 404 as a foreign one", async () => {
  const missing = await detail(chair(), MISSING_REPORT);
  const foreign = await detail(chair(), REPORT_B);

  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.body, foreign.body);
});

test("detail: a caller without a society never gets a report", async () => {
  for (const societyId of [null, undefined, ""]) {
    const res = await detail(chair(societyId), REPORT_A);

    assert.equal(res.statusCode, 404, JSON.stringify(societyId));
  }
});

test("detail: a populated report society is understood; an administrator reads any report", async () => {
  reports[REPORT_A] = { ...reports[REPORT_A], societyId: { _id: SOCIETY_A, name: "A" } };

  assert.equal((await detail(chair(), REPORT_A)).statusCode, 200);
  assert.equal((await detail(admin(), REPORT_B)).statusCode, 200);
});

// ---- create ---------------------------------------------------------------------

const newReport = (extra = {}) => ({ title: "New", description: "d", type: "general", ...extra });

test("create: an own-society report for an own-society project succeeds", async () => {
  const res = await create(chair(), newReport({ societyId: SOCIETY_A, projectId: PROJECT_A }));

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(calls.created.length, 1);
  assert.equal(calls.created[0].projectId, PROJECT_A);
  assert.equal(calls.created[0].status, "SUBMITTED");
});

test("create: the society defaults to the caller's, as before", async () => {
  const res = await create(chair(), newReport({ projectId: PROJECT_A }));

  assert.equal(res.statusCode, 201);
  assert.equal(String(calls.created[0].societyId), SOCIETY_A);
});

test("create: a report without a project is unaffected", async () => {
  const res = await create(chair(), newReport({ societyId: SOCIETY_A }));

  assert.equal(res.statusCode, 201);
  assert.equal(calls.created[0].projectId, null);
  assert.deepEqual(calls.projectLookups, []);
});

test("create: a project from another society is rejected for a non-admin", async () => {
  const res = await create(chair(), newReport({ societyId: SOCIETY_A, projectId: PROJECT_B }));

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Project does not belong/);
  assert.deepEqual(calls.created, []);
});

test("create: a mismatch is rejected for an administrator too (both directions)", async () => {
  const aReportBProject = await create(admin(), newReport({ societyId: SOCIETY_A, projectId: PROJECT_B }));
  const bReportAProject = await create(admin(), newReport({ societyId: SOCIETY_B, projectId: PROJECT_A }));

  assert.equal(aReportBProject.statusCode, 400);
  assert.equal(bReportAProject.statusCode, 400);
  assert.deepEqual(calls.created, []);
});

test("create: an administrator can still create a matching report in any society", async () => {
  const res = await create(admin(), newReport({ societyId: SOCIETY_B, projectId: PROJECT_B }));

  assert.equal(res.statusCode, 201);
  assert.equal(String(calls.created[0].societyId), SOCIETY_B);
});

test("create: a nonexistent project is 404 and nothing is created", async () => {
  const res = await create(chair(), newReport({ societyId: SOCIETY_A, projectId: MISSING_PROJECT }));

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Project not found");
  assert.deepEqual(calls.created, []);
});

test("create: the project's society is read from the database, not the request", async () => {
  const res = await create(
    chair(),
    newReport({
      societyId: SOCIETY_A,
      projectId: PROJECT_B,
      project: { societyId: SOCIETY_A },
      projectSocietyId: SOCIETY_A,
    }),
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(calls.created, []);
});

test("create: a project that has no stored society fails closed", async () => {
  projects[PROJECT_A] = { _id: PROJECT_A, societyId: null };

  const res = await create(chair(), newReport({ societyId: SOCIETY_A, projectId: PROJECT_A }));

  assert.equal(res.statusCode, 400);
  assert.deepEqual(calls.created, []);
});

test("create: the existing guards still apply (another society is 403, no permission is 403)", async () => {
  const foreign = await create(chair(), newReport({ societyId: SOCIETY_B, projectId: PROJECT_B }));
  resolved = { ...resolved, permissions: {} };
  const noPermission = await create(chair(), newReport({ societyId: SOCIETY_A, projectId: PROJECT_A }));

  assert.equal(foreign.statusCode, 403);
  assert.equal(noPermission.statusCode, 403);
  assert.deepEqual(calls.created, []);
});

// ---- unchanged write guards -----------------------------------------------------

test("PATCH and DELETE keep their permission, society and object-level guards", () => {
  const router = freshLoad("../../src/routes/projectReports.js");
  const stackOf = (method) =>
    router.stack.find((l) => l.route && l.route.path === "/:id" && l.route.methods[method]).route.stack.length;

  assert.equal(stackOf("patch"), 3); // requirePermission, societyAccess, handler
  assert.equal(stackOf("delete"), 3);
});
