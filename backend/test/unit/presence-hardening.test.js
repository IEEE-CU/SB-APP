// AUD-012: presence reliability and abuse limits (single process).
//
// Reproduced before the fix, with this same harness:
//   - any string a client put in `presence:heartbeat` { status } was broadcast verbatim to its
//     whole society room (text up to the socket frame limit, markup, "offline" while online);
//   - a socket could make the server fan out an unbounded stream of presence events: every
//     heartbeat was relayed to every member of the society.
// Now only online / idle / dnd are relayed (no status means online), a status CHANGE spends a
// token from a small per-socket bucket, and the same status is only re-relayed as a refresh
// after 30 s. Identity always comes from the authenticated socket, never from the payload.
//
// Also pinned here because nothing tested them before: presence state does not leak across
// many connect/disconnect cycles, and a user with several sockets goes offline only when the
// last one closes.
//
// Presence state is per process (Maps). Nothing here, or in the code, makes it correct across
// several server processes; see the final report for the limitation.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ALICE = "64b7f8f2a1b2c3d4e5f60aaa"; // society A
const BOB = "64b7f8f2a1b2c3d4e5f60bbb"; // society A
const CAROL = "64b7f8f2a1b2c3d4e5f60ccc"; // society B
const SOC_A = "64b7f8f2a1b2c3d4e5f60001";
const SOC_B = "64b7f8f2a1b2c3d4e5f60002";

function stubResolver() {
  const resolved = require.resolve(path.join(__dirname, "../../src/services/resolvePermissions.js"));
  const societies = { [ALICE]: SOC_A, [BOB]: SOC_A, [CAROL]: SOC_B };
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {
      resolvePermissions: async (userId) => ({
        role: "ieee_member",
        scope: { type: "society", societyId: societies[String(userId)] ?? null },
        permissions: {},
      }),
      invalidateCache: () => {},
    },
  };
}

function harness() {
  for (const rel of ["../../src/services/presenceService.js", "../../src/middleware/rbac.js"]) {
    delete require.cache[require.resolve(path.join(__dirname, rel))];
  }
  const presence = require("../../src/services/presenceService.js");
  const rooms = new Map();
  const sockets = new Map();
  const received = [];
  let onConnection;
  let counter = 0;

  const io = {
    on: (event, fn) => {
      if (event === "connection") onConnection = fn;
    },
    emit() {},
    to: (target) => ({
      emit: (event, payload) => {
        if (rooms.has(target)) for (const id of rooms.get(target)) received.push({ toSocket: id, event, payload });
        else received.push({ toSocket: target, event, payload });
      },
    }),
    sockets: { adapter: { rooms }, sockets },
  };
  presence.setupPresenceHandlers(io);

  const connect = (userId, user = {}) => {
    const handlers = {};
    counter += 1;
    const socket = {
      id: `sock-${counter}`,
      user: { id: userId, ...user },
      rooms: new Set(),
      handlers,
      on(event, fn) {
        handlers[event] = fn;
      },
      join(room) {
        this.rooms.add(room);
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(this.id);
      },
      leave(room) {
        this.rooms.delete(room);
        rooms.get(room)?.delete(this.id);
      },
      disconnect() {},
      to: () => ({ emit() {} }),
    };
    sockets.set(socket.id, socket);
    onConnection(socket);
    return socket;
  };
  const disconnect = async (socket) => {
    for (const room of [...socket.rooms]) socket.leave(room);
    sockets.delete(socket.id);
    await socket.handlers.disconnect();
  };
  const heardBy = (socket) => received.filter((r) => r.toSocket === socket.id && r.event === "presence:update").map((r) => r.payload);
  return { presence, connect, disconnect, heardBy };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => stubResolver());

async function pair() {
  const h = harness();
  const alice = h.connect(ALICE);
  const bob = h.connect(BOB);
  const carol = h.connect(CAROL);
  await flush();
  return { h, alice, bob, carol, mark: h.heardBy(bob).length };
}
const sinceMark = (h, socket, mark) => h.heardBy(socket).slice(mark);

// ---- what a heartbeat may say ----------------------------------------------------------------------

test("only online, idle and dnd are relayed; a missing status means online", async () => {
  const { h, alice, bob, mark } = await pair();

  await alice.handlers["presence:heartbeat"]({ status: "dnd" });
  await alice.handlers["presence:heartbeat"]({ status: "idle" });
  await alice.handlers["presence:heartbeat"]({ status: "online" });
  await alice.handlers["presence:heartbeat"]();

  assert.deepEqual(
    sinceMark(h, bob, mark).map((p) => p.status),
    ["dnd", "idle", "online"], // the final no-payload heartbeat repeats "online": a refresh, not re-relayed
  );
});

test("any other status is ignored: markup, long text, other case, numbers, objects, arrays, offline", async () => {
  const { h, alice, bob, mark } = await pair();
  const hostile = ["<img src=x onerror=alert(1)>", "x".repeat(100000), "Online", "IDLE", " idle", "offline", "", 5, true, {}, [], ["idle"], { $ne: 1 }];

  for (const status of hostile) await alice.handlers["presence:heartbeat"]({ status });

  assert.deepEqual(sinceMark(h, bob, mark), []);

  // A payload that is not an object carries no status at all, which has always meant "online".
  await alice.handlers["presence:heartbeat"]("idle");
  assert.deepEqual(sinceMark(h, bob, mark), [{ userId: ALICE, status: "online" }]);
});

test("the sender's identity comes from the socket, not from the payload", async () => {
  const { h, alice, bob, carol, mark } = await pair();
  const markCarol = h.heardBy(carol).length;

  await alice.handlers["presence:heartbeat"]({ status: "idle", userId: CAROL, user: { id: CAROL }, society: SOC_B, room: `society:${SOC_B}` });

  assert.deepEqual(sinceMark(h, bob, mark), [{ userId: ALICE, status: "idle" }]);
  assert.deepEqual(h.heardBy(carol).slice(markCarol), [], "a payload reached another society");
});

// ---- how often -----------------------------------------------------------------------------------------

test("a flood of alternating statuses relays at most the burst allowance", async () => {
  const { h, alice, bob, mark } = await pair();

  for (let i = 0; i < 500; i += 1) await alice.handlers["presence:heartbeat"]({ status: i % 2 ? "idle" : "dnd" });

  const relayed = sinceMark(h, bob, mark).length;
  assert.ok(relayed >= 3 && relayed <= 6, `relayed ${relayed} of 500`);
});

test("repeating the same status is relayed once, and refreshed only after 30 s", async () => {
  const { h, alice, bob, mark } = await pair();
  let base = Date.now();
  const clock = mock.method(Date, "now", () => base);
  try {
    for (let i = 0; i < 200; i += 1) await alice.handlers["presence:heartbeat"]({ status: "idle" });
    assert.equal(sinceMark(h, bob, mark).length, 1);

    base += 29_000;
    await alice.handlers["presence:heartbeat"]({ status: "idle" });
    assert.equal(sinceMark(h, bob, mark).length, 1, "refreshed too early");

    base += 2_000;
    await alice.handlers["presence:heartbeat"]({ status: "idle" });
    assert.equal(sinceMark(h, bob, mark).length, 2, "never refreshed");
  } finally {
    clock.mock.restore();
  }
});

test("the burst bucket refills over time", async () => {
  const { h, alice, bob, mark } = await pair();
  let base = Date.now();
  const clock = mock.method(Date, "now", () => base);
  try {
    for (let i = 0; i < 50; i += 1) await alice.handlers["presence:heartbeat"]({ status: i % 2 ? "idle" : "dnd" });
    const first = sinceMark(h, bob, mark).length;

    base += 10_000;
    await alice.handlers["presence:heartbeat"]({ status: "online" });

    assert.equal(sinceMark(h, bob, mark).length, first + 1);
  } finally {
    clock.mock.restore();
  }
});

test("each socket has its own allowance: one flooding socket does not silence another", async () => {
  const { h, alice, bob, mark } = await pair();
  const markAlice = h.heardBy(alice).length;

  for (let i = 0; i < 100; i += 1) await alice.handlers["presence:heartbeat"]({ status: i % 2 ? "idle" : "dnd" });
  await bob.handlers["presence:heartbeat"]({ status: "idle" });

  assert.deepEqual(h.heardBy(alice).slice(markAlice).at(-1), { userId: BOB, status: "idle" });
  assert.ok(sinceMark(h, bob, mark).length <= 6);
});

// ---- state is cleaned up --------------------------------------------------------------------------------------

test("hundreds of connect/disconnect cycles leave no presence, typing or timer state behind", async () => {
  const { h, alice, bob, carol } = await pair();
  const { userSockets, socketUserMap } = h.presence;
  await h.disconnect(alice);
  await h.disconnect(bob);

  for (let i = 0; i < 300; i += 1) {
    const socket = h.connect(i % 2 ? ALICE : BOB, { exp: Math.floor(Date.now() / 1000) + 3600 });
    await flush();
    await socket.handlers["presence:heartbeat"]({ status: "idle" });
    await h.disconnect(socket);
  }

  // Only carol (still connected) remains; every cycled socket was fully released.
  assert.deepEqual([...socketUserMap.keys()], [carol.id]);
  assert.deepEqual([...userSockets.keys()], [CAROL]);
  assert.deepEqual([...userSockets.get(CAROL)], [carol.id]);
});

test("a user with two sockets goes offline only when the last one closes, exactly once", async () => {
  const { h, alice, bob, mark } = await pair();
  const second = h.connect(ALICE);
  await flush();
  const markAfterSecond = h.heardBy(bob).length;

  await h.disconnect(alice);
  const afterFirst = h.heardBy(bob).slice(markAfterSecond);
  await h.disconnect(second);
  const afterLast = h.heardBy(bob).slice(markAfterSecond);

  assert.equal(afterFirst.some((p) => p.userId === ALICE && p.status === "offline"), false, "went offline with a socket still open");
  assert.equal(afterLast.filter((p) => p.userId === ALICE && p.status === "offline").length, 1);
  assert.ok(mark >= 0);
});

test("a stale socket id never lingers after an abrupt double disconnect", async () => {
  const { h, alice } = await pair();
  const { userSockets, socketUserMap } = h.presence;

  await h.disconnect(alice);
  await alice.handlers.disconnect(); // a transport that reports the close twice

  assert.equal(socketUserMap.has(alice.id), false);
  assert.equal(userSockets.get(ALICE)?.has(alice.id) ?? false, false);
});

// Presence, rooms and rate-limit counters are per process, so cluster mode is refused at
// start-up (AUD-012B); that behavior is tested in runtime-modes.test.js.
