// Unit tests for src/lib/messageContract.ts (AUD-008: the server's message payload -> the UI's Message).
//
// The `serverMessage` fixture is the payload captured from the isolated backend for a real
// `message:new` event (field names and nesting as sent), not an invented shape.
//
// Run with Node's built-in runner, no extra dependency:
//   node --test tests/unit/message-contract.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import { groupReactions, normalizeMessage, normalizeMessages } from "../../src/lib/messageContract.ts";

const serverMessage = (extra = {}) => ({
  poll: { question: null, options: [] },
  body: "Hello <b>team</b>",
  plainText: "Hello team",
  imageUrl: null,
  authorId: { email: "admin@integration.test", name: "Integration Admin", id: "6ad91c5a177aaddd9b1e4a08" },
  societyId: "6ad91c59177aaddd9b1e4979",
  channelId: "6ad91c5d177aaddd9b1e4a29",
  conversationId: null,
  parentMessageId: null,
  replyCount: 0,
  lastReplyTime: null,
  lastReplyAuthorId: null,
  createdAt: "2026-10-21T20:11:28.950Z",
  updatedAt: "2026-10-21T20:11:28.950Z",
  id: "6ad91c70177aaddd9b1e4a99",
  reactions: [],
  ...extra,
});

test("the real server payload becomes a UI message: sender, content, ids and times", () => {
  const message = normalizeMessage(serverMessage());

  assert.equal(message.id, "6ad91c70177aaddd9b1e4a99");
  assert.deepEqual(message.sender, { id: "6ad91c5a177aaddd9b1e4a08", name: "Integration Admin" });
  assert.equal(message.content, "Hello <b>team</b>");
  assert.equal(message.channelId, "6ad91c5d177aaddd9b1e4a29");
  assert.equal(message.conversationId, undefined);
  assert.equal(message.parentId, undefined);
  assert.equal(message.createdAt, "2026-10-21T20:11:28.950Z");
  assert.deepEqual(message.reactions, []);
});

test("the author's e-mail is not carried into the sender the UI renders", () => {
  assert.deepEqual(Object.keys(normalizeMessage(serverMessage()).sender).sort(), ["id", "name"]);
});

test("a reply keeps its parent, a conversation message keeps its conversation", () => {
  const reply = normalizeMessage(serverMessage({ parentMessageId: "6ad91c70177aaddd9b1e4aaa" }));
  const dm = normalizeMessage(serverMessage({ channelId: null, conversationId: "6ad91c70177aaddd9b1e4bbb" }));

  assert.equal(reply.parentId, "6ad91c70177aaddd9b1e4aaa");
  assert.equal(dm.channelId, undefined);
  assert.equal(dm.conversationId, "6ad91c70177aaddd9b1e4bbb");
});

test("fields the UI reads beyond the mapped ones (poll) are passed through unchanged", () => {
  const poll = { question: "Lunch?", options: [{ text: "Yes", votes: ["u1"] }] };

  assert.deepEqual(normalizeMessage(serverMessage({ poll })).poll, poll);
});

test("a deleted author (null authorId) is shown as 'Unknown member' with an empty id, not dropped and not a crash", () => {
  const message = normalizeMessage(serverMessage({ authorId: null }));

  assert.deepEqual(message.sender, { id: "", name: "Unknown member" });
  assert.notEqual(message.sender.id, "any-signed-in-user-id");
});

test("payloads that do not match the contract are rejected, never half-converted", () => {
  const rejected = [
    null,
    undefined,
    "text",
    5,
    [],
    {},
    serverMessage({ id: undefined }),
    serverMessage({ id: 7 }),
    serverMessage({ body: undefined }),
    serverMessage({ body: 5 }),
    serverMessage({ createdAt: undefined }),
    serverMessage({ updatedAt: null }),
    serverMessage({ authorId: undefined }),
    serverMessage({ authorId: "6ad91c5a177aaddd9b1e4a08" }), // an unpopulated id is not the contract
    serverMessage({ authorId: { name: "No id" } }),
    serverMessage({ authorId: { id: "x" } }),
    serverMessage({ authorId: [] }),
    // the UI's own shape is not accepted as server input either
    { id: "m1", sender: { id: "u1", name: "A" }, content: "hi", createdAt: "t", updatedAt: "t", reactions: [] },
  ];
  for (const value of rejected) assert.equal(normalizeMessage(value), null, JSON.stringify(value));
});

test("an empty message body is valid; a list drops only the malformed entries", () => {
  assert.equal(normalizeMessage(serverMessage({ body: "" })).content, "");
  const list = normalizeMessages([serverMessage(), { nope: true }, serverMessage({ id: "second" }), null]);

  assert.deepEqual(list.map((m) => m.id), ["6ad91c70177aaddd9b1e4a99", "second"]);
  assert.deepEqual(normalizeMessages(undefined), []);
  assert.deepEqual(normalizeMessages({ data: [] }), []);
});

test("per-user reaction records are grouped by emoji, once per user", () => {
  const records = [
    { id: "r1", messageId: "m", userId: { id: "u1", name: "A", email: "a@x" }, value: "👍" },
    { id: "r2", messageId: "m", userId: { id: "u2", name: "B", email: "b@x" }, value: "👍" },
    { id: "r3", messageId: "m", userId: { id: "u1", name: "A", email: "a@x" }, value: "🎉" },
    { id: "r4", messageId: "m", userId: { id: "u1", name: "A", email: "a@x" }, value: "👍" }, // duplicate record
    { id: "r5", messageId: "m", userId: "u3", value: "🎉" }, // unpopulated user id
  ];

  assert.deepEqual(groupReactions(records), [
    { emoji: "👍", users: ["u1", "u2"] },
    { emoji: "🎉", users: ["u1", "u3"] },
  ]);
});

test("malformed reaction entries are skipped and a non-list gives no reactions", () => {
  assert.deepEqual(groupReactions([null, 5, {}, { value: "👍" }, { userId: "u1" }, { value: 3, userId: "u1" }, { value: "👍", userId: {} }]), []);
  for (const value of [undefined, null, "x", {}, 5]) assert.deepEqual(groupReactions(value), []);
});

test("a message carrying server reaction records renders with grouped reactions", () => {
  const message = normalizeMessage(serverMessage({ reactions: [{ value: "👍", userId: { id: "u1", name: "A" } }] }));

  assert.deepEqual(message.reactions, [{ emoji: "👍", users: ["u1"] }]);
});
