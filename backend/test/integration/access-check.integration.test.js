"use strict";

/**
 * AUD-023 over HTTP: POST /access/check authorization and audit attribution.
 *
 * Policy (accessCheck.controller.js): an authenticated user may check their own
 * permissions; checking anyone else needs a UserRole whose role level is
 * super_admin or faculty_advisor (User.role === "ADMIN" alone is not enough).
 * The audit actor is the authenticated caller; the inspected user is recorded in
 * details.metadata.targetUserId (auditLogger.js maps user -> userId and keeps the
 * remaining context under details).
 *
 * Fixture identities: admin holds the sb_faculty_advisor role (level
 * super_admin); chairA/chairB are society chairs; memberA is a member; loner has
 * no RBAC role. A disposable faculty_advisor is created here because the shared
 * fixtures have none.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 * Everything written lives in the harness's disposable database. Tokens are
 * never printed.
 */

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const {
  requireHarnessTarget,
  deleteDisposableUser,
  withDatabase,
} = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { TEST_PASSWORD } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const session = createSession(target);
const { users } = target.ready.fixtures;

const MISSING_ID = "64b7f8f2a1b2c3d4e5f6ffff"; // well-formed, no such user
const ADVISOR_EMAIL = `access-check-advisor-${Date.now()}@integration.test`;
const LEGACY_ADMIN_EMAIL = `access-check-legacy-admin-${Date.now()}@integration.test`;

let advisor; // { id, token }
let legacyAdmin; // { id, token }: User.role === "ADMIN" but no UserRole
let counter = 0;
const uniqueModule = (label) => `probe_${label}_${++counter}_${Date.now()}`;

async function asToken(account, route, body) {
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${account.token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text), text };
}

const check = (userKey, body) => session.request(userKey, "POST", "/access/check", { body });

const request = (userId, extra = {}) => ({
  userId,
  module: "events",
  action: "view",
  ...extra,
});

/** Newest saved audit rows for a unique module name, oldest first. */
function auditRows(module) {
  return withDatabase(target, (db) =>
    db.collection("auditlogs").find({ module }).sort({ createdAt: 1 }).toArray(),
  );
}

before(async () => {
  // roles_access:view/create do not exist in the shared fixtures; the super_admin
  // resolver grants "full" on every permission that exists.
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    for (const action of ["view", "create"]) {
      await db.collection("permissions").updateOne(
        { key: `roles_access:${action}` },
        {
          $setOnInsert: {
            key: `roles_access:${action}`,
            module: "roles_access",
            action,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }

    // A disposable user holding a faculty_advisor-level role.
    const register = await target.registerAccount({
        name: "Disposable Faculty Advisor",
        email: ADVISOR_EMAIL,
        password: TEST_PASSWORD,
      });
    const registered = await register.json();
    assert.equal(register.status, 201, "could not register the disposable advisor");
    const advisorId = registered.data.user.id;

    const role = await db.collection("roles").findOneAndUpdate(
      { name: "it_faculty_advisor" },
      {
        $setOnInsert: {
          name: "it_faculty_advisor",
          displayName: "Integration Faculty Advisor",
          level: "faculty_advisor",
          scope: "global",
          description: "Integration test role",
          isSystemRole: false,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    await db.collection("userroles").insertOne({
      user: new ObjectId(advisorId),
      role: role._id,
      society: null,
      assignedBy: new ObjectId(users.admin.id),
      assignedAt: now,
    });

    const login = await target.api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADVISOR_EMAIL, password: TEST_PASSWORD }),
    });
    const body = await login.json();
    assert.equal(login.status, 200, "could not log in as the disposable advisor");
    advisor = { id: advisorId, token: body.data.token };

    // A user that is ADMIN in User.role but holds no UserRole at all.
    const registerLegacy = await target.registerAccount({
        name: "Disposable Legacy Admin",
        email: LEGACY_ADMIN_EMAIL,
        password: TEST_PASSWORD,
      });
    const legacy = await registerLegacy.json();
    assert.equal(registerLegacy.status, 201, "could not register the legacy admin");
    await db
      .collection("users")
      .updateOne({ _id: new ObjectId(legacy.data.user.id) }, { $set: { role: "ADMIN" } });
    const loginLegacy = await target.api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: LEGACY_ADMIN_EMAIL, password: TEST_PASSWORD }),
    });
    const legacyBody = await loginLegacy.json();
    assert.equal(loginLegacy.status, 200, "could not log in as the legacy admin");
    legacyAdmin = { id: legacy.data.user.id, token: legacyBody.data.token };
  });
});

after(async () => {
  if (advisor) {
    await withDatabase(target, (db, ObjectId) =>
      db.collection("userroles").deleteOne({ user: new ObjectId(advisor.id) }),
    );
    await deleteDisposableUser(target, advisor.id, ADVISOR_EMAIL);
  }
  if (legacyAdmin) {
    await deleteDisposableUser(target, legacyAdmin.id, LEGACY_ADMIN_EMAIL);
  }
});

describe("authentication", () => {
  test("a request without a token is 401", async () => {
    const res = await session.request(null, "POST", "/access/check", {
      body: request(users.chairA.id),
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test("an invalid token is 401", async () => {
    const res = await session.request(null, "POST", "/access/check", {
      headers: { Authorization: "Bearer not-a-real-token" },
      body: request(users.chairA.id),
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });
});

describe("self-check", () => {
  test("a user can check their own permissions, and the answer is theirs", async () => {
    const granted = await check("chairA", request(users.chairA.id, { module: "events", action: "edit" }));
    const notGranted = await check("memberA", request(users.memberA.id, { module: "events", action: "edit" }));

    assert.equal(granted.status, 200);
    assert.equal(granted.body.success, true);
    assert.deepEqual(Object.keys(granted.body.data).sort(), ["accessLevel", "allowed", "reason"]);
    assert.equal(granted.body.data.allowed, true);
    assert.equal(granted.body.data.accessLevel, "limited_own_scope");
    assert.equal(notGranted.status, 200);
    assert.equal(notGranted.body.data.allowed, false);
  });

  test("a user with no RBAC role can check themselves and is simply not allowed", async () => {
    const res = await check("loner", request(users.loner.id));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.allowed, false);
  });
});

describe("cross-user checks by unprivileged callers", () => {
  test("are 403 PERMISSION_DENIED and disclose nothing about the target", async () => {
    const cases = [
      ["chairA", users.chairB.id], // another society's chair
      ["chairA", users.admin.id], // the super admin
      ["memberA", users.chairA.id], // same society, lower role
      ["loner", users.chairA.id], // no RBAC role at all
    ];
    for (const [caller, targetId] of cases) {
      const res = await check(caller, request(targetId));

      assert.equal(res.status, 403, `${caller} -> ${targetId}`);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, "PERMISSION_DENIED");
      assert.equal(res.body.data, undefined, "permission data was returned");
    }
  });

  test("a nonexistent target is indistinguishable from an existing one", async () => {
    const forMissing = await check("chairA", request(MISSING_ID));
    const forExisting = await check("chairA", request(users.chairB.id));

    assert.equal(forMissing.status, 403);
    assert.deepEqual(forMissing.body, forExisting.body);
  });

  test("User.role === 'ADMIN' without a super_admin/faculty_advisor UserRole is not privileged", async () => {
    const other = await asToken(legacyAdmin, "/access/check", request(users.chairA.id));
    const self = await asToken(legacyAdmin, "/access/check", request(legacyAdmin.id));

    assert.equal(other.status, 403, other.text.slice(0, 160));
    assert.equal(other.body.error.code, "PERMISSION_DENIED");
    assert.equal(self.status, 200, "a self-check must still work");
  });

  test("spoofed identity fields in the body do not grant privilege", async () => {
    const res = await check(
      "chairA",
      request(users.chairB.id, {
        callerId: users.admin.id,
        actor: users.admin.id,
        user: { _id: users.admin.id },
        role: "super_admin",
        isAdmin: true,
      }),
    );

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "PERMISSION_DENIED");
  });

  test("a differently-cased copy of another user's id is still another user", async () => {
    const res = await check("chairA", request(users.chairB.id.toUpperCase()));

    assert.equal(res.status, 403);
  });
});

describe("cross-user checks by privileged callers", () => {
  test("a super_admin can check another user and gets the target's permissions", async () => {
    const asTarget = await check("admin", request(users.memberA.id, { module: "community_hub", action: "create" }));
    const notGranted = await check("admin", request(users.memberA.id, { module: "events", action: "edit" }));
    const own = await check("admin", request(users.admin.id, { module: "events", action: "edit" }));

    assert.equal(asTarget.status, 200);
    assert.equal(asTarget.body.data.allowed, true);
    assert.equal(asTarget.body.data.accessLevel, "limited_own_scope");
    // The admin has "full" on events:edit; the member has none. The answer must
    // describe the target, not the caller.
    assert.equal(notGranted.status, 200);
    assert.equal(notGranted.body.data.allowed, false);
    assert.equal(own.body.data.accessLevel, "full");
  });

  test("a faculty_advisor can check another user", async () => {
    const res = await asToken(advisor, "/access/check", request(users.chairA.id, { action: "edit" }));

    assert.equal(res.status, 200, res.text.slice(0, 160));
    assert.equal(res.body.data.allowed, true);
    assert.equal(res.body.data.accessLevel, "limited_own_scope");
  });
});

describe("missing, malformed and nonexistent target ids", () => {
  test("missing userId, module or action is 400 VALIDATION_ERROR", async () => {
    for (const caller of ["chairA", "admin"]) {
      for (const body of [
        {},
        { module: "events", action: "view" },
        { userId: users.chairA.id, action: "view" },
        { userId: users.chairA.id, module: "events" },
      ]) {
        const res = await check(caller, body);

        assert.equal(res.status, 400, `${caller} ${JSON.stringify(body)}`);
        assert.equal(res.body.error.code, "VALIDATION_ERROR");
      }
    }
  });

  test("malformed ids are 400, even for a privileged caller", async () => {
    const malformed = [
      "not-an-object-id",
      "abcdefghijkl", // 12 characters
      users.chairA.id.slice(1),
      `${users.chairA.id}0`,
      [users.chairA.id, users.chairB.id],
      { $ne: null },
      12345,
    ];
    for (const caller of ["chairA", "admin"]) {
      for (const userId of malformed) {
        const res = await check(caller, request(userId));

        assert.equal(res.status, 400, `${caller} ${JSON.stringify(userId)}`);
        assert.equal(res.body.error.code, "VALIDATION_ERROR");
      }
    }
  });

  test("a nonexistent target is 404 NOT_FOUND for a privileged caller", async () => {
    const res = await check("admin", request(MISSING_ID));

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });

  test("the server stays healthy after the rejected requests", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});

describe("audit attribution (persisted rows)", () => {
  test("a self-check is audited to the caller with the same user as target", async () => {
    const module = uniqueModule("self");

    const res = await check("chairA", request(users.chairA.id, { module, action: "edit" }));
    assert.equal(res.status, 200);

    const rows = await auditRows(module);
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].userId), users.chairA.id);
    assert.equal(rows[0].action, "access_check");
    assert.equal(rows[0].module, module);
    assert.equal(rows[0].details.metadata.targetUserId, users.chairA.id);
    assert.equal(rows[0].details.metadata.requestedAction, "edit");
  });

  test("a cross-user check is audited to the privileged caller, with the target as metadata", async () => {
    const module = uniqueModule("cross");

    const res = await check("admin", request(users.chairB.id, { module, action: "edit" }));
    assert.equal(res.status, 200);

    const rows = await auditRows(module);
    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.equal(String(row.userId), users.admin.id, "the actor is not the caller");
    assert.notEqual(String(row.userId), users.chairB.id, "the target was saved as the actor");
    assert.equal(row.details.metadata.targetUserId, users.chairB.id);
    assert.equal(row.details.metadata.requestedAction, "edit");
    assert.equal(row.details.method, "POST");
    assert.match(row.details.route, /\/access\/check$/);
    assert.equal(row.details.result, "denied"); // chair B has no permission on this module
    assert.match(row.details.reason, new RegExp(`${module}:edit`));
    assert.equal(typeof row.ipAddress, "string");
    assert.ok(row.createdAt instanceof Date);
  });

  test("a faculty_advisor's cross-user check is audited to the advisor", async () => {
    const module = uniqueModule("advisor");

    const res = await asToken(advisor, "/access/check", request(users.memberA.id, { module, action: "edit" }));
    assert.equal(res.status, 200, res.text.slice(0, 160));

    const rows = await auditRows(module);
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].userId), advisor.id);
    assert.equal(rows[0].details.metadata.targetUserId, users.memberA.id);
  });

  test("requests rejected as malformed (400) or unknown (404) write no access_check row", async () => {
    const module = uniqueModule("rejected");

    await check("admin", request("not-an-object-id", { module }));
    await check("admin", request(MISSING_ID, { module }));

    assert.equal((await auditRows(module)).length, 0);
  });
});

describe("other logAudit callers keep working over HTTP", () => {
  test("requirePermission audits the authenticated caller on a protected route", async () => {
    const res = await session.request("admin", "GET", "/roles");
    assert.equal(res.status, 200, res.text.slice(0, 160));

    const rows = await withDatabase(target, (db, ObjectId) =>
      db
        .collection("auditlogs")
        .find({ module: "roles_access", action: "access_check", userId: new ObjectId(users.admin.id) })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray(),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].details.result, "allowed");
    assert.equal(rows[0].details.method, "GET");
    assert.match(rows[0].details.route, /\/roles$/);
    assert.match(rows[0].details.reason, /roles_access:view/);
  });

  test("POST /roles still works and its controller audit entry names the creator", async () => {
    const name = `it-audit-probe-${Date.now()}`;

    const res = await session.request("admin", "POST", "/roles", {
      body: { name, displayName: "Audit Probe", level: "member", scope: "society" },
    });
    assert.equal(res.status, 201, res.text.slice(0, 160));

    const rows = await withDatabase(target, (db) =>
      db.collection("auditlogs").find({ action: "role_created", "details.metadata.roleName": name }).toArray(),
    );
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].userId), users.admin.id);
    assert.equal(rows[0].module, "roles_access");
    assert.equal(rows[0].details.result, "allowed");
    assert.equal(rows[0].details.metadata.level, "member");
  });

  test("a denied protected request is audited as denied for the caller", async () => {
    const res = await session.request("chairA", "GET", "/roles");
    assert.equal(res.status, 403);

    const rows = await withDatabase(target, (db, ObjectId) =>
      db
        .collection("auditlogs")
        .find({ module: "roles_access", userId: new ObjectId(users.chairA.id) })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray(),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].details.result, "denied");
  });
});
