"use strict";

/**
 * AUD-009 over HTTP: message reactions.
 *
 * The only reaction route is POST /api/v1/channels/messages/:messageId/reactions with body
 * { value }. It TOGGLES: the first request by a user for an emoji adds it, the next removes it
 * (there is no DELETE route). The response is the message's full list of reaction records
 * ({ id, messageId, userId: {id, name, email}, value }). The frontend used to call
 * POST /messages/:id/reactions with { emoji } and DELETE for removal, none of which exist.
 *
 * Authorization is the existing contract: community_hub:create, then the message must be in
 * the caller's society scope (channel messages) or the caller must be a participant (direct
 * messages). A unique (message, user, emoji) index makes duplicates impossible.
 *
 * Fixtures: admin (global advisor); chairA and memberA (society A, hub create); chairB
 * (society B); loner (no society, no role). Messages are created through the API.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { users, channels, conversation } = target.ready.fixtures;

const RUN = Date.now();
let channelMessageId;
let dmMessageId;

const react = (key, messageId, body) => session.request(key, "POST", `/channels/messages/${messageId}/reactions`, body === undefined ? {} : { body });
const stored = (messageId) =>
  withDatabase(target, (db, ObjectId) => db.collection("reactions").find({ messageId: new ObjectId(messageId) }).toArray());
const summary = (res) => res.body.data.map((r) => `${r.userId.id}:${r.value}`).sort();

before(async () => {
  const posted = await session.request("chairA", "POST", `/channels/${channels.A.id}/messages`, { body: { body: `reaction target ${RUN}` } });
  assert.equal(posted.status, 201, posted.text.slice(0, 160));
  channelMessageId = posted.body.data.id;

  dmMessageId = await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const inserted = await db.collection("messages").insertOne({
      body: `dm target ${RUN}`, plainText: `dm target ${RUN}`, authorId: new ObjectId(users.chairA.id),
      societyId: new ObjectId(target.ready.fixtures.societies.A.id), conversationId: new ObjectId(conversation.id),
      parentMessageId: null, createdAt: now, updatedAt: now,
    });
    return String(inserted.insertedId);
  });
});

describe("the mounted route toggles a reaction", () => {
  test("an authorized member adds a reaction, and the same request again removes it", async () => {
    const added = await react("memberA", channelMessageId, { value: "👍" });
    const afterAdd = await stored(channelMessageId);

    assert.equal(added.status, 200, added.text.slice(0, 200));
    assert.equal(added.body.success, true);
    assert.deepEqual(summary(added), [`${users.memberA.id}:👍`]);
    assert.equal(afterAdd.length, 1);

    const removed = await react("memberA", channelMessageId, { value: "👍" });

    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.data, []);
    assert.equal((await stored(channelMessageId)).length, 0);
  });

  test("never more than one record per user and emoji, however often it is requested", async () => {
    for (let i = 1; i <= 5; i += 1) {
      const res = await react("memberA", channelMessageId, { value: "🎉" });
      assert.equal(res.status, 200);
      assert.equal((await stored(channelMessageId)).length, i % 2, `after request ${i}`);
    }
    // an odd number of toggles leaves exactly one record; one more removes it, leaving the message clean
    assert.equal((await stored(channelMessageId)).filter((r) => r.value === "🎉").length, 1);
    await react("memberA", channelMessageId, { value: "🎉" });
    assert.equal((await stored(channelMessageId)).length, 0);
  });

  test("different users and different emoji are independent records", async () => {
    await react("memberA", channelMessageId, { value: "🚀" });
    await react("chairA", channelMessageId, { value: "🚀" });
    const res = await react("chairA", channelMessageId, { value: "🔥" });

    assert.deepEqual(summary(res), [`${users.chairA.id}:🔥`, `${users.chairA.id}:🚀`, `${users.memberA.id}:🚀`].sort());
    await react("memberA", channelMessageId, { value: "🚀" });
    await react("chairA", channelMessageId, { value: "🚀" });
    await react("chairA", channelMessageId, { value: "🔥" });
    assert.equal((await stored(channelMessageId)).length, 0);
  });

  test("simultaneous identical requests never produce a duplicate record (the unique index holds)", async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => react("memberA", channelMessageId, { value: "👀" })));

    for (const res of responses) assert.ok([200, 400].includes(res.status), `unexpected ${res.status}: ${res.text.slice(0, 120)}`);
    const rows = (await stored(channelMessageId)).filter((r) => r.value === "👀");
    assert.ok(rows.length <= 1, `${rows.length} records for one user and emoji`);
    if (rows.length === 1) await react("memberA", channelMessageId, { value: "👀" });
    assert.equal((await stored(channelMessageId)).length, 0);
  });
});

describe("only the mounted route exists", () => {
  test("the path the frontend used before, and a DELETE on the real path, are not routes", async () => {
    const wrongPath = await session.request("memberA", "POST", `/messages/${channelMessageId}/reactions`, { body: { emoji: "👍", value: "👍" } });
    const deleted = await session.request("memberA", "DELETE", `/channels/messages/${channelMessageId}/reactions`, { body: { value: "👍" } });

    assert.equal(wrongPath.status, 404);
    assert.equal(deleted.status, 404);
    assert.equal((await stored(channelMessageId)).length, 0);
  });

  test("the body must carry `value`; the old `emoji` key alone is a 400 and creates nothing", async () => {
    const emojiKey = await react("memberA", channelMessageId, { emoji: "👍" });
    const empty = await react("memberA", channelMessageId, {});
    const blank = await react("memberA", channelMessageId, { value: "" });

    for (const res of [emojiKey, empty, blank]) assert.equal(res.status, 400, res.text.slice(0, 120));
    assert.equal((await stored(channelMessageId)).length, 0);
  });
});

describe("authorization", () => {
  test("anonymous requests are rejected", async () => {
    assert.equal((await react(null, channelMessageId, { value: "👍" })).status, 401);
    assert.equal((await stored(channelMessageId)).length, 0);
  });

  test("a user without the community_hub permission is denied, whatever the message", async () => {
    const res = await react("loner", channelMessageId, { value: "👍" });

    assert.equal(res.status, 403);
    assert.equal((await stored(channelMessageId)).length, 0);
  });

  test("a channel message of another society cannot be reacted to, and nothing is written", async () => {
    const res = await react("chairB", channelMessageId, { value: "👍" });

    assert.equal(res.status, 403, res.text.slice(0, 160));
    assert.equal((await stored(channelMessageId)).length, 0);
  });

  test("a direct message can be reacted to by its participants only", async () => {
    const outsider = await react("chairB", dmMessageId, { value: "👍" });
    const participant = await react("memberA", dmMessageId, { value: "👍" });

    assert.equal(outsider.status, 403);
    assert.equal(participant.status, 200, participant.text.slice(0, 160));
    assert.deepEqual(summary(participant), [`${users.memberA.id}:👍`]);
    await react("memberA", dmMessageId, { value: "👍" });
    assert.equal((await stored(dmMessageId)).length, 0);
  });

  test("an unknown or malformed message id is a 404/400, not a server error", async () => {
    const unknown = await react("memberA", "64b7f8f2a1b2c3d4e5f6ffff", { value: "👍" });
    const malformed = await react("memberA", "not-an-id", { value: "👍" });

    assert.equal(unknown.status, 404);
    assert.equal(malformed.status, 400);
  });
});
