"use strict";

/**
 * AUD-018 over real HTTP: society routes declared with `:id` must authorize
 * against the society named in the URL, not silently fall back to the
 * caller's own society.
 *
 * Mutations used are reversible and non-destructive (logo / signature URLs);
 * the cross-society member write is only attempted to prove it is denied.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, readDocument, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const { request } = createSession(target);
const { A, B } = target.ready.fixtures.societies;

const DENIED_MESSAGE = "Access restricted to your own society only.";
const society = (id) => readDocument(target, "societies", id);
const url = (label) => `https://integration.test/${label}.png`;

// PATCH /societies/:id now also requires the existing RBAC permission
// settings:edit (see society-patch.integration.test.js). The shared fixtures do
// not define the settings permissions, so the permission record is added here,
// exactly as the production seed defines it. Without it the administrator would
// be refused by the permission check before reaching the id validation that the
// "empty id segment" test below is about ("/societies//logo" is handled as
// "/societies/logo", i.e. PATCH /:id with the id "logo"). No role is granted
// anything beyond what the seed grants.
before(async () => {
  await withDatabase(target, async (db) => {
    await db.collection("permissions").updateOne(
      { key: "settings:edit" },
      {
        $setOnInsert: {
          key: "settings:edit",
          module: "settings",
          action: "edit",
          description: "Allows edit actions in settings module",
        },
      },
      { upsert: true },
    );
  });
});

describe("AUD-018: PATCH /societies/:id/* is authorized against the URL's society", () => {
  test("an office bearer of A cannot change B's logo, and B is unchanged", async () => {
    const before = await society(B.id);

    const res = await request("chairA", "PATCH", `/societies/${B.id}/logo`, {
      body: { logoUrl: url("hijack-b") },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, DENIED_MESSAGE);
    const after = await society(B.id);
    assert.equal(after.logoUrl, before.logoUrl, "B's logo was changed");
    assert.deepEqual(after.updatedAt, before.updatedAt, "B was written to");
  });

  test("an office bearer of A cannot change B's advisor signature", async () => {
    const before = await society(B.id);

    const res = await request("chairA", "PATCH", `/societies/${B.id}/signature`, {
      body: { advisorSignatureUrl: url("sig-hijack") },
    });

    assert.equal(res.status, 403);
    assert.equal((await society(B.id)).advisorSignatureUrl, before.advisorSignatureUrl);
  });

  test("an office bearer of A cannot add a member to B (state unchanged)", async () => {
    const before = await society(B.id);

    const res = await request("chairA", "POST", `/societies/${B.id}/members`, {
      body: {
        ieeeId: "IT-INTRUDER-1",
        name: "Intruder",
        email: "intruder@integration.test",
        grade: "Student",
      },
    });

    assert.equal(res.status, 403);
    const after = await society(B.id);
    assert.equal(after.members.length, before.members.length);
    assert.equal(
      after.members.some((m) => m.ieeeId === "IT-INTRUDER-1"),
      false,
      "the intruder was added to B",
    );
  });

  test("an office bearer of A cannot patch B's profile or replace its office bearers", async () => {
    const before = await society(B.id);

    const profile = await request("chairA", "PATCH", `/societies/${B.id}`, {
      body: { name: "Hijacked Name" },
    });
    const bearers = await request("chairA", "PUT", `/societies/${B.id}/office-bearers`, {
      body: { officeBearers: [] },
    });

    assert.equal(profile.status, 403);
    assert.equal(bearers.status, 403);
    const after = await society(B.id);
    assert.equal(after.name, before.name);
    assert.equal(after.officeBearers.length, before.officeBearers.length);
  });

  test("body or query society ids of the caller do not rescue a foreign :id", async () => {
    const before = await society(B.id);

    const viaBody = await request("chairA", "PATCH", `/societies/${B.id}/logo`, {
      body: { logoUrl: url("spoof-body"), societyId: A.id },
    });
    const viaQuery = await request(
      "chairA",
      "PATCH",
      `/societies/${B.id}/logo?societyId=${A.id}`,
      { body: { logoUrl: url("spoof-query") } },
    );

    assert.equal(viaBody.status, 403);
    assert.equal(viaQuery.status, 403);
    assert.equal((await society(B.id)).logoUrl, before.logoUrl);
  });

  test("the same office bearer can perform the equivalent change on society A", async () => {
    const target1 = url("a-logo");

    const logo = await request("chairA", "PATCH", `/societies/${A.id}/logo`, {
      body: { logoUrl: target1 },
    });
    const signature = await request("chairA", "PATCH", `/societies/${A.id}/signature`, {
      body: { advisorSignatureUrl: url("a-signature") },
    });

    assert.equal(logo.status, 200);
    assert.equal(logo.body.success, true);
    assert.equal(logo.body.data.logoUrl, target1);
    assert.equal(signature.status, 200);
    const stored = await society(A.id);
    assert.equal(stored.logoUrl, target1, "the permitted change was not persisted");
    assert.equal(stored.advisorSignatureUrl, url("a-signature"));
  });

  test("an administrator keeps cross-society capability (and changes persist)", async () => {
    const logo = await request("admin", "PATCH", `/societies/${B.id}/logo`, {
      body: { logoUrl: url("admin-set-b") },
    });

    assert.equal(logo.status, 200);
    assert.equal((await society(B.id)).logoUrl, url("admin-set-b"));
  });

  test("an unauthenticated caller is rejected with 401", async () => {
    const res = await request(null, "PATCH", `/societies/${A.id}/logo`, {
      body: { logoUrl: url("anon") },
    });

    assert.equal(res.status, 401);
  });
});

describe("AUD-018: missing or malformed society identifiers fail safely", () => {
  test("a malformed id is denied (not a 500) for an office bearer", async () => {
    const res = await request("chairA", "PATCH", "/societies/not-an-object-id/logo", {
      body: { logoUrl: url("malformed") },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test("a malformed id gives a clean 400 for an administrator", async () => {
    const res = await request("admin", "PATCH", "/societies/not-an-object-id/logo", {
      body: { logoUrl: url("malformed-admin") },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid ID format.");
  });

  test("a well-formed id of a society that does not exist is denied for an office bearer and 404 for an administrator", async () => {
    const unknown = "64b7f8f2a1b2c3d4e5f6ffff";

    const asChair = await request("chairA", "PATCH", `/societies/${unknown}/logo`, {
      body: { logoUrl: url("unknown") },
    });
    const asAdmin = await request("admin", "PATCH", `/societies/${unknown}/logo`, {
      body: { logoUrl: url("unknown") },
    });

    assert.equal(asChair.status, 403);
    assert.equal(asAdmin.status, 404);
    assert.equal(asAdmin.body.message, "Society not found");
  });

  test("an absent id matches no society route (404) and changes nothing", async () => {
    const beforeA = await society(A.id);
    const beforeB = await society(B.id);

    const res = await request("chairA", "PATCH", "/societies/", {
      body: { name: "no id" },
    });

    assert.equal(res.status, 404);
    assert.equal((await society(A.id)).name, beforeA.name);
    assert.equal((await society(B.id)).name, beforeB.name);
  });

  // Express collapses an empty path segment, so "/societies//logo" is handled
  // as "/societies/logo": the effective :id is "logo". The guard evaluates
  // that real value, so the request is denied (office bearer) or rejected as
  // an invalid id (administrator) and nothing is written.
  test("an empty id segment is evaluated as the next segment, never as the caller's society", async () => {
    const beforeA = await society(A.id);
    const beforeB = await society(B.id);

    const asChair = await request("chairA", "PATCH", "/societies//logo", {
      body: { logoUrl: url("empty-segment") },
    });
    const asAdmin = await request("admin", "PATCH", "/societies//logo", {
      body: { logoUrl: url("empty-segment-admin") },
    });

    assert.equal(asChair.status, 403);
    assert.equal(asAdmin.status, 400);
    assert.equal(asAdmin.body.message, "Invalid ID format.");
    assert.equal((await society(A.id)).logoUrl, beforeA.logoUrl);
    assert.equal((await society(B.id)).logoUrl, beforeB.logoUrl);
  });
});

describe("AUD-018: routes where :id is a resource id are not treated as society routes", () => {
  test("an office bearer can edit their own event whose id is not their society id", async () => {
    const created = await request("chairA", "POST", "/events", {
      body: {
        title: "Integration Workshop",
        date: "2027-01-15",
        time: "10:00",
        venue: "Lab 1",
        eventType: "Workshop",
        participants: 10,
        description: "Disposable event for the :id routing test",
      },
    });
    assert.equal(created.status, 201, `event creation failed: ${created.text.slice(0, 200)}`);
    const eventId = created.body.data.id || created.body.data._id;
    assert.notEqual(eventId, A.id, "event id unexpectedly equals the society id");

    const edited = await request("chairA", "PUT", `/events/${eventId}`, {
      body: { title: "Integration Workshop (edited)" },
    });

    assert.equal(edited.status, 200, "an event :id was treated as a society id");
    assert.equal(edited.body.data.title, "Integration Workshop (edited)");

    // The event-level object check (a different, pre-existing guard) still
    // keeps another society's office bearer out.
    const foreign = await request("chairB", "PUT", `/events/${eventId}`, {
      body: { title: "Not yours" },
    });
    assert.equal(foreign.status, 403);
    const stored = await readDocument(target, "events", eventId);
    assert.equal(stored.title, "Integration Workshop (edited)");
  });
});
