"use strict";

/**
 * Event registration data integrity over HTTP: the unique (event, user) index must be in
 * place before registrations are accepted.
 *
 * Reproduced defect: on a fresh database the EventRegistration model used to be loaded
 * lazily inside the route handler, so its indexes only started building on the FIRST
 * registration request. A repeat or concurrent registration arriving before the unique
 * index existed was accepted: two active registrations (and two EVENT_REGISTER audit rows)
 * for one user and event. The model is now loaded at start-up and the handler awaits
 * EventRegistration.init() (additive: it creates, never drops or rebuilds, an index)
 * before writing.
 *
 * Each integration file gets a brand-new harness and database with no eventregistrations
 * collection, so the first test below is exactly the vulnerable situation: the very first
 * registration requests ever made, all at once. No sleeps and no index set-up by the test.
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

const RUN = Date.now();
let eventId;

const register = (key, id = eventId) => session.request(key, "POST", `/events/${id}/register`);
const registrations = (id = eventId) =>
  withDatabase(target, (db, ObjectId) => db.collection("eventregistrations").find({ event: new ObjectId(id) }).toArray());
const audits = (id = eventId) =>
  withDatabase(target, (db) => db.collection("auditlogs").find({ action: "EVENT_REGISTER", "details.eventId": id }).toArray());

before(async () => {
  // Warm the session tokens (logins) so the concurrent requests below are registrations only.
  for (const key of ["memberA", "chairA", "chairB"]) await session.tokenFor(key);
  eventId = await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const inserted = await db.collection("events").insertOne({
      societyId: new ObjectId(societies.A.id),
      title: `index-race-${RUN}`,
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

describe("the first registrations ever made on a fresh database", () => {
  test("eight simultaneous registrations by one user create exactly one registration", async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => register("memberA")));

    const statuses = responses.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 400, 400, 400, 400, 400, 400, 400], statuses.join(","));
    for (const response of responses.filter((r) => r.status === 400)) {
      assert.equal(response.body.message, "User already registered for this event");
    }
    assert.equal((await registrations()).length, 1);
  });

  test("only the successful registration was audited", async () => {
    const rows = await audits();

    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].userId), users.memberA.id);
  });

  test("the unique (event, user) index exists", async () => {
    const indexes = await withDatabase(target, (db) => db.collection("eventregistrations").indexes());

    assert.ok(
      indexes.some((index) => index.unique && index.key.event === 1 && index.key.user === 1),
      JSON.stringify(indexes.map((i) => i.name)),
    );
  });
});

describe("after the index is ready", () => {
  test("a later repeat is the same 400 and adds nothing", async () => {
    const again = await register("memberA");

    assert.equal(again.status, 400);
    assert.equal(again.body.message, "User already registered for this event");
    assert.equal((await registrations()).length, 1);
    assert.equal((await audits()).length, 1);
  });

  test("different users registering together each get one registration and one audit row", async () => {
    const [a, b] = await Promise.all([register("chairA"), register("chairB")]);

    assert.equal(a.status, 201, a.text.slice(0, 160));
    assert.equal(b.status, 201, b.text.slice(0, 160));
    assert.equal((await registrations()).length, 3);
    assert.equal((await audits()).length, 3);
  });

  test("registering still requires authentication, and unknown events are 404 with no row", async () => {
    const anonymous = await session.request(null, "POST", `/events/${eventId}/register`);
    const missing = await register("memberA", "64b7f8f2a1b2c3d4e5f6ffff");

    assert.equal(anonymous.status, 401);
    assert.equal(missing.status, 404);
    assert.equal((await registrations()).length, 3);
    assert.equal((await audits()).length, 3);
  });
});
