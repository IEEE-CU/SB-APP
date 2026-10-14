// AUD-024 follow-up: socket handshake authentication.
//
// The inline handshake middleware verified the JWT but, unlike the REST
// `authenticate` middleware, never checked that the user still exists, so a
// token belonging to a deleted account could open a socket until it expired.
//
// Real `jsonwebtoken` is used with a throwaway secret; the User model is
// stubbed. No server, database or network.
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const User = require("../../src/models/User");

const SECRET = "unit-test-secret-not-used-anywhere-else";
const USER_ID = "64b7f8f2a1b2c3d4e5f60aaa";

let savedSecret;
let realFindById;
let existingUsers;
let lookupError;

beforeEach(() => {
  savedSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = SECRET;
  existingUsers = new Set([USER_ID]);
  lookupError = null;
  realFindById = User.findById;
  User.findById = (id) => {
    const query = {
      select: () => query,
      lean: async () => {
        if (lookupError) throw lookupError;
        return existingUsers.has(String(id)) ? { _id: id } : null;
      },
    };
    return query;
  };
});

afterEach(() => {
  User.findById = realFindById;
  if (savedSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedSecret;
});

const { authenticateSocket } = (() => {
  try {
    return require("../../src/middleware/socketAuth");
  } catch {
    return {};
  }
})();

async function handshake(token) {
  assert.equal(
    typeof authenticateSocket,
    "function",
    "authenticateSocket is not exported",
  );
  const socket = { handshake: { auth: token === undefined ? {} : { token } } };
  let result;
  await authenticateSocket(socket, (err) => {
    result = err || null;
  });
  return { socket, error: result };
}

const sign = (payload, options = {}) =>
  jwt.sign(payload, SECRET, { expiresIn: "1h", ...options });

test("a valid token for an existing user is accepted and attached to the socket", async () => {
  const { socket, error } = await handshake(sign({ id: USER_ID, role: "ADMIN" }));

  assert.equal(error, null);
  assert.equal(socket.user.id, USER_ID);
  assert.equal(socket.user.role, "ADMIN");
  assert.equal(typeof socket.user.exp, "number");
});

test("a missing token is rejected with the existing message", async () => {
  const { error } = await handshake(undefined);

  assert.equal(error.message, "Authentication error: Token required");
});

test("an invalid, tampered or wrong-secret token is rejected with the existing message", async () => {
  const bad = [
    "not-a-jwt",
    jwt.sign({ id: USER_ID }, "another-secret"),
    `${sign({ id: USER_ID })}x`,
  ];

  for (const token of bad) {
    const { error, socket } = await handshake(token);
    assert.equal(error.message, "Authentication error: Invalid token");
    assert.equal(socket.user, undefined);
  }
});

test("an expired token is rejected", async () => {
  const token = jwt.sign({ id: USER_ID }, SECRET, { expiresIn: -10 });

  const { error } = await handshake(token);

  assert.equal(error.message, "Authentication error: Invalid token");
});

test("AUD-024: a valid token whose user no longer exists is rejected", async () => {
  existingUsers.clear();

  const { error, socket } = await handshake(sign({ id: USER_ID, role: "OFFICE_BEARER" }));

  assert.equal(error.message, "Authentication error: Invalid token");
  assert.equal(socket.user, undefined);
});

test("a token without a user id is rejected", async () => {
  const { error } = await handshake(sign({ role: "ADMIN" }));

  assert.equal(error.message, "Authentication error: Invalid token");
});

test("a user lookup failure fails closed", async () => {
  lookupError = new Error("database unavailable");

  const { error, socket } = await handshake(sign({ id: USER_ID }));

  assert.equal(error.message, "Authentication error: Invalid token");
  assert.equal(socket.user, undefined);
});
