"use strict";

/**
 * AUD-031 over HTTP: how many audit rows one logical request writes.
 *
 * The audit register listed "audit double writes" as unconfirmed. Probing every audit
 * writer (requirePermission, requireRole, the RBAC controllers, finance, event
 * registration) on the isolated harness found NO duplicate persistence: each request
 * writes exactly the rows below, and distinct events (the permission check plus the
 * action's own event) are intentionally separate rows. These tests pin that behavior so
 * a future double write (for example a route that stacks requirePermission twice, or a
 * handler that logs and also lets middleware log) fails here.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { users, societies } = target.ready.fixtures;
const A = societies.A.id;

const RUN = Date.now();
const rows = () => withDatabase(target, (db) => db.collection("auditlogs").find({}).sort({ createdAt: 1, _id: 1 }).toArray());

/** Audit rows written by one request. */
async function written(key, method, route, body) {
  const before = (await rows()).length;
  const res = await session.request(key, method, route, body === undefined ? {} : { body });
  const after = await rows();
  return { res, rows: after.slice(before) };
}
const summary = (list) => list.map((r) => `${r.action}/${r.module}/${r.details && r.details.result}`);

before(async () => {
  await withDatabase(target, async (db) => {
    for (const key of ["roles_access:view", "roles_access:create"]) {
      const [module, action] = key.split(":");
      await db.collection("permissions").updateOne({ key }, { $setOnInsert: { key, module, action, description: key } }, { upsert: true });
    }
  });
});

describe("permission checks write one row per request", () => {
  test("an allowed request writes exactly one access_check row, attributed to the caller", async () => {
    const { res, rows: written1 } = await written("chairA", "GET", `/societies/${A}/notes`);

    assert.equal(res.status, 200);
    assert.deepEqual(summary(written1), ["access_check/community_hub/allowed"]);
    assert.equal(String(written1[0].userId), users.chairA.id);
    assert.equal(written1[0].details.method, "GET");
  });

  test("a denied request writes exactly one denied row", async () => {
    const { res, rows: written1 } = await written("memberA", "PUT", `/societies/${A}/notes/64b7f8f2a1b2c3d4e5f6ffff`, { title: "x" });

    assert.equal(res.status, 403);
    assert.deepEqual(summary(written1), ["access_check/community_hub/denied"]);
    assert.equal(String(written1[0].userId), users.memberA.id);
  });

  test("a request with no permission middleware writes nothing", async () => {
    const { res, rows: written1 } = await written("chairA", "GET", "/events");

    assert.equal(res.status, 200);
    assert.deepEqual(written1, []);
  });

  test("an unauthenticated request writes nothing", async () => {
    const { res, rows: written1 } = await written(null, "GET", `/societies/${A}/notes`);

    assert.equal(res.status, 401);
    assert.deepEqual(written1, []);
  });

  test("repeating a request writes one new row each time, not more", async () => {
    const first = await written("chairA", "GET", `/societies/${A}/notes`);
    const second = await written("chairA", "GET", `/societies/${A}/notes`);

    assert.equal(first.rows.length, 1);
    assert.equal(second.rows.length, 1);
    assert.notEqual(String(first.rows[0]._id), String(second.rows[0]._id));
  });
});

describe("actions that log their own event", () => {
  test("creating a role writes the permission check and ONE role_created row (distinct events)", async () => {
    const { res, rows: written1 } = await written("admin", "POST", "/roles", {
      name: `audit_count_${RUN}`,
      displayName: "Audit Count",
      level: "member",
      scope: "society",
    });

    assert.equal(res.status, 201, res.text.slice(0, 160));
    assert.deepEqual(summary(written1), ["access_check/roles_access/allowed", "role_created/roles_access/allowed"]);
    assert.equal(written1[1].details.metadata.roleName, `audit_count_${RUN}`);
    assert.equal(String(written1[1].userId), users.admin.id);
  });

  test("a failed create (duplicate name) writes only the permission check, no role_created", async () => {
    const { res, rows: written1 } = await written("admin", "POST", "/roles", {
      name: `audit_count_${RUN}`,
      displayName: "Audit Count",
      level: "member",
      scope: "society",
    });

    assert.equal(res.status, 409);
    assert.deepEqual(summary(written1), ["access_check/roles_access/allowed"]);
  });

  test("a programmatic access check writes one row naming the target in its metadata", async () => {
    const { res, rows: written1 } = await written("chairA", "POST", "/access/check", {
      userId: users.chairA.id,
      module: "events",
      action: "view",
    });

    assert.equal(res.status, 200);
    assert.equal(written1.length, 1);
    assert.equal(written1[0].action, "access_check");
    assert.equal(String(written1[0].userId), users.chairA.id);
    assert.equal(written1[0].details.metadata.targetUserId, users.chairA.id);
  });

  test("reading the audit log through the API writes one row for that read", async () => {
    const { res, rows: written1 } = await written("admin", "GET", "/audit-logs");

    assert.equal(res.status, 200);
    assert.deepEqual(summary(written1), ["access_check/roles_access/allowed"]);
  });
});

describe("event registration", () => {
  let eventId;
  before(async () => {
    // On a brand-new empty database Mongoose only builds this collection's indexes after the
    // first write, so a very early repeat registration is not yet refused by the unique
    // (event, user) index. Create the model's own index up front so the test is deterministic
    // (same specification as models/EventRegistration.js; disposable harness database only).
    await withDatabase(target, (db) =>
      db.collection("eventregistrations").createIndex({ event: 1, user: 1 }, { unique: true }),
    );
    eventId = await withDatabase(target, async (db, ObjectId) => {
      const now = new Date();
      const inserted = await db.collection("events").insertOne({
        societyId: new ObjectId(A),
        title: `audit-count-${RUN}`,
        date: new Date("2026-06-01T10:00:00Z"),
        eventType: "Workshop",
        participants: 10,
        description: "Integration event",
        createdAt: now,
        updatedAt: now,
      });
      return String(inserted.insertedId);
    });
  });

  test("one registration writes one EVENT_REGISTER row; a repeated attempt writes none", async () => {
    const first = await written("memberA", "POST", `/events/${eventId}/register`);
    const repeat = await written("memberA", "POST", `/events/${eventId}/register`);

    assert.equal(first.res.status, 201, first.res.text.slice(0, 160));
    assert.deepEqual(first.rows.map((r) => r.action), ["EVENT_REGISTER"]);
    assert.equal(String(first.rows[0].userId), users.memberA.id);
    assert.equal(first.rows[0].details.eventId, eventId);
    assert.equal(repeat.res.status, 400);
    assert.deepEqual(repeat.rows, []);
  });
});
