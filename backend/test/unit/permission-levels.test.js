// AUD-028: requirePermission treated EVERY truthy access level other than the
// literal string "none" as a grant, so an unknown or malformed value (for
// example "banana", "NONE", an object) authorized the request. Only the
// levels defined by the RolePermission model may grant access.
//
// Policy that is intentionally unchanged: "full", "limited_own_scope" and
// "approval" each grant the permission key being checked (there is no caller
// that specifies a minimum level), and "none"/missing deny.
//
// The permission resolver and the audit logger are stubbed; no database or
// network is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

let audits;

function stubModule(relPath, exportsValue) {
  const resolved = require.resolve(path.join(__dirname, relPath));
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
}

function freshLoad(relPath) {
  const resolved = require.resolve(path.join(__dirname, relPath));
  delete require.cache[resolved];
  return require(resolved);
}

function installStubs(resolved) {
  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", {
    logAudit: async (entry) => {
      audits.push(entry);
    },
  });
}

function mockRes() {
  const res = { statusCode: null, body: null };
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

const resolvedWith = (level, extra = {}) => ({
  role: "society_chair",
  scope: { type: "global", societyId: null },
  permissions: level === undefined ? {} : { "events:edit": level },
  ...extra,
});

async function runRequirePermission(resolved, { user = { _id: "u1" } } = {}) {
  installStubs(resolved);
  const { requirePermission } = freshLoad("../../src/middleware/rbac.js");
  const req = {
    user,
    method: "PUT",
    originalUrl: "/api/v1/events/1",
    ip: "127.0.0.1",
    headers: {},
    socket: {},
  };
  const res = mockRes();
  let nextCalled = false;
  await requirePermission("events", "edit")(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
}

beforeEach(() => {
  audits = [];
});

// ---- the defect ---------------------------------------------------------------

test("AUD-028: unknown or malformed access levels are denied (fail closed)", async () => {
  const bogus = [
    "banana",
    "NONE",
    "None",
    "FULL",
    " full",
    "full ",
    "admin",
    "superadmin",
    "write",
    "read",
    "true",
    "1",
    1,
    true,
    {},
    [],
    ["full"],
    "__proto__",
    "constructor",
    "toString",
  ];

  for (const level of bogus) {
    const { res, nextCalled } = await runRequirePermission(resolvedWith(level));

    assert.equal(nextCalled, false, `granted for level ${JSON.stringify(level)}`);
    assert.equal(res.statusCode, 403, `status for ${JSON.stringify(level)}`);
    assert.equal(res.body.error.code, "PERMISSION_DENIED");
  }
});

test("AUD-028: a denied unknown level is recorded in the audit log as denied", async () => {
  await runRequirePermission(resolvedWith("banana"));

  assert.equal(audits.length, 1);
  assert.equal(audits[0].result, "denied");
  assert.equal(audits[0].module, "events");
});

// ---- behavior that must not change ------------------------------------------

test("recognized granting levels are accepted (current policy)", async () => {
  for (const level of ["full", "limited_own_scope", "approval"]) {
    const { req, res, nextCalled } = await runRequirePermission(
      resolvedWith(level),
    );

    assert.equal(nextCalled, true, `denied for ${level}`);
    assert.equal(res.statusCode, null);
    assert.equal(req.accessLevel, level);
    assert.equal(audits.at(-1).result, "allowed");
  }
});

test('"none" is denied', async () => {
  const { res, nextCalled } = await runRequirePermission(resolvedWith("none"));

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "PERMISSION_DENIED");
});

test("a missing permission key is denied", async () => {
  for (const level of [undefined, null, ""]) {
    const resolved = resolvedWith(undefined);
    if (level !== undefined) resolved.permissions["events:edit"] = level;

    const { res, nextCalled } = await runRequirePermission(resolved);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  }
});

test("a module-level grant does not stand in for a missing action key", async () => {
  const resolved = resolvedWith(undefined);
  resolved.permissions = { events: "full" };

  const { res, nextCalled } = await runRequirePermission(resolved);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("unauthenticated requests are still rejected with 401 UNAUTHENTICATED", async () => {
  const { res, nextCalled } = await runRequirePermission(resolvedWith("full"), {
    user: null,
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, "UNAUTHENTICATED");
});

test("a society-scoped role without a society is still denied even with a granting level", async () => {
  const { res, nextCalled } = await runRequirePermission(
    resolvedWith("limited_own_scope", {
      scope: { type: "society", societyId: null },
    }),
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error.message, /society scope/i);
});

test("the faculty advisor's explicit exception to the society-scope rule is preserved", async () => {
  const { nextCalled } = await runRequirePermission(
    resolvedWith("full", {
      role: "sb_faculty_advisor",
      scope: { type: "society", societyId: null },
    }),
  );

  assert.equal(nextCalled, true);
});

test("a super-admin style grant ('full' on the key) is accepted", async () => {
  const { nextCalled } = await runRequirePermission(
    resolvedWith("full", { role: "sb_faculty_advisor" }),
  );

  assert.equal(nextCalled, true);
});

// ---- the programmatic check must agree with the middleware -------------------

async function runCheckAccess(level) {
  installStubs({
    role: "society_chair",
    scope: { type: "global", societyId: null },
    permissions: level === undefined ? {} : { "events:edit": level },
  });
  const controller = freshLoad(
    "../../src/controllers/rbac/accessCheck.controller.js",
  );
  const req = {
    user: { _id: "u1" },
    body: { userId: "u2", module: "events", action: "edit" },
    method: "POST",
    originalUrl: "/api/v1/access/check",
    ip: "127.0.0.1",
    headers: {},
    socket: {},
  };
  const res = mockRes();
  await controller.checkAccess(req, res, (err) => {
    throw err;
  });
  return res;
}

test("POST /access/check does not report unknown levels as allowed", async () => {
  for (const level of ["banana", "NONE", {}, 1, "constructor"]) {
    const res = await runCheckAccess(level);

    assert.equal(res.statusCode, 200);
    assert.equal(
      res.body.data.allowed,
      false,
      `reported allowed for ${JSON.stringify(level)}`,
    );
  }
});

test("POST /access/check still reports recognized levels as allowed and none as denied", async () => {
  for (const level of ["full", "limited_own_scope", "approval"]) {
    const res = await runCheckAccess(level);
    assert.equal(res.body.data.allowed, true, level);
    assert.equal(res.body.data.accessLevel, level);
  }
  for (const level of ["none", undefined]) {
    const res = await runCheckAccess(level);
    assert.equal(res.body.data.allowed, false);
  }
});

// ---- the shared predicate -----------------------------------------------------

test("isGrantingLevel recognizes exactly the model's granting levels", () => {
  installStubs(resolvedWith("full"));
  const { isGrantingLevel } = freshLoad("../../src/middleware/rbac.js");

  assert.equal(typeof isGrantingLevel, "function");
  for (const ok of ["full", "limited_own_scope", "approval"]) {
    assert.equal(isGrantingLevel(ok), true, ok);
  }
  for (const bad of ["none", "", undefined, null, "banana", 1, {}, "__proto__"]) {
    assert.equal(isGrantingLevel(bad), false, JSON.stringify(bad));
  }
});
