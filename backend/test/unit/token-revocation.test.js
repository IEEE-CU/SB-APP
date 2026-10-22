// AUD-007B: tokens issued before a password change or administrator reset are refused.
//
// Reproduced before the change: after a self-service change or an admin reset, the old token
// kept working (200) until it expired. Now User.passwordChangedAt is stamped with the new hash
// and authenticate / authenticateSocket refuse any token issued at or before that second, using
// the user record they already load (no extra query).
//
// Pure functions, the real middleware with the User model replaced, and the socket helper with
// fake sockets: no database or server. The end-to-end behavior is in
// password-revocation.integration.test.js.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const { isTokenRevoked, signAuthToken } = require("../../src/utils/authTokens");
const User = require("../../src/models/User");
const { authenticate } = require("../../src/middleware/auth");
const { authenticateSocket } = require("../../src/middleware/socketAuth");
const { disconnectUserSockets } = require("../../src/services/presenceService");

const SECRET = "token-revocation-unit-test-only-0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const ID = "64b7f8f2a1b2c3d4e5f6a001";
const T = Date.UTC(2026, 5, 15, 10, 0, 7, 500); // 10:00:07.500
const SEC = Math.floor(T / 1000);

let savedSecret;
let savedExpiry;
beforeEach(() => {
  savedSecret = process.env.JWT_SECRET;
  savedExpiry = process.env.JWT_EXPIRES_IN;
  process.env.JWT_SECRET = SECRET;
  delete process.env.JWT_EXPIRES_IN;
});
test.after(() => {
  if (savedSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedSecret;
  if (savedExpiry === undefined) delete process.env.JWT_EXPIRES_IN;
  else process.env.JWT_EXPIRES_IN = savedExpiry;
});

// ---- the comparison --------------------------------------------------------------------------------

test("an account without a marker is never affected, whatever the token carries", () => {
  for (const user of [{}, { passwordChangedAt: undefined }, { passwordChangedAt: null }, null, undefined]) {
    for (const decoded of [{ iat: 1 }, { iat: SEC }, {}, { iat: "x" }, undefined]) {
      assert.equal(isTokenRevoked(decoded, user), false);
    }
  }
});

test("tokens issued before or in the same second as the change are revoked; the next second is accepted", () => {
  const user = { passwordChangedAt: new Date(T) };

  assert.equal(isTokenRevoked({ iat: SEC - 3600 }, user), true);
  assert.equal(isTokenRevoked({ iat: SEC - 1 }, user), true);
  assert.equal(isTokenRevoked({ iat: SEC }, user), true, "a token minted in the second of the change survived");
  assert.equal(isTokenRevoked({ iat: SEC + 1 }, user), false);
  assert.equal(isTokenRevoked({ iat: SEC + 3600 }, user), false);
});

test("sub-second positions inside the second behave the same (.000 and .999)", () => {
  for (const ms of [0, 1, 500, 999]) {
    const user = { passwordChangedAt: new Date(Date.UTC(2026, 5, 15, 10, 0, 7, ms)) };

    assert.equal(isTokenRevoked({ iat: SEC }, user), true, `ms ${ms}`);
    assert.equal(isTokenRevoked({ iat: SEC + 1 }, user), false, `ms ${ms}`);
  }
});

test("for an account with a marker, a missing or malformed iat is refused", () => {
  const user = { passwordChangedAt: new Date(T) };

  for (const decoded of [{}, { iat: null }, { iat: undefined }, { iat: "1781517608" }, { iat: NaN }, { iat: Infinity }, { iat: {} }, { iat: [SEC + 5] }, null, undefined]) {
    assert.equal(isTokenRevoked(decoded, user), true, JSON.stringify(decoded));
  }
});

test("the marker may be a Date or an ISO string; an unreadable marker fails closed", () => {
  assert.equal(isTokenRevoked({ iat: SEC }, { passwordChangedAt: new Date(T).toISOString() }), true);
  assert.equal(isTokenRevoked({ iat: SEC + 1 }, { passwordChangedAt: new Date(T).toISOString() }), false);
  assert.equal(isTokenRevoked({ iat: SEC + 99 }, { passwordChangedAt: new Date("garbage") }), true);
  assert.equal(isTokenRevoked({ iat: SEC + 99 }, { passwordChangedAt: "garbage" }), true);
});

// ---- signing ---------------------------------------------------------------------------------------------

test("tokens for accounts without a marker are signed exactly as before: { id, role }, 8 hours", () => {
  const token = signAuthToken({ _id: ID, role: "OFFICE_BEARER" });
  const claims = jwt.verify(token, SECRET);

  assert.deepEqual(Object.keys(claims).sort(), ["exp", "iat", "id", "role"]);
  assert.equal(claims.id, ID);
  assert.equal(claims.role, "OFFICE_BEARER");
  assert.equal(claims.exp - claims.iat, 8 * 3600);
  assert.ok(Math.abs(claims.iat - Math.floor(Date.now() / 1000)) <= 2);
});

test("JWT_EXPIRES_IN is still honoured, and the signature is still HS256 with the configured secret", () => {
  process.env.JWT_EXPIRES_IN = "2h";
  const token = signAuthToken({ _id: ID, role: "ADMIN" });

  assert.equal(jwt.decode(token, { complete: true }).header.alg, "HS256");
  const claims = jwt.verify(token, SECRET);
  assert.equal(claims.exp - claims.iat, 2 * 3600);
  assert.throws(() => jwt.verify(token, "another-secret-of-adequate-length-xxxxxxxx"), /invalid signature/);
});

test("a token signed right after a change is accepted, even in the same second; the previous one is not", () => {
  const now = Date.UTC(2026, 5, 15, 10, 0, 7, 900);
  const clock = mock.method(Date, "now", () => now);
  try {
    const before = jwt.sign({ id: ID, role: "OFFICE_BEARER" }, SECRET, { expiresIn: "8h" }); // iat = 10:00:07
    const user = { _id: ID, role: "OFFICE_BEARER", passwordChangedAt: new Date(now) };

    const replacement = signAuthToken(user);

    assert.equal(isTokenRevoked(jwt.decode(before), user), true, "the old same-second token survived");
    const claims = jwt.decode(replacement);
    assert.equal(isTokenRevoked(claims, user), false, "the replacement token is refused");
    assert.equal(claims.iat, Math.floor(now / 1000) + 1);
    assert.equal(claims.exp - claims.iat, 8 * 3600);
  } finally {
    clock.mock.restore();
  }
});

test("once time has moved on, the replacement token uses the current second", () => {
  const marker = new Date(Date.now() - 60_000);
  const claims = jwt.decode(signAuthToken({ _id: ID, role: "ADMIN", passwordChangedAt: marker }));

  assert.ok(Math.abs(claims.iat - Math.floor(Date.now() / 1000)) <= 2);
  assert.equal(isTokenRevoked(claims, { passwordChangedAt: marker }), false);
});

// ---- HTTP middleware -------------------------------------------------------------------------------------

function stubUser(user) {
  const real = User.findById;
  User.findById = () => ({ populate: async () => user, select: () => ({ lean: async () => user }) });
  return () => {
    User.findById = real;
  };
}
async function runAuthenticate(token) {
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const req = { headers: { authorization: `Bearer ${token}` } };
  let passed = false;
  await authenticate(req, res, () => {
    passed = true;
  });
  return { passed, res, req };
}

test("authenticate: an old token is refused with 401 after a change, the replacement and a marker-less account pass", async () => {
  const marker = new Date(Date.now());
  const markerSec = Math.floor(marker.getTime() / 1000);
  const oldToken = jwt.sign({ id: ID, role: "OFFICE_BEARER", iat: markerSec - 5 }, SECRET, { expiresIn: "8h" });
  const sameSecond = jwt.sign({ id: ID, role: "OFFICE_BEARER", iat: markerSec }, SECRET, { expiresIn: "8h" });
  const fresh = jwt.sign({ id: ID, role: "OFFICE_BEARER", iat: markerSec + 1 }, SECRET, { expiresIn: "8h" });
  const restore = stubUser({ _id: ID, role: "OFFICE_BEARER", passwordChangedAt: marker });
  try {
    for (const token of [oldToken, sameSecond]) {
      const result = await runAuthenticate(token);
      assert.equal(result.passed, false);
      assert.equal(result.res.statusCode, 401);
      assert.equal(result.res.body.success, false);
      assert.equal(result.req.user, undefined, "a revoked token still attached a user");
    }
    assert.equal((await runAuthenticate(fresh)).passed, true);
  } finally {
    restore();
  }

  const restoreLegacy = stubUser({ _id: ID, role: "OFFICE_BEARER" });
  try {
    assert.equal((await runAuthenticate(oldToken)).passed, true, "an account with no marker must keep authenticating");
  } finally {
    restoreLegacy();
  }
});

test("authenticate: signature, expiry and format checks still come first", async () => {
  const restore = stubUser({ _id: ID, role: "OFFICE_BEARER" });
  try {
    const cases = {
      wrongSecret: jwt.sign({ id: ID }, "another-secret-of-adequate-length-xxxxxxxx"),
      expired: jwt.sign({ id: ID }, SECRET, { expiresIn: -60 }),
      malformed: "not.a.jwt",
    };
    for (const [name, token] of Object.entries(cases)) {
      const result = await runAuthenticate(token);

      assert.equal(result.passed, false, name);
      assert.equal(result.res.statusCode, 401, name);
    }
  } finally {
    restore();
  }
});

// ---- socket handshake --------------------------------------------------------------------------------------

async function runHandshake(token) {
  const socket = { handshake: { auth: { token } } };
  let error = null;
  await authenticateSocket(socket, (err) => {
    error = err || null;
  });
  return { socket, error };
}

test("authenticateSocket: refuses a token issued before the change, accepts the replacement and marker-less accounts", async () => {
  const marker = new Date();
  const markerSec = Math.floor(marker.getTime() / 1000);
  const oldToken = jwt.sign({ id: ID, iat: markerSec - 5 }, SECRET, { expiresIn: "8h" });
  const sameSecond = jwt.sign({ id: ID, iat: markerSec }, SECRET, { expiresIn: "8h" });
  const fresh = jwt.sign({ id: ID, iat: markerSec + 1 }, SECRET, { expiresIn: "8h" });
  const restore = stubUser({ _id: ID, passwordChangedAt: marker });
  try {
    for (const token of [oldToken, sameSecond]) {
      const { socket, error } = await runHandshake(token);
      assert.equal(error.message, "Authentication error: Invalid token");
      assert.equal(socket.user, undefined);
    }
    const accepted = await runHandshake(fresh);
    assert.equal(accepted.error, null);
    assert.equal(accepted.socket.user.id, ID);
  } finally {
    restore();
  }
  const restoreLegacy = stubUser({ _id: ID });
  try {
    assert.equal((await runHandshake(oldToken)).error, null);
  } finally {
    restoreLegacy();
  }
});

// ---- closing a user's sockets -----------------------------------------------------------------------------------

function fakeSocket(id, userId, { failing = false } = {}) {
  return {
    id,
    user: { id: userId },
    closed: false,
    disconnect() {
      if (failing) throw new Error("transport already closed");
      this.closed = true;
    },
  };
}
const ioWith = (...sockets) => ({ sockets: { sockets: new Map(sockets.map((s) => [s.id, s])) } });

test("disconnectUserSockets closes every socket of that user and nobody else's", () => {
  const a1 = fakeSocket("s1", ID);
  const a2 = fakeSocket("s2", ID);
  const other = fakeSocket("s3", "64b7f8f2a1b2c3d4e5f6a002");

  const summary = disconnectUserSockets(ioWith(a1, a2, other), ID);

  assert.deepEqual(summary, { matched: 2, disconnected: 2, failed: 0 });
  assert.deepEqual([a1.closed, a2.closed, other.closed], [true, true, false]);
});

test("ids are compared as strings (ObjectId or string), and a socket without identity is never matched", () => {
  const objectIdLike = { toString: () => ID };
  const byObject = fakeSocket("s1", objectIdLike);
  const anonymous = { id: "s2", user: {}, disconnect() { this.closed = true; } };

  const summary = disconnectUserSockets(ioWith(byObject, anonymous), ID);

  assert.equal(summary.matched, 1);
  assert.equal(byObject.closed, true);
  assert.equal(anonymous.closed, undefined);
});

test("a socket that fails to close is counted and logged without its token or the others being skipped", () => {
  const failing = fakeSocket("s1", ID, { failing: true });
  const good = fakeSocket("s2", ID);
  const logged = [];
  const realError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  let summary;
  try {
    summary = disconnectUserSockets(ioWith(failing, good), ID);
  } finally {
    console.error = realError;
  }

  assert.deepEqual(summary, { matched: 2, disconnected: 1, failed: 1 });
  assert.equal(good.closed, true);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /s1/);
  assert.match(logged[0], /transport already closed/);
});

test("an io without sockets, a missing io and a missing user id are harmless", () => {
  assert.deepEqual(disconnectUserSockets({}, ID), { matched: 0, disconnected: 0, failed: 0 });
  assert.deepEqual(disconnectUserSockets(null, ID), { matched: 0, disconnected: 0, failed: 0 });
  assert.deepEqual(disconnectUserSockets(ioWith(fakeSocket("s1", ID)), undefined), { matched: 0, disconnected: 0, failed: 0 });
});
