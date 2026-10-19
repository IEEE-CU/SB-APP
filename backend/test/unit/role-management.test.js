// AUD-027: role controls.
//
//  1. createRole only reserved system roles and super_admin-level roles to the SB
//     Faculty Advisor, so anyone holding roles_access:create could also create a
//     faculty_advisor-level role - the other half of the privileged tier (those
//     levels may view other users' permissions, read the audit log and edit the
//     role-permission matrix).
//  2. updateRolePermission upserted a role/permission given as an ObjectId without
//     checking it exists, leaving a dangling document and then failing with a 500;
//     a non-string role or permission also failed with a 500.
//
// Policy under test (from the existing code and seed): the privileged tier - system
// roles, the super_admin and faculty_advisor levels, and the name sb_faculty_advisor
// that the resolver and requireSuperAdmin recognise - is created only by the SB
// Faculty Advisor; other holders of roles_access:create create ordinary roles. The
// role-permission matrix stays editable by super_admin and faculty_advisor levels
// only (unchanged), and only for roles and permissions that exist.
//
// The real controllers and the real Role schema run; database calls are stubbed. No
// database or server is involved. See role-management.integration.test.js for the
// same behavior against a real database.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");

const Role = require("../../src/models/Role");
const Permission = require("../../src/models/Permission");
const RolePermission = require("../../src/models/RolePermission");
const UserRole = require("../../src/models/UserRole");

const ROLE_ID = "64b7f8f2a1b2c3d4e5f6a001";
const PERM_ID = "64b7f8f2a1b2c3d4e5f6a002";
const GHOST_ID = "64b7f8f2a1b2c3d4e5f6a0ff";
const CALLER = "64b7f8f2a1b2c3d4e5f6a009";

const original = {
  roleFindOne: Role.findOne,
  roleFindById: Role.findById,
  roleSave: Role.prototype.save,
  permFindOne: Permission.findOne,
  permFindById: Permission.findById,
  rpUpdate: RolePermission.findOneAndUpdate,
  urFindOne: UserRole.findOne,
};

let saved; // roles that were "saved"
let roleLookups;
let upserts;
let callerLevel; // level of the caller's role in updateRolePermission
let existingRoleNames;
let roles; // id -> true
let permissions; // id -> true

function freshLoad(relPath) {
  const file = require.resolve(path.join(__dirname, relPath));
  delete require.cache[file];
  return require(file);
}
function stubModule(relPath, exportsValue) {
  const file = require.resolve(path.join(__dirname, relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsValue };
}

beforeEach(() => {
  saved = [];
  roleLookups = [];
  upserts = [];
  callerLevel = "super_admin";
  existingRoleNames = new Set();
  roles = { [ROLE_ID]: true };
  permissions = { [PERM_ID]: true };

  stubModule("../../src/services/auditLogger.js", { logAudit: async () => {} });
  stubModule("../../src/services/resolvePermissions.js", { resolvePermissions: async () => ({}), invalidateCache: () => {} });

  Role.findOne = async (query) => {
    roleLookups.push(query);
    if (query.name && existingRoleNames.has(query.name)) return { _id: ROLE_ID, name: query.name };
    return null;
  };
  Role.findById = (id) => {
    const found = roles[String(id)] ? { _id: id } : null;
    return { select: async () => found };
  };
  Role.prototype.save = async function save() {
    await this.validate();
    saved.push(this.toObject());
    return this;
  };
  Permission.findOne = async () => null;
  Permission.findById = (id) => {
    const found = permissions[String(id)] ? { _id: id } : null;
    return { select: async () => found };
  };
  RolePermission.findOneAndUpdate = (filter, update) => {
    upserts.push({ filter, update });
    const doc = { role: { name: "r" }, permission: { key: "p:k" }, accessLevel: update.accessLevel };
    const chain = { populate: () => chain, then: (a, b) => Promise.resolve(doc).then(a, b) };
    return chain;
  };
  UserRole.findOne = () => ({
    populate: async () => (callerLevel ? { role: { level: callerLevel } } : null),
  });
});

test.after(() => {
  Role.findOne = original.roleFindOne;
  Role.findById = original.roleFindById;
  Role.prototype.save = original.roleSave;
  Permission.findOne = original.permFindOne;
  Permission.findById = original.permFindById;
  RolePermission.findOneAndUpdate = original.rpUpdate;
  UserRole.findOne = original.urFindOne;
});

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

async function createRole(body, { userRole = "role_manager" } = {}) {
  const { createRole: handler } = freshLoad("../../src/controllers/rbac/roles.controller.js");
  const req = { body, userRole, user: { _id: CALLER }, ip: "127.0.0.1", headers: {}, socket: {} };
  const res = mockRes();
  let error = null;
  await handler(req, res, (err) => {
    error = err;
  });
  return { res, error };
}
const roleBody = (extra = {}) => ({ name: "treasurer_helper", displayName: "Treasurer Helper", level: "office_bearer", scope: "society", ...extra });
const SUPER = { userRole: "sb_faculty_advisor" };

async function updateRolePermission(body) {
  const { updateRolePermission: handler } = freshLoad("../../src/controllers/rbac/rolePermissions.controller.js");
  const req = { body, user: { _id: CALLER }, ip: "127.0.0.1", headers: {}, socket: {} };
  const res = mockRes();
  let error = null;
  await handler(req, res, (err) => {
    error = err;
  });
  return { res, error };
}

// ---- createRole: the privileged tier ---------------------------------------------------

test("create: a delegated holder cannot create a faculty_advisor-level role (the AUD-027 gap)", async () => {
  const { res } = await createRole(roleBody({ level: "faculty_advisor" }));

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "PERMISSION_DENIED");
  assert.deepEqual(saved, []);
});

test("create: super_admin level, system roles and the super admin's name stay reserved to the SB Faculty Advisor", async () => {
  for (const extra of [
    { level: "super_admin" },
    { isSystemRole: true },
    { isSystemRole: "false" }, // truthy: fail closed
    { name: "sb_faculty_advisor" },
    { name: "  SB_Faculty_Advisor  " },
    { level: "faculty_advisor", isSystemRole: true },
  ]) {
    const { res } = await createRole(roleBody(extra));

    assert.equal(res.statusCode, 403, JSON.stringify(extra));
  }
  assert.deepEqual(saved, []);
});

test("create: the gate is checked before the duplicate lookup, so it discloses nothing", async () => {
  existingRoleNames.add("sb_faculty_advisor");

  const { res } = await createRole(roleBody({ name: "sb_faculty_advisor" }));

  assert.equal(res.statusCode, 403);
  assert.deepEqual(roleLookups, []);
});

test("create: a delegated holder can still create ordinary roles", async () => {
  for (const level of ["office_bearer", "member"]) {
    const { res } = await createRole(roleBody({ name: `ordinary_${level}`, level }));

    assert.equal(res.statusCode, 201, level);
  }
  assert.deepEqual(saved.map((r) => r.level), ["office_bearer", "member"]);
  assert.ok(saved.every((r) => r.isSystemRole === false));
});

test("create: the SB Faculty Advisor can create every kind of role (existing administrative workflow)", async () => {
  for (const extra of [
    { name: "advisor_level", level: "faculty_advisor", scope: "society" },
    { name: "super_level", level: "super_admin", scope: "global" },
    { name: "system_one", isSystemRole: true },
  ]) {
    const { res } = await createRole(roleBody(extra), SUPER);

    assert.equal(res.statusCode, 201, JSON.stringify(extra));
  }
  assert.equal(saved.length, 3);
  assert.equal(saved[2].isSystemRole, true);
});

test("create: non-string inputs are a 400, never reach the checks, and create nothing", async () => {
  for (const extra of [
    { level: ["faculty_advisor"] },
    { level: { $ne: "x" } },
    { level: 1 },
    { name: ["sb_faculty_advisor"] },
    { name: { toLowerCase: "x" } },
    { displayName: ["x"] },
    { scope: ["society"] },
    { description: { a: 1 } },
    { description: 5 },
  ]) {
    const { res, error } = await createRole(roleBody(extra));

    assert.equal(error, null, JSON.stringify(extra));
    assert.equal(res.statusCode, 400, JSON.stringify(extra));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  assert.deepEqual(saved, []);
  assert.deepEqual(roleLookups, []);
});

test("create: missing fields, duplicates and unknown levels keep their established errors", async () => {
  const missing = await createRole({ name: "x" });
  existingRoleNames.add("dupe");
  const duplicate = await createRole(roleBody({ name: "Dupe" }));
  const badLevel = await createRole(roleBody({ name: "bad_level", level: "emperor" }));

  assert.equal(missing.res.statusCode, 400);
  assert.equal(duplicate.res.statusCode, 409);
  assert.equal(duplicate.res.body.error.code, "DUPLICATE_RESOURCE");
  assert.equal(badLevel.error && badLevel.error.name, "ValidationError");
  assert.deepEqual(saved, []);
});

test("create: body fields other than the documented ones are ignored", async () => {
  const { res } = await createRole(roleBody({ _id: GHOST_ID, createdBy: CALLER, permissions: ["finance:approve"], userId: CALLER }));

  assert.equal(res.statusCode, 201);
  assert.notEqual(String(saved[0]._id), GHOST_ID);
  assert.equal(saved[0].permissions, undefined);
});

// ---- updateRolePermission ----------------------------------------------------------------

const rpBody = (extra = {}) => ({ role: ROLE_ID, permission: PERM_ID, accessLevel: "full", ...extra });

test("role-permission: only super_admin and faculty_advisor levels may edit the matrix (unchanged)", async () => {
  for (const level of ["office_bearer", "member", null]) {
    callerLevel = level;

    const { res } = await updateRolePermission(rpBody());

    assert.equal(res.statusCode, 403, String(level));
    assert.equal(res.body.error.code, "PERMISSION_DENIED");
  }
  assert.deepEqual(upserts, []);
  for (const level of ["super_admin", "faculty_advisor"]) {
    callerLevel = level;

    const { res } = await updateRolePermission(rpBody());

    assert.equal(res.statusCode, 200, level);
  }
});

test("role-permission: a role id that does not exist is a 404 and nothing is written", async () => {
  const { res } = await updateRolePermission(rpBody({ role: GHOST_ID }));

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "NOT_FOUND");
  assert.deepEqual(upserts, []);
});

test("role-permission: a permission id that does not exist is a 404 and nothing is written", async () => {
  const { res } = await updateRolePermission(rpBody({ permission: GHOST_ID }));

  assert.equal(res.statusCode, 404);
  assert.deepEqual(upserts, []);
});

test("role-permission: unknown role names and permission keys are still 404s", async () => {
  const roleName = await updateRolePermission(rpBody({ role: "no_such_role" }));
  const permKey = await updateRolePermission(rpBody({ permission: "no:such_key" }));

  assert.equal(roleName.res.statusCode, 404);
  assert.equal(permKey.res.statusCode, 404);
  assert.deepEqual(upserts, []);
});

test("role-permission: non-string inputs are a 400, not a 500", async () => {
  for (const extra of [{ role: { a: 1 } }, { role: [ROLE_ID] }, { permission: { a: 1 } }, { permission: 5 }, { accessLevel: ["full"] }]) {
    const { res, error } = await updateRolePermission(rpBody(extra));

    assert.equal(error, null, JSON.stringify(extra));
    assert.equal(res.statusCode, 400, JSON.stringify(extra));
  }
  assert.deepEqual(upserts, []);
});

test("role-permission: an invalid access level and missing fields keep their 400s", async () => {
  const badLevel = await updateRolePermission(rpBody({ accessLevel: "root" }));
  const missing = await updateRolePermission({ role: ROLE_ID });

  assert.equal(badLevel.res.statusCode, 400);
  assert.equal(missing.res.statusCode, 400);
  assert.deepEqual(upserts, []);
});

test("role-permission: a valid update upserts exactly the verified role and permission", async () => {
  const { res } = await updateRolePermission(rpBody({ accessLevel: "approval" }));

  assert.equal(res.statusCode, 200);
  assert.equal(upserts.length, 1);
  assert.equal(String(upserts[0].filter.role), ROLE_ID);
  assert.equal(String(upserts[0].filter.permission), PERM_ID);
  assert.equal(upserts[0].update.accessLevel, "approval");
  assert.ok(mongoose.isValidObjectId(upserts[0].filter.role));
});
