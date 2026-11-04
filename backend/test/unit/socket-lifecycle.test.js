// AUD-024 follow-up: token lifetime on live sockets.
//
// The JWT was verified once at the handshake. A connected socket kept every
// room, typing and canvas privilege after its token expired, and kept
// receiving message events into rooms it had joined.
//
// Policy implemented (mirrors REST `authenticate`, which answers 401 for an
// expired token): once `exp` has passed, protected socket actions are refused
// and the socket is disconnected, which releases its rooms and typing state
// through the existing disconnect handling.
//
// Mock io/socket; the permission resolver and models are stubbed.
const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const Channel = require("../../src/models/Channel");
const Conversation = require("../../src/models/Conversation");
const User = require("../../src/models/User");

const USER = "64b7f8f2a1b2c3d4e5f60aaa";
const PEER = "64b7f8f2a1b2c3d4e5f60bbb";
const SOC = "64b7f8f2a1b2c3d4e5f60001";
const CH = "64b7f8f2a1b2c3d4e5f60a01";
const CONV = "64b7f8f2a1b2c3d4e5f60c01";

let realChannel;
let realConversation;
let realUser;

function stubResolver() {
  const resolved = require.resolve(
    path.join(__dirname, "../../src/services/resolvePermissions.js"),
  );
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {
      resolvePermissions: async () => ({
        role: "ieee_member",
        scope: { type: "society", societyId: SOC },
        permissions: { "community_hub:view": "limited_own_scope" },
      }),
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
  const deliveries = [];
  let onConnection;

  const toRoom = (room, event, payload, except) => {
    for (const id of rooms.get(room) || []) {
      if (id !== except) deliveries.push({ toSocket: id, event, payload });
    }
  };
  const io = {
    on: (event, fn) => {
      if (event === "connection") onConnection = fn;
    },
    emit() {},
    to: (target) => ({
      emit: (event, payload) =>
        rooms.has(target)
          ? toRoom(target, event, payload)
          : deliveries.push({ toSocket: target, event, payload }),
    }),
    sockets: { adapter: { rooms }, sockets },
  };
  presence.setupPresenceHandlers(io);

  const connect = (userId, tokenPayload = {}) => {
    const handlers = {};
    const socket = {
      id: `sock-${userId}-${sockets.size}`,
      user: { id: userId, ...tokenPayload },
      rooms: new Set(),
      handlers,
      disconnected: false,
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
      to: (room) => ({
        emit: (event, payload) => toRoom(room, event, payload, socket.id),
      }),
      disconnect() {
        if (this.disconnected) return;
        this.disconnected = true;
        for (const room of [...this.rooms]) this.leave(room);
        handlers.disconnect?.();
      },
    };
    sockets.set(socket.id, socket);
    onConnection(socket);
    return socket;
  };

  const fire = async (socket, event, ...args) => {
    if (typeof socket.handlers[event] !== "function") return undefined;
    return socket.handlers[event](...args);
  };
  const deliveredTo = (socket, event) =>
    deliveries.filter((d) => d.toSocket === socket.id && d.event === event);

  return { connect, fire, deliveredTo, rooms };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  stubResolver();
  realChannel = Channel.findById;
  realConversation = Conversation.findById;
  realUser = User.findById;
  Channel.findById = async (id) => (id === CH ? { _id: CH, societyId: SOC } : null);
  Conversation.findById = async (id) =>
    id === CONV ? { _id: CONV, userOneId: USER, userTwoId: PEER } : null;
  User.findById = () => {
    const q = { select: () => q, lean: async () => ({ name: "Alice A" }) };
    return q;
  };
});

afterEach(() => {
  mock.timers.reset();
  Channel.findById = realChannel;
  Conversation.findById = realConversation;
  User.findById = realUser;
});

const nowSeconds = () => Math.floor(Date.now() / 1000);

// ---- already-expired token ---------------------------------------------------------

test("AUD-024: a socket whose token has already expired is disconnected and cannot act", async () => {
  const h = harness();
  const socket = h.connect(USER, { exp: nowSeconds() - 60 });
  await flush();

  await h.fire(socket, "channel:join", CH);
  await h.fire(socket, "room:join", { channelId: CH });
  await h.fire(socket, "conversation:join", CONV);

  assert.equal(socket.disconnected, true);
  assert.equal(socket.rooms.has(`channel_${CH}`), false);
  assert.equal(socket.rooms.has(`channel:${CH}`), false);
  assert.equal(socket.rooms.has(`conversation_${CONV}`), false);
});

// ---- token that expires while connected ------------------------------------------------

test("AUD-024: protected actions are refused once the token expires on a live socket", async () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const h = harness();
  const alice = h.connect(USER, { exp: 1000 + 60 }); // expires 60 s from "now"
  const peer = h.connect(PEER, { exp: 1000 + 3600 });
  await flush();
  await h.fire(alice, "channel:join", CH);
  await h.fire(peer, "channel:join", CH);
  assert.equal(alice.rooms.has(`channel_${CH}`), true);

  mock.timers.setTime(1_000_000 + 61_000); // past alice's expiry
  await h.fire(alice, "typing:start", { channelId: CH });
  await h.fire(alice, "conversation:join", CONV);

  assert.equal(alice.disconnected, true);
  assert.equal(h.deliveredTo(peer, "typing:start").length, 0);
  assert.equal(alice.rooms.has(`conversation_${CONV}`), false);
});

test("AUD-024: the socket is disconnected when its token expires, releasing rooms and typing state", async () => {
  mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  const h = harness();
  const alice = h.connect(USER, { exp: 1000 + 60 });
  const peer = h.connect(PEER, { exp: 1000 + 3600 });
  await flush();
  await h.fire(alice, "channel:join", CH);
  await h.fire(peer, "channel:join", CH);
  await h.fire(alice, "typing:start", { channelId: CH });
  assert.deepEqual(
    h.deliveredTo(peer, "typing:update").at(-1).payload.activeTypingUsers,
    ["Alice A"],
  );

  mock.timers.tick(60_000);

  assert.equal(alice.disconnected, true);
  assert.equal(alice.rooms.size, 0);
  assert.deepEqual(
    h.deliveredTo(peer, "typing:update").at(-1).payload.activeTypingUsers,
    [],
  );
  assert.equal(peer.disconnected, false, "an unrelated socket was disconnected");
});

test("an acknowledgement callback is told when a join is refused after the token expires", async () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const h = harness();
  const socket = h.connect(USER, { exp: 1000 + 60 });
  await flush();
  mock.timers.setTime(1_000_000 + 61_000);
  const acks = [];

  await h.fire(socket, "channel:join", CH, (r) => acks.push(r));

  assert.deepEqual(acks, [{ success: false }]);
  assert.equal(socket.disconnected, true);
});

// ---- unchanged behavior ------------------------------------------------------------------

test("a socket with a valid, unexpired token behaves exactly as before", async () => {
  const h = harness();
  const alice = h.connect(USER, { exp: nowSeconds() + 3600 });
  const peer = h.connect(PEER, { exp: nowSeconds() + 3600 });
  await flush();

  await h.fire(alice, "channel:join", { channelId: CH });
  await h.fire(peer, "channel:join", CH);
  await h.fire(alice, "typing:start", { channelId: CH });

  assert.equal(alice.disconnected, false);
  assert.equal(alice.rooms.has(`channel_${CH}`), true);
  assert.equal(h.deliveredTo(peer, "typing:start").length, 1);
});

test("a token without an exp claim is not treated as expired", async () => {
  const h = harness();
  const socket = h.connect(USER, {});
  await flush();

  await h.fire(socket, "channel:join", CH);

  assert.equal(socket.disconnected, false);
  assert.equal(socket.rooms.has(`channel_${CH}`), true);
});

test("a normal disconnect still cleans up and does not leave a pending expiry timer", async () => {
  mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  const h = harness();
  const alice = h.connect(USER, { exp: 1000 + 60 });
  await flush();
  await h.fire(alice, "channel:join", CH);

  alice.disconnect();
  assert.equal(alice.rooms.size, 0);

  // Ticking past the old expiry must not throw or act on the closed socket.
  assert.doesNotThrow(() => mock.timers.tick(120_000));
});
