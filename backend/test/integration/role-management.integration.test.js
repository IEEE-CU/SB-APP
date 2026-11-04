"use strict";

/**
 * AUD-027 over HTTP: role creation and the role-permission matrix
 * (controllers/rbac/roles.controller.js, rolePermissions.controller.js).
 *
 * Policy (from the existing code, seed and matrix):
 *   - the privileged tier is reserved to the SB Faculty Advisor: system roles, the
 *     super_admin and faculty_advisor LEVELS (which may view other users'
 *     permissions, read the audit log and edit the matrix) and the name
 *     sb_faculty_advisor. Anyone else holding roles_access:create creates ordinary
 *     roles only (office_bearer / member level). This gate runs before the
 *     duplicate-name check, so it discloses nothing;
 *   - the role-permission matrix is edited only by the super_admin and
 *     faculty_advisor levels (unchanged), and only for a role and a permission that
 *     exist (404 otherwise; a non-string role or permission is a 400);
 *   - creating a role assigns it to nobody: there is no role-assignment endpoint, and
 *     PATCH /users/:id ignores role fields;
 *   - POST /permissions stays super-admin-only.
 *
 * Setup is explicit: the fixtures define no role-management permissions or delegates.
 * roleManager (disposable, society A) holds a role granted roles_access:create/view -
 * what an advisor could delegate. societyAdvisor (disposable, society A) holds a
 * faculty_advisor-LEVEL role with roles_access:view only, so it can edit the matrix by
 * level but cannot create roles. chairA/memberA hold no role-management permission;
 * admin is the SB Faculty Advisor (super_admin level).
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const { requireHarnessTarget, deleteDisposableUser, withDatabase } = require("./helpers/target");
const { TEST_PASSWORD, USERS } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const { users, societies } = target.ready.fixtures;
const A = societies.A.id;

const RUN = Date.now();
const MISSING = "64b7f8f2a1b2c3d4e5f6ffff";
const DISPOSABLE = ["roleManager", "societyAdvisor"];
const ids = {};
const tokens = {};
let managerRoleId;
let viewPermissionId;

const emailOf = (key) => (USERS[key] ? USERS[key].email : `roles-${key.toLowerCase()}-${RUN}@integration.test`);
const idOf = (key) => (USERS[key] ? users[key].id : ids[key]);

async function tokenFor(key) {
  if (tokens[key]) return tokens[key];
  const res = await fetch(`${target.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailOf(key), password: TEST_PASSWORD }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, `login failed for ${key}`);
  tokens[key] = body.data.token;
  return tokens[key];
}
async function call(key, method, route, body) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${await tokenFor(key)}`;
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed, text };
}

const count = (collection, filter = {}) => withDatabase(target, (db) => db.collection(collection).countDocuments(filter));
const roleNamed = (name) => withDatabase(target, (db) => db.collection("roles").findOne({ name }));
const matrixRow = (roleId, permissionId) =>
  withDatabase(target, (db, ObjectId) =>
    db.collection("rolepermissions").findOne({ role: new ObjectId(String(roleId)), permission: new ObjectId(String(permissionId)) }),
  );

let counter = 0;
const roleBody = (extra = {}) => ({
  name: `it-role-${RUN}-${++counter}`,
  displayName: "Integration Role",
  level: "office_bearer",
  scope: "society",
  ...extra,
});

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    for (const action of ["view", "create"]) {
      await db.collection("permissions").updateOne(
        { key: `roles_access:${action}` },
        { $setOnInsert: { key: `roles_access:${action}`, module: "roles_access", action, description: `Allows ${action} actions in roles_access module` } },
        { upsert: true },
      );
    }
    const create = await db.collection("permissions").findOne({ key: "roles_access:create" });
    const view = await db.collection("permissions").findOne({ key: "roles_access:view" });
    viewPermissionId = String(view._id);

    const role = async (name, level) => {
      const inserted = await db.collection("roles").insertOne({
        name, displayName: name, level, scope: "society", description: "Integration role", isSystemRole: false, createdAt: now, updatedAt: now,
      });
      return inserted.insertedId;
    };
    const managerRole = await role("it_role_manager", "office_bearer");
    const advisorRole = await role("it_society_advisor", "faculty_advisor");
    managerRoleId = String(managerRole);
    await db.collection("rolepermissions").insertMany([
      { role: managerRole, permission: create._id, accessLevel: "limited_own_scope" },
      { role: managerRole, permission: view._id, accessLevel: "limited_own_scope" },
      { role: advisorRole, permission: view._id, accessLevel: "limited_own_scope" },
    ]);

    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    for (const [key, roleId] of [["roleManager", managerRole], ["societyAdvisor", advisorRole]]) {
      const user = await db.collection("users").insertOne({
        email: emailOf(key), password: hash, name: `Roles ${key}`, role: "OFFICE_BEARER",
        societyId: new ObjectId(A), createdAt: now, updatedAt: now,
      });
      ids[key] = String(user.insertedId);
      await db.collection("userroles").insertOne({
        user: user.insertedId, role: roleId, society: new ObjectId(A), assignedBy: new ObjectId(users.admin.id), assignedAt: now,
      });
    }
  });
});

after(async () => {
  await withDatabase(target, (db, ObjectId) =>
    db.collection("userroles").deleteMany({ user: { $in: Object.values(ids).map((id) => new ObjectId(id)) } }),
  );
  for (const key of DISPOSABLE) await deleteDisposableUser(target, ids[key], emailOf(key));
});

// ---- authentication and permissions -----------------------------------------------------

describe("role creation: authentication and permission", () => {
  test("anonymous requests are 401", async () => {
    const before = await count("roles");

    const create = await call(null, "POST", "/roles", roleBody());
    const list = await call(null, "GET", "/roles");

    assert.equal(create.status, 401);
    assert.equal(list.status, 401);
    assert.equal(await count("roles"), before);
  });

  test("users without roles_access:create cannot create roles, and create nothing", async () => {
    const before = await count("roles");

    for (const key of ["chairA", "memberA", "loner", "societyAdvisor"]) {
      const res = await call(key, "POST", "/roles", roleBody());

      assert.equal(res.status, 403, key);
      assert.equal(res.body.error.code, "PERMISSION_DENIED");
    }
    assert.equal(await count("roles"), before);
  });

  test("reading roles keeps its permission (roles_access:view)", async () => {
    const manager = await call("roleManager", "GET", "/roles");
    const admin = await call("admin", "GET", "/roles");
    const chair = await call("chairA", "GET", "/roles");

    assert.equal(manager.status, 200, manager.text.slice(0, 160));
    assert.equal(admin.status, 200);
    assert.equal(chair.status, 403);
  });
});

// ---- the privileged tier ---------------------------------------------------------------------

describe("role creation: the privileged tier is reserved to the SB Faculty Advisor", () => {
  test("a delegated holder creates ordinary roles", async () => {
    for (const level of ["office_bearer", "member"]) {
      const body = roleBody({ level, description: "  made by a delegate  " });

      const res = await call("roleManager", "POST", "/roles", body);

      assert.equal(res.status, 201, res.text.slice(0, 200));
      const stored = await roleNamed(body.name);
      assert.equal(stored.level, level);
      assert.equal(stored.isSystemRole, false);
      assert.equal(stored.description, "made by a delegate");
    }
  });

  test("a delegated holder cannot create a faculty_advisor- or super_admin-level role, a system role, or the super admin's name", async () => {
    const count0 = await count("roles");
    const attempts = [
      roleBody({ level: "faculty_advisor" }),
      roleBody({ level: "super_admin" }),
      roleBody({ isSystemRole: true }),
      roleBody({ isSystemRole: "false" }),
      roleBody({ name: "sb_faculty_advisor" }),
      roleBody({ name: "  SB_Faculty_Advisor  " }),
      roleBody({ level: "faculty_advisor", scope: "global", isSystemRole: true }),
    ];

    for (const body of attempts) {
      const res = await call("roleManager", "POST", "/roles", body);

      assert.equal(res.status, 403, JSON.stringify(body));
      assert.equal(res.body.error.code, "PERMISSION_DENIED");
      const normalized = body.name.toLowerCase().trim();
      if (normalized === "sb_faculty_advisor") {
        assert.equal(await count("roles", { name: normalized }), 1, "the reserved name was duplicated");
      } else {
        assert.equal(await roleNamed(normalized), null, `${normalized} was stored`);
      }
    }
    assert.equal(await count("roles"), count0);
    assert.equal(await count("roles", { level: "faculty_advisor", name: /^it-role-/ }), 0);
  });

  test("the refusal discloses nothing about existing roles", async () => {
    const existing = await call("roleManager", "POST", "/roles", roleBody({ name: "sb_faculty_advisor" }));
    const fresh = await call("roleManager", "POST", "/roles", roleBody({ name: `it-fresh-${RUN}`, level: "faculty_advisor" }));

    assert.equal(existing.status, 403);
    assert.equal(fresh.status, 403);
    assert.equal(existing.body.error.message, fresh.body.error.message);
  });

  test("a non-string level, name or description is a 400 and cannot slip past the gate", async () => {
    const before = await count("roles");

    for (const extra of [
      { level: ["faculty_advisor"] },
      { level: { $ne: "x" } },
      { name: ["sb_faculty_advisor"] },
      { scope: ["society"] },
      { displayName: { a: 1 } },
      { description: { a: 1 } },
    ]) {
      const res = await call("roleManager", "POST", "/roles", roleBody(extra));

      assert.equal(res.status, 400, JSON.stringify(extra));
    }
    assert.equal(await count("roles"), before);
  });

  test("the SB Faculty Advisor can create every kind of role (existing administrative workflow)", async () => {
    const cases = [
      roleBody({ level: "faculty_advisor", scope: "society" }),
      roleBody({ level: "super_admin", scope: "global" }),
      roleBody({ isSystemRole: true }),
    ];
    for (const body of cases) {
      const res = await call("admin", "POST", "/roles", body);

      assert.equal(res.status, 201, `${JSON.stringify(body)}: ${res.text.slice(0, 160)}`);
      const stored = await roleNamed(body.name);
      assert.equal(stored.level, body.level);
      assert.equal(stored.isSystemRole, Boolean(body.isSystemRole));
    }
    const duplicate = await call("admin", "POST", "/roles", cases[0]);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "DUPLICATE_RESOURCE");
  });

  test("invalid levels and missing fields keep their established errors", async () => {
    const before = await count("roles");

    const badLevel = await call("admin", "POST", "/roles", roleBody({ level: "emperor" }));
    const missing = await call("admin", "POST", "/roles", { name: "x" });

    assert.equal(badLevel.status, 400);
    assert.equal(missing.status, 400);
    assert.equal(await count("roles"), before);
  });

  test("body fields cannot attach permissions or assign the role to anyone", async () => {
    const body = roleBody({ permissions: ["finance:approve"], rolePermissions: [{ permission: viewPermissionId, accessLevel: "full" }], users: [idOf("roleManager")], userId: idOf("roleManager"), _id: MISSING });
    const userRolesBefore = await count("userroles");
    const matrixBefore = await count("rolepermissions");

    const res = await call("roleManager", "POST", "/roles", body);

    assert.equal(res.status, 201, res.text.slice(0, 200));
    const stored = await roleNamed(body.name);
    assert.notEqual(String(stored._id), MISSING);
    assert.equal(await count("userroles"), userRolesBefore, "creating a role assigned it");
    assert.equal(await count("rolepermissions"), matrixBefore, "creating a role granted permissions");
  });
});

// ---- role assignment is not reachable through the API ------------------------------------------

describe("role assignment", () => {
  test("there is no role-assignment endpoint, and profile updates ignore role fields", async () => {
    const userRolesBefore = await count("userroles");

    const attempts = [
      ["POST", "/user-roles", { user: idOf("roleManager"), role: managerRoleId }],
      ["POST", `/users/${idOf("roleManager")}/roles`, { role: managerRoleId }],
      ["PUT", `/users/${idOf("roleManager")}/role`, { role: managerRoleId }],
    ];
    for (const [method, route, body] of attempts) {
      const res = await call("roleManager", method, route, body);

      assert.equal(res.status, 404, `${method} ${route}`);
    }

    const adminRole = await roleNamed("sb_faculty_advisor");
    const update = await call("roleManager", "PATCH", `/users/${idOf("roleManager")}`, {
      name: "Roles roleManager",
      role: "ADMIN",
      roleId: String(adminRole._id),
      societyId: MISSING,
    });
    assert.equal(update.status, 200, update.text.slice(0, 200));
    const stored = await withDatabase(target, (db, ObjectId) => db.collection("users").findOne({ _id: new ObjectId(idOf("roleManager")) }));
    assert.equal(stored.role, "OFFICE_BEARER", "the legacy role was changed through the profile endpoint");
    assert.equal(String(stored.societyId), A);
    assert.equal(await count("userroles"), userRolesBefore);
  });
});

// ---- the role-permission matrix -----------------------------------------------------------------

describe("role-permission matrix: authorization is unchanged", () => {
  const update = (key, extra = {}) =>
    call(key, "POST", "/role-permissions", { role: managerRoleId, permission: viewPermissionId, accessLevel: "full", ...extra });

  test("anonymous requests are 401", async () => {
    assert.equal((await update(null)).status, 401);
  });

  test("callers below the faculty_advisor level cannot edit the matrix, even with roles_access:create", async () => {
    const before = await matrixRow(managerRoleId, viewPermissionId);

    for (const key of ["roleManager", "chairA", "memberA", "loner"]) {
      const res = await update(key);

      assert.equal(res.status, 403, key);
      assert.equal(res.body.error.code, "PERMISSION_DENIED");
    }
    assert.deepEqual(await matrixRow(managerRoleId, viewPermissionId), before);
  });

  test("faculty_advisor-level and super_admin-level callers can edit the matrix, by id and by name/key", async () => {
    const byAdvisor = await update("societyAdvisor", { accessLevel: "approval" });
    assert.equal(byAdvisor.status, 200, byAdvisor.text.slice(0, 200));
    assert.equal((await matrixRow(managerRoleId, viewPermissionId)).accessLevel, "approval");

    const byAdmin = await call("admin", "POST", "/role-permissions", {
      role: "it_role_manager",
      permission: "roles_access:view",
      accessLevel: "limited_own_scope",
    });
    assert.equal(byAdmin.status, 200, byAdmin.text.slice(0, 200));
    assert.equal((await matrixRow(managerRoleId, viewPermissionId)).accessLevel, "limited_own_scope");
  });

  test("POST /permissions stays super-admin-only", async () => {
    const before = await count("permissions");

    const anonymous = await call(null, "POST", "/permissions", { module: "settings", action: "view" });
    const manager = await call("roleManager", "POST", "/permissions", { module: "settings", action: "view" });
    const advisor = await call("societyAdvisor", "POST", "/permissions", { module: "settings", action: "view" });
    assert.equal(anonymous.status, 401);
    assert.equal(manager.status, 403);
    assert.equal(advisor.status, 403);
    assert.equal(await count("permissions"), before);

    const admin = await call("admin", "POST", "/permissions", { module: "settings", action: "view" });
    assert.equal(admin.status, 201, admin.text.slice(0, 200));
  });
});

describe("role-permission matrix: what is referenced must exist", () => {
  test("a role or permission id that exists nowhere is a 404 and writes nothing", async () => {
    const before = await count("rolepermissions");

    const ghostRole = await call("admin", "POST", "/role-permissions", { role: MISSING, permission: viewPermissionId, accessLevel: "full" });
    const ghostPermission = await call("admin", "POST", "/role-permissions", { role: managerRoleId, permission: MISSING, accessLevel: "full" });
    const asAdvisor = await call("societyAdvisor", "POST", "/role-permissions", { role: MISSING, permission: MISSING, accessLevel: "full" });

    assert.equal(ghostRole.status, 404, ghostRole.text.slice(0, 200));
    assert.equal(ghostRole.body.error.code, "NOT_FOUND");
    assert.equal(ghostPermission.status, 404);
    assert.equal(asAdvisor.status, 404);
    assert.equal(await count("rolepermissions"), before, "a dangling document was written");
  });

  test("unknown role names and permission keys are 404s", async () => {
    const before = await count("rolepermissions");

    const role = await call("admin", "POST", "/role-permissions", { role: "no_such_role", permission: viewPermissionId, accessLevel: "full" });
    const key = await call("admin", "POST", "/role-permissions", { role: managerRoleId, permission: "no:such_key", accessLevel: "full" });

    assert.equal(role.status, 404);
    assert.equal(key.status, 404);
    assert.equal(await count("rolepermissions"), before);
  });

  test("non-string inputs and bad access levels are 400s, never 500s", async () => {
    const before = await count("rolepermissions");

    for (const extra of [
      { role: { a: 1 } },
      { role: [managerRoleId] },
      { permission: { a: 1 } },
      { permission: 5 },
      { accessLevel: ["full"] },
      { accessLevel: "root" },
    ]) {
      const res = await call("admin", "POST", "/role-permissions", { role: managerRoleId, permission: viewPermissionId, accessLevel: "full", ...extra });

      assert.equal(res.status, 400, JSON.stringify(extra));
    }
    const missing = await call("admin", "POST", "/role-permissions", { role: managerRoleId });
    assert.equal(missing.status, 400);
    assert.equal(await count("rolepermissions"), before);
  });

  test("a valid update creates the pair once and then updates it in place", async () => {
    const created = await call("admin", "POST", "/roles", roleBody());
    const newRoleId = created.body.data.id;
    const before = await count("rolepermissions");

    const first = await call("admin", "POST", "/role-permissions", { role: newRoleId, permission: viewPermissionId, accessLevel: "limited_own_scope" });
    const second = await call("admin", "POST", "/role-permissions", { role: newRoleId, permission: viewPermissionId, accessLevel: "approval" });

    assert.equal(first.status, 200, first.text.slice(0, 200));
    assert.equal(second.status, 200);
    assert.equal(await count("rolepermissions"), before + 1);
    assert.equal((await matrixRow(newRoleId, viewPermissionId)).accessLevel, "approval");
  });

  test("the server stays healthy after the rejected requests", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});
