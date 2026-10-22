"use strict";

/**
 * AUD-020 over HTTP: POST /events/:id/register and GET /events/:id/registrations.
 *
 * Policy (routes/events.js):
 *   register - any authenticated user may register for any EXISTING event (the
 *     code has no society or status rule and none is added); the registrant is
 *     always the authenticated user; nonexistent event 404, malformed id 400;
 *     the unique (event, user) index makes a repeat registration a 400.
 *   list - events:edit (the organizer permission used by the other event
 *     routes) AND either an administrator or an office bearer whose society is
 *     the one stored on the event. Same-society members without events:edit and
 *     society-less users are refused.
 *
 * Every denied or invalid request is proven by the database: registrations and
 * EVENT_REGISTER audit entries are counted before and after.
 *
 * Fixtures: chairA/memberA belong to society A, chairB to society B, loner has
 * no society or RBAC role, admin is the branch-wide administrator. Events are
 * inserted here (one per society). A disposable organizer holds events:edit
 * but has no User.societyId, to exercise the missing-society case.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
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
const { users, societies } = target.ready.fixtures;

const RUN = Date.now();
const MISSING_EVENT = "64b7f8f2a1b2c3d4e5f6ffff";
const ORGANIZER_EMAIL = `event-organizer-no-society-${RUN}@integration.test`;

let events; // { A: id, B: id }
let organizer; // { id, token }: events:edit via a society-A UserRole, but User.societyId null

const registerAs = (userKey, eventId, body) =>
  session.request(userKey, "POST", `/events/${eventId}/register`, body === undefined ? {} : { body });
const listAs = (userKey, eventId, query = "") =>
  session.request(userKey, "GET", `/events/${eventId}/registrations${query}`);

async function asToken(account, method, route, body) {
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(account ? { Authorization: `Bearer ${account.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed, text };
}

const registrationsOf = (eventId) =>
  withDatabase(target, (db, ObjectId) =>
    db.collection("eventregistrations").find({ event: new ObjectId(eventId) }).toArray(),
  );
const totalRegistrations = () =>
  withDatabase(target, (db) => db.collection("eventregistrations").countDocuments({}));
const registerAudits = (filter = {}) =>
  withDatabase(target, (db) =>
    db.collection("auditlogs").find({ action: "EVENT_REGISTER", ...filter }).toArray(),
  );

/** Counts that must not change across a denied or invalid request. */
async function snapshot() {
  return { registrations: await totalRegistrations(), audits: (await registerAudits()).length };
}

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const event = (societyId, title) => ({
      societyId: new ObjectId(societyId),
      title,
      date: new Date("2026-06-01T10:00:00Z"),
      eventType: "Workshop",
      participants: 10,
      description: "Integration event",
      createdAt: now,
      updatedAt: now,
    });
    const a = await db.collection("events").insertOne(event(societies.A.id, `Event A ${RUN}`));
    const b = await db.collection("events").insertOne(event(societies.B.id, `Event B ${RUN}`));
    events = { A: String(a.insertedId), B: String(b.insertedId) };

    const register = await target.registerAccount({
        name: "Disposable Organizer Without Society",
        email: ORGANIZER_EMAIL,
        password: TEST_PASSWORD,
      });
    const registered = await register.json();
    assert.equal(register.status, 201, "could not register the disposable organizer");
    const id = registered.data.user.id;
    const stored = await db.collection("users").findOne({ _id: new ObjectId(id) });
    assert.ok(!stored.societyId, "the disposable organizer unexpectedly has a society");

    const chairRole = await db.collection("roles").findOne({ name: "society_chair" });
    await db.collection("userroles").insertOne({
      user: new ObjectId(id),
      role: chairRole._id,
      society: new ObjectId(societies.A.id),
      assignedBy: new ObjectId(users.admin.id),
      assignedAt: now,
    });
    const login = await target.api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ORGANIZER_EMAIL, password: TEST_PASSWORD }),
    });
    const body = await login.json();
    assert.equal(login.status, 200);
    organizer = { id, token: body.data.token };
  });
});

after(async () => {
  if (!organizer) return;
  await withDatabase(target, (db, ObjectId) =>
    db.collection("userroles").deleteOne({ user: new ObjectId(organizer.id) }),
  );
  await deleteDisposableUser(target, organizer.id, ORGANIZER_EMAIL);
});

describe("register: open participation", () => {
  test("a user from another society can register for an existing event", async () => {
    const res = await registerAs("chairB", events.A);

    assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, "REGISTERED");
    assert.equal(String(res.body.data.event), events.A);
    assert.equal(String(res.body.data.user), users.chairB.id);
    const rows = await registrationsOf(events.A);
    const mine = rows.filter((r) => String(r.user) === users.chairB.id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].status, "REGISTERED");
  });

  test("a member and a user with no society or role can register too", async () => {
    const member = await registerAs("memberA", events.B);
    const loner = await registerAs("loner", events.B);

    assert.equal(member.status, 201, member.text.slice(0, 200));
    assert.equal(loner.status, 201, loner.text.slice(0, 200));
  });

  test("the registration is audited to the registrant", async () => {
    const res = await registerAs("chairA", events.B);

    assert.equal(res.status, 201, res.text.slice(0, 200));
    const audits = await registerAudits({ userId: await userObjectId(users.chairA.id) });
    const entry = audits.find((a) => a.details.eventId === events.B);
    assert.ok(entry, "no audit entry for the registration");
    assert.equal(String(entry.details.registrationId), String(res.body.data.id));
  });

  test("a repeat registration keeps its 400 response and adds no row", async () => {
    const before = await registrationsOf(events.A);
    const first = await registerAs("chairA", events.A);
    assert.equal(first.status, 201);

    const again = await registerAs("chairA", events.A);

    assert.equal(again.status, 400);
    assert.equal(again.body.message, "User already registered for this event");
    const rows = await registrationsOf(events.A);
    assert.equal(rows.length, before.length + 1);
    assert.equal(rows.filter((r) => String(r.user) === users.chairA.id).length, 1);
  });
});

function userObjectId(id) {
  return withDatabase(target, (_db, ObjectId) => new ObjectId(id));
}

describe("register: identity comes from the authenticated user", () => {
  test("body fields cannot register someone else or change the status or event", async () => {
    const eventsBefore = await registrationsOf(events.B);

    const res = await session.request("admin", "POST", `/events/${events.A}/register`, {
      body: {
        user: users.chairB.id,
        userId: users.chairB.id,
        registrant: users.chairB.id,
        event: events.B,
        status: "ATTENDED",
        registeredAt: "2001-01-01T00:00:00Z",
      },
    });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(String(res.body.data.user), users.admin.id);
    assert.equal(String(res.body.data.event), events.A);
    assert.equal(res.body.data.status, "REGISTERED");
    const stored = (await registrationsOf(events.A)).filter((r) => String(r.user) === users.admin.id);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].status, "REGISTERED");
    assert.ok(stored[0].registeredAt.getFullYear() >= 2026, "registeredAt was client-controlled");
    assert.equal((await registrationsOf(events.B)).length, eventsBefore.length, "the body's event id was used");
  });
});

describe("register: invalid requests create nothing", () => {
  test("a nonexistent event is 404", async () => {
    const before = await snapshot();

    const res = await registerAs("chairA", MISSING_EVENT);

    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Event not found");
    assert.deepEqual(await snapshot(), before);
    assert.equal((await registrationsOf(MISSING_EVENT)).length, 0);
  });

  test("malformed event ids are 400", async () => {
    const before = await snapshot();

    for (const id of ["not-an-object-id", "abcdefghijkl", `${events.A}0`, "undefined", "null"]) {
      const res = await registerAs("chairA", id);

      assert.equal(res.status, 400, id);
      assert.equal(res.body.message, "Invalid ID format.");
    }
    assert.deepEqual(await snapshot(), before);
  });

  test("anonymous and invalid-token requests are 401", async () => {
    const before = await snapshot();

    const anonymous = await asToken(null, "POST", `/events/${events.A}/register`, {});
    const badToken = await asToken({ token: "not-a-real-token" }, "POST", `/events/${events.A}/register`, {});

    assert.equal(anonymous.status, 401);
    assert.equal(badToken.status, 401);
    assert.deepEqual(await snapshot(), before);
  });

  test("the server stays healthy after the rejected requests", async () => {
    const res = await target.api("/health");

    assert.equal(res.status, 200);
  });
});

describe("list: authorized callers", () => {
  before(async () => {
    // Make sure both events have registrants from both societies.
    await registerAs("chairB", events.A);
    await registerAs("memberA", events.A);
    await registerAs("chairA", events.B);
  });

  test("an office bearer of the event's society gets the registrants, envelope unchanged", async () => {
    const res = await listAs("chairA", events.A);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.equal(res.body.success, true);
    assert.deepEqual(Object.keys(res.body).sort(), ["count", "data", "success"]);
    assert.equal(res.body.count, res.body.data.length);
    assert.ok(res.body.count >= 2);
    const stored = await registrationsOf(events.A);
    assert.equal(res.body.count, stored.length);
    const entry = res.body.data.find((e) => e.user && e.user.email === "member.a@integration.test");
    assert.ok(entry, "memberA's registration is missing");
    assert.equal(entry.user.name, "Integration Member A");
    assert.equal(String(entry.event), events.A);
    assert.equal(entry.status, "REGISTERED");
  });

  test("registrants are newest first", async () => {
    const res = await listAs("chairA", events.A);

    const times = res.body.data.map((e) => new Date(e.registeredAt).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  });

  test("the response exposes no credentials", async () => {
    const res = await listAs("chairA", events.A);

    assert.doesNotMatch(res.text, /password|passwordHash|\$2[aby]\$/i);
  });

  test("an administrator can list the registrants of either society's event", async () => {
    const a = await listAs("admin", events.A);
    const b = await listAs("admin", events.B);

    assert.equal(a.status, 200, a.text.slice(0, 200));
    assert.equal(b.status, 200, b.text.slice(0, 200));
    assert.equal(b.body.count, (await registrationsOf(events.B)).length);
  });

  test("society B's office bearer lists society B's event", async () => {
    const res = await listAs("chairB", events.B);

    assert.equal(res.status, 200, res.text.slice(0, 200));
    assert.ok(res.body.data.every((e) => String(e.event) === events.B));
  });
});

describe("list: denied callers get no registrant data", () => {
  const assertNoData = (res) => {
    assert.equal(res.body.data, undefined, "registrant data leaked");
    assert.equal(res.body.count, undefined);
    assert.doesNotMatch(res.text, /@integration\.test/);
  };

  test("an office bearer of another society is 403 (both directions)", async () => {
    const chairBOnA = await listAs("chairB", events.A);
    const chairAOnB = await listAs("chairA", events.B);

    assert.equal(chairBOnA.status, 403);
    assert.equal(chairBOnA.body.message, "Access restricted to your own society");
    assert.equal(chairAOnB.status, 403);
    assertNoData(chairBOnA);
    assertNoData(chairAOnB);
  });

  test("a society named by the client cannot widen access", async () => {
    const res = await session.request("chairB", "GET", `/events/${events.A}/registrations?societyId=${societies.B.id}`);
    const spoofed = await session.request("chairB", "GET", `/events/${events.A}/registrations?societyId=${societies.A.id}`);

    assert.equal(res.status, 403);
    assert.equal(spoofed.status, 403);
    assertNoData(spoofed);
  });

  test("a same-society member without events:edit is 403", async () => {
    const res = await listAs("memberA", events.A);

    assert.equal(res.status, 403);
    assertNoData(res);
  });

  test("a user with no society and no role is 403", async () => {
    const res = await listAs("loner", events.A);

    assert.equal(res.status, 403);
    assertNoData(res);
  });

  test("a user holding events:edit but no User.societyId is 403 (no missing-society fallback)", async () => {
    const own = await asToken(organizer, "GET", `/events/${events.A}/registrations`);
    const other = await asToken(organizer, "GET", `/events/${events.B}/registrations`);

    assert.equal(own.status, 403, own.text.slice(0, 200));
    assert.equal(own.body.message, "Access restricted to your own society");
    assert.equal(other.status, 403);
    assertNoData(own);
  });

  test("anonymous and invalid-token requests are 401", async () => {
    const anonymous = await asToken(null, "GET", `/events/${events.A}/registrations`);
    const badToken = await asToken({ token: "not-a-real-token" }, "GET", `/events/${events.A}/registrations`);

    assert.equal(anonymous.status, 401);
    assert.equal(badToken.status, 401);
    assertNoData(anonymous);
  });

  test("a nonexistent event is 404 and a malformed id is 400 for an authorized caller", async () => {
    const missing = await listAs("chairA", MISSING_EVENT);
    assert.equal(missing.status, 404);
    for (const id of ["not-an-object-id", "abcdefghijkl", `${events.A}0`]) {
      const res = await listAs("chairA", id);

      assert.equal(res.status, 400, id);
      assert.equal(res.body.message, "Invalid ID format.");
    }
  });

  test("an unauthorized caller learns nothing about whether an event exists", async () => {
    const forMissing = await listAs("memberA", MISSING_EVENT);
    const forExisting = await listAs("memberA", events.A);

    assert.equal(forMissing.status, 403);
    assert.deepEqual(forMissing.body, forExisting.body);
  });

  test("denied list requests change no data", async () => {
    const before = await snapshot();

    await listAs("chairB", events.A);
    await listAs("memberA", events.A);
    await listAs("loner", events.A);

    assert.deepEqual(await snapshot(), before);
  });
});
