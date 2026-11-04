"use strict";

/**
 * GET /audit-logs over HTTP (auditLogs.controller.js).
 *
 * The AuditLog schema stores the actor as `userId`, the time as `createdAt` and
 * route/method/result/reason/metadata under `details` (auditLogger.js). The
 * endpoint filters, sorts and populates on those fields and returns flat
 * entries: { id, user, action, module, route, method, result, reason, metadata,
 * timestamp }. Authorization is unchanged: roles_access:view (middleware) and a
 * super_admin / faculty_advisor role level (controller).
 *
 * Rows are inserted directly into the harness's disposable database with fixed
 * timestamps and a unique module name, so counts and ordering are exact. Dates
 * are placed well away from day boundaries because dateTo is applied in the
 * server's local time zone.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { users } = target.ready.fixtures;

const RUN = Date.now();
const MODULE = `auditread_${RUN}`;
const OTHER_MODULE = `auditread_other_${RUN}`;
const MISSING_USER_ID = "64b7f8f2a1b2c3d4e5f6ffff";

const at = (iso) => new Date(iso);
const T = {
  r1: at("2026-01-10T12:00:00Z"),
  r2: at("2026-01-14T12:00:00Z"),
  r3: at("2026-01-20T12:00:00Z"),
  r4: at("2025-12-01T12:00:00Z"), // historical, no actor, no details
  r5: at("2025-12-02T12:00:00Z"), // actor no longer exists
  other: at("2026-02-01T12:00:00Z"),
};

const list = (userKey, query = "") =>
  session.request(userKey, "GET", `/audit-logs${query ? `?${query}` : ""}`);
const byModule = (extra = "") => `module=${MODULE}${extra ? `&${extra}` : ""}`;
const reasonsOf = (res) => res.body.data.map((e) => e.reason);

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    // roles_access:view does not exist in the shared fixtures. The super_admin
    // resolver grants "full" on every permission that exists.
    const now = new Date();
    await db.collection("permissions").updateOne(
      { key: "roles_access:view" },
      {
        $setOnInsert: {
          key: "roles_access:view",
          module: "roles_access",
          action: "view",
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    // memberA gets the permission but not an audit-capable role level, to
    // exercise the controller's own check separately from the middleware.
    const permission = await db.collection("permissions").findOne({ key: "roles_access:view" });
    const memberRole = await db.collection("roles").findOne({ name: "ieee_member" });
    await db.collection("rolepermissions").insertOne({
      role: memberRole._id,
      permission: permission._id,
      accessLevel: "limited_own_scope",
      createdAt: now,
      updatedAt: now,
    });

    const row = (userId, module, createdAt, details) => ({
      userId,
      action: "access_check",
      module,
      ...(details ? { details } : {}),
      ipAddress: "",
      userAgent: "",
      createdAt,
    });
    // Inserted out of chronological order on purpose.
    await db.collection("auditlogs").insertMany([
      row(new ObjectId(users.admin.id), MODULE, T.r1, {
        route: "/api/v1/things/1",
        method: "GET",
        result: "allowed",
        reason: "r1",
        metadata: { requestedAction: "view", n: 1 },
      }),
      row(null, MODULE, T.r4), // historical: no actor, no details
      row(new ObjectId(users.admin.id), MODULE, T.r3, {
        route: "/api/v1/things/3",
        method: "POST",
        result: "allowed",
        reason: "r3",
        metadata: { requestedAction: "create" },
      }),
      row(new ObjectId(MISSING_USER_ID), MODULE, T.r5, {
        route: "/api/v1/things/5",
        method: "DELETE",
        result: "allowed",
        reason: "r5",
        metadata: {},
      }),
      row(new ObjectId(users.chairA.id), MODULE, T.r2, {
        route: "/api/v1/things/2",
        method: "PUT",
        result: "denied",
        reason: "r2",
        metadata: { requestedAction: "edit" },
      }),
      row(new ObjectId(users.admin.id), OTHER_MODULE, T.other, {
        route: "/api/v1/other",
        method: "GET",
        result: "allowed",
        reason: "other",
        metadata: {},
      }),
    ]);
  });
});

describe("authorization", () => {
  test("an authorized caller gets 200 and the response envelope", async () => {
    const res = await list("admin", byModule());

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.deepEqual(Object.keys(res.body.meta).sort(), [
      "limit",
      "page",
      "totalItems",
      "totalPages",
    ]);
  });

  test("an anonymous request is 401", async () => {
    const res = await session.request(null, "GET", "/audit-logs");

    assert.equal(res.status, 401);
  });

  test("a caller without roles_access:view is 403", async () => {
    for (const caller of ["chairA", "chairB", "loner"]) {
      const res = await list(caller, byModule());

      assert.equal(res.status, 403, caller);
      assert.equal(res.body.success, false);
      assert.equal(res.body.data, undefined, "audit data leaked to the denied caller");
    }
  });

  test("a caller with the permission but no super_admin/faculty_advisor level is 403 PERMISSION_DENIED", async () => {
    const res = await list("memberA", byModule());

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "PERMISSION_DENIED");
    assert.match(res.body.error.message, /audit logs/i);
    assert.equal(res.body.data, undefined);
  });
});

describe("entry mapping", () => {
  let entries; // by reason

  before(async () => {
    const res = await list("admin", byModule());
    assert.equal(res.status, 200);
    entries = Object.fromEntries(res.body.data.map((e) => [e.reason ?? "historical", e]));
  });

  test("each entry has exactly the flat shape", () => {
    for (const entry of Object.values(entries)) {
      assert.deepEqual(Object.keys(entry).sort(), [
        "action",
        "id",
        "metadata",
        "method",
        "module",
        "reason",
        "result",
        "route",
        "timestamp",
        "user",
      ]);
    }
  });

  test("the actor is populated from userId with name and email only", () => {
    assert.deepEqual(entries.r1.user, {
      id: users.admin.id,
      name: "Integration Admin",
      email: "admin@integration.test",
    });
    assert.equal(entries.r2.user.id, users.chairA.id);
  });

  test("route, method, result, reason and metadata come from details", () => {
    assert.equal(entries.r1.route, "/api/v1/things/1");
    assert.equal(entries.r1.method, "GET");
    assert.equal(entries.r1.result, "allowed");
    assert.equal(entries.r1.reason, "r1");
    assert.deepEqual(entries.r1.metadata, { requestedAction: "view", n: 1 });
    assert.equal(entries.r2.result, "denied");
    assert.equal(entries.r2.method, "PUT");
    assert.equal(entries.r1.action, "access_check");
    assert.equal(entries.r1.module, MODULE);
  });

  test("the timestamp comes from createdAt", () => {
    assert.equal(new Date(entries.r1.timestamp).getTime(), T.r1.getTime());
    assert.equal(new Date(entries.r3.timestamp).getTime(), T.r3.getTime());
  });

  test("the response contains no credentials or unrelated user fields", async () => {
    const res = await list("admin", byModule());

    assert.doesNotMatch(res.text, /password|passwordHash|\$2[aby]\$|token|societyId/i);
    assert.equal(typeof res.body.data[0].id, "string");
  });
});

describe("historical and orphaned rows", () => {
  test("a row with no actor and no details is returned safely", async () => {
    const res = await list("admin", byModule());
    const historical = res.body.data.find((e) => new Date(e.timestamp).getTime() === T.r4.getTime());

    assert.equal(res.status, 200);
    assert.ok(historical, "the historical row is missing");
    assert.equal(historical.user, null);
    assert.equal(historical.route, null);
    assert.equal(historical.method, null);
    assert.equal(historical.result, null);
    assert.equal(historical.reason, null);
    assert.deepEqual(historical.metadata, {});
    assert.equal(historical.action, "access_check");
    assert.equal(historical.module, MODULE);
  });

  test("a row whose actor no longer exists has user null and keeps its details", async () => {
    const res = await list("admin", byModule());
    const orphan = res.body.data.find((e) => e.reason === "r5");

    assert.equal(orphan.user, null);
    assert.equal(orphan.method, "DELETE");
    assert.equal(orphan.result, "allowed");
  });
});

describe("filtering and sorting use the stored fields", () => {
  test("module", async () => {
    const res = await list("admin", byModule());

    assert.equal(res.body.meta.totalItems, 5);
    assert.ok(res.body.data.every((e) => e.module === MODULE));
  });

  test("result filters on details.result", async () => {
    const denied = await list("admin", byModule("result=denied"));
    const allowed = await list("admin", byModule("result=allowed"));

    assert.deepEqual(reasonsOf(denied), ["r2"]);
    assert.equal(allowed.body.meta.totalItems, 3); // r1, r3, r5; the historical row has no result
  });

  test("user filters on userId", async () => {
    const asAdmin = await list("admin", byModule(`user=${users.admin.id}`));
    const asChair = await list("admin", byModule(`user=${users.chairA.id}`));
    const asNobody = await list("admin", byModule(`user=${users.chairB.id}`));

    assert.deepEqual(reasonsOf(asAdmin).sort(), ["r1", "r3"]);
    assert.deepEqual(reasonsOf(asChair), ["r2"]);
    assert.equal(asNobody.body.meta.totalItems, 0);
    assert.deepEqual(asNobody.body.data, []);
  });

  test("dateFrom and dateTo filter on createdAt", async () => {
    const from = await list("admin", byModule("dateFrom=2026-01-14"));
    const to = await list("admin", byModule("dateTo=2026-01-15"));
    const both = await list("admin", byModule("dateFrom=2026-01-01&dateTo=2026-01-15"));

    assert.deepEqual(reasonsOf(from), ["r3", "r2"]);
    assert.deepEqual(reasonsOf(to), ["r2", "r1", "r5", null]);
    assert.deepEqual(reasonsOf(both), ["r2", "r1"]);
  });

  test("the default order is newest createdAt first, regardless of insertion order", async () => {
    const res = await list("admin", byModule());

    assert.deepEqual(reasonsOf(res), ["r3", "r2", "r1", "r5", null]);
    const times = res.body.data.map((e) => new Date(e.timestamp).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  });

  test("filters combine", async () => {
    const res = await list("admin", byModule(`result=allowed&user=${users.admin.id}&dateFrom=2026-01-15`));

    assert.deepEqual(reasonsOf(res), ["r3"]);
  });
});

describe("pagination", () => {
  test("page and limit slice the ordered result and totals stay consistent", async () => {
    const p1 = await list("admin", byModule("limit=2&page=1"));
    const p2 = await list("admin", byModule("limit=2&page=2"));
    const p3 = await list("admin", byModule("limit=2&page=3"));
    const p4 = await list("admin", byModule("limit=2&page=4"));

    assert.deepEqual(reasonsOf(p1), ["r3", "r2"]);
    assert.deepEqual(reasonsOf(p2), ["r1", "r5"]);
    assert.deepEqual(reasonsOf(p3), [null]);
    assert.deepEqual(p4.body.data, []);
    assert.deepEqual(p1.body.meta, { page: 1, limit: 2, totalItems: 5, totalPages: 3 });
    assert.equal(p3.body.meta.page, 3);
  });

  test("defaults are page 1, limit 20", async () => {
    const res = await list("admin", byModule());

    assert.equal(res.body.meta.page, 1);
    assert.equal(res.body.meta.limit, 20);
    assert.equal(res.body.meta.totalPages, 1);
  });

  test("out-of-range paging values are clamped, never a server error", async () => {
    for (const query of ["page=0", "page=-3", "limit=0", "limit=-5", "limit=100000", "page=abc&limit=xyz"]) {
      const res = await list("admin", byModule(query));

      assert.equal(res.status, 200, query);
      assert.ok(res.body.meta.page >= 1, query);
      assert.ok(res.body.meta.limit >= 1 && res.body.meta.limit <= 100, query);
    }
  });
});

describe("invalid filters are 400, never 500 or an operator", () => {
  test("malformed or non-string values", async () => {
    for (const query of [
      "user=not-an-id",
      "user=abcdefghijkl",
      `user[$ne]=${users.admin.id}`,
      "module[$ne]=x",
      "result[$ne]=x",
      "result[$regex]=.*",
      "dateFrom=not-a-date",
      "dateTo=also-not-a-date",
      "dateFrom[$gt]=2020-01-01",
    ]) {
      const res = await list("admin", query);

      assert.equal(res.status, 400, query);
      assert.equal(res.body.error.code, "VALIDATION_ERROR", query);
    }
  });

  test("a repeated parameter is collapsed by hpp() to its last value, which is a plain string filter", async () => {
    const res = await list("admin", `module=ignored&${byModule("result=denied")}`);

    assert.equal(res.status, 200);
    assert.deepEqual(reasonsOf(res), ["r2"]);
  });

  test("the server stays healthy", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});

describe("end to end with real audit writes", () => {
  test("an /access/check cross-user check appears with the caller as actor and the target in metadata", async () => {
    const module = `auditread_e2e_${RUN}`;

    const check = await session.request("admin", "POST", "/access/check", {
      body: { userId: users.chairB.id, module, action: "view" },
    });
    assert.equal(check.status, 200);

    const res = await list("admin", `module=${module}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.meta.totalItems, 1);
    const [entry] = res.body.data;
    assert.equal(entry.user.id, users.admin.id);
    assert.equal(entry.user.email, "admin@integration.test");
    assert.equal(entry.metadata.targetUserId, users.chairB.id);
    assert.equal(entry.metadata.requestedAction, "view");
    assert.equal(entry.method, "POST");
    assert.match(entry.route, /\/access\/check$/);
    assert.equal(entry.result, "denied");
    assert.match(entry.reason, new RegExp(`${module}:view`));
    assert.ok(Math.abs(Date.now() - new Date(entry.timestamp).getTime()) < 60_000);
  });
});
