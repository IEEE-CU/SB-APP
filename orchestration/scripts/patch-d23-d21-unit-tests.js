// Coordinator patch (integration worktree only): unit tests for D-23 / D-21.
const fs = require("fs");
const dir = "D:/SB-APP-worktrees/batch1-integration/backend/test/unit/";

function patch(name, edits) {
  let s = fs.readFileSync(dir + name, "utf8");
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  for (const [a, b] of edits) {
    if (s.split(a).length !== 2) throw new Error(name + ": anchor not unique/found: " + a.slice(0, 80));
    s = s.replace(a, () => b);
  }
  if (crlf) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(dir + name, s);
}

// ---- society-access.test.js: the handover route now carries the permission check (D-23)
patch("society-access.test.js", [
  [
    `// check (requirePermission): [guard, requirePermission, handler]. PATCH /:id
// needs settings:edit in addition to the society scope.
const WITH_PERMISSION_CHECK = new Set(["patch /:id"]);`,
    `// check (requirePermission): [guard, requirePermission, handler]. PATCH /:id
// needs settings:edit in addition to the society scope; so does the term handover
// PATCH (D-23), through an administrator-or-permission wrapper around requirePermission.
const WITH_PERMISSION_CHECK = new Set(["patch /:id", "patch /:id/terms/:termId/handover"]);`,
  ],
]);

// ---- society-terms.test.js
patch("society-terms.test.js", [
  // state for the Society.exists stub
  [
    `let storedTerm;
`,
    `let storedTerm;
let societyExists;
`,
  ],
  [
    `  calls = { inits: 0, creates: [], finds: [], populates: [], audits: [], permissionLookups: 0 };`,
    `  calls = { inits: 0, creates: [], finds: [], populates: [], audits: [], permissionLookups: 0, societyLookups: [] };
  societyExists = true;`,
  ],
  [
    `  stubModule("../../src/models/SocietyTerm.js", {`,
    `  // D-21: creation first checks that the society exists.
  stubModule("../../src/models/Society.js", {
    exists: async (query) => {
      calls.societyLookups.push(query);
      return societyExists ? { _id: query._id } : null;
    },
  });
  stubModule("../../src/models/SocietyTerm.js", {`,
  ],
  // handover test: the caller must now hold settings:edit; the stack is three layers
  [
    `test("handover: the response honours the same budget protection and keeps the guard stack", async () => {
  resolved = { ...resolved, permissions: {} };`,
    `test("handover: the response honours the same budget protection (caller holds settings:edit, not finance:view)", async () => {
  resolved = { ...resolved, permissions: { "settings:edit": "limited_own_scope" } };`,
  ],
  [
    `  assert.equal(layer.route.stack.length, 2, "guard + handler, unchanged");
});`,
    `  assert.equal(layer.route.stack.length, 3, "society guard + permission check + handler (D-23)");
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
  assert.equal(calls.permissionLookups, lookupsBefore, "an administrator is not subject to the permission lookup");
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
});`,
  ],
]);
console.log("unit tests patched");
