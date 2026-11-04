// AUD-007: live sockets are re-authorized after the permission matrix changes.
//
// Reproduced before the fix: after an administrator set a role's community_hub:view to "none",
// every HTTP request of that role was refused at once, but its already-connected sockets kept
// the channel rooms they had joined and kept receiving every message (and could keep typing
// into them) until they disconnected. reauthorizeLiveSockets() re-checks each live socket's
// channel rooms with the same rule as joining and removes the ones no longer allowed.
//
// io, sockets, the permission resolver and the models are replaced; no database or server.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ALICE = "64b7f8f2a1b2c3d4e5f60aaa"; // keeps access
const BOB = "64b7f8f2a1b2c3d4e5f60bbb"; // revoked
const GONE = "64b7f8f2a1b2c3d4e5f60ccc"; // user no longer exists
const OTHER = "64b7f8f2a1b2c3d4e5f60ddd"; // resolver throws
const SOC_A = "64b7f8f2a1b2c3d4e5f60001";
const SOC_B = "64b7f8f2a1b2c3d4e5f60002";
const CH_A = "64b7f8f2a1b2c3d4e5f6c001"; // society A
const CH_B = "64b7f8f2a1b2c3d4e5f6c002"; // society B
const CONV = "64b7f8f2a1b2c3d4e5f6d001";

let permissions; // userId -> { hub: boolean, society }
let existing;
let userLookupFails;

function stubResolver() {
  const resolved = require.resolve(path.join(__dirname, "../../src/services/resolvePermissions.js"));
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: {
      resolvePermissions: async (userId) => {
        if (String(userId) === OTHER) throw new Error("resolver unavailable");
        const entry = permissions[String(userId)] || { hub: false, society: SOC_A };
        return {
          role: "ieee_member",
          scope: { type: "society", societyId: entry.society },
          permissions: entry.hub ? { "community_hub:view": "limited_own_scope" } : {},
        };
      },
      invalidateCache: () => {},
    },
  };
}

function load() {
  for (const rel of ["../../src/services/presenceService.js", "../../src/middleware/rbac.js"]) {
    delete require.cache[require.resolve(path.join(__dirname, rel))];
  }
  const Channel = require("../../src/models/Channel");
  const User = require("../../src/models/User");
  Channel.findById = async (id) => ({ _id: id, societyId: String(id) === CH_B ? SOC_B : SOC_A });
  User.findById = (id) => {
    const chain = {
      select: () => chain,
      lean: async () => {
        if (userLookupFails) throw new Error("db down");
        return existing.has(String(id)) ? { _id: id } : null;
      },
    };
    return chain;
  };
  return require("../../src/services/presenceService.js");
}

function fakeSocket(userId, rooms) {
  const socket = {
    id: `sock-${userId}`,
    user: { id: userId },
    rooms: new Set(rooms),
    disconnected: false,
    leave(room) {
      this.rooms.delete(room);
    },
    disconnect() {
      this.disconnected = true;
    },
  };
  return socket;
}
const ioOf = (...sockets) => ({ sockets: { sockets: new Map(sockets.map((s) => [s.id, s])) } });

beforeEach(() => {
  permissions = { [ALICE]: { hub: true, society: SOC_A }, [BOB]: { hub: false, society: SOC_A } };
  existing = new Set([ALICE, BOB, OTHER]);
  userLookupFails = false;
  stubResolver();
});

const rooms = () => [`channel_${CH_A}`, `channel:${CH_A}`, `conversation_${CONV}`, `society:${SOC_A}`, `socket-own-room`];

test("a revoked user leaves their channel rooms (delivery and typing/canvas) and keeps the rest", async () => {
  const { reauthorizeLiveSockets } = load();
  const bob = fakeSocket(BOB, rooms());
  const alice = fakeSocket(ALICE, rooms());

  const summary = await reauthorizeLiveSockets(ioOf(bob, alice));

  assert.deepEqual([...bob.rooms].sort(), [`conversation_${CONV}`, `society:${SOC_A}`, "socket-own-room"].sort());
  assert.deepEqual([...alice.rooms].sort(), rooms().sort(), "an authorized user lost a room");
  assert.deepEqual(summary, { checked: 2, left: 2, disconnected: 0 });
  assert.equal(bob.disconnected, false);
});

test("a channel outside the user's society scope is left even if the permission is held", async () => {
  const { reauthorizeLiveSockets } = load();
  const alice = fakeSocket(ALICE, [`channel_${CH_A}`, `channel_${CH_B}`]);

  await reauthorizeLiveSockets(ioOf(alice));

  assert.deepEqual([...alice.rooms], [`channel_${CH_A}`]);
});

test("a socket whose user no longer exists is disconnected", async () => {
  const { reauthorizeLiveSockets } = load();
  const gone = fakeSocket(GONE, rooms());
  const alice = fakeSocket(ALICE, rooms());

  const summary = await reauthorizeLiveSockets(ioOf(gone, alice));

  assert.equal(gone.disconnected, true);
  assert.equal(alice.disconnected, false);
  assert.deepEqual(summary, { checked: 2, left: 0, disconnected: 1 });
});

test("a failing permission lookup fails closed for that socket and does not stop the others", async () => {
  const { reauthorizeLiveSockets } = load();
  const other = fakeSocket(OTHER, [`channel_${CH_A}`, `conversation_${CONV}`]);
  const alice = fakeSocket(ALICE, [`channel_${CH_A}`]);
  const bob = fakeSocket(BOB, [`channel_${CH_A}`]);

  await reauthorizeLiveSockets(ioOf(other, alice, bob));

  assert.deepEqual([...other.rooms], [`conversation_${CONV}`]);
  assert.deepEqual([...alice.rooms], [`channel_${CH_A}`]);
  assert.deepEqual([...bob.rooms], []);
});

test("a failing user lookup is not treated as a deleted user", async () => {
  const { reauthorizeLiveSockets } = load();
  userLookupFails = true;
  const alice = fakeSocket(ALICE, [`channel_${CH_A}`]);

  await reauthorizeLiveSockets(ioOf(alice));

  assert.equal(alice.disconnected, false);
  assert.deepEqual([...alice.rooms], [`channel_${CH_A}`]);
});

test("rooms that are not channel rooms, or have malformed ids, are ignored", async () => {
  const { reauthorizeLiveSockets } = load();
  const bob = fakeSocket(BOB, ["channel_not-an-id", "channel_", "channelX" + CH_A, `conversation_${CONV}`, `society:${SOC_A}`]);

  const summary = await reauthorizeLiveSockets(ioOf(bob));

  assert.equal(summary.left, 0);
  assert.equal(bob.rooms.size, 5);
});

test("sockets without an identity and an io without sockets are harmless", async () => {
  const { reauthorizeLiveSockets } = load();
  const anonymous = fakeSocket(undefined, [`channel_${CH_A}`]);
  anonymous.user = {};

  assert.deepEqual(await reauthorizeLiveSockets(ioOf(anonymous)), { checked: 0, left: 0, disconnected: 0 });
  assert.deepEqual(await reauthorizeLiveSockets({}), { checked: 0, left: 0, disconnected: 0 });
  assert.deepEqual(await reauthorizeLiveSockets(null), { checked: 0, left: 0, disconnected: 0 });
  assert.equal(anonymous.rooms.size, 1);
});

test("restoring the permission lets the user join again through the normal join path (nothing is cached against them)", async () => {
  const { reauthorizeLiveSockets } = load();
  const bob = fakeSocket(BOB, [`channel_${CH_A}`]);
  await reauthorizeLiveSockets(ioOf(bob));
  assert.equal(bob.rooms.size, 0);

  permissions[BOB] = { hub: true, society: SOC_A };
  const again = fakeSocket(BOB, [`channel_${CH_A}`]);
  await reauthorizeLiveSockets(ioOf(again));

  assert.deepEqual([...again.rooms], [`channel_${CH_A}`]);
});
