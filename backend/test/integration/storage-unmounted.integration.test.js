"use strict";

/**
 * AUD-001 over real HTTP: the storage router is not mounted, so the
 * application answers every /api/v1/storage/* request with its generic 404.
 *
 * Only the application's own HTTP routes are exercised here. Nothing is
 * uploaded, downloaded, listed or deleted, no storage service is contacted,
 * and no claim is made about direct blob URLs.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, countDocuments } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const { request } = createSession(target);

const CALLERS = [
  { label: "anonymous", userKey: null },
  { label: "office bearer", userKey: "chairA" },
  { label: "administrator", userKey: "admin" },
];

const uploadBody = () => {
  const form = new FormData();
  form.append("file", new Blob(["integration test content"], { type: "text/plain" }), "probe.txt");
  return form;
};

const ROUTES = [
  { name: "GET /storage/files", method: "GET", path: "/api/v1/storage/files" },
  { name: "POST /storage/upload", method: "POST", path: "/api/v1/storage/upload", upload: true },
  {
    name: "GET /storage/download/:blobName",
    method: "GET",
    path: "/api/v1/storage/download/stored-1700000000000-probe.txt",
  },
  {
    name: "DELETE /storage/:blobName",
    method: "DELETE",
    path: "/api/v1/storage/stored-1700000000000-probe.txt",
  },
];

for (const caller of CALLERS) {
  describe(`storage API is unavailable to an ${caller.label} caller`.replace("an anonymous", "an anonymous"), () => {
    for (const route of ROUTES) {
      test(`${route.name} returns the application's 404`, async () => {
        const res = await request(caller.userKey, route.method, route.path, {
          ...(route.upload ? { raw: uploadBody() } : {}),
        });

        assert.equal(res.status, 404, `${route.name} returned ${res.status}`);
        assert.equal(res.body.success, false);
        assert.equal(res.body.message, `Route ${route.path} not found`);
        // No handler ran: nothing about files or blobs in the response.
        assert.equal(/blob|container|azure|stored-/i.test(res.body.message.replace(route.path, "")), false);
      });
    }
  });
}

describe("storage containment side effects", () => {
  test("no file metadata was created by the attempted upload", async () => {
    assert.equal(await countDocuments(target, "files"), 0);
  });

  test("an unauthenticated request does not reach any storage handler (not 401/500)", async () => {
    const res = await request(null, "GET", "/api/v1/storage/files");

    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 500);
    assert.equal(res.status, 404);
  });

  test("the standalone test-server mount path /api/storage is not served either", async () => {
    const res = await request("admin", "GET", "/api/storage/files");

    assert.equal(res.status, 404);
  });

  test("control: other routes are still mounted and the app is healthy", async () => {
    const health = await request(null, "GET", "/health");
    const me = await request("chairA", "GET", "/auth/me");

    assert.equal(health.status, 200);
    assert.equal(me.status, 200);
  });
});
