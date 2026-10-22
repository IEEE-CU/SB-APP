"use strict";

/**
 * AUD-012 over WebSocket: what a presence heartbeat may say and how often it is relayed.
 *
 * Before: any string in `presence:heartbeat` { status } was broadcast verbatim to the whole
 * society room, and every heartbeat was relayed (unbounded fan-out from one socket). Now only
 * online / idle / dnd are relayed, a status change spends a token from a per-socket bucket
 * (burst 5, 1 per second), and repeating a status is refreshed at most every 30 s.
 *
 * Positive controls accompany every negative assertion; waits are bounded windows.
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
const { users } = target.ready.fixtures;

after(() => tracker.closeAll());

async function connectAs(userKey) {
  const result = await tracker.connect(target.baseUrl, { token: await session.tokenFor(userKey) });
  assert.equal(result.ok, true, `${userKey} could not connect: ${result.error}`);
  await result.client.waitFor("presence:update", (p) => p.userId === users[userKey].id && p.status === "online", 4000, 0);
  return result.client;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const heard = (client, mark) => client.events.slice(mark).filter((e) => e.event === "presence:update").map((e) => e.args[0]);

describe("presence heartbeat", () => {
  test("a valid status is relayed to the society with the sender's own identity", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    const mark = memberA.mark();

    chairA.emit("presence:heartbeat", { status: "dnd", userId: users.memberA.id });
    await memberA.waitFor("presence:update", (p) => p.userId === users.chairA.id && p.status === "dnd", 3000, mark);

    assert.deepEqual(heard(memberA, mark), [{ userId: users.chairA.id, status: "dnd" }]);
    await Promise.all([chairA.close(), memberA.close()]);
  });

  test("markup, oversized text and unknown statuses are not relayed", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    const mark = memberA.mark();

    for (const status of ["<img src=x onerror=alert(1)>", "x".repeat(20000), "offline", "Online", 7, {}, ["idle"]]) {
      chairA.emit("presence:heartbeat", { status });
    }
    chairA.emit("presence:heartbeat", { status: "idle" }); // positive control, sent last
    await memberA.waitFor("presence:update", (p) => p.status === "idle", 3000, mark);
    await sleep(500);

    assert.deepEqual(heard(memberA, mark), [{ userId: users.chairA.id, status: "idle" }]);
    await Promise.all([chairA.close(), memberA.close()]);
  });

  test("a flood of heartbeats is relayed only up to the burst allowance", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    const mark = memberA.mark();

    for (let i = 0; i < 300; i += 1) chairA.emit("presence:heartbeat", { status: i % 2 ? "idle" : "dnd" });
    await sleep(1500);

    const relayed = heard(memberA, mark).length;
    assert.ok(relayed >= 3, `the first status changes were not relayed (${relayed})`);
    assert.ok(relayed <= 8, `${relayed} of 300 heartbeats were relayed`);
    await Promise.all([chairA.close(), memberA.close()]);
  });

  test("the same status repeated is relayed once", async () => {
    const chairA = await connectAs("chairA");
    const memberA = await connectAs("memberA");
    const mark = memberA.mark();

    for (let i = 0; i < 100; i += 1) chairA.emit("presence:heartbeat", { status: "idle" });
    await memberA.waitFor("presence:update", (p) => p.status === "idle", 3000, mark);
    await sleep(800);

    assert.equal(heard(memberA, mark).length, 1);
    await Promise.all([chairA.close(), memberA.close()]);
  });

  test("another society still hears nothing (existing isolation unchanged)", async () => {
    const chairA = await connectAs("chairA");
    const chairB = await connectAs("chairB");
    const mark = chairB.mark();

    chairA.emit("presence:heartbeat", { status: "idle" });
    await sleep(800);

    assert.deepEqual(heard(chairB, mark), []);
    await Promise.all([chairA.close(), chairB.close()]);
  });
});
