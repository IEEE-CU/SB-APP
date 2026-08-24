const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  requirePermission,
  attachScope,
  isSocietyInScope,
} = require("../../src/middleware/rbac");

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

// --- requirePermission / attachScope: unauthenticated -> 401 -----------------
// (These are the two middleware every fixed community_hub route now runs
// before touching any resource, so an unauthenticated caller never reaches
// controller logic for channels/boards/notes/sprints/community messages.)

test("requirePermission rejects unauthenticated requests with 401", async () => {
  const req = {};
  const res = mockRes();
  let nextCalled = false;

  await requirePermission("community_hub", "view")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("attachScope rejects unauthenticated requests with 401", async () => {
  const req = {};
  const res = mockRes();
  let nextCalled = false;

  await attachScope("societyId")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

// --- isSocietyInScope: the core scoping check added to channels/community/ ---
// boards/notes/sprints routes to close the IDOR found in the repo audit.
// req.scopeFilter is what attachScope('societyId') produces for the caller.

test("isSocietyInScope allows access when the resource belongs to the caller's own society", () => {
  const req = { scopeFilter: { societyId: "society-A" } };
  assert.equal(isSocietyInScope(req, "society-A"), true);
});

test("isSocietyInScope denies access when the resource belongs to a different society (cross-society IDOR check)", () => {
  const req = { scopeFilter: { societyId: "society-A" } };
  assert.equal(isSocietyInScope(req, "society-B"), false);
});

test("isSocietyInScope allows access for globally-scoped roles (empty scopeFilter, e.g. sb_faculty_advisor)", () => {
  const req = { scopeFilter: {} };
  assert.equal(isSocietyInScope(req, "society-B"), true);
});

test("isSocietyInScope denies access when scopeFilter was never attached", () => {
  const req = {};
  assert.equal(isSocietyInScope(req, "society-A"), false);
});

test("isSocietyInScope denies access when no resource societyId is provided", () => {
  const req = { scopeFilter: { societyId: "society-A" } };
  assert.equal(isSocietyInScope(req, undefined), false);
});

test("isSocietyInScope compares ObjectId-like values via toString (not reference equality)", () => {
  const societyId = { toString: () => "society-A" };
  const req = { scopeFilter: { societyId: { toString: () => "society-A" } } };
  assert.equal(isSocietyInScope(req, societyId), true);
});
