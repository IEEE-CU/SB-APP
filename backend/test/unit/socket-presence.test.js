// Presence privacy.
//
// `presence:update` was broadcast to every connected socket and carried
// `socketCount` and `lastSeen`. Approved policy: presence is delivered only to
// sockets in the user's own `society:<id>` room, never globally, and the
// payload exposes only `userId` and `status`.
//
// Mock io/socket; the permission resolver is stubbed. No server or database.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ALICE = "64b7f8f2a1b2c3d4e5f60aaa"; // society A
const BOB = "64b7f8f2a1b2c3d4e5f60bbb"; // society A
const CAROL = "64b7f8f2a1b2c3d4e5f60ccc"; // society B
const DAVE = "64b7f8f2a1b2c3d4e5f60ddd"; // no society scope
const ERIN = "64b7f8f2a1b2c3d4e5f60eee"; // resolver failure
const SOC_A = "64b7f8f2a1b2c3d4e5f60001";
const SOC_B = "64b7f8f2a1b2c3d4e5f60002";

let resolveGate; // optional promise to hold resolution back

function stubResolver() {
  const resolved = require.resolve(
    path.join(__dirname, "../../src/services/resolvePermissions.js"),
  );
  const societies = { [ALICE]: SOC_A, [BOB]: SOC_A, [CAROL]: SOC_B, [DAVE]: null };
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {
      resolvePermissions: async (userId) => {
        if (resolveGate) await resolveGate;
        if (String(userId) === ERIN) throw new Error("resolver unavailable");
        return {
          role: "ieee_member",
          scope: { type: "society", societyId: societies[String(userId)] ?? null },
          permissions: {},
        };
      },
      invalidateCache: () => {},
    },
  };
}

function harness() {
  for (const rel of [
    "../../src/services/presenceService.js",
    "../../src/middleware/rbac.js",
  ]) {
    delete require.cache[require.resolve(path.join(__dirname, rel))];
  }
  const presence = require("../../src/services/presenceService.js");

  const rooms = new Map();
  const sockets = new Map();
  const received = []; // { toSocket, event, payload }
  let globalEmits = 0;
  let onConnection;

  const deliver = (id, event, payload) =>
    received.push({ toSocket: id, event, payload });

  const io = {
    on: (event, fn) => {
      if (event === "connection") onConnection = fn;
    },
    // A global broadcast reaches every connected socket.
    emit: (event, payload) => {
      if (event === "presence:update") globalEmits += 1;
      for (const id of sockets.keys()) deliver(id, event, payload);
    },
    to: (target) => ({
      emit: (event, payload) => {
        if (rooms.has(target)) {
          for (const id of rooms.get(target)) deliver(id, event, payload);
        } else {
          deliver(target, event, payload);
        }
      },
    }),
    sockets: { adapter: { rooms }, sockets },
  };
  presence.setupPresenceHandlers(io);

  const connect = (userId) => {
    const handlers = {};
    const socket = {
      id: `sock-${userId}-${sockets.size}`,
      user: { id: userId },
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
  const presenceFor = (socket) =>
    received.filter((r) => r.toSocket === socket.id && r.event === "presence:update");

  return {
    connect,
    disconnect,
    presenceFor,
    received,
    globalEmits: () => globalEmits,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  resolveGate = null;
  stubResolver();
});

test("online presence reaches the user's own society only", async () => {
  const h = harness();
  const bob = h.connect(BOB);
  const carol = h.connect(CAROL);
  const dave = h.connect(DAVE);
  await flush();
  const before = {
    bob: h.presenceFor(bob).length,
    carol: h.presenceFor(carol).length,
    dave: h.presenceFor(dave).length,
  };

  const alice = h.connect(ALICE);
  await flush();

  assert.equal(h.presenceFor(bob).length - before.bob, 1);
  assert.deepEqual(h.presenceFor(bob).at(-1).payload, {
    userId: ALICE,
    status: "online",
  });
  assert.equal(h.presenceFor(carol).length - before.carol, 0, "other society");
  assert.equal(h.presenceFor(dave).length - before.dave, 0, "society-less");
  assert.ok(alice.rooms.has(`society:${SOC_A}`));
});

test("presence is never sent as a global broadcast", async () => {
  const h = harness();
  const alice = h.connect(ALICE);
  const bob = h.connect(BOB);
  await flush();
  await alice.handlers["presence:heartbeat"]({ status: "idle" });
  await h.disconnect(alice);
  await h.disconnect(bob);

  assert.equal(h.globalEmits(), 0);
});

test("a user with no society scope neither emits nor receives presence (no global fallback)", async () => {
  const h = harness();
  const bob = h.connect(BOB);
  await flush();
  const bobBefore = h.presenceFor(bob).length;

  const dave = h.connect(DAVE);
  await flush();
  await dave.handlers["presence:heartbeat"]({ status: "dnd" });
  await h.disconnect(dave);

  assert.equal(h.presenceFor(bob).length, bobBefore);
  assert.equal(h.presenceFor(dave).length, 0);
  assert.equal(h.globalEmits(), 0);
});

test("a resolver failure fails closed: nothing is emitted", async () => {
  const h = harness();
  const bob = h.connect(BOB);
  await flush();
  const before = h.presenceFor(bob).length;

  const erin = h.connect(ERIN);
  await flush();
  await erin.handlers["presence:heartbeat"]({ status: "online" });

  assert.equal(h.presenceFor(bob).length, before);
  assert.equal(h.presenceFor(erin).length, 0);
  assert.equal(h.globalEmits(), 0);
});

test("heartbeat status reaches the society only, defaulting to online", async () => {
  const h = harness();
  const alice = h.connect(ALICE);
  const bob = h.connect(BOB);
  const carol = h.connect(CAROL);
  await flush();
  const carolBefore = h.presenceFor(carol).length;

  await alice.handlers["presence:heartbeat"]({ status: "idle" });
  await alice.handlers["presence:heartbeat"](undefined);

  const last = h.presenceFor(bob).slice(-2).map((r) => r.payload);
  assert.deepEqual(last, [
    { userId: ALICE, status: "idle" },
    { userId: ALICE, status: "online" },
  ]);
  assert.equal(h.presenceFor(carol).length, carolBefore);
});

test("payloads never include socketCount or lastSeen", async () => {
  const h = harness();
  const alice = h.connect(ALICE);
  const alice2 = h.connect(ALICE);
  const bob = h.connect(BOB);
  await flush();
  await alice.handlers["presence:heartbeat"]({ status: "idle" });
  await h.disconnect(alice2); // user still online via the other socket
  await h.disconnect(alice); // user now offline

  const payloads = h.received
    .filter((r) => r.event === "presence:update")
    .map((r) => r.payload);

  assert.ok(payloads.length > 0);
  for (const payload of payloads) {
    assert.deepEqual(Object.keys(payload).sort(), ["status", "userId"]);
  }
  assert.equal(h.presenceFor(bob).at(-1).payload.status, "offline");
});

test("a user's last disconnect sends offline to their society only", async () => {
  const h = harness();
  const alice = h.connect(ALICE);
  const bob = h.connect(BOB);
  const carol = h.connect(CAROL);
  await flush();
  const carolBefore = h.presenceFor(carol).length;

  await h.disconnect(alice);

  assert.deepEqual(h.presenceFor(bob).at(-1).payload, {
    userId: ALICE,
    status: "offline",
  });
  assert.equal(h.presenceFor(carol).length, carolBefore);
});

test("closing one of two sockets keeps the user online without a socket count", async () => {
  const h = harness();
  const alice = h.connect(ALICE);
  const alice2 = h.connect(ALICE);
  const bob = h.connect(BOB);
  await flush();

  await h.disconnect(alice);

  assert.deepEqual(h.presenceFor(bob).at(-1).payload, {
    userId: ALICE,
    status: "online",
  });
  assert.ok(alice2.rooms.has(`society:${SOC_A}`));
});

test("disconnecting before the society is resolved emits nothing and does not throw", async () => {
  let release;
  resolveGate = new Promise((resolve) => {
    release = resolve;
  });
  const h = harness();
  const alice = h.connect(ALICE);

  await assert.doesNotReject(() => h.disconnect(alice));
  release();
  await flush();

  assert.equal(h.received.filter((r) => r.event === "presence:update").length, 0);
  assert.equal(alice.rooms.size, 0, "joined a room after disconnect");
  assert.equal(h.globalEmits(), 0);
});
