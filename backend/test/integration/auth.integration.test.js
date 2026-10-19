"use strict";

/**
 * Phase 2.2: health and authentication, over real HTTP, against the isolated
 * integration harness (127.0.0.1:5057, disposable in-memory MongoDB).
 *
 * Run (the harness must already be running; see helpers/target.js):
 *   TEST_BASE_URL=http://127.0.0.1:5057 TEST_READY_FILE=<ready-file> \
 *     node --test test/integration/auth.integration.test.js
 *
 * Passwords and tokens are never printed. Credentials come from the shared
 * fixture module; nothing is duplicated here.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const { requireHarnessTarget, deleteDisposableUser } = require("./helpers/target");
const { TEST_JWT_SECRET, TEST_PASSWORD, USERS } = require("./helpers/fixtures");

const target = requireHarnessTarget(); // throws (fails the run) if unsafe
const { api, ready } = target;
const fixtureUsers = ready.fixtures.users;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jsonHeaders = { "Content-Type": "application/json" };
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function login(email, password) {
  const res = await api("/auth/login", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  });
  return { res, body: await res.json() };
}

async function me(headers) {
  const res = await api("/auth/me", { headers });
  return { res, body: await res.json() };
}

/** Never put a token or password into an assertion message. */
const noSecrets = (value) => {
  const text = JSON.stringify(value);
  assert.equal(/\$2[aby]\$/.test(text), false, "response contains a password hash");
  assert.equal(text.includes(TEST_PASSWORD), false, "response contains the password");
};

describe("health", () => {
  test("GET /api/v1/health reports a connected database", async () => {
    const res = await api("/health");
    const body = await res.json();

    assert.equal(
      res.status,
      200,
      `health returned ${res.status}: ${JSON.stringify(body)}`,
    );
    assert.equal(body.success, true);
    assert.equal(body.db, "connected", `database state: ${body.db}`);
    assert.equal(body.message, "IEEE Campus Community Hub API is running");
    assert.equal(typeof body.pid, "number");
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)), "timestamp is not a date");
    assert.equal(body.pid, ready.pid, "health is served by the harness process");
  });

  test("the health endpoint is not authenticated and sets no cookies", async () => {
    const res = await api("/health", { headers: { Authorization: "Bearer not-a-token" } });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("set-cookie"), null);
  });
});

describe("login", () => {
  test("A. valid credentials return a usable token and the user", async () => {
    const { res, body } = await login(USERS.chairA.email, TEST_PASSWORD);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(typeof body.data.token, "string");
    assert.equal(body.data.token.split(".").length, 3, "token is not a JWT");
    assert.equal(body.data.user.email, USERS.chairA.email);
    assert.equal(body.data.user.role, USERS.chairA.role);
    assert.equal(body.data.user.name, USERS.chairA.name);
    assert.equal(body.data.user.id, fixtureUsers.chairA.id);
    assert.equal(body.data.user.societyId, ready.fixtures.societies.A.id);
    noSecrets({ ...body, data: { ...body.data, token: undefined } });
    assert.equal("password" in body.data.user, false);

    // The token verifies with the harness's secret and names this user.
    const claims = jwt.verify(body.data.token, TEST_JWT_SECRET);
    assert.equal(claims.id, fixtureUsers.chairA.id);
    assert.equal(claims.role, USERS.chairA.role);
    assert.ok(claims.exp > claims.iat, "token has no expiry");
  });

  test("A. a login token authenticates a protected request", async () => {
    const { body } = await login(USERS.admin.email, TEST_PASSWORD);

    const result = await me(bearer(body.data.token));

    assert.equal(result.res.status, 200);
  });

  test("B. a wrong password is rejected with 401 and discloses nothing", async () => {
    const { res, body } = await login(USERS.chairA.email, `${TEST_PASSWORD}-wrong`);

    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, "Incorrect password");
    assert.equal("data" in body, false, "a failed login returned data");
    noSecrets(body);
    assert.equal(JSON.stringify(body).includes("token"), false);
  });

  test("B. an unknown e-mail is rejected with 401", async () => {
    const { res, body } = await login("nobody@integration.test", TEST_PASSWORD);

    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.equal("data" in body, false);
    noSecrets(body);
  });

  test("B. missing credentials are rejected with 400", async () => {
    const { res, body } = await login(undefined, undefined);

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
  });

  // KNOWN ISSUE (recorded, not changed): the two failure messages differ
  // ("Invalid email address" vs "Incorrect password"), so the endpoint reveals
  // whether an account exists. This test states the desired behavior and is a
  // `todo`, so it documents the gap without failing the run or changing login.
  test(
    "B. unknown e-mail and wrong password are indistinguishable (account enumeration)",
    { todo: "login reveals whether an e-mail has an account" },
    async () => {
      const wrongPassword = await login(USERS.chairA.email, `${TEST_PASSWORD}-wrong`);
      const unknownEmail = await login("nobody@integration.test", TEST_PASSWORD);

      assert.equal(unknownEmail.res.status, wrongPassword.res.status);
      assert.equal(unknownEmail.body.message, wrongPassword.body.message);
    },
  );
});

describe("GET /auth/me", () => {
  test("C. returns the authenticated user matching the login fixture", async () => {
    const { body: loginBody } = await login(USERS.chairB.email, TEST_PASSWORD);

    const { res, body } = await me(bearer(loginBody.data.token));

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.user.email, USERS.chairB.email);
    assert.equal(body.user.name, USERS.chairB.name);
    assert.equal(body.user.role, USERS.chairB.role);
    assert.equal(body.user.id, fixtureUsers.chairB.id);
    const society = body.user.societyId;
    assert.equal(String(society._id ?? society.id ?? society), ready.fixtures.societies.B.id);
    assert.equal("password" in body.user, false);
    noSecrets(body);
  });

  test("C. an administrator without a society is returned with a null society", async () => {
    const { body: loginBody } = await login(USERS.admin.email, TEST_PASSWORD);

    const { res, body } = await me(bearer(loginBody.data.token));

    assert.equal(res.status, 200);
    assert.equal(body.user.id, fixtureUsers.admin.id);
    assert.equal(body.user.role, "ADMIN");
    assert.equal(body.user.societyId, null);
  });

  test("C. no Authorization header is rejected with 401", async () => {
    const { res, body } = await me({});

    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, "Access denied. No token provided.");
  });

  test("C. a non-Bearer Authorization header is rejected with 401", async () => {
    const { res, body } = await me({ Authorization: "Basic Zm9vOmJhcg==" });

    assert.equal(res.status, 401);
    assert.equal(body.message, "Access denied. No token provided.");
  });

  test("C. an invalid token is rejected with 401", async () => {
    for (const token of ["not-a-jwt", "a.b.c"]) {
      const { res, body } = await me(bearer(token));
      assert.equal(res.status, 401);
      assert.equal(body.success, false);
      assert.equal(body.message, "Invalid token.");
    }
  });

  test("C. a token signed with a different secret is rejected with 401", async () => {
    const forged = jwt.sign(
      { id: fixtureUsers.admin.id, role: "ADMIN" },
      "some-other-secret-value-of-sufficient-length",
      { expiresIn: "1h" },
    );

    const { res, body } = await me(bearer(forged));

    assert.equal(res.status, 401);
    assert.equal(body.message, "Invalid token.");
  });

  test("C. a tampered token (altered payload) is rejected with 401", async () => {
    const { body: loginBody } = await login(USERS.chairA.email, TEST_PASSWORD);
    const [header, , signature] = loginBody.data.token.split(".");
    const payload = Buffer.from(
      JSON.stringify({ id: fixtureUsers.admin.id, role: "ADMIN" }),
    ).toString("base64url");

    const { res, body } = await me(bearer(`${header}.${payload}.${signature}`));

    assert.equal(res.status, 401);
    assert.equal(body.message, "Invalid token.");
  });
});

describe("token lifetime and account existence", () => {
  test("D. an expired JWT is rejected with 401 'Token expired.'", async () => {
    const token = jwt.sign(
      { id: fixtureUsers.chairA.id, role: "OFFICE_BEARER" },
      TEST_JWT_SECRET,
      { expiresIn: 1 },
    );
    const { exp } = jwt.decode(token);

    // Control: the same token is accepted while it is still valid.
    const whileValid = await me(bearer(token));
    assert.equal(whileValid.res.status, 200, "token was not valid before expiry");

    // Wait until the wall clock is strictly past exp (the server shares it).
    while (Date.now() / 1000 <= exp + 0.5) {
      await sleep(100);
    }
    assert.ok(Date.now() / 1000 > exp, "token is not yet expired");

    const { res, body } = await me(bearer(token));

    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.message, "Token expired.");
  });

  test("E. a valid token for a deleted user is rejected with 401", async () => {
    // Disposable user created through the public registration endpoint.
    const email = `deleted-user-${Date.now()}@integration.test`;
    const registration = await api("/auth/register", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: "Disposable User", email, password: TEST_PASSWORD }),
    });
    const registered = await registration.json();
    assert.equal(registration.status, 201, "could not create the disposable user");
    const userId = registered.data.user.id;

    // A valid, non-expired token for that user id, signed like the app does.
    const token = jwt.sign({ id: userId, role: "OFFICE_BEARER" }, TEST_JWT_SECRET, {
      expiresIn: "1h",
    });

    // Control: accepted while the user exists.
    const whileExists = await me(bearer(token));
    assert.equal(whileExists.res.status, 200);
    assert.equal(whileExists.body.user.email, email);

    // Delete exactly that test-created user from the disposable database.
    const deleted = await deleteDisposableUser(target, userId, email);
    assert.equal(deleted, 1, "the disposable user was not deleted");

    const { res, body } = await me(bearer(token));

    assert.equal(res.status, 401, "a token for a deleted user was accepted");
    assert.equal(body.success, false);
    assert.equal(body.message, "Invalid token. User not found.");

    // The deleted user's e-mail can no longer log in either.
    const relogin = await login(email, TEST_PASSWORD);
    assert.equal(relogin.res.status, 401);
  });
});

describe("health after authentication traffic", () => {
  test("the health endpoint is still healthy after the authentication tests", async () => {
    const res = await api("/health");
    const body = await res.json();

    assert.equal(res.status, 200, `health returned ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body.db, "connected");
    assert.equal(body.success, true);
  });
});
