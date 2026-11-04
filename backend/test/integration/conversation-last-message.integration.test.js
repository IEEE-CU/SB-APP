"use strict";

/**
 * NEW-22 over HTTP: GET /conversations returns `lastMessage` ({ content, createdAt, ... }) for the
 * sidebar preview. `content` is plain text (never HTML), a conversation with no messages has no
 * lastMessage, and the caller only ever sees conversations (and so messages) they take part in.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");

const target = requireHarnessTarget();
const session = createSession(target);
const { users, societies, conversation: fixtureConversation } = target.ready.fixtures;
const A = societies.A.id;
const B = societies.B.id;

const RUN = Date.now();
const TAG = {
  older: `OLDER-${RUN}`,
  latest: `LATEST-${RUN}`,
  secretB: `SECRET-B-${RUN}`,
  reply: `REPLY-${RUN}`,
};
let emptyConversationId;
let otherConversationId;

const list = (key, query = "") => session.request(key, "GET", `/conversations${query}`);
const byId = (res, id) => res.body.data.find((c) => String(c.id) === String(id));

before(async () => {
  await withDatabase(target, async (db, ObjectId) => {
    const oid = (id) => new ObjectId(id);
    const base = Date.now() + 3600 * 1000; // later than anything the harness seeded
    const message = (conversationId, societyId, authorId, body, plainText, offset, extra = {}) =>
      db.collection("messages").insertOne({
        body, plainText, authorId: oid(authorId), societyId: oid(societyId), conversationId,
        parentMessageId: null, createdAt: new Date(base + offset), updatedAt: new Date(base + offset), ...extra,
      });

    const fixtureId = oid(fixtureConversation.id);
    await message(fixtureId, A, users.chairA.id, TAG.older, TAG.older, 0);
    const parent = await message(
      fixtureId, A, users.memberA.id,
      `<p>Hello <b>${TAG.latest}</b><img src=x onerror=alert(1)><script>alert(2)</script></p>`,
      `<p>Hello <b>${TAG.latest}</b><img src=x onerror=alert(1)><script>alert(2)</script></p>`, 1000,
    );
    // A thread reply is newer still but is not a top-level message (GET /:id/messages omits it).
    await message(fixtureId, A, users.chairA.id, TAG.reply, TAG.reply, 2000, { parentMessageId: parent.insertedId });

    const now = new Date();
    const empty = await db.collection("conversations").insertOne({
      societyId: oid(A), userOneId: oid(users.chairA.id), userTwoId: oid(users.loner.id), createdAt: now, updatedAt: now,
    });
    emptyConversationId = String(empty.insertedId);

    const other = await db.collection("conversations").insertOne({
      societyId: oid(B), userOneId: oid(users.chairB.id), userTwoId: oid(users.admin.id), createdAt: now, updatedAt: now,
    });
    otherConversationId = String(other.insertedId);
    await message(other.insertedId, B, users.chairB.id, TAG.secretB, TAG.secretB, 0);
  });
});

describe("lastMessage on the conversation list", () => {
  test("a participant gets the newest top-level message as plain text, in the frontend Message shape", async () => {
    const res = await list("memberA");

    assert.equal(res.status, 200, res.text.slice(0, 200));
    const conv = byId(res, fixtureConversation.id);
    assert.ok(conv, "fixture conversation missing");
    assert.ok(conv.lastMessage, "lastMessage missing");
    assert.ok(conv.lastMessage.content.includes(TAG.latest), conv.lastMessage.content);
    assert.equal(typeof conv.lastMessage.createdAt, "string");
    assert.ok(!Number.isNaN(Date.parse(conv.lastMessage.createdAt)));
    assert.equal(conv.lastMessage.sender.id, users.memberA.id);
    assert.equal(conv.lastMessage.conversationId, String(fixtureConversation.id));
    assert.ok(!res.text.includes(TAG.reply), "a thread reply was used as the preview");
    assert.ok(!res.text.includes(TAG.older));
  });

  test("content is plain text: no tags, scripts or event handlers", async () => {
    const conv = byId(await list("memberA"), fixtureConversation.id);

    assert.equal(/[<>]/.test(conv.lastMessage.content), false, conv.lastMessage.content);
    assert.ok(conv.lastMessage.content.startsWith(`Hello ${TAG.latest}`), conv.lastMessage.content);
  });

  test("existing fields and populated participants are unchanged", async () => {
    const conv = byId(await list("memberA"), fixtureConversation.id);

    for (const key of ["id", "societyId", "userOneId", "userTwoId", "createdAt", "updatedAt"]) assert.ok(key in conv, key);
    assert.equal(typeof conv.userOneId, "object");
    assert.ok(conv.userOneId.name);
    assert.equal("__v" in conv, false);
  });

  test("a conversation with no messages has no lastMessage and is still listed", async () => {
    const conv = byId(await list("chairA"), emptyConversationId);

    assert.ok(conv, "empty conversation not listed");
    assert.equal("lastMessage" in conv, false);
  });
});

describe("no leaks across conversations", () => {
  test("another society's conversation and its message never appear for a non-participant", async () => {
    const plain = await list("memberA");
    const forced = await list("memberA", `?societyId=${B}`);

    for (const res of [plain, forced]) {
      assert.equal(res.status, 200);
      assert.equal(res.text.includes(TAG.secretB), false);
      assert.equal(byId(res, otherConversationId), undefined);
    }
  });

  test("a same-society non-participant does not see a conversation or its message", async () => {
    const res = await list("memberA");

    assert.equal(byId(res, emptyConversationId), undefined);
  });

  test("the real participant of that other conversation does get its preview", async () => {
    const res = await list("chairB");
    const conv = byId(res, otherConversationId);

    assert.ok(conv);
    assert.equal(conv.lastMessage.content, TAG.secretB);
  });

  test("anonymous requests are still rejected", async () => {
    assert.equal((await list(null)).status, 401);
  });
});
