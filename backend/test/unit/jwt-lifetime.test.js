// JWT lifetime: the default is eight hours; an explicit JWT_EXPIRES_IN is
// honored; sockets disconnect at the token's actual `exp`.
//
// The real login/register handlers are run with the User model stubbed (no
// database) and the resulting token is decoded.
const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const User = require("../../src/models/User");

const SECRET = "unit-test-secret-not-used-anywhere-else";
const USER_ID = "64b7f8f2a1b2c3d4e5f60aaa";

let savedSecret;
let savedLifetime;
let realFindOne;
let realCreate;

beforeEach(() => {
  savedSecret = process.env.JWT_SECRET;
  savedLifetime = process.env.JWT_EXPIRES_IN;
  process.env.JWT_SECRET = SECRET;
  delete process.env.JWT_EXPIRES_IN;

  realFindOne = User.findOne;
  realCreate = User.create;
  const user = {
    _id: USER_ID,
    email: "a@example.org",
    name: "Alice",
    role: "OFFICE_BEARER",
    societyId: null,
    comparePassword: async () => true,
  };
  // login: findOne(...).select(...).populate(...) -> user; register: findOne -> null
  User.findOne = (query) => {
    const chain = {
      select: () => chain,
      populate: () => chain,
      then: (resolve, reject) =>
        Promise.resolve(query.__registering ? null : user).then(resolve, reject),
    };
    return chain;
  };
  User.create = async () => user;
});

afterEach(() => {
  mock.timers.reset();
  User.findOne = realFindOne;
  User.create = realCreate;
  if (savedSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedSecret;
  if (savedLifetime === undefined) delete process.env.JWT_EXPIRES_IN;
  else process.env.JWT_EXPIRES_IN = savedLifetime;
});

function authHandler(routePath) {
  const router = require("../../src/routes/auth");
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods.post,
  );
  assert.ok(layer, `POST ${routePath} not found`);
  return layer.route.stack.at(-1).handle;
}

async function issueToken(routePath, body) {
  const res = {
    body: null,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  let error = null;
  await authHandler(routePath)({ body }, res, (e) => {
    error = e || null;
  });
  assert.equal(error, null);
  assert.ok(res.body?.data?.token, `no token from ${routePath}: ${JSON.stringify(res.body)}`);
  return jwt.verify(res.body.data.token, SECRET);
}

const loginBody = { email: "a@example.org", password: "x" };
const registerBody = {
  name: "Alice",
  email: "new@example.org",
  password: "a-sufficiently-long-password",
};

test("login issues tokens that live eight hours by default", async () => {
  const claims = await issueToken("/login", loginBody);

  assert.equal(claims.exp - claims.iat, 8 * 60 * 60);
});

test("register issues tokens that live eight hours by default", async () => {
  // Make the "existing user" lookup report no match for registration.
  User.findOne = () => ({ then: (resolve) => resolve(null) });
  const claims = await issueToken("/register", registerBody);

  assert.equal(claims.exp - claims.iat, 8 * 60 * 60);
});

test("an explicit JWT_EXPIRES_IN override is preserved", async () => {
  process.env.JWT_EXPIRES_IN = "2h";

  const claims = await issueToken("/login", loginBody);

  assert.equal(claims.exp - claims.iat, 2 * 60 * 60);
});

test("an explicit override longer than the default is also honored", async () => {
  process.env.JWT_EXPIRES_IN = "7d";

  const claims = await issueToken("/login", loginBody);

  assert.equal(claims.exp - claims.iat, 7 * 24 * 60 * 60);
});

// ---- sockets follow the token's actual exp ------------------------------------

function socketHarness(tokenPayload) {
  for (const rel of [
    "../../src/services/presenceService.js",
    "../../src/middleware/rbac.js",
  ]) {
    delete require.cache[require.resolve(path.join(__dirname, rel))];
  }
  const resolvedPath = require.resolve(
    path.join(__dirname, "../../src/services/resolvePermissions.js"),
  );
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports: {
      resolvePermissions: async () => ({
        role: "ieee_member",
        scope: { type: "society", societyId: null },
        permissions: {},
      }),
      invalidateCache: () => {},
    },
  };
  const presence = require("../../src/services/presenceService.js");

  let onConnection;
  const io = {
    on: (event, fn) => {
      if (event === "connection") onConnection = fn;
    },
    emit() {},
    to: () => ({ emit() {} }),
  };
  presence.setupPresenceHandlers(io);

  const handlers = {};
  const socket = {
    id: "sock-1",
    user: tokenPayload,
    rooms: new Set(),
    disconnected: false,
    on(event, fn) {
      handlers[event] = fn;
    },
    join() {},
    leave() {},
    to: () => ({ emit() {} }),
    disconnect() {
      if (this.disconnected) return;
      this.disconnected = true;
      handlers.disconnect?.();
    },
  };
  onConnection(socket);
  return socket;
}

test("a socket authenticated with a default-lifetime token is disconnected at that token's exp", async () => {
  // JWT iat/exp are whole seconds, so start the mocked clock on a second
  // boundary to make the expected disconnect time exact.
  mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Math.floor(Date.now() / 1000) * 1000,
  });
  const claims = await issueToken("/login", loginBody); // iat/exp from mocked clock
  const socket = socketHarness({ id: USER_ID, exp: claims.exp });

  mock.timers.tick(8 * 60 * 60 * 1000 - 1);
  assert.equal(socket.disconnected, false, "disconnected early");

  mock.timers.tick(1);
  assert.equal(socket.disconnected, true);
});

test("a socket with a token longer than the timer limit is still disconnected at exp", async () => {
  mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000_000_000 });
  const thirtyDays = 30 * 24 * 60 * 60;
  const socket = socketHarness({
    id: USER_ID,
    exp: Math.floor(Date.now() / 1000) + thirtyDays,
  });

  mock.timers.tick((thirtyDays - 1) * 1000);
  assert.equal(socket.disconnected, false);

  mock.timers.tick(1000);
  assert.equal(socket.disconnected, true);
});
