const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  requirePermission,
  attachScope,
  isSocietyInScope,
} = require("../../src/middleware/rbac");
const boardsRouter = require("../../src/routes/boards");
const sprintsRouter = require("../../src/routes/sprints");

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

// --- ieee_member over-grant fix -----------------------------------------------
// ieee_member was seeded with scope "student_branch", which attachScope maps to
// an empty (unrestricted) scopeFilter -- the same treatment as genuinely
// branch-wide leadership roles. The fix changes ieee_member's Role.scope to
// "society" in seed.js, so it resolves like any other per-society role.
// These tests drive the real attachScope + isSocietyInScope middleware with
// req.userScope/req.userRole pre-set (as requirePermission already does by the
// time attachScope runs in production), so no DB connection is needed.

test("attachScope + isSocietyInScope: a society-scoped user (ieee_member, post-fix) cannot access another society's resource", async () => {
  const req = {
    user: { _id: "user-1" },
    userRole: "ieee_member",
    userScope: { type: "society", societyId: "society-A" },
  };
  const res = mockRes();
  let nextCalled = false;

  await attachScope("societyId")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.scopeFilter, { societyId: "society-A" });
  assert.equal(isSocietyInScope(req, "society-A"), true);
  assert.equal(isSocietyInScope(req, "society-B"), false);
});

test("attachScope + isSocietyInScope: branch-wide leadership roles (student_branch scope) retain cross-society access", async () => {
  const req = {
    user: { _id: "user-2" },
    userRole: "sb_chair",
    userScope: { type: "student_branch", societyId: null },
  };
  const res = mockRes();
  let nextCalled = false;

  await attachScope("societyId")(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.scopeFilter, {});
  assert.equal(isSocietyInScope(req, "society-A"), true);
  assert.equal(isSocietyInScope(req, "society-B"), true);
});

test('seed role catalog: ieee_member is scoped to "society", not "student_branch" (regression guard)', () => {
  const seedSource = fs.readFileSync(
    path.join(__dirname, "../../src/scripts/seed.js"),
    "utf8",
  );
  const start = seedSource.indexOf('name: "ieee_member"');
  assert.ok(start !== -1, "ieee_member role not found in seed.js");
  const block = seedSource.slice(start, seedSource.indexOf("},", start));
  assert.match(block, /scope:\s*"society"/);
});

test('seed role catalog: branch-wide leadership roles retain scope "student_branch"', () => {
  const seedSource = fs.readFileSync(
    path.join(__dirname, "../../src/scripts/seed.js"),
    "utf8",
  );
  for (const roleName of [
    "sb_chair",
    "sb_vice_chair",
    "sb_secretary",
    "sb_treasurer",
    "sb_webmaster",
  ]) {
    const start = seedSource.indexOf(`name: "${roleName}"`);
    assert.ok(start !== -1, `${roleName} not found in seed.js`);
    const block = seedSource.slice(start, seedSource.indexOf("},", start));
    assert.match(
      block,
      /scope:\s*"student_branch"/,
      `${roleName} should retain student_branch scope`,
    );
  }
});

// --- Mass-assignment allow-lists ----------------------------------------------
// boards.js PUT /cards/:id and sprints.js PUT /sprints/:sprintId now assign
// only whitelisted fields instead of Object.assign(resource, req.body), so a
// legitimate edit can no longer relocate a card/sprint via channelId/societyId.

test("board card PUT allow-list preserves legitimate editable fields", () => {
  const fields = boardsRouter.EDITABLE_CARD_FIELDS;
  for (const f of [
    "title",
    "description",
    "status",
    "priority",
    "order",
    "dueDate",
    "assignees",
    "projectId",
    "parentCardId",
    "blockedBy",
  ]) {
    assert.ok(fields.includes(f), `expected "${f}" to remain editable`);
  }
});

test("board card PUT allow-list blocks channelId (the scope-defining field)", () => {
  assert.ok(!boardsRouter.EDITABLE_CARD_FIELDS.includes("channelId"));
});

test("sprint PUT allow-list preserves legitimate editable fields", () => {
  const fields = sprintsRouter.EDITABLE_SPRINT_FIELDS;
  for (const f of [
    "name",
    "goal",
    "startDate",
    "endDate",
    "status",
    "totalPoints",
    "completedPoints",
  ]) {
    assert.ok(fields.includes(f), `expected "${f}" to remain editable`);
  }
});

test("sprint PUT allow-list blocks societyId (the scope-defining field)", () => {
  assert.ok(!sprintsRouter.EDITABLE_SPRINT_FIELDS.includes("societyId"));
});
