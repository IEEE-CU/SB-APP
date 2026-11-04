"use strict";

/**
 * SEC-CLOSE-01 over HTTP: GET /calendar/unified, public registration, POST /conversations.
 *
 * Reproduced before the fix (same fixtures):
 *   - /calendar/unified returned EVERY message that carries a calendarEvent (direct messages
 *     and channel messages of any society, with the author's e-mail address) and every board
 *     card to any signed-in user, including a freshly self-registered account;
 *   - POST /conversations accepted nonexistent recipients and societies, a recipient from
 *     another society, conversations with oneself and any society id from the caller.
 *
 * Now: a direct message appears only for its two participants; a channel message or board
 * card only for a caller who holds community_hub:view AND whose society scope contains the
 * channel's society; author e-mails are never returned; conversations are validated, scoped
 * to the caller's society (administrators excepted) and always owned by the caller.
 *
 * Fixtures: admin (global advisor), chairA/memberA (society A), chairB (society B), loner
 * (no society, no role). Everything is synthetic and lives in the disposable harness DB.
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
  dmA: `DM-AM-${RUN}`,
  dmB: `DM-BADMIN-${RUN}`,
  chA: `CHANNEL-A-${RUN}`,
  chB: `CHANNEL-B-${RUN}`,
  cardA: `CARD-A-${RUN}`,
  cardB: `CARD-B-${RUN}`,
};
const RANGE = "start=2026-06-01&end=2026-06-30";
const EMAIL_PATTERN = /@integration\.test|@example\.test/;
let stranger; // { token, id }

async function raw(method, route, token, body) {
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text };
}
const as = (key, method, route, body) => session.request(key, method, route, body === undefined ? {} : { body });
const asStranger = (method, route, body) => raw(method, route, stranger.token, body);

const seen = (res) => Object.values(TAG).filter((tag) => res.text.includes(tag)).sort();
const leaksAny = (...responses) => responses.some((res) => Object.values(TAG).some((tag) => res.text.includes(tag)));
const conversationCount = () => withDatabase(target, (db) => db.collection("conversations").countDocuments({}));

before(async () => {
  // Public registration is closed (SEC-CLOSE-02); a society-less, role-less account is
  // what an administrator-created account looks like before it is assigned anything.
  const registered = await target.registerAccount({
    name: "Synthetic Stranger",
    email: `stranger-${RUN}@example.test`,
    password: "a-very-long-synthetic-password-1",
  });
  const registeredBody = await registered.json();
  assert.equal(registered.status, 201, JSON.stringify(registeredBody).slice(0, 160));
  stranger = { token: registeredBody.data.token, id: registeredBody.data.user.id };

  await withDatabase(target, async (db, ObjectId) => {
    const now = new Date();
    const oid = (id) => new ObjectId(id);
    const day = new Date("2026-06-15T10:00:00Z");
    const channelA = await db.collection("channels").findOne({ societyId: oid(A) });
    const channelB = await db.collection("channels").findOne({ societyId: oid(B) });

    // The harness already holds the chairA-memberA conversation (unique per pair): reuse it.
    const dm = async (societyId, one, two, tag, existingId) => {
      const conversationId = existingId
        ? oid(existingId)
        : (await db.collection("conversations").insertOne({
            societyId: oid(societyId), userOneId: oid(one), userTwoId: oid(two), createdAt: now, updatedAt: now,
          })).insertedId;
      await db.collection("messages").insertOne({
        body: tag, plainText: tag, authorId: oid(one), societyId: oid(societyId), conversationId,
        parentMessageId: null, calendarEvent: { date: day, time: "10:00" }, createdAt: now, updatedAt: now,
      });
    };
    await dm(A, users.chairA.id, users.memberA.id, TAG.dmA, fixtureConversation.id);
    await dm(B, users.chairB.id, users.admin.id, TAG.dmB);

    const channelMessage = (channel, authorId, tag) =>
      db.collection("messages").insertOne({
        body: tag, plainText: tag, authorId: oid(authorId), societyId: channel.societyId, channelId: channel._id,
        parentMessageId: null, calendarEvent: { date: day, time: "11:00" }, createdAt: now, updatedAt: now,
      });
    await channelMessage(channelA, users.chairA.id, TAG.chA);
    await channelMessage(channelB, users.chairB.id, TAG.chB);

    const card = (channel, title, assignee) =>
      db.collection("boardcards").insertOne({
        title, channelId: channel._id, status: "TODO", priority: "LOW", order: 0, dueDate: day,
        assignees: [oid(assignee)], createdBy: oid(assignee), createdAt: now, updatedAt: now,
      });
    await card(channelA, TAG.cardA, users.memberA.id);
    await card(channelB, TAG.cardB, users.chairB.id);

    // The unique (society, userOne, userTwo) index is what makes concurrent creates safe;
    // wait for that condition (no fixed sleep).
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const indexes = await db.collection("conversations").indexes();
      if (indexes.some((index) => index.unique && index.key.userOneId === 1 && index.key.userTwoId === 1)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });
});

describe("GET /calendar/unified", () => {
  const EXPECTED = {
    chairA: [TAG.dmA, TAG.chA, TAG.cardA],
    memberA: [TAG.dmA, TAG.chA, TAG.cardA],
    chairB: [TAG.dmB, TAG.chB, TAG.cardB],
    // The advisor reads every channel and board, but is NOT a participant of society A's direct message.
    admin: [TAG.dmB, TAG.chA, TAG.chB, TAG.cardA, TAG.cardB],
    loner: [],
  };
  for (const [key, expected] of Object.entries(EXPECTED)) {
    test(`${key} sees exactly their permitted records, and no e-mail address`, async () => {
      const res = await as(key, "GET", `/calendar/unified?${RANGE}`);

      assert.equal(res.status, 200, res.text.slice(0, 160));
      assert.deepEqual(seen(res), [...expected].sort());
      assert.equal(EMAIL_PATTERN.test(res.text), false, "an e-mail address was returned");
      assert.equal(res.body.count, res.body.data.length);
    });
  }

  test("a self-registered account sees none of it", async () => {
    const res = await asStranger("GET", `/calendar/unified?${RANGE}`);

    assert.equal(res.status, 200);
    assert.deepEqual(seen(res), []);
    assert.equal(EMAIL_PATTERN.test(res.text), false);
  });

  test("anonymous requests are rejected", async () => {
    assert.equal((await raw("GET", `/calendar/unified?${RANGE}`)).status, 401);
  });

  test("a societyId filter cannot reach another society's records", async () => {
    const res = await as("chairA", "GET", `/calendar/unified?${RANGE}&societyId=${B}`);

    assert.equal(res.status, 200);
    assert.deepEqual(seen(res), []);
  });

  test("a malformed societyId is a 400 and leaks nothing; missing dates are still a 400", async () => {
    const bad = await as("chairA", "GET", `/calendar/unified?${RANGE}&societyId=not-an-id`);
    const missing = await as("chairA", "GET", "/calendar/unified");

    assert.equal(bad.status, 400);
    assert.deepEqual(seen(bad), []);
    assert.equal(missing.status, 400);
  });

  test("the author is returned by name only", async () => {
    const res = await as("chairA", "GET", `/calendar/unified?${RANGE}`);
    const message = res.body.data.find((item) => item.title === TAG.chA);

    assert.ok(message, "own-society channel message missing");
    assert.equal(typeof message.author.name, "string");
    assert.equal("email" in message.author, false);
  });
});

describe("POST /conversations", () => {
  const post = (key, body) => as(key, "POST", "/conversations", body);
  const idOf = (res) => res.body.data.id || res.body.data._id;
  const participants = (res) => [res.body.data.userOneId, res.body.data.userTwoId].map((u) => String(u.id || u._id)).sort();

  test("a legitimate direct message is created for the caller and the recipient, in either direction, once", async () => {
    const forward = await post("memberA", { recipientId: users.chairA.id });
    const reverse = await post("chairA", { recipientId: users.memberA.id });
    const alias = await post("memberA", { participantIds: [users.chairA.id] }); // what the web client sends

    for (const res of [forward, reverse, alias]) assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(idOf(forward), fixtureConversation.id);
    assert.equal(idOf(reverse), idOf(forward));
    assert.equal(idOf(alias), idOf(forward));
    assert.deepEqual(participants(forward), [users.chairA.id, users.memberA.id].sort());
    assert.equal(String(forward.body.data.societyId), A);
  });

  test("the caller's identity comes from the token: forged participant fields are ignored", async () => {
    const res = await post("memberA", { recipientId: users.chairA.id, userOneId: users.chairB.id, userTwoId: users.admin.id, societyId: A });

    assert.equal(res.status, 201);
    assert.deepEqual(participants(res), [users.chairA.id, users.memberA.id].sort());
  });

  test("an administrator may be messaged by anyone, and may open a conversation in any society", async () => {
    const toAdmin = await post("memberA", { recipientId: users.admin.id });
    const adminInB = await post("admin", { recipientId: users.chairB.id, societyId: B });

    assert.equal(toAdmin.status, 201, toAdmin.text.slice(0, 200));
    assert.equal(adminInB.status, 201, adminInB.text.slice(0, 200));
  });

  test("invalid, missing and self requests are 400 and write nothing", async () => {
    const before = await conversationCount();
    const cases = [
      {},
      { recipientId: "" },
      { recipientId: "not-an-id" },
      { recipientId: { $ne: null } },
      { recipientId: 5 },
      { recipientId: users.chairA.id, societyId: "not-an-id" },
      { recipientId: users.memberA.id }, // yourself
      { participantIds: [] },
      { participantIds: [users.chairA.id, users.chairB.id] },
    ];
    for (const body of cases) {
      const res = await post("memberA", body);
      assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${res.status} ${res.text.slice(0, 120)}`);
    }
    assert.equal(await conversationCount(), before);
  });

  test("a nonexistent recipient or society is a 404 and writes nothing", async () => {
    const before = await conversationCount();
    const ghostUser = await post("memberA", { recipientId: "64b7f8f2a1b2c3d4e5f6ffff" });
    const ghostSociety = await post("admin", { recipientId: users.chairA.id, societyId: "64b7f8f2a1b2c3d4e5f6fffe" });

    assert.equal(ghostUser.status, 404);
    assert.equal(ghostSociety.status, 404);
    assert.equal(await conversationCount(), before);
  });

  test("another society, or a recipient outside the society, is a 403 and writes nothing", async () => {
    const before = await conversationCount();
    const otherSociety = await post("memberA", { recipientId: users.chairB.id, societyId: B });
    const outsideRecipient = await post("memberA", { recipientId: users.chairB.id });
    const lonerRecipient = await post("memberA", { recipientId: users.loner.id });

    assert.equal(otherSociety.status, 403);
    assert.equal(outsideRecipient.status, 403);
    assert.equal(lonerRecipient.status, 403);
    assert.equal(await conversationCount(), before);
  });

  test("a society-less account cannot start conversations: 400 without a society, 403 for any society given", async () => {
    const before = await conversationCount();
    assert.equal((await post("loner", { recipientId: users.chairA.id })).status, 400);
    assert.equal((await post("loner", { recipientId: users.chairA.id, societyId: A })).status, 403);
    const noSociety = await asStranger("POST", "/conversations", { recipientId: users.admin.id });
    const withSociety = await asStranger("POST", "/conversations", { recipientId: users.chairA.id, societyId: A });
    assert.equal(noSociety.status, 400);
    assert.equal(withSociety.status, 403);
    assert.equal(await conversationCount(), before);
  });

  test("unauthenticated requests are rejected", async () => {
    assert.equal((await raw("POST", "/conversations", null, { recipientId: users.chairA.id })).status, 401);
  });

  test("simultaneous identical requests create exactly one conversation", async () => {
    const before = await conversationCount();
    const responses = await Promise.all(Array.from({ length: 8 }, () => post("chairA", { recipientId: users.admin.id })));

    for (const res of responses) assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(new Set(responses.map(idOf)).size, 1);
    assert.equal(await conversationCount(), before + 1);
  });
});

describe("combined path: a society-less account, then every probe", () => {
  test("a society-less, role-less account reaches no private data", async () => {
    const me = await asStranger("GET", "/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.json.user.role, "OFFICE_BEARER");
    assert.ok(!me.json.user.societyId);

    const calendar = await asStranger("GET", `/calendar/unified?${RANGE}`);
    assert.deepEqual(seen(calendar), []);
    assert.equal(EMAIL_PATTERN.test(calendar.text), false);

    const conversations = await asStranger("GET", "/conversations");
    assert.equal(conversations.status, 200);
    assert.deepEqual(conversations.json.data, []);

    // RBAC-protected resources are closed to an account that holds no role.
    assert.equal((await asStranger("GET", `/societies/${A}/notes`)).status, 403);
    assert.equal((await asStranger("GET", "/roles")).status, 403);
  });

  test("the stranger cannot read or write into someone else's direct message", async () => {
    const convs = await withDatabase(target, (db) => db.collection("conversations").find({}).toArray());
    const someoneElses = convs.find((c) => String(c.userOneId) !== stranger.id && String(c.userTwoId) !== stranger.id);

    const read = await asStranger("GET", `/conversations/${someoneElses._id}/messages`);
    const write = await asStranger("POST", `/conversations/${someoneElses._id}/messages`, { body: "intrusion" });

    assert.equal(read.status, 403);
    assert.equal(write.status, 403);
    assert.equal(leaksAny(read, write), false);
  });

  test("the stranger cannot read channel messages or board cards of any society", async () => {
    const channel = await withDatabase(target, (db, ObjectId) => db.collection("channels").findOne({ societyId: new ObjectId(A) }));

    const messages = await asStranger("GET", `/channels/${channel._id}/messages`);
    const cards = await asStranger("GET", `/boards/${channel._id}/cards`);

    assert.ok([401, 403].includes(messages.status), String(messages.status));
    assert.ok([401, 403].includes(cards.status), String(cards.status));
    assert.equal(leaksAny(messages, cards), false);
  });
});
