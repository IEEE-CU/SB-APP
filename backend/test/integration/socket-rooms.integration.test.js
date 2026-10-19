"use strict";

/**
 * Socket.IO room authorization and end-to-end delivery over the real server.
 *
 * Contract (presenceService.js, routes/channels.js, routes/conversations.js):
 *   client -> server  channel:join / channel:leave   raw id or { channelId }
 *                     conversation:join / :leave     raw id or { conversationId }
 *                     room:join / room:leave         { channelId }  (canvas room)
 *   acknowledgement   { success: boolean }
 *   HTTP POST message -> `message:new` into channel_<id> / conversation_<id>
 *
 * Negative assertions always have a positive control (a legitimate receiver
 * that must get the same event) before silence is interpreted.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { createSocketTracker } = require("./helpers/socket-client");

const target = requireHarnessTarget();
const session = createSession(target);
const tracker = createSocketTracker();
const { users, channels, conversation } = target.ready.fixtures;

after(() => tracker.closeAll());

async function connectAs(userKey) {
  const result = await tracker.connect(target.baseUrl, {
    token: await session.tokenFor(userKey),
  });
  assert.equal(result.ok, true, `${userKey} could not connect: ${result.error}`);
  return result.client;
}

const join = (client, event, payload) => client.emitWithAck(event, payload);
const isMessage = (text) => (m) => m && m.body === text;
let counter = 0;
const unique = (label) => `${label} #${++counter} ${Date.now()}`;

async function postChannelMessage(userKey, channelId, text) {
  const res = await session.request(userKey, "POST", `/channels/${channelId}/messages`, {
    body: { body: text },
  });
  assert.equal(res.status, 201, `message post failed: ${res.text.slice(0, 160)}`);
  return res.body.data;
}

describe("channel rooms: authorized join and end-to-end delivery", () => {
  test("HTTP message -> message:new reaches an authorized member of the channel", async () => {
    const memberA = await connectAs("memberA");
    const chairA = await connectAs("chairA");
    assert.deepEqual(await join(memberA, "channel:join", channels.A.id), { success: true });
    assert.deepEqual(await join(chairA, "channel:join", { channelId: channels.A.id }), {
      success: true,
    });
    const text = unique("hello from chair A");
    const mark = memberA.mark();

    const created = await postChannelMessage("chairA", channels.A.id, text);

    const received = await memberA.waitFor("message:new", isMessage(text), 3000, mark);
    assert.equal(received.id, created.id, "event does not carry the created message id");
    assert.equal(received.channelId, channels.A.id);
    assert.equal(received.authorId._id || received.authorId.id || received.authorId, users.chairA.id);
    assert.equal(received.societyId, target.ready.fixtures.societies.A.id);
  });

  test("an administrator (branch-wide role) can join channels of either society", async () => {
    const admin = await connectAs("admin");

    assert.deepEqual(await join(admin, "channel:join", channels.A.id), { success: true });
    assert.deepEqual(await join(admin, "channel:join", channels.B.id), { success: true });
  });
});

describe("channel rooms: cross-society isolation", () => {
  test("a society A user cannot join B's channel and never receives B's messages", async () => {
    const chairA = await connectAs("chairA");
    const chairB = await connectAs("chairB");
    assert.deepEqual(await join(chairB, "channel:join", channels.B.id), { success: true });

    const refused = await join(chairA, "channel:join", channels.B.id);
    assert.deepEqual(refused, { success: false });

    const text = unique("society B private message");
    const markA = chairA.mark();
    const markB = chairB.mark();
    await postChannelMessage("chairB", channels.B.id, text);

    // Positive control first: the legitimate receiver gets it.
    await chairB.waitFor("message:new", isMessage(text), 3000, markB);
    const leaked = await chairA.collect("message:new", isMessage(text), 1500, markA);
    assert.equal(leaked.length, 0, "society A's socket received society B's message");
  });

  test("guessing the room name or using the legacy room does not grant membership", async () => {
    const memberA = await connectAs("memberA");
    const chairB = await connectAs("chairB");
    await join(chairB, "channel:join", channels.B.id);

    const guesses = [
      ["channel:join", `channel_${channels.B.id}`],
      ["channel:join", { channelId: `channel_${channels.B.id}` }],
      ["room:join", { channelId: channels.B.id }],
      ["room:join", `channel:${channels.B.id}`],
    ];
    for (const [event, payload] of guesses) {
      assert.deepEqual(await join(memberA, event, payload), { success: false }, event);
    }

    const text = unique("not for A");
    const markA = memberA.mark();
    const markB = chairB.mark();
    await postChannelMessage("chairB", channels.B.id, text);
    await chairB.waitFor("message:new", isMessage(text), 3000, markB);
    assert.equal((await memberA.collect("message:new", isMessage(text), 1200, markA)).length, 0);
  });

  test("a connected socket that never joined a room receives no channel messages", async () => {
    const lurker = await connectAs("chairA");
    const member = await connectAs("memberA");
    await join(member, "channel:join", channels.A.id);
    const text = unique("only for joined sockets");
    const markLurker = lurker.mark();
    const markMember = member.mark();

    await postChannelMessage("chairA", channels.A.id, text);

    await member.waitFor("message:new", isMessage(text), 3000, markMember);
    assert.equal((await lurker.collect("message:new", isMessage(text), 1200, markLurker)).length, 0);
  });

  test("a user without any hub permission or society cannot join a channel", async () => {
    const loner = await connectAs("loner");

    assert.deepEqual(await join(loner, "channel:join", channels.A.id), { success: false });
    assert.deepEqual(await join(loner, "room:join", { channelId: channels.A.id }), {
      success: false,
    });
  });
});

describe("channel rooms: leaving and disconnecting", () => {
  test("after channel:leave a socket no longer receives the channel's messages", async () => {
    const member = await connectAs("memberA");
    const control = await connectAs("chairA");
    await join(member, "channel:join", channels.A.id);
    await join(control, "channel:join", channels.A.id);

    assert.deepEqual(await join(member, "channel:leave", channels.A.id), { success: true });
    const text = unique("after leave");
    const markMember = member.mark();
    const markControl = control.mark();
    await postChannelMessage("chairA", channels.A.id, text);

    await control.waitFor("message:new", isMessage(text), 3000, markControl);
    assert.equal((await member.collect("message:new", isMessage(text), 1200, markMember)).length, 0);
  });

  test("a disconnected client receives nothing further and others are unaffected", async () => {
    const leaver = await connectAs("memberA");
    const control = await connectAs("chairA");
    await join(leaver, "channel:join", channels.A.id);
    await join(control, "channel:join", channels.A.id);

    await leaver.close();
    assert.equal(leaver.closed, true);
    const eventsAtClose = leaver.events.length;
    const text = unique("after disconnect");
    const markControl = control.mark();
    await postChannelMessage("chairA", channels.A.id, text);

    await control.waitFor("message:new", isMessage(text), 3000, markControl);
    assert.equal(leaver.events.length, eventsAtClose);
    assert.throws(() => leaver.emit("channel:join", channels.A.id), /not open/);
  });
});

describe("malformed join and leave payloads", () => {
  test("are refused safely and the server and the socket keep working", async () => {
    const client = await connectAs("chairA");
    // Structurally invalid: refused by every join AND leave event.
    const malformed = [
      undefined,
      null,
      42,
      true,
      [],
      {},
      "",
      "not-an-object-id",
      "x".repeat(5000),
      { channelId: 7 },
      { channelId: { $ne: "" } },
      { channelId: ["a"] },
      { conversationId: {} },
    ];
    // Well-formed ids that name the wrong kind of resource: refused by joins
    // (the lookup finds nothing). Leaves only remove membership, so they are
    // idempotent and not tested here.
    const wrongKind = [
      { channelId: conversation.id },
      { conversationId: channels.A.id },
      conversation.id,
    ];

    for (const event of [
      "channel:join",
      "conversation:join",
      "room:join",
      "channel:leave",
      "conversation:leave",
      "room:leave",
    ]) {
      for (const payload of malformed) {
        const ack = await client.emitWithAck(event, payload);
        assert.deepEqual(
          ack,
          { success: false },
          `${event} accepted ${JSON.stringify(payload)?.slice(0, 40)}`,
        );
      }
    }
    for (const event of ["channel:join", "room:join"]) {
      for (const payload of wrongKind.filter((p) => p !== channels.A.id)) {
        assert.deepEqual(await client.emitWithAck(event, payload), { success: false }, event);
      }
    }
    for (const payload of [{ channelId: conversation.id }, { conversationId: channels.A.id }, channels.A.id]) {
      assert.deepEqual(
        await client.emitWithAck("conversation:join", payload),
        { success: false },
        `conversation:join accepted ${JSON.stringify(payload)}`,
      );
    }

    // The process is alive, the DB connected, and the socket still works.
    const health = await target.api("/health");
    assert.equal(health.status, 200);
    assert.equal(client.closed, false, "the socket was dropped");
    assert.deepEqual(await join(client, "channel:join", channels.A.id), { success: true });
  });
});

describe("conversation rooms", () => {
  test("participants can join; message:new reaches the other participant only", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    const chairB = await connectAs("chairB");

    assert.deepEqual(await join(chairA, "conversation:join", conversation.id), { success: true });
    assert.deepEqual(await join(memberA, "conversation:join", { conversationId: conversation.id }), {
      success: true,
    });
    assert.deepEqual(await join(chairB, "conversation:join", conversation.id), {
      success: false,
    });

    const text = unique("direct message");
    const markMember = memberA.mark();
    const markOutsider = chairB.mark();
    const res = await session.request("chairA", "POST", `/conversations/${conversation.id}/messages`, {
      body: { body: text },
    });
    assert.equal(res.status, 201, res.text.slice(0, 160));

    const received = await memberA.waitFor("message:new", isMessage(text), 3000, markMember);
    assert.equal(received.conversationId, conversation.id);
    assert.equal(received.id, res.body.data.id);
    assert.equal((await chairB.collect("message:new", isMessage(text), 1500, markOutsider)).length, 0);
  });

  test("a non-participant cannot post into the conversation and nothing is delivered", async () => {
    const memberA = await connectAs("memberA");
    await join(memberA, "conversation:join", conversation.id);
    const text = unique("intruder message");
    const mark = memberA.mark();

    const res = await session.request("chairB", "POST", `/conversations/${conversation.id}/messages`, {
      body: { body: text },
    });

    assert.equal(res.status, 403);
    assert.equal((await memberA.collect("message:new", isMessage(text), 1200, mark)).length, 0);
  });

  test("malformed or unknown conversation ids are refused", async () => {
    const chairA = await connectAs("chairA");

    for (const payload of [
      "not-an-object-id",
      { conversationId: 7 },
      "64b7f8f2a1b2c3d4e5f6ffff", // well-formed, no such conversation
    ]) {
      assert.deepEqual(await join(chairA, "conversation:join", payload), { success: false });
    }
  });

  test("after conversation:leave the participant stops receiving its messages", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    await join(chairA, "conversation:join", conversation.id);
    await join(memberA, "conversation:join", conversation.id);
    assert.deepEqual(await join(memberA, "conversation:leave", conversation.id), {
      success: true,
    });
    const text = unique("after conversation leave");
    const markMember = memberA.mark();
    const markSender = chairA.mark();

    await session.request("chairA", "POST", `/conversations/${conversation.id}/messages`, {
      body: { body: text },
    });

    await chairA.waitFor("message:new", isMessage(text), 3000, markSender);
    assert.equal((await memberA.collect("message:new", isMessage(text), 1200, markMember)).length, 0);
  });
});
