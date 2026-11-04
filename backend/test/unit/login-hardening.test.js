// AUTH-CLOSE-01 (AUD-008): POST /auth/login.
//
// Before: a non-string email (object, array, number, true) reached `email.toLowerCase()` and
// threw (a 500 through the error handler), and "no such account" ("Invalid email address")
// was distinguishable from "wrong password" ("Incorrect password").
//
// Now: anything that is not a pair of non-empty strings within length limits is a 400 and
// never reaches the string methods or the database; an unknown account and a wrong password
// give the same status and body; a throw-away hash is compared when the account does not
// exist, so the two failures do similar work. The route's handler runs with the User model
// replaced, so no database or server is involved (real HTTP, including the rate limiter, is
// covered in login-hardening.integration.test.js).
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const User = require("../../src/models/User");
const realFindOne = User.findOne;
const realCompare = bcrypt.compare;
const authRouter = require("../../src/routes/auth");

let queries;
let account; // what User.findOne resolves to
let compareCalls;
let findOneError;

beforeEach(() => {
  queries = [];
  account = null;
  compareCalls = 0;
  findOneError = null;
  User.findOne = (filter) => {
    queries.push(filter);
    if (findOneError) throw findOneError;
    const chain = { select: () => chain, populate: () => chain, then: (a, b) => Promise.resolve(account).then(a, b) };
    return chain;
  };
  bcrypt.compare = async (...args) => {
    compareCalls += 1;
    return realCompare(...args);
  };
});
test.after(() => {
  User.findOne = realFindOne;
  bcrypt.compare = realCompare;
});

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

// The handler is the last layer of the route; the rate limiter in front of it is exercised
// over real HTTP.
async function login(body) {
  const layer = authRouter.stack.find((l) => l.route && l.route.path === "/login" && l.route.methods.post);
  assert.ok(layer, "no POST /login");
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;
  const res = mockRes();
  let error = null;
  await handler({ body }, res, (err) => {
    error = err;
  });
  return { res, error };
}

const PASSWORD = "a-correct-horse-battery-staple";

test("malformed credentials are a 400, never an exception, and never reach the database", async () => {
  const bad = [
    undefined,
    null,
    "a string body",
    42,
    [],
    {},
    { email: "a@b.test" },
    { password: PASSWORD },
    { email: null, password: PASSWORD },
    { email: {}, password: PASSWORD },
    { email: { $ne: null }, password: PASSWORD },
    { email: ["a@b.test"], password: PASSWORD },
    { email: 5, password: PASSWORD },
    { email: true, password: PASSWORD },
    { email: "a@b.test", password: null },
    { email: "a@b.test", password: {} },
    { email: "a@b.test", password: ["x"] },
    { email: "a@b.test", password: 12345678 },
    { email: "", password: PASSWORD },
    { email: "   ", password: PASSWORD },
    { email: "a@b.test", password: "" },
    { email: `${"a".repeat(300)}@b.test`, password: PASSWORD },
    { email: "a@b.test", password: "x".repeat(2000) },
  ];

  for (const body of bad) {
    const { res, error } = await login(body);

    assert.equal(error, null, `threw for ${JSON.stringify(body)?.slice(0, 60)}`);
    assert.equal(res.statusCode, 400, JSON.stringify(body)?.slice(0, 60));
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "Please provide email and password");
    assert.equal("data" in res.body, false);
  }
  assert.deepEqual(queries, [], "a malformed request reached the database");
  assert.equal(compareCalls, 0);
});

test("an unknown account and a wrong password get the identical status and body", async () => {
  account = null;
  const unknown = await login({ email: "nobody@example.test", password: PASSWORD });

  account = { comparePassword: async () => false };
  const wrong = await login({ email: "someone@example.test", password: PASSWORD });

  assert.equal(unknown.res.statusCode, 401);
  assert.equal(wrong.res.statusCode, 401);
  assert.deepEqual(unknown.res.body, wrong.res.body);
  assert.deepEqual(Object.keys(unknown.res.body).sort(), ["message", "success"]);
  assert.equal(unknown.res.body.message, "Invalid email or password");
});

test("a hash is compared even when the account does not exist (similar work for both failures)", async () => {
  account = null;
  await login({ email: "nobody@example.test", password: PASSWORD });

  assert.equal(compareCalls, 1);
});

test("a valid string email is trimmed and lowercased before the lookup", async () => {
  account = null;
  await login({ email: "  Mixed.Case@Example.Test ", password: PASSWORD });

  assert.deepEqual(queries, [{ email: "mixed.case@example.test" }]);
});

test("correct credentials still produce the unchanged token contract", async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "unit-test-secret";
  account = {
    _id: "64b7f8f2a1b2c3d4e5f6a001",
    email: "someone@example.test",
    name: "Someone",
    role: "OFFICE_BEARER",
    societyId: { _id: "64b7f8f2a1b2c3d4e5f6b001" },
    comparePassword: async (candidate) => candidate === PASSWORD,
  };

  const { res } = await login({ email: "someone@example.test", password: PASSWORD });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body.data).sort(), ["token", "user"]);
  assert.deepEqual(Object.keys(res.body.data.user).sort(), ["email", "id", "name", "role", "societyId"]);
  assert.ok(res.body.data.token);
  assert.equal("password" in res.body.data.user, false);
});

test("a database failure is passed to the error handler, not answered as a login result", async () => {
  findOneError = new Error("db down");

  const { res, error } = await login({ email: "a@b.test", password: PASSWORD });

  assert.equal(error.message, "db down");
  assert.equal(res.body, null);
});
