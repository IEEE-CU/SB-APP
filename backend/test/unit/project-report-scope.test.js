// AUD-021: PATCH and DELETE /project-reports/:id (also mounted at /reports/:id)
// loaded the report by id and modified or deleted it without comparing the
// report's society to the caller's. `societyAccess` cannot help because the
// route has no society parameter, so any office bearer holding the reports
// permission could edit or delete any society's report.
//
// These tests run the route's real final handlers from the real router with
// the ProjectReport model stubbed: no database, server or network.
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const ProjectReport = require("../../src/models/ProjectReport");
const router = require("../../src/routes/projectReports");

const SOCIETY_A = "64b7f8f2a1b2c3d4e5f60001";
const SOCIETY_B = "64b7f8f2a1b2c3d4e5f60002";
const REPORT_ID = "64b7f8f2a1b2c3d4e5f60abc";

function routeHandler(method, routePath) {
  const layer = router.stack.find(
    (l) =>
      l.route && l.route.path === routePath && l.route.methods[method] === true,
  );
  assert.ok(layer, `route ${method.toUpperCase()} ${routePath} not found`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle; // the route handler itself
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

const calls = { save: 0, deleted: [] };
let realFindById;
let realFindByIdAndDelete;
let currentReport;

function makeReport(societyId) {
  return {
    _id: REPORT_ID,
    societyId,
    title: "Original title",
    description: "Original description",
    async save() {
      calls.save += 1;
    },
  };
}

beforeEach(() => {
  calls.save = 0;
  calls.deleted = [];
  currentReport = makeReport(SOCIETY_A);

  realFindById = ProjectReport.findById;
  realFindByIdAndDelete = ProjectReport.findByIdAndDelete;

  // Awaiting the result gives the report; .populate() is chainable.
  ProjectReport.findById = (id) => {
    const doc = id === REPORT_ID ? currentReport : null;
    const chain = {
      then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      populate() {
        return chain;
      },
    };
    return chain;
  };
  ProjectReport.findByIdAndDelete = async (id) => {
    calls.deleted.push(id);
    return currentReport;
  };
});

afterEach(() => {
  ProjectReport.findById = realFindById;
  ProjectReport.findByIdAndDelete = realFindByIdAndDelete;
});

async function invoke(method, user, { id = REPORT_ID, body = {} } = {}) {
  const handler = routeHandler(method, "/:id");
  const req = { user, params: { id }, body, query: {} };
  const res = mockRes();
  let nextError = null;
  await handler(req, res, (err) => {
    nextError = err || null;
  });
  return { res, nextError };
}

const officeBearer = (societyId) => ({ role: "OFFICE_BEARER", societyId });
const admin = { role: "ADMIN", societyId: null };

// ---- PATCH ---------------------------------------------------------------

test("AUD-021 PATCH: an office bearer of another society cannot edit the report", async () => {
  const { res } = await invoke("patch", officeBearer(SOCIETY_B), {
    body: { title: "Hijacked", status: "APPROVED" },
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(calls.save, 0, "the report was saved");
  assert.equal(currentReport.title, "Original title");
});

test("AUD-021 PATCH: an office bearer of the report's society can edit it", async () => {
  const { res } = await invoke("patch", officeBearer(SOCIETY_A), {
    body: { title: "Updated title" },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(calls.save, 1);
  assert.equal(currentReport.title, "Updated title");
});

test("PATCH: society ids compare correctly when the user's society is a populated document", async () => {
  const user = { role: "OFFICE_BEARER", societyId: { _id: SOCIETY_A } };

  const { res } = await invoke("patch", user, { body: { title: "Updated" } });

  assert.equal(res.statusCode, 200);
  assert.equal(calls.save, 1);
});

test("PATCH: an administrator is not restricted by society", async () => {
  const { res } = await invoke("patch", admin, { body: { title: "By admin" } });

  assert.equal(res.statusCode, 200);
  assert.equal(calls.save, 1);
});

test("PATCH: an office bearer with no society is denied", async () => {
  const { res } = await invoke("patch", officeBearer(null), {
    body: { title: "x" },
  });

  assert.equal(res.statusCode, 403);
  assert.equal(calls.save, 0);
});

test("PATCH: a report with no society recorded is denied to non-admins and not crashed on", async () => {
  currentReport = makeReport(null);

  const { res, nextError } = await invoke("patch", officeBearer(SOCIETY_A), {
    body: { title: "x" },
  });

  assert.equal(nextError, null);
  assert.equal(res.statusCode, 403);
  assert.equal(calls.save, 0);
});

test("PATCH: an unknown report id returns 404 without modifying anything", async () => {
  const { res } = await invoke("patch", officeBearer(SOCIETY_A), {
    id: "64b7f8f2a1b2c3d4e5f6ffff",
    body: { title: "x" },
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Report not found");
  assert.equal(calls.save, 0);
});

test("PATCH: an unrecognized role is denied for another society's report", async () => {
  const { res } = await invoke(
    "patch",
    { role: "SOMETHING_ELSE", societyId: SOCIETY_B },
    { body: { title: "x" } },
  );

  assert.equal(res.statusCode, 403);
  assert.equal(calls.save, 0);
});

// ---- DELETE --------------------------------------------------------------

test("AUD-021 DELETE: an office bearer of another society cannot delete the report", async () => {
  const { res } = await invoke("delete", officeBearer(SOCIETY_B));

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.deepEqual(calls.deleted, [], "the report was deleted");
});

test("AUD-021 DELETE: an office bearer of the report's society can delete it", async () => {
  const { res } = await invoke("delete", officeBearer(SOCIETY_A));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Report deleted successfully");
  assert.deepEqual(calls.deleted, [REPORT_ID]);
});

test("DELETE: an administrator is not restricted by society", async () => {
  const { res } = await invoke("delete", admin);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.deleted, [REPORT_ID]);
});

test("DELETE: an office bearer with no society is denied", async () => {
  const { res } = await invoke("delete", officeBearer(undefined));

  assert.equal(res.statusCode, 403);
  assert.deepEqual(calls.deleted, []);
});

test("DELETE: an unknown report id returns 404 without deleting anything", async () => {
  const { res } = await invoke("delete", officeBearer(SOCIETY_A), {
    id: "64b7f8f2a1b2c3d4e5f6ffff",
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Report not found");
  assert.deepEqual(calls.deleted, []);
});

test("DELETE: a malformed id error is passed to the error handler, not swallowed", async () => {
  ProjectReport.findById = () => {
    const err = new Error("Cast to ObjectId failed");
    err.name = "CastError";
    throw err;
  };

  const { res, nextError } = await invoke("delete", officeBearer(SOCIETY_A), {
    id: "not-an-id",
  });

  assert.ok(nextError, "expected the error to reach next()");
  assert.equal(nextError.name, "CastError");
  assert.equal(res.body, null);
  assert.deepEqual(calls.deleted, []);
});

// ---- routes stay guarded by the existing middleware ---------------------------

test("both routes still run requirePermission and the shared guard before the handler", () => {
  for (const method of ["patch", "delete"]) {
    const layer = router.stack.find(
      (l) => l.route && l.route.path === "/:id" && l.route.methods[method],
    );
    assert.equal(
      layer.route.stack.length,
      3,
      `${method} should be [requirePermission, societyAccess, handler]`,
    );
  }
});
