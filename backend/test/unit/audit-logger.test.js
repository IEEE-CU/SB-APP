// logAudit passed fields the AuditLog schema does not define (user, route,
// method, result, reason, metadata). Mongoose strict mode dropped them, so every
// saved row had userId = null and no context. logAudit now maps `user` to
// `userId` and keeps the rest under `details`.
//
// The real AuditLog model and the real logger are used so that schema strict
// mode applies; only save() is replaced, so no database is involved. The
// permission resolver is stubbed for the callers that need it.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");

const AuditLog = require("../../src/models/AuditLog");

const ACTOR = "64b7f8f2a1b2c3d4e5f6a001";
const TARGET = "64b7f8f2a1b2c3d4e5f6a002";

let saved;
let resolved;
let originalSave;

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
  saved = [];
  resolved = {
    role: "society_chair",
    scope: { type: "global", societyId: null },
    permissions: { "events:edit": "full" },
  };
  if (!originalSave) originalSave = AuditLog.prototype.save;
  AuditLog.prototype.save = async function () {
    saved.push(this.toObject());
    return this;
  };
  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async () => resolved,
    invalidateCache: () => {},
  });
  // The real logger, loaded fresh so it uses the stubbed save().
  delete require.cache[require.resolve("../../src/services/auditLogger.js")];
});

const loadLogger = () => require("../../src/services/auditLogger.js");

const FULL_ENTRY = {
  user: ACTOR,
  action: "role_created",
  module: "roles_access",
  route: "/api/roles",
  method: "POST",
  result: "allowed",
  reason: "Successfully created role: treasurer",
  ipAddress: "10.1.2.3",
  metadata: { roleName: "treasurer", level: "office_bearer" },
};

// ---- the logger -----------------------------------------------------------------

test("the actor is saved as userId, not dropped", async () => {
  await loadLogger().logAudit(FULL_ENTRY);

  assert.equal(saved.length, 1);
  assert.equal(String(saved[0].userId), ACTOR);
});

test("an ObjectId actor is saved as userId", async () => {
  await loadLogger().logAudit({ ...FULL_ENTRY, user: new mongoose.Types.ObjectId(ACTOR) });

  assert.equal(String(saved[0].userId), ACTOR);
});

test("action, module and ipAddress stay top-level; route, method, result, reason and metadata go to details", async () => {
  await loadLogger().logAudit(FULL_ENTRY);

  const row = saved[0];
  assert.equal(row.action, "role_created");
  assert.equal(row.module, "roles_access");
  assert.equal(row.ipAddress, "10.1.2.3");
  assert.deepEqual(row.details, {
    route: "/api/roles",
    method: "POST",
    result: "allowed",
    reason: "Successfully created role: treasurer",
    metadata: { roleName: "treasurer", level: "office_bearer" },
  });
});

test("no value supplied to the logger is missing from the saved row", async () => {
  await loadLogger().logAudit(FULL_ENTRY);

  const text = JSON.stringify(saved[0]);
  for (const value of [
    ACTOR,
    "role_created",
    "roles_access",
    "/api/roles",
    "POST",
    "allowed",
    "Successfully created role: treasurer",
    "10.1.2.3",
    "treasurer",
    "office_bearer",
  ]) {
    assert.ok(text.includes(value), `${value} was not persisted`);
  }
});

test("a missing actor is saved as userId null without an actor detail", async () => {
  for (const user of [undefined, null, ""]) {
    saved = [];

    await loadLogger().logAudit({ ...FULL_ENTRY, user });

    assert.equal(saved[0].userId, null);
    assert.equal("actor" in saved[0].details, false);
  }
});

test("an actor that is not an ObjectId is kept as text instead of being lost", async () => {
  await loadLogger().logAudit({ ...FULL_ENTRY, user: "not-an-object-id" });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].userId, null);
  assert.equal(saved[0].details.actor, "not-an-object-id");
});

test("omitted metadata saves no metadata (Mongoose minimizes empty objects)", async () => {
  const { metadata, ...withoutMetadata } = FULL_ENTRY;
  assert.ok(metadata);

  await loadLogger().logAudit(withoutMetadata);

  assert.deepEqual(saved[0].details.metadata ?? {}, {});
  assert.equal(saved[0].details.result, "allowed");
});

test("a failure to save is swallowed, as before", async () => {
  AuditLog.prototype.save = async () => {
    throw new Error("database unavailable");
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(loadLogger().logAudit(FULL_ENTRY));
  } finally {
    console.error = originalError;
  }
});

// ---- representative existing callers ---------------------------------------------

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

const baseReq = (extra = {}) => ({
  user: { _id: ACTOR },
  method: "PUT",
  originalUrl: "/api/v1/events/1",
  ip: "127.0.0.1",
  headers: {},
  socket: {},
  ...extra,
});

test("requirePermission: an allowed check is attributed to the caller with its context", async () => {
  const { requirePermission } = freshLoad("../../src/middleware/rbac.js");
  let nextCalled = false;

  await requirePermission("events", "edit")(baseReq(), mockRes(), () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(saved.length, 1);
  assert.equal(String(saved[0].userId), ACTOR);
  assert.equal(saved[0].action, "access_check");
  assert.equal(saved[0].module, "events");
  assert.equal(saved[0].details.result, "allowed");
  assert.equal(saved[0].details.method, "PUT");
  assert.equal(saved[0].details.route, "/api/v1/events/1");
  assert.match(saved[0].details.reason, /events:edit/);
});

test("requirePermission: a denied check is attributed to the caller and recorded as denied", async () => {
  const { requirePermission } = freshLoad("../../src/middleware/rbac.js");
  const res = mockRes();

  await requirePermission("finance", "approve")(baseReq(), res, () => {
    assert.fail("next must not be called");
  });

  assert.equal(res.statusCode, 403);
  assert.equal(saved.length, 1);
  assert.equal(String(saved[0].userId), ACTOR);
  assert.equal(saved[0].details.result, "denied");
  assert.match(saved[0].details.reason, /finance:approve/);
});

test("requireRole: allowed and denied checks are attributed to the caller", async () => {
  const { requireRole } = freshLoad("../../src/middleware/rbac.js");

  await requireRole("society_chair")(baseReq(), mockRes(), () => {});
  await requireRole("sb_faculty_advisor")(baseReq(), mockRes(), () => {});

  assert.equal(saved.length, 2);
  for (const row of saved) {
    assert.equal(String(row.userId), ACTOR);
    assert.equal(row.action, "role_check");
    assert.equal(row.module, "roles_access");
  }
  assert.deepEqual(
    saved.map((row) => row.details.result),
    ["allowed", "denied"],
  );
});

test("POST /access/check: the caller is the actor and the inspected user is separate metadata", async () => {
  stubModule("../../src/models/UserRole.js", {
    findOne: () => ({ populate: async () => ({ role: { level: "faculty_advisor" } }) }),
  });
  stubModule("../../src/models/User.js", { exists: async () => ({ _id: TARGET }) });
  const controller = freshLoad("../../src/controllers/rbac/accessCheck.controller.js");
  const res = mockRes();

  await controller.checkAccess(
    baseReq({ body: { userId: TARGET, module: "events", action: "edit" }, method: "POST" }),
    res,
    (error) => {
      throw error;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(saved.length, 1);
  assert.equal(String(saved[0].userId), ACTOR, "the target was saved as the actor");
  assert.notEqual(String(saved[0].userId), TARGET);
  assert.equal(saved[0].details.metadata.targetUserId, TARGET);
  assert.equal(saved[0].details.metadata.requestedAction, "edit");
  assert.equal(saved[0].details.result, "allowed");
});
