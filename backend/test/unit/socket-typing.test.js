// AUD-024 follow-up: typing indicators.
//
// Approved contract:
//  - client -> server: `typing:start` / `typing:stop` with `{ channelId }` or
//    `{ conversationId }`
//  - server -> room members: `typing:start` / `typing:stop` (per user) and
//    `typing:update` ({ activeTypingUsers: string[] })
//  - the typing identity is derived from the authenticated socket, never from
//    client-supplied fields
//  - only members of the authorized channel_/conversation_ room may type into it
//
// Driven with a mocked io/socket; the permission resolver and the
// Channel/Conversation/User models are stubbed. No server, database or network.
const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const Channel = require("../../src/models/Channel");
const Conversation = require("../../src/models/Conversation");
const User = require("../../src/models/User");

const ALICE = "64b7f8f2a1b2c3d4e5f60aaa";
const BOB = "64b7f8f2a1b2c3d4e5f60bbb";
const CAROL = "64b7f8f2a1b2c3d4e5f60ccc"; // society B user
const SOC_A = "64b7f8f2a1b2c3d4e5f60001";
const SOC_B = "64b7f8f2a1b2c3d4e5f60002";
const CH_A = "64b7f8f2a1b2c3d4e5f60a01";
const CH_B = "64b7f8f2a1b2c3d4e5f60b01";
const CONV = "64b7f8f2a1b2c3d4e5f60c01"; // ALICE <-> BOB

const NAMES = { [ALICE]: "Alice A", [BOB]: "Bob B", [CAROL]: "Carol C" };

let realChannel;
let realConversation;
let realUserFindById;
let userLookups;
let failNameLookup;

function stubResolver() {
  const resolved = require.resolve(
    path.join(__dirname, "../../src/services/resolvePermissions.js"),
  );
  const scopes = {
    [ALICE]: SOC_A,
    [BOB]: SOC_A,
    [CAROL]: SOC_B,
  };
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {
      resolvePermissions: async (userId) => ({
        role: "ieee_member",
        scope: { type: "society", societyId: scopes[String(userId)] || null },
        permissions: { "community_hub:view": "limited_own_scope" },
      }),
      invalidateCache: () => {},
    },
  };
}

function freshPresence() {
  for (const rel of [
    "../../src/services/presenceService.js",
    "../../src/middleware/rbac.js",
  ]) {
    delete require.cache[require.resolve(path.join(__dirname, rel))];
  }
  return require("../../src/services/presenceService.js");
}

// A tiny io + multi-socket harness that records what is delivered to whom.
function harness() {
  const presence = freshPresence();
  const rooms = new Map(); // room -> Set(socketId)
  const socketsById = new Map();
  const deliveries = []; // { toSocket, event, payload }
  let onConnection;

  const deliverToRoom = (room, event, payload, exceptId) => {
    for (const id of rooms.get(room) || []) {
      if (id !== exceptId) deliveries.push({ toSocket: id, event, payload });
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
          ? deliverToRoom(target, event, payload)
          : deliveries.push({ toSocket: target, event, payload }),
    }),
    sockets: { adapter: { rooms }, sockets: socketsById },
  };
  presence.setupPresenceHandlers(io);

  const connect = (userId) => {
    const handlers = {};
    const socket = {
      id: `sock-${userId}-${socketsById.size}`,
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
      to: (room) => ({
        emit: (event, payload) =>
          deliverToRoom(room, event, payload, socket.id),
      }),
    };
    socketsById.set(socket.id, socket);
    onConnection(socket);
    return socket;
  };

  const fire = async (socket, event, ...args) =>
    socket.handlers[event](...args);
  const deliveredTo = (socket, event) =>
    deliveries.filter((d) => d.toSocket === socket.id && d.event === event);

  return { connect, fire, deliveries, deliveredTo };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  stubResolver();
  userLookups = 0;
  failNameLookup = false;

  realChannel = Channel.findById;
  realConversation = Conversation.findById;
  realUserFindById = User.findById;

  Channel.findById = async (id) =>
    ({
      [CH_A]: { _id: CH_A, societyId: SOC_A },
      [CH_B]: { _id: CH_B, societyId: SOC_B },
    })[id] || null;
  Conversation.findById = async (id) =>
    id === CONV ? { _id: CONV, userOneId: ALICE, userTwoId: BOB } : null;
  User.findById = (id) => {
    const query = {
      select: () => query,
      lean: async () => {
        userLookups += 1;
        if (failNameLookup) throw new Error("database unavailable");
        return NAMES[id] ? { _id: id, name: NAMES[id] } : null;
      },
    };
    return query;
  };
});

afterEach(() => {
  mock.timers.reset();
  Channel.findById = realChannel;
  Conversation.findById = realConversation;
  User.findById = realUserFindById;
});

async function inChannel(h, userId, channelId = CH_A) {
  const socket = h.connect(userId);
  await settle();
  await h.fire(socket, "channel:join", channelId);
  return socket;
}

async function inConversation(h, userId, conversationId = CONV) {
  const socket = h.connect(userId);
  await settle();
  await h.fire(socket, "conversation:join", conversationId);
  return socket;
}

// ---- relay with server-derived identity -----------------------------------------

test("channel typing:start is relayed to other members with the server-derived identity", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);

  await h.fire(alice, "typing:start", { channelId: CH_A });

  const got = h.deliveredTo(bob, "typing:start");
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.channelId, CH_A);
  assert.equal(got[0].payload.userId, ALICE);
  assert.equal(got[0].payload.userName, "Alice A");
  assert.deepEqual(got[0].payload.user, { id: ALICE, name: "Alice A" });
  assert.equal("conversationId" in got[0].payload, false);
  assert.equal(h.deliveredTo(alice, "typing:start").length, 0, "echoed to sender");
});

test("conversation typing:start is relayed to the other participant", async () => {
  const h = harness();
  const alice = await inConversation(h, ALICE);
  const bob = await inConversation(h, BOB);

  await h.fire(alice, "typing:start", { conversationId: CONV });

  const got = h.deliveredTo(bob, "typing:start");
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.conversationId, CONV);
  assert.equal(got[0].payload.userId, ALICE);
  assert.equal(got[0].payload.userName, "Alice A");
  assert.equal("channelId" in got[0].payload, false);
});

test("typing:stop is relayed and clears the user from the active list", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);
  await h.fire(alice, "typing:start", { channelId: CH_A });

  await h.fire(alice, "typing:stop", { channelId: CH_A });

  const stops = h.deliveredTo(bob, "typing:stop");
  assert.equal(stops.length, 1);
  assert.equal(stops[0].payload.userId, ALICE);
  assert.equal(stops[0].payload.channelId, CH_A);

  const updates = h.deliveredTo(bob, "typing:update");
  assert.deepEqual(updates.at(-1).payload.activeTypingUsers, []);
});

test("typing:update carries the active typers' names, excluding the recipient", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);

  await h.fire(alice, "typing:start", { channelId: CH_A });
  await h.fire(bob, "typing:start", { channelId: CH_A });

  const forBob = h.deliveredTo(bob, "typing:update").at(-1).payload;
  const forAlice = h.deliveredTo(alice, "typing:update").at(-1).payload;

  assert.deepEqual(forBob.activeTypingUsers, ["Alice A"]);
  assert.deepEqual(forAlice.activeTypingUsers, ["Bob B"]);
  assert.equal(forBob.channelId, CH_A);
});

// ---- identity spoofing -------------------------------------------------------------

test("AUD-024: client-supplied identity is ignored for channel typing", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);

  await h.fire(alice, "typing:start", {
    channelId: CH_A,
    user: { id: BOB, name: "Mallory", avatar: "x" },
    userId: BOB,
    userName: "Mallory",
  });

  const payload = h.deliveredTo(bob, "typing:start")[0].payload;
  assert.equal(payload.userId, ALICE);
  assert.equal(payload.userName, "Alice A");
  assert.deepEqual(payload.user, { id: ALICE, name: "Alice A" });
  assert.equal(JSON.stringify(h.deliveries).includes("Mallory"), false);
});

test("AUD-024: spoofed identity is ignored through the legacy canvas room as well", async () => {
  // Pre-fix the relay copied payload.user verbatim.
  const h = harness();
  const alice = h.connect(ALICE);
  const bob = h.connect(BOB);
  await settle();
  await h.fire(alice, "room:join", { channelId: CH_A });
  await h.fire(bob, "room:join", { channelId: CH_A });

  await h.fire(alice, "typing:start", {
    channelId: CH_A,
    user: { id: "someone-else", name: "Mallory" },
  });

  const all = JSON.stringify(h.deliveries);
  assert.equal(all.includes("Mallory"), false, "client identity was relayed");
  assert.equal(all.includes("someone-else"), false);
});

// ---- authorization and room membership ---------------------------------------------

test("a user who is not in the channel room cannot type into it", async () => {
  const h = harness();
  const bob = await inChannel(h, BOB);
  const carol = await inChannel(h, CAROL, CH_A); // society B: join is refused

  await h.fire(carol, "typing:start", { channelId: CH_A });

  assert.equal(carol.rooms.has(`channel_${CH_A}`), false);
  assert.equal(h.deliveredTo(bob, "typing:start").length, 0);
  assert.equal(h.deliveredTo(bob, "typing:update").length, 0);
});

test("membership in one channel room does not allow typing into another", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE, CH_A);
  const carol = await inChannel(h, CAROL, CH_B);

  await h.fire(alice, "typing:start", { channelId: CH_B });

  assert.equal(h.deliveredTo(carol, "typing:start").length, 0);
});

test("a non-participant cannot type into a conversation", async () => {
  const h = harness();
  const alice = await inConversation(h, ALICE);
  const carol = await inConversation(h, CAROL); // refused: not a participant

  await h.fire(carol, "typing:start", { conversationId: CONV });

  assert.equal(h.deliveredTo(alice, "typing:start").length, 0);
});

test("a user who merely knows the room name cannot relay into it", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = h.connect(BOB);
  await settle(); // BOB never joins channel_ room

  await h.fire(bob, "typing:start", { channelId: CH_A });

  assert.equal(h.deliveredTo(alice, "typing:start").length, 0);
});

// ---- payload validation -----------------------------------------------------------------

test("malformed typing payloads are ignored without throwing or relaying", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);
  const bad = [
    undefined,
    null,
    42,
    "string",
    [],
    {},
    { channelId: 7 },
    { channelId: "not-an-object-id" },
    { conversationId: ["x"] },
    { channelId: CH_A, conversationId: CONV }, // ambiguous: both set
    { channelId: { $ne: "" } },
  ];

  for (const event of ["typing:start", "typing:stop"]) {
    for (const payload of bad) {
      await assert.doesNotReject(
        async () => h.fire(alice, event, payload),
        `${event} threw for ${JSON.stringify(payload)}`,
      );
    }
  }

  assert.equal(h.deliveredTo(bob, "typing:start").length, 0);
  assert.equal(h.deliveredTo(bob, "typing:stop").length, 0);
  assert.equal(h.deliveredTo(bob, "typing:update").length, 0);
});

test("a name lookup failure fails closed (nothing relayed)", async () => {
  failNameLookup = true;
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);

  await assert.doesNotReject(async () =>
    h.fire(alice, "typing:start", { channelId: CH_A }),
  );

  assert.equal(h.deliveredTo(bob, "typing:start").length, 0);
});

test("the display name is looked up once per connection", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  await inChannel(h, BOB);

  await h.fire(alice, "typing:start", { channelId: CH_A });
  await h.fire(alice, "typing:start", { channelId: CH_A });
  await h.fire(alice, "typing:stop", { channelId: CH_A });

  assert.equal(userLookups, 1);
});

// ---- expiry and disconnect -----------------------------------------------------------------

test("a typer expires after 3 seconds without a stop (ChannelChatFeed never sends one)", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);
  mock.timers.enable({ apis: ["setTimeout"] });

  await h.fire(alice, "typing:start", { channelId: CH_A });
  assert.deepEqual(
    h.deliveredTo(bob, "typing:update").at(-1).payload.activeTypingUsers,
    ["Alice A"],
  );

  mock.timers.tick(3000);

  assert.deepEqual(
    h.deliveredTo(bob, "typing:update").at(-1).payload.activeTypingUsers,
    [],
  );
});

test("a repeated typing:start extends the expiry", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);
  mock.timers.enable({ apis: ["setTimeout"] });

  await h.fire(alice, "typing:start", { channelId: CH_A });
  mock.timers.tick(2000);
  await h.fire(alice, "typing:start", { channelId: CH_A });
  mock.timers.tick(2000); // 4s since the first start, 2s since the second

  assert.deepEqual(
    h.deliveredTo(bob, "typing:update").at(-1).payload.activeTypingUsers,
    ["Alice A"],
  );
});

test("disconnecting removes the user from the active typers", async () => {
  const h = harness();
  const alice = await inChannel(h, ALICE);
  const bob = await inChannel(h, BOB);
  await h.fire(alice, "typing:start", { channelId: CH_A });

  await h.fire(alice, "disconnect");

  assert.deepEqual(
    h.deliveredTo(bob, "typing:update").at(-1).payload.activeTypingUsers,
    [],
  );
});

test("canvas relay is unchanged: room:join + canvas:draw still works for an authorized user", async () => {
  const h = harness();
  const alice = h.connect(ALICE);
  const bob = h.connect(BOB);
  await settle();
  await h.fire(alice, "room:join", { channelId: CH_A });
  await h.fire(bob, "room:join", { channelId: CH_A });

  await h.fire(alice, "canvas:draw", { channelId: CH_A, stroke: { x: 1 } });

  const got = h.deliveredTo(bob, "canvas:draw");
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].payload, { channelId: CH_A, stroke: { x: 1 } });
});
