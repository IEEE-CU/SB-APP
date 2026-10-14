// AUD-024: socket room handling.
//
//  - The REST routes emit message events into `channel_<id>` and
//    `conversation_<id>` rooms, and the frontend asks to join them with
//    `channel:join` / `conversation:join`, but the server had no such
//    handlers, so real-time delivery never reached anyone.
//  - The existing `room:join` joined any client-supplied id with no payload
//    validation and no authorization, and a missing payload threw inside the
//    handler.
//
// The presence handlers are driven with a mocked io/socket; the permission
// resolver and the Channel/Conversation models are stubbed. No Socket.IO
// server, database or network is involved.
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const Channel = require("../../src/models/Channel");
const Conversation = require("../../src/models/Conversation");

const USER = "64b7f8f2a1b2c3d4e5f60aaa";
const OTHER_USER = "64b7f8f2a1b2c3d4e5f60bbb";
const THIRD_USER = "64b7f8f2a1b2c3d4e5f60ccc";
const SOC_A = "64b7f8f2a1b2c3d4e5f60001";
const SOC_B = "64b7f8f2a1b2c3d4e5f60002";
const CH_A = "64b7f8f2a1b2c3d4e5f60a01"; // channel in society A
const CH_B = "64b7f8f2a1b2c3d4e5f60b01"; // channel in society B
const CONV = "64b7f8f2a1b2c3d4e5f60c01"; // conversation USER <-> OTHER_USER

let permissionsBySocietyUser;
let realChannelFindById;
let realConversationFindById;

function stubResolver() {
  const resolved = require.resolve(
    path.join(__dirname, "../../src/services/resolvePermissions.js"),
  );
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {
      resolvePermissions: async (userId) =>
        permissionsBySocietyUser[String(userId)] || {
          role: "guest",
          scope: { type: "none", societyId: null },
          permissions: {},
        },
      invalidateCache: () => {},
    },
  };
}

function freshPresence() {
  const resolved = require.resolve(
    path.join(__dirname, "../../src/services/presenceService.js"),
  );
  delete require.cache[resolved];
  const rbac = require.resolve(
    path.join(__dirname, "../../src/middleware/rbac.js"),
  );
  delete require.cache[rbac];
  return require(resolved);
}

beforeEach(() => {
  stubResolver();
  permissionsBySocietyUser = {
    // member of society A with community hub access
    [USER]: {
      role: "ieee_member",
      scope: { type: "society", societyId: SOC_A },
      permissions: { "community_hub:view": "limited_own_scope" },
    },
    // society A user whose hub permission is none
    [THIRD_USER]: {
      role: "ieee_member",
      scope: { type: "society", societyId: SOC_A },
      permissions: { "community_hub:view": "none" },
    },
    // branch-wide role
    [OTHER_USER]: {
      role: "sb_faculty_advisor",
      scope: { type: "global", societyId: null },
      permissions: { "community_hub:view": "full" },
    },
  };

  realChannelFindById = Channel.findById;
  realConversationFindById = Conversation.findById;
  Channel.findById = async (id) =>
    ({ [CH_A]: { _id: CH_A, societyId: SOC_A }, [CH_B]: { _id: CH_B, societyId: SOC_B } })[
      id
    ] || null;
  Conversation.findById = async (id) =>
    id === CONV ? { _id: CONV, userOneId: USER, userTwoId: OTHER_USER } : null;
});

afterEach(() => {
  Channel.findById = realChannelFindById;
  Conversation.findById = realConversationFindById;
});

// Minimal mock of the parts of io/socket the handlers use.
function connect(userId, presence = freshPresence()) {
  const handlers = {};
  const socket = {
    id: `sock-${userId}`,
    user: { id: userId },
    rooms: new Set(),
    emitted: [],
    handlers,
    on(event, fn) {
      handlers[event] = fn;
    },
    join(room) {
      this.rooms.add(room);
    },
    leave(room) {
      this.rooms.delete(room);
    },
    to(room) {
      return {
        emit: (event, payload) => socket.emitted.push({ room, event, payload }),
      };
    },
  };
  let onConnection;
  const io = {
    on: (event, fn) => {
      if (event === "connection") onConnection = fn;
    },
    emit() {},
    to() {
      return { emit() {} };
    },
  };
  presence.setupPresenceHandlers(io);
  onConnection(socket);
  return socket;
}

// Handlers may be async; await whatever they return.
const fire = async (socket, event, ...args) => {
  assert.equal(typeof socket.handlers[event], "function", `no handler for ${event}`);
  return socket.handlers[event](...args);
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// ---- the event mismatch -------------------------------------------------------

test("channel:join with a raw id joins the channel_<id> room the REST routes emit to", async () => {
  const socket = connect(USER);
  await settle();

  await fire(socket, "channel:join", CH_A);

  assert.equal(socket.rooms.has(`channel_${CH_A}`), true);
});

test("channel:join with a { channelId } payload joins the same room", async () => {
  const socket = connect(USER);
  await settle();

  await fire(socket, "channel:join", { channelId: CH_A });

  assert.equal(socket.rooms.has(`channel_${CH_A}`), true);
});

test("channel:leave removes the room (raw id and object payloads)", async () => {
  const socket = connect(USER);
  await settle();
  await fire(socket, "channel:join", CH_A);

  await fire(socket, "channel:leave", { channelId: CH_A });
  assert.equal(socket.rooms.has(`channel_${CH_A}`), false);

  await fire(socket, "channel:join", CH_A);
  await fire(socket, "channel:leave", CH_A);
  assert.equal(socket.rooms.has(`channel_${CH_A}`), false);
});

test("conversation:join joins conversation_<id> for a participant", async () => {
  const socket = connect(USER);
  await settle();

  await fire(socket, "conversation:join", CONV);

  assert.equal(socket.rooms.has(`conversation_${CONV}`), true);
});

test("conversation:leave removes the room", async () => {
  const socket = connect(USER);
  await settle();
  await fire(socket, "conversation:join", CONV);

  await fire(socket, "conversation:leave", CONV);

  assert.equal(socket.rooms.has(`conversation_${CONV}`), false);
});

// ---- authorization --------------------------------------------------------------

test("AUD-024: a user cannot join a channel of another society", async () => {
  const socket = connect(USER);
  await settle();

  await fire(socket, "channel:join", CH_B);

  assert.equal(socket.rooms.has(`channel_${CH_B}`), false);
});

test("AUD-024: room:join no longer admits a user to another society's channel room", async () => {
  const socket = connect(USER);
  await settle();

  await fire(socket, "room:join", { channelId: CH_B });

  assert.equal(socket.rooms.has(`channel:${CH_B}`), false);
});

test("room:join still admits an authorized user to their own society's channel room", async () => {
  const socket = connect(USER);
  await settle();

  await fire(socket, "room:join", { channelId: CH_A });

  assert.equal(socket.rooms.has(`channel:${CH_A}`), true);
});

test("a user whose community hub permission is none cannot join a channel in their own society", async () => {
  const socket = connect(THIRD_USER);
  await settle();

  await fire(socket, "channel:join", CH_A);
  await fire(socket, "room:join", { channelId: CH_A });

  assert.equal(socket.rooms.has(`channel_${CH_A}`), false);
  assert.equal(socket.rooms.has(`channel:${CH_A}`), false);
});

test("a branch-wide role (empty scope filter) keeps cross-society access", async () => {
  const socket = connect(OTHER_USER);
  await settle();

  await fire(socket, "channel:join", CH_B);

  assert.equal(socket.rooms.has(`channel_${CH_B}`), true);
});

test("AUD-024: a non-participant cannot join a conversation room", async () => {
  const socket = connect(THIRD_USER);
  await settle();

  await fire(socket, "conversation:join", CONV);

  assert.equal(socket.rooms.has(`conversation_${CONV}`), false);
});

test("an unknown channel or conversation is not joined", async () => {
  const socket = connect(USER);
  await settle();
  const missing = "64b7f8f2a1b2c3d4e5f6ffff";

  await fire(socket, "channel:join", missing);
  await fire(socket, "conversation:join", missing);

  // Only the society room joined at connection time (existing behavior).
  assert.deepEqual([...socket.rooms], [`society:${SOC_A}`]);
});

// ---- payload validation ------------------------------------------------------------

test("AUD-024: malformed payloads are rejected safely and never throw", async () => {
  const socket = connect(USER);
  await settle();
  const bad = [
    undefined,
    null,
    42,
    true,
    [],
    {},
    { channelId: 42 },
    { channelId: {} },
    { channelId: ["a"] },
    { channelId: "" },
    { channelId: "not-an-object-id" },
    { channelId: "channel:../../x" },
    "",
    "not-an-object-id",
    "x".repeat(5000),
  ];

  for (const event of ["room:join", "channel:join", "conversation:join"]) {
    for (const payload of bad) {
      await assert.doesNotReject(
        async () => fire(socket, event, payload),
        `${event} threw for ${JSON.stringify(payload)?.slice(0, 40)}`,
      );
    }
  }
  for (const event of ["room:leave", "channel:leave", "conversation:leave"]) {
    for (const payload of bad) {
      await assert.doesNotReject(async () => fire(socket, event, payload));
    }
  }

  // Only the society room joined at connection time (existing behavior).
  assert.deepEqual([...socket.rooms], [`society:${SOC_A}`]);
});

test("a lookup failure is contained (no throw, no join)", async () => {
  Channel.findById = async () => {
    throw new Error("database unavailable");
  };
  const socket = connect(USER);
  await settle();

  await assert.doesNotReject(async () => fire(socket, "channel:join", CH_A));

  assert.equal(socket.rooms.has(`channel_${CH_A}`), false);
});

test("an optional acknowledgement callback receives a failure result", async () => {
  const socket = connect(USER);
  await settle();
  const acks = [];

  await fire(socket, "channel:join", CH_B, (result) => acks.push(result));
  await fire(socket, "channel:join", CH_A, (result) => acks.push(result));

  assert.equal(acks[0].success, false);
  assert.equal(acks[1].success, true);
});

// ---- existing relays keep working ---------------------------------------------------

test("canvas events are relayed only to a member of the room; typing no longer uses that room", async () => {
  const socket = connect(USER);
  await settle();

  await fire(socket, "typing:start", { channelId: CH_A });
  await fire(socket, "canvas:draw", { channelId: CH_A, stroke: { x: 1 } });
  assert.deepEqual(socket.emitted, [], "relayed without membership");

  await fire(socket, "room:join", { channelId: CH_A });
  await fire(socket, "typing:start", { channelId: CH_A });
  await fire(socket, "canvas:draw", { channelId: CH_A, stroke: { x: 1 } });

  // Typing is relayed through the message delivery rooms (see
  // socket-typing.test.js); membership of the canvas room alone is not enough.
  assert.deepEqual(
    socket.emitted.map((e) => [e.room, e.event]),
    [[`channel:${CH_A}`, "canvas:draw"]],
  );
});

test("typing and canvas handlers tolerate missing payloads", async () => {
  const socket = connect(USER);
  await settle();

  for (const event of ["typing:start", "typing:stop", "canvas:draw", "presence:heartbeat"]) {
    await assert.doesNotReject(async () => fire(socket, event, undefined), event);
  }
});

test("disconnect still cleans up presence without throwing", async () => {
  const socket = connect(USER);
  await settle();

  await assert.doesNotReject(async () => fire(socket, "disconnect"));
});
