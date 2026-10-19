// Regression tests for AUD-018: society-scoped routes declared with `:id`
// (e.g. PATCH /societies/:id/members) were guarded by `societyAccess`, which
// only reads `req.params.societyId`. With no `societyId` supplied it silently
// substituted the caller's own society and called next(), so any non-admin
// could mutate any society.
//
// These tests drive the real router's guard middleware with the real
// `req.params` shape, without starting a server or touching a database.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const authModule = require("../../src/middleware/auth");
const societiesRouter = require("../../src/routes/societies");

function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
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

function run(guard, req) {
  const res = mockRes();
  let nextCalled = false;
  guard(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

// Every route in routes/societies.js that is guarded by the society guard and
// declares the target society as `:id`.
const SOCIETY_ID_ROUTES = [
  ["patch", "/:id/logo"],
  ["patch", "/:id/signature"],
  ["post", "/:id/office-bearers"],
  ["put", "/:id/office-bearers/:obId"],
  ["delete", "/:id/office-bearers/:obId"],
  ["post", "/:id/members"],
  ["delete", "/:id/members/:memberId"],
  ["put", "/:id/office-bearers"],
  ["put", "/:id/members"],
  ["patch", "/:id"],
  ["patch", "/:id/terms/:termId/handover"],
];

// Routes that, after the society guard, also carry the existing RBAC permission
// check (requirePermission): [guard, requirePermission, handler]. PATCH /:id
// needs settings:edit in addition to the society scope.
const WITH_PERMISSION_CHECK = new Set(["patch /:id"]);

// Returns the guard (first handler) of a route in the real societies router,
// asserting the exact shape of the route: the guard comes first and is followed
// by the route handler (and, where listed above, the permission check).
function guardFor(method, routePath) {
  const layer = societiesRouter.stack.find(
    (l) =>
      l.route && l.route.path === routePath && l.route.methods[method] === true,
  );
  assert.ok(layer, `route ${method.toUpperCase()} ${routePath} not found`);
  const withPermission = WITH_PERMISSION_CHECK.has(`${method} ${routePath}`);
  assert.equal(
    layer.route.stack.length,
    withPermission ? 3 : 2,
    withPermission
      ? `${method.toUpperCase()} ${routePath} should be [guard, requirePermission, handler]`
      : `${method.toUpperCase()} ${routePath} should be [guard, handler]`,
  );
  return layer.route.stack[0].handle;
}

const officeBearer = (societyId) => ({ role: "OFFICE_BEARER", societyId });

// ---- Router wiring: the actual bug -------------------------------------

for (const [method, routePath] of SOCIETY_ID_ROUTES) {
  const label = `${method.toUpperCase()} /societies${routePath}`;

  test(`AUD-018 ${label}: non-admin targeting another society via params.id is denied`, () => {
    const guard = guardFor(method, routePath);
    const req = {
      user: officeBearer("society-1"),
      params: { id: "society-2" },
      body: {},
      query: {},
    };
    const { res, nextCalled } = run(guard, req);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  test(`AUD-018 ${label}: body.societyId of the caller does not rescue a foreign params.id`, () => {
    const guard = guardFor(method, routePath);
    const req = {
      user: officeBearer("society-1"),
      params: { id: "society-2" },
      body: { societyId: "society-1" },
      query: { societyId: "society-1" },
    };
    const { res, nextCalled } = run(guard, req);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  test(`AUD-018 ${label}: non-admin targeting their own society via params.id is allowed`, () => {
    const guard = guardFor(method, routePath);
    const req = {
      user: officeBearer("society-1"),
      params: { id: "society-1" },
      body: {},
      query: {},
    };
    const { res, nextCalled } = run(guard, req);

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  });

  test(`AUD-018 ${label}: missing params.id fails closed instead of using the caller's society`, () => {
    const guard = guardFor(method, routePath);
    const req = {
      user: officeBearer("society-1"),
      params: {},
      body: {},
      query: {},
    };
    const { res, nextCalled } = run(guard, req);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
  });

  test(`AUD-018 ${label}: administrators are not restricted`, () => {
    const guard = guardFor(method, routePath);
    const req = {
      user: { role: "ADMIN" },
      params: { id: "society-2" },
      body: {},
      query: {},
    };
    const { nextCalled } = run(guard, req);

    assert.equal(nextCalled, true);
  });
}

// ---- Parameter-aware guard in isolation --------------------------------

test("societyAccessByParam is exported as a factory", () => {
  assert.equal(typeof authModule.societyAccessByParam, "function");
});

test("societyAccessByParam rejects unauthenticated requests with 401", () => {
  const guard = authModule.societyAccessByParam("id");
  const { res, nextCalled } = run(guard, {
    params: { id: "society-1" },
    body: {},
    query: {},
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("societyAccessByParam denies a non-admin with no society, even for a valid-looking id", () => {
  const guard = authModule.societyAccessByParam("id");
  const { res, nextCalled } = run(guard, {
    user: { role: "OFFICE_BEARER", societyId: null },
    params: { id: "society-1" },
    body: {},
    query: {},
  });

  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("societyAccessByParam treats empty, non-string and array identifiers as invalid (400)", () => {
  const guard = authModule.societyAccessByParam("id");
  for (const bad of ["", "   ", undefined, null, 42, ["society-1"], {}]) {
    const { res, nextCalled } = run(guard, {
      user: officeBearer("society-1"),
      params: { id: bad },
      body: {},
      query: {},
    });
    assert.equal(nextCalled, false, `identifier ${JSON.stringify(bad)}`);
    assert.equal(res.statusCode, 400, `identifier ${JSON.stringify(bad)}`);
  }
});

test("societyAccessByParam accepts a populated society object on the user", () => {
  const guard = authModule.societyAccessByParam("id");
  const { nextCalled } = run(guard, {
    user: {
      role: "OFFICE_BEARER",
      societyId: { _id: { toString: () => "society-1" } },
    },
    params: { id: "society-1" },
    body: {},
    query: {},
  });

  assert.equal(nextCalled, true);
});

test("societyAccessByParam does not modify req.body", () => {
  const guard = authModule.societyAccessByParam("id");
  const req = {
    user: officeBearer("society-1"),
    params: { id: "society-1" },
    body: { name: "x" },
    query: {},
  };
  run(guard, req);

  assert.deepEqual(req.body, { name: "x" });
});

test("denial message does not reveal the target society or the caller's society", () => {
  const guard = authModule.societyAccessByParam("id");
  const { res } = run(guard, {
    user: officeBearer("society-1"),
    params: { id: "society-2" },
    body: {},
    query: {},
  });
  const text = JSON.stringify(res.body);

  assert.equal(text.includes("society-2"), false);
  assert.equal(text.includes("society-1"), false);
});

// ---- Existing callers keep their behavior ------------------------------

test("legacy societyAccess still authorizes via params.societyId", () => {
  const { societyAccess } = authModule;
  const allowed = run(societyAccess, {
    user: officeBearer("society-1"),
    params: { societyId: "society-1" },
    body: {},
    query: {},
  });
  const denied = run(societyAccess, {
    user: officeBearer("society-1"),
    params: { societyId: "society-2" },
    body: {},
    query: {},
  });

  assert.equal(allowed.nextCalled, true);
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.statusCode, 403);
});

test("legacy societyAccess does not interpret params.id (a resource id on events/projects/etc.) as a society", () => {
  const { societyAccess } = authModule;
  const req = {
    user: officeBearer("society-1"),
    params: { id: "some-event-id" },
    body: {},
    query: {},
  };
  const { nextCalled } = run(societyAccess, req);

  assert.equal(nextCalled, true);
  assert.equal(req.body.societyId, "society-1");
});

test("legacy societyAccess still checks body.societyId on create-style routes", () => {
  const { societyAccess } = authModule;
  const { res, nextCalled } = run(societyAccess, {
    user: officeBearer("society-1"),
    params: {},
    body: { societyId: "society-2" },
    query: {},
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});
