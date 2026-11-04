"use strict";

/**
 * AUD-021 over real HTTP: PATCH and DELETE on /project-reports/:id (also
 * mounted at /reports/:id) must be limited to the report's own society, with
 * administrators unrestricted.
 *
 * Destructive cases use disposable reports created through the API; fixture
 * reports of the other society are only the target of denied requests and are
 * verified unchanged in the database afterwards.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  requireHarnessTarget,
  readDocument,
  countDocuments,
} = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const { request } = createSession(target);
const { reports } = target.ready.fixtures;

const DENIED_MESSAGE = "Access restricted to your own society";
const report = (id) => readDocument(target, "projectreports", id);

async function createReport(userKey, title) {
  const res = await request(userKey, "POST", "/project-reports", {
    body: { title, description: "Disposable report", type: "general" },
  });
  assert.equal(res.status, 201, `report creation failed: ${res.text.slice(0, 200)}`);
  return res.body.data._id || res.body.data.id;
}

describe("AUD-021: office bearer of A against society B's report", () => {
  test("PATCH is denied and the stored report is unchanged", async () => {
    const before = await report(reports.B.id);

    const res = await request("chairA", "PATCH", `/project-reports/${reports.B.id}`, {
      body: { title: "Hijacked title", status: "APPROVED" },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, DENIED_MESSAGE);
    const after = await report(reports.B.id);
    assert.equal(after.title, before.title, "title was changed");
    assert.equal(after.status, before.status, "status was changed");
    assert.deepEqual(after.updatedAt, before.updatedAt, "the report was written to");
  });

  test("DELETE is denied and the report still exists", async () => {
    const res = await request("chairA", "DELETE", `/project-reports/${reports.B.id}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.message, DENIED_MESSAGE);
    assert.notEqual(await report(reports.B.id), null, "B's report was deleted");
  });

  test("the /reports alias of the same router is guarded identically", async () => {
    const before = await report(reports.B.id);

    const patch = await request("chairA", "PATCH", `/reports/${reports.B.id}`, {
      body: { title: "Hijack via alias" },
    });
    const del = await request("chairA", "DELETE", `/reports/${reports.B.id}`);

    assert.equal(patch.status, 403);
    assert.equal(del.status, 403);
    const after = await report(reports.B.id);
    assert.notEqual(after, null);
    assert.equal(after.title, before.title);
  });

  test("an unauthenticated caller is rejected with 401", async () => {
    const patch = await request(null, "PATCH", `/project-reports/${reports.B.id}`, {
      body: { title: "anon" },
    });
    const del = await request(null, "DELETE", `/project-reports/${reports.B.id}`);

    assert.equal(patch.status, 401);
    assert.equal(del.status, 401);
  });
});

describe("AUD-021: office bearer of A against A's own reports", () => {
  test("PATCH succeeds and persists", async () => {
    const res = await request("chairA", "PATCH", `/project-reports/${reports.A.id}`, {
      body: { title: "Updated by A", description: "Edited in scope" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.title, "Updated by A");
    const stored = await report(reports.A.id);
    assert.equal(stored.title, "Updated by A");
    assert.equal(stored.description, "Edited in scope");
  });

  test("DELETE succeeds on a disposable report of A and removes it", async () => {
    const id = await createReport("chairA", "Disposable report A (delete)");
    assert.notEqual(await report(id), null);

    const res = await request("chairA", "DELETE", `/project-reports/${id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Report deleted successfully");
    assert.equal(await report(id), null, "the report still exists");
  });
});

describe("AUD-021: administrator", () => {
  test("PATCH and DELETE another society's disposable report", async () => {
    const id = await createReport("chairB", "Disposable report B (admin)");

    const patch = await request("admin", "PATCH", `/project-reports/${id}`, {
      body: { title: "Edited by admin" },
    });
    assert.equal(patch.status, 200);
    assert.equal((await report(id)).title, "Edited by admin");

    const del = await request("admin", "DELETE", `/project-reports/${id}`);
    assert.equal(del.status, 200);
    assert.equal(await report(id), null);
  });
});

describe("AUD-021: missing and malformed report identifiers", () => {
  test("an unknown report id returns 404 and nothing is created or removed", async () => {
    const unknown = "64b7f8f2a1b2c3d4e5f6ffff";
    const before = await countDocuments(target, "projectreports");

    const patch = await request("chairA", "PATCH", `/project-reports/${unknown}`, {
      body: { title: "ghost" },
    });
    const del = await request("chairA", "DELETE", `/project-reports/${unknown}`);

    assert.equal(patch.status, 404);
    assert.equal(patch.body.message, "Report not found");
    assert.equal(del.status, 404);
    assert.equal(del.body.message, "Report not found");
    assert.equal(await countDocuments(target, "projectreports"), before);
  });

  test("a malformed id is a clean 400 (not a 500) and changes nothing", async () => {
    const before = await countDocuments(target, "projectreports");

    const patch = await request("chairA", "PATCH", "/project-reports/not-an-object-id", {
      body: { title: "bad id" },
    });
    const del = await request("chairA", "DELETE", "/project-reports/not-an-object-id");

    assert.equal(patch.status, 400);
    assert.equal(patch.body.message, "Invalid ID format.");
    assert.equal(del.status, 400);
    assert.equal(await countDocuments(target, "projectreports"), before);
  });
});
