"use strict";

/**
 * Typing indicators and society-scoped presence over the real server.
 *
 * Typing contract (presenceService.js):
 *   client -> server  typing:start | typing:stop   { channelId } | { conversationId }
 *   server -> members typing:start { channelId|conversationId, userId, userName, user:{id,name} }
 *                     typing:stop  { channelId|conversationId, userId, user:{id} }
 *                     typing:update{ channelId|conversationId, activeTypingUsers:[names] }
 *                     (typing:update excludes the recipient; entries expire after 3 s)
 * Presence contract:
 *   presence:update { userId, status } delivered only to the user's society room.
 *
 * Every negative assertion has a positive control. Timing assertions use
 * bounded windows, never exact milliseconds. Each test opens and closes its
 * own sockets so typing/presence state does not leak between tests.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { createSocketTracker } = require("./helpers/socket-client");
const { USERS } = require("./helpers/fixtures");

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
const closeAll = (...clients) => Promise.all(clients.map((c) => c.close()));
const join = (client, event, payload) => client.emitWithAck(event, payload);
const names = (update) => update.activeTypingUsers;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves once the socket's own "online" presence arrived, i.e. it has joined its society room. */
async function settled(client, userKey) {
  await client.waitFor(
    "presence:update",
    (p) => p.userId === users[userKey].id && p.status === "online",
    4000,
    0,
  );
}

async function channelPair() {
  const sender = await connectAs("chairA");
  const receiver = await connectAs("memberA");
  assert.deepEqual(await join(sender, "channel:join", channels.A.id), { success: true });
  assert.deepEqual(await join(receiver, "channel:join", channels.A.id), { success: true });
  return { sender, receiver };
}

describe("typing in a channel", () => {
  test("members receive the typer with a server-derived identity; spoofed fields are ignored", async () => {
    const { sender, receiver } = await channelPair();
    const mark = receiver.mark();
    const senderMark = sender.mark();

    sender.emit("typing:start", {
      channelId: channels.A.id,
      user: { id: users.chairB.id, name: "Mallory", avatar: "x" },
      userId: users.chairB.id,
      userName: "Mallory",
    });

    const started = await receiver.waitFor("typing:start", () => true, 3000, mark);
    assert.equal(started.channelId, channels.A.id);
    assert.equal(started.userId, users.chairA.id);
    assert.equal(started.userName, USERS.chairA.name);
    assert.deepEqual(started.user, { id: users.chairA.id, name: USERS.chairA.name });
    assert.equal("conversationId" in started, false);

    const update = await receiver.waitFor(
      "typing:update",
      (u) => u.activeTypingUsers.length > 0,
      3000,
      mark,
    );
    assert.deepEqual(names(update), [USERS.chairA.name]);
    assert.equal(update.channelId, channels.A.id);

    const everythingReceived = JSON.stringify(receiver.events);
    assert.equal(everythingReceived.includes("Mallory"), false, "client identity was relayed");
    assert.equal(everythingReceived.includes(users.chairB.id), false);

    // The typer is not echoed their own typing:start, and their own update
    // never lists themselves.
    assert.equal((await sender.collect("typing:start", () => true, 600, senderMark)).length, 0);
    for (const own of sender.events.slice(senderMark).filter((e) => e.event === "typing:update")) {
      assert.equal(names(own.args[0]).includes(USERS.chairA.name), false);
    }
    await closeAll(sender, receiver);
  });

  test("a user who is not in the channel room cannot make typing appear", async () => {
    const receiver = await connectAs("memberA");
    await join(receiver, "channel:join", channels.A.id);
    const outsider = await connectAs("chairB"); // society B, never joined A's room
    const mark = receiver.mark();

    outsider.emit("typing:start", { channelId: channels.A.id });
    const quiet = await receiver.collect("typing:start", () => true, 1200, mark);
    assert.equal(quiet.length, 0, "an outsider's typing reached the channel");
    assert.equal(
      (await receiver.collect("typing:update", () => true, 100, mark)).length,
      0,
    );

    // Positive control: a real member still gets through.
    const member = await connectAs("chairA");
    await join(member, "channel:join", channels.A.id);
    member.emit("typing:start", { channelId: channels.A.id });
    const seen = await receiver.waitFor("typing:start", () => true, 3000, mark);
    assert.equal(seen.userId, users.chairA.id);
    await closeAll(receiver, outsider, member);
  });

  test("typing:stop removes the typer", async () => {
    const { sender, receiver } = await channelPair();
    sender.emit("typing:start", { channelId: channels.A.id });
    await receiver.waitFor("typing:update", (u) => names(u).length === 1, 3000, 0);
    const mark = receiver.mark();

    sender.emit("typing:stop", { channelId: channels.A.id });

    const stopped = await receiver.waitFor("typing:stop", () => true, 3000, mark);
    assert.equal(stopped.userId, users.chairA.id);
    assert.equal(stopped.channelId, channels.A.id);
    const cleared = await receiver.waitFor("typing:update", (u) => names(u).length === 0, 3000, mark);
    assert.equal(cleared.channelId, channels.A.id);
    await closeAll(sender, receiver);
  });

  test("typing expires after the 3 s inactivity window without a stop", async () => {
    const { sender, receiver } = await channelPair();
    const startedAt = Date.now();
    sender.emit("typing:start", { channelId: channels.A.id });
    await receiver.waitFor("typing:update", (u) => names(u).length === 1, 3000, 0);
    const mark = receiver.mark();

    await receiver.waitFor("typing:update", (u) => names(u).length === 0, 8000, mark);
    const elapsed = Date.now() - startedAt;

    assert.ok(elapsed >= 2000, `expired too early (${elapsed} ms)`);
    assert.ok(elapsed <= 6500, `expired too late (${elapsed} ms)`);
    await closeAll(sender, receiver);
  });

  test("repeating typing:start keeps the typer active past the first window", async () => {
    const { sender, receiver } = await channelPair();
    sender.emit("typing:start", { channelId: channels.A.id });
    await receiver.waitFor("typing:update", (u) => names(u).length === 1, 3000, 0);
    const mark = receiver.mark();

    await sleep(1800);
    sender.emit("typing:start", { channelId: channels.A.id }); // refresh
    await sleep(1800); // 3.6 s since the first start, 1.8 s since the refresh

    const earlyClears = receiver.events
      .slice(mark)
      .filter((e) => e.event === "typing:update" && names(e.args[0]).length === 0);
    assert.equal(earlyClears.length, 0, "typer expired despite continued typing");
    await closeAll(sender, receiver);
  });

  test("leaving the channel clears the typer promptly (not via expiry)", async () => {
    const { sender, receiver } = await channelPair();
    sender.emit("typing:start", { channelId: channels.A.id });
    await receiver.waitFor("typing:update", (u) => names(u).length === 1, 3000, 0);
    const mark = receiver.mark();
    const t0 = Date.now();

    assert.deepEqual(await join(sender, "channel:leave", channels.A.id), { success: true });

    await receiver.waitFor("typing:update", (u) => names(u).length === 0, 2500, mark);
    assert.ok(Date.now() - t0 < 2500);
    await closeAll(sender, receiver);
  });

  test("disconnecting clears the typer promptly", async () => {
    const { sender, receiver } = await channelPair();
    sender.emit("typing:start", { channelId: channels.A.id });
    await receiver.waitFor("typing:update", (u) => names(u).length === 1, 3000, 0);
    const mark = receiver.mark();

    await sender.close();

    await receiver.waitFor("typing:update", (u) => names(u).length === 0, 2500, mark);
    await closeAll(receiver);
  });

  test("malformed typing payloads are ignored; the server and real typing keep working", async () => {
    const { sender, receiver } = await channelPair();
    const mark = receiver.mark();
    const bad = [
      undefined,
      null,
      42,
      "string",
      [],
      {},
      { channelId: 7 },
      { channelId: "not-an-object-id" },
      { channelId: { $ne: "" } },
      { conversationId: ["x"] },
      { channelId: channels.A.id, conversationId: conversation.id }, // ambiguous
    ];

    for (const payload of bad) {
      sender.emit("typing:start", payload);
      sender.emit("typing:stop", payload);
    }

    assert.equal((await receiver.collect("typing:start", () => true, 1200, mark)).length, 0);
    assert.equal((await receiver.collect("typing:stop", () => true, 100, mark)).length, 0);
    assert.equal(sender.closed, false);
    assert.equal((await target.api("/health")).status, 200);

    sender.emit("typing:start", { channelId: channels.A.id }); // positive control
    const ok = await receiver.waitFor("typing:start", () => true, 3000, mark);
    assert.equal(ok.userId, users.chairA.id);
    await closeAll(sender, receiver);
  });
});

describe("typing in a conversation", () => {
  test("only participants receive typing; identity is server-derived", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    const outsider = await connectAs("chairB");
    await join(chairA, "conversation:join", conversation.id);
    await join(memberA, "conversation:join", conversation.id);
    assert.deepEqual(await join(outsider, "conversation:join", conversation.id), {
      success: false,
    });
    const markMember = memberA.mark();
    const markOutsider = outsider.mark();

    chairA.emit("typing:start", {
      conversationId: conversation.id,
      userName: "Mallory",
      user: { id: users.admin.id, name: "Mallory" },
    });

    const started = await memberA.waitFor("typing:start", () => true, 3000, markMember);
    assert.equal(started.conversationId, conversation.id);
    assert.equal(started.userId, users.chairA.id);
    assert.equal(started.userName, USERS.chairA.name);
    assert.equal("channelId" in started, false);
    const update = await memberA.waitFor(
      "typing:update",
      (u) => names(u).length === 1,
      3000,
      markMember,
    );
    assert.deepEqual(names(update), [USERS.chairA.name]);
    assert.equal(update.conversationId, conversation.id);
    assert.equal(JSON.stringify(memberA.events).includes("Mallory"), false);

    assert.equal((await outsider.collect("typing:start", () => true, 1000, markOutsider)).length, 0);
    assert.equal((await outsider.collect("typing:update", () => true, 100, markOutsider)).length, 0);

    // An outsider emitting into the conversation is ignored (positive control above).
    const mark2 = memberA.mark();
    outsider.emit("typing:start", { conversationId: conversation.id });
    assert.equal((await memberA.collect("typing:start", () => true, 1000, mark2)).length, 0);
    await closeAll(chairA, memberA, outsider);
  });
});

describe("society-scoped presence", () => {
  const presenceOf = (client, userKey) =>
    client.events
      .filter((e) => e.event === "presence:update" && e.args[0].userId === users[userKey].id)
      .map((e) => e.args[0]);

  test("a society's presence reaches its own members only", async () => {
    const chairA = await connectAs("chairA");
    await settled(chairA, "chairA");
    const chairB = await connectAs("chairB");
    await settled(chairB, "chairB");
    const loner = await connectAs("loner"); // no society scope: joins no room
    await sleep(300);
    const markB = chairB.mark();
    const markLoner = loner.mark();
    const markA = chairA.mark();

    const memberA = await connectAs("memberA");

    // Positive control: society A hears memberA come online.
    const heard = await chairA.waitFor(
      "presence:update",
      (p) => p.userId === users.memberA.id && p.status === "online",
      4000,
      markA,
    );
    assert.deepEqual(Object.keys(heard).sort(), ["status", "userId"]);
    assert.equal(heard.status, "online");

    // Society B and the society-less user hear nothing about society A.
    await sleep(1000);
    assert.equal(presenceOf(chairB, "memberA").length + presenceOf(chairB, "chairA").length, 0);
    assert.equal(
      chairB.events.slice(markB).filter((e) => e.event === "presence:update").length,
      0,
      "society B received society A's presence",
    );
    assert.equal(
      loner.events.slice(markLoner).filter((e) => e.event === "presence:update").length,
      0,
      "a society-less socket received presence",
    );
    // And society A never hears about B or the society-less user.
    assert.equal(presenceOf(chairA, "chairB").length + presenceOf(chairA, "loner").length, 0);
    await closeAll(chairA, chairB, loner, memberA);
  });

  test("heartbeat status stays inside the society and defaults to online", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    const chairB = await connectAs("chairB");
    await settled(chairA, "chairA");
    await settled(memberA, "memberA");
    await settled(chairB, "chairB");
    const markMember = memberA.mark();
    const markB = chairB.mark();

    chairA.emit("presence:heartbeat", { status: "idle" });
    const idle = await memberA.waitFor(
      "presence:update",
      (p) => p.userId === users.chairA.id && p.status === "idle",
      3000,
      markMember,
    );
    assert.deepEqual(idle, { userId: users.chairA.id, status: "idle" });

    chairA.emit("presence:heartbeat"); // no payload
    await memberA.waitFor(
      "presence:update",
      (p) => p.userId === users.chairA.id && p.status === "online",
      3000,
      markMember,
    );

    await sleep(800);
    assert.equal(
      chairB.events.slice(markB).filter((e) => e.event === "presence:update").length,
      0,
    );
    await closeAll(chairA, memberA, chairB);
  });

  test("with two sockets, closing one keeps the user online; closing the last sends offline", async () => {
    const watcher = await connectAs("chairA");
    await settled(watcher, "chairA");
    const first = await connectAs("memberA");
    await settled(first, "memberA");
    const second = await connectAs("memberA");
    await settled(second, "memberA");
    const mark = watcher.mark();

    await first.close();

    const stillOnline = await watcher.waitFor(
      "presence:update",
      (p) => p.userId === users.memberA.id,
      3000,
      mark,
    );
    assert.equal(stillOnline.status, "online", "user reported offline with a socket still open");
    await sleep(600);
    assert.equal(
      presenceOf(watcher, "memberA").slice(-1)[0].status,
      "online",
    );

    const mark2 = watcher.mark();
    await second.close();

    const offline = await watcher.waitFor(
      "presence:update",
      (p) => p.userId === users.memberA.id && p.status === "offline",
      3000,
      mark2,
    );
    assert.deepEqual(offline, { userId: users.memberA.id, status: "offline" });
    await closeAll(watcher);
  });

  test("a user with no society scope causes no presence at all", async () => {
    const chairA = await connectAs("chairA");
    const chairB = await connectAs("chairB");
    await settled(chairA, "chairA");
    await settled(chairB, "chairB");
    const markA = chairA.mark();
    const markB = chairB.mark();

    const loner = await connectAs("loner");
    loner.emit("presence:heartbeat", { status: "dnd" });
    await sleep(600);
    await loner.close();
    await sleep(900);

    assert.equal(chairA.events.slice(markA).filter((e) => e.event === "presence:update").length, 0);
    assert.equal(chairB.events.slice(markB).filter((e) => e.event === "presence:update").length, 0);
    assert.equal(presenceOf(loner, "loner").length, 0, "the society-less user heard itself");
    await closeAll(chairA, chairB);
  });

  test("a branch-wide administrator (no society room) causes no presence leakage", async () => {
    const chairA = await connectAs("chairA");
    await settled(chairA, "chairA");
    const mark = chairA.mark();

    const admin = await connectAs("admin");
    admin.emit("presence:heartbeat", { status: "online" });
    await sleep(1000);

    assert.equal(
      chairA.events.slice(mark).filter((e) => e.event === "presence:update").length,
      0,
      "an administrator's presence reached society A",
    );
    await closeAll(chairA, admin);
  });

  test("no presence payload anywhere contains socketCount or lastSeen", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    await settled(chairA, "chairA");
    await settled(memberA, "memberA");
    chairA.emit("presence:heartbeat", { status: "dnd" });
    await memberA.waitFor("presence:update", (p) => p.status === "dnd", 3000, 0);
    await chairA.close();
    await memberA.waitFor(
      "presence:update",
      (p) => p.userId === users.chairA.id && p.status === "offline",
      3000,
      0,
    ).catch(() => {}); // the closing user's own socket cannot be the recipient

    const payloads = [...chairA.events, ...memberA.events]
      .filter((e) => e.event === "presence:update")
      .map((e) => e.args[0]);
    assert.ok(payloads.length >= 3);
    for (const payload of payloads) {
      assert.deepEqual(Object.keys(payload).sort(), ["status", "userId"]);
    }
    await closeAll(memberA);
  });
});
