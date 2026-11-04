"use strict";

/**
 * AUD-009 over HTTP: what the Community page may rely on for a NON-administrator.
 *
 * The page used to load its channels, conversations and the whole user directory in one
 * Promise.all; GET /users is administrator-only, so for everyone else the whole load failed and
 * no channel appeared. The page now needs only GET /channels and GET /conversations. This file
 * pins those two contracts, and that the user directory stays protected:
 *   - a non-admin with community_hub:view lists exactly the channels of their own society;
 *   - another society's channel cannot be listed, filtered into, or read by id;
 *   - a caller without the permission is denied (the existing policy);
 *   - administrators keep listing any society's channels and keep GET /users;
 *   - GET /conversations needs no administrator role.
 *
 * Fixtures: admin (global advisor); chairA and memberA (society A); chairB (society B); loner
 * (no society, no role).
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { channels, societies } = target.ready.fixtures;

const get = (key, route) => session.request(key, "GET", route);
const idsOf = (res) => res.body.data.map((c) => String(c.id)).sort();
const societyOf = (c) => String(c.societyId && (c.societyId.id || c.societyId._id || c.societyId));

describe("GET /channels for a non-administrator", () => {
  test("lists exactly the channels of the user's own society", async () => {
    for (const [key, own, other] of [["memberA", channels.A.id, channels.B.id], ["chairA", channels.A.id, channels.B.id], ["chairB", channels.B.id, channels.A.id]]) {
      const res = await get(key, "/channels");

      assert.equal(res.status, 200, `${key}: ${res.text.slice(0, 160)}`);
      assert.deepEqual(idsOf(res), [own], key);
      assert.equal(res.text.includes(other), false, `${key} saw another society's channel`);
    }
  });

  test("every channel returned belongs to the user's society", async () => {
    const res = await get("memberA", "/channels");

    for (const channel of res.body.data) assert.equal(societyOf(channel), societies.A.id);
  });

  test("another society cannot be listed or read: filter by society and fetch by id are refused", async () => {
    const filtered = await get("memberA", `/channels?societyId=${societies.B.id}`);
    const byId = await get("memberA", `/channels/${channels.B.id}`);
    const messages = await get("memberA", `/channels/${channels.B.id}/messages`);

    assert.equal(filtered.status, 403);
    assert.equal(byId.status, 403);
    assert.equal(messages.status, 403);
    for (const res of [filtered, byId, messages]) assert.equal(res.text.includes(channels.B.id) && res.status === 200, false);
  });

  test("a user without the community_hub permission is denied (existing policy)", async () => {
    const res = await get("loner", "/channels");

    assert.equal(res.status, 403);
  });

  test("anonymous requests are rejected", async () => {
    assert.equal((await get(null, "/channels")).status, 401);
    assert.equal((await get(null, "/conversations")).status, 401);
  });
});

describe("the other request Community makes", () => {
  test("GET /conversations works for a non-administrator and returns only their own conversations", async () => {
    const own = await get("memberA", "/conversations");
    const other = await get("chairB", "/conversations");

    assert.equal(own.status, 200, own.text.slice(0, 160));
    assert.ok(Array.isArray(own.body.data));
    assert.ok(own.body.data.length >= 1, "the fixture conversation is the member's");
    assert.deepEqual(other.body.data, [], "another society's user sees none of them");
  });
});

describe("administrators and the protected user directory", () => {
  test("an administrator still lists any society's channels (the default list is one society, as before)", async () => {
    const inA = await get("admin", `/channels?societyId=${societies.A.id}`);
    const inB = await get("admin", `/channels?societyId=${societies.B.id}`);
    const byDefault = await get("admin", "/channels");

    assert.deepEqual(idsOf(inA), [channels.A.id]);
    assert.deepEqual(idsOf(inB), [channels.B.id]);
    assert.equal(byDefault.status, 200);
    assert.equal(byDefault.body.data.length, 1, "the default list is a single society's channels (AUD-029)");
  });

  test("GET /users stays administrator-only: ordinary accounts are refused, the administrator is served", async () => {
    for (const key of ["memberA", "chairA", "chairB", "loner"]) {
      const res = await get(key, "/users");

      assert.equal(res.status, 403, key);
      assert.equal(res.text.includes("@integration.test"), false, `${key} received user data`);
    }
    const admin = await get("admin", "/users");
    assert.equal(admin.status, 200);
    assert.ok(admin.body.data.length >= 4);
    assert.equal((await get(null, "/users")).status, 401);
  });
});
