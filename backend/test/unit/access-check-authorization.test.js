// AUD-023: POST /access/check accepted any target `userId` from the request
// body, so any authenticated user could read another user's resolved
// permissions, and the audit entry named the *target* as the actor.
//
// Policy under test (mirrors getUserPermissions):
//   - an authenticated user may check their own permissions;
//   - checking anyone else requires a UserRole whose role level is
//     "super_admin" or "faculty_advisor" (User.role === "ADMIN" alone is not
//     enough);
//   - the audit actor is always the authenticated caller, the target is
//     recorded as metadata.
//
// The resolver, audit logger, UserRole and User models are stubbed; no
// database or network is involved.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CALLER = "64b7f8f2a1b2c3d4e5f6a001";
const OTHER = "64b7f8f2a1b2c3d4e5f6a002";
const MISSING = "64b7f8f2a1b2c3d4e5f6a0ff";

let audits;
let resolverCalls;
let userRoles; // userId -> role level
let existingUsers; // Set of user ids

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

beforeEach(() => {
  audits = [];
  resolverCalls = [];
  userRoles = {};
  existingUsers = new Set([CALLER, OTHER]);

  stubModule("../../src/services/resolvePermissions.js", {
    resolvePermissions: async (userId) => {
      resolverCalls.push(String(userId));
      return {
        role: "society_chair",
        scope: { type: "global", societyId: null },
        permissions: { "events:edit": "full" },
      };
    },
    invalidateCache: () => {},
  });
  stubModule("../../src/services/auditLogger.js", {
    logAudit: async (entry) => {
      audits.push(entry);
    },
  });
  stubModule("../../src/models/UserRole.js", {
    findOne: (query) => ({
      populate: async () => {
        const level = userRoles[String(query.user)];
        return level ? { role: { level } } : null;
      },
    }),
  });
  stubModule("../../src/models/User.js", {
    exists: async (query) =>
      existingUsers.has(String(query._id)) ? { _id: query._id } : null,
  });
});

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

async function check(body, { caller = CALLER, user } = {}) {
  const controller = freshLoad(
    "../../src/controllers/rbac/accessCheck.controller.js",
  );
  const req = {
    user: user || { _id: caller, role: "OFFICE_BEARER" },
    body,
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

const request = (userId, extra = {}) => ({
  userId,
  module: "events",
  action: "edit",
  ...extra,
});

// ---- self-check ---------------------------------------------------------------

test("a user may check their own permissions without any privileged role", async () => {
  const res = await check(request(CALLER));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.allowed, true);
  assert.deepEqual(resolverCalls, [CALLER]);
});

test("self-check works when the caller id is an ObjectId-like object", async () => {
  const objectIdLike = { toString: () => CALLER };

  const res = await check(request(CALLER), { user: { _id: objectIdLike } });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(resolverCalls, [CALLER]);
});

test("the response shape is unchanged: { allowed, accessLevel, reason }", async () => {
  const res = await check(request(CALLER));

  assert.deepEqual(Object.keys(res.body).sort(), ["data", "success"]);
  assert.deepEqual(Object.keys(res.body.data).sort(), [
    "accessLevel",
    "allowed",
    "reason",
  ]);
});

// ---- cross-user denial --------------------------------------------------------

test("a caller with no UserRole cannot check another user", async () => {
  const res = await check(request(OTHER));

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, "PERMISSION_DENIED");
  assert.deepEqual(resolverCalls, [], "the target's permissions were resolved");
  assert.deepEqual(audits, []);
});

test("roles other than super_admin / faculty_advisor cannot check another user", async () => {
  for (const level of ["society_chair", "office_bearer", "member", "admin", "", "SUPER_ADMIN"]) {
    userRoles = { [CALLER]: level };
    resolverCalls = [];

    const res = await check(request(OTHER));

    assert.equal(res.statusCode, 403, `level ${JSON.stringify(level)}`);
    assert.deepEqual(resolverCalls, [], `level ${JSON.stringify(level)}`);
  }
});

test("User.role === 'ADMIN' without a super_admin / faculty_advisor UserRole is not privileged", async () => {
  const res = await check(request(OTHER), {
    user: { _id: CALLER, role: "ADMIN" },
  });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(resolverCalls, []);
});

// ---- cross-user allowed -------------------------------------------------------

test("super_admin and faculty_advisor may check another user", async () => {
  for (const level of ["super_admin", "faculty_advisor"]) {
    userRoles = { [CALLER]: level };
    resolverCalls = [];

    const res = await check(request(OTHER));

    assert.equal(res.statusCode, 200, level);
    assert.equal(res.body.data.allowed, true, level);
    assert.deepEqual(resolverCalls, [OTHER], level);
  }
});

// ---- spoofing -----------------------------------------------------------------

test("body fields that name another caller or actor do not grant privilege", async () => {
  userRoles = { [OTHER]: "super_admin" }; // the privileged account being impersonated

  const res = await check(
    request(OTHER, {
      callerId: OTHER,
      actor: OTHER,
      requesterId: OTHER,
      user: { _id: OTHER },
      role: "super_admin",
    }),
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(resolverCalls, []);
});

test("a differently-cased copy of another user's id is still treated as another user", async () => {
  const res = await check(request(OTHER.toUpperCase()));

  assert.equal(res.statusCode, 403);
  assert.deepEqual(resolverCalls, []);
});

test("a differently-cased copy of the caller's own id is treated as a self-check and normalised", async () => {
  const res = await check(request(CALLER.toUpperCase()));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(resolverCalls, [CALLER]);
  assert.equal(audits[0].metadata.targetUserId, CALLER);
});

test("array, object and operator-style userId values are rejected, never resolved", async () => {
  userRoles = { [CALLER]: "super_admin" }; // even a privileged caller gets 400

  for (const userId of [
    [CALLER, OTHER],
    [OTHER],
    { $ne: null },
    { $gt: "" },
    { toString: () => CALLER },
    12345,
    true,
  ]) {
    const res = await check(request(userId));

    assert.equal(res.statusCode, 400, JSON.stringify(userId));
    assert.equal(res.body.error.code, "VALIDATION_ERROR", JSON.stringify(userId));
  }
  assert.deepEqual(resolverCalls, []);
  assert.deepEqual(audits, []);
});

// ---- audit attribution --------------------------------------------------------

test("self-check audit: actor is the caller, target is metadata", async () => {
  await check(request(CALLER));

  assert.equal(audits.length, 1);
  assert.equal(String(audits[0].user), CALLER);
  assert.equal(audits[0].action, "access_check");
  assert.equal(audits[0].module, "events");
  assert.equal(audits[0].metadata.requestedAction, "edit");
  assert.equal(audits[0].metadata.targetUserId, CALLER);
});

test("cross-user audit: actor stays the privileged caller, the target is separate metadata", async () => {
  userRoles = { [CALLER]: "faculty_advisor" };

  await check(request(OTHER));

  assert.equal(audits.length, 1);
  assert.equal(String(audits[0].user), CALLER, "the target was recorded as the actor");
  assert.notEqual(String(audits[0].user), OTHER);
  assert.equal(audits[0].metadata.targetUserId, OTHER);
  assert.equal(audits[0].metadata.requestedAction, "edit");
  assert.equal(audits[0].result, "allowed");
});

// ---- missing / malformed / nonexistent ids ------------------------------------

test("missing userId, module or action is a 400 VALIDATION_ERROR", async () => {
  for (const body of [
    {},
    { module: "events", action: "edit" },
    { userId: CALLER, action: "edit" },
    { userId: CALLER, module: "events" },
    { userId: "", module: "events", action: "edit" },
    { userId: null, module: "events", action: "edit" },
  ]) {
    const res = await check(body);

    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  assert.deepEqual(resolverCalls, []);
});

test("a missing request body is a 400, not a crash", async () => {
  const res = await check(undefined);

  assert.equal(res.statusCode, 400);
});

test("malformed userId strings are a 400 and never reach the resolver", async () => {
  for (const userId of [
    "not-an-object-id",
    "abcdefghijkl", // 12 characters: accepted by mongoose.isValidObjectId, not a real id
    CALLER.slice(1),
    `${CALLER}0`,
    ` ${CALLER}`,
    `${CALLER}\n`,
    "x".repeat(5000),
  ]) {
    const res = await check(request(userId));

    assert.equal(res.statusCode, 400, JSON.stringify(userId).slice(0, 40));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  assert.deepEqual(resolverCalls, []);
});

test("a nonexistent target is 404 for a privileged caller", async () => {
  userRoles = { [CALLER]: "super_admin" };

  const res = await check(request(MISSING));

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "NOT_FOUND");
  assert.deepEqual(resolverCalls, []);
  assert.deepEqual(audits, []);
});

test("a nonexistent target is indistinguishable from an existing one for an unprivileged caller", async () => {
  const forMissing = await check(request(MISSING));
  const forExisting = await check(request(OTHER));

  assert.equal(forMissing.statusCode, 403);
  assert.equal(forExisting.statusCode, 403);
  assert.deepEqual(forMissing.body, forExisting.body);
});

// ---- getUserPermissions keeps its behaviour after sharing the predicate -------

async function getPermissions(query, caller = CALLER) {
  const controller = freshLoad(
    "../../src/controllers/rbac/accessCheck.controller.js",
  );
  const res = mockRes();
  await controller.getUserPermissions({ user: { _id: caller }, query }, res, (err) => {
    throw err;
  });
  return res;
}

test("getUserPermissions: own permissions need no privilege; ?userId= still needs one", async () => {
  const own = await getPermissions({});
  assert.equal(own.statusCode, 200);
  assert.deepEqual(resolverCalls, [CALLER]);

  const denied = await getPermissions({ userId: OTHER });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.error.code, "PERMISSION_DENIED");

  userRoles = { [CALLER]: "faculty_advisor" };
  const allowed = await getPermissions({ userId: OTHER });
  assert.equal(allowed.statusCode, 200);
  assert.deepEqual(resolverCalls, [CALLER, OTHER]);
});
