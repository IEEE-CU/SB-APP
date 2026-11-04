"use strict";

/**
 * SEC-CLOSE-02 over HTTP: accounts are created by an administrator, never by the public.
 *
 * Before: POST /auth/register was open. Anyone could create an OFFICE_BEARER account and
 * receive a working JWT without approval. Now the endpoint requires a valid token that
 * belongs to an ADMIN (middleware order: authenticate, adminOnly, rate limiter, handler).
 * The server fixes the new account's role (OFFICE_BEARER) and leaves it without a society;
 * nothing in the body can choose a role, society or approval state. These tests check the
 * database as well as the responses: a rejected request must create no user, and the
 * response must contain no token.
 *
 * Fixtures: admin (ADMIN), chairA and memberA (OFFICE_BEARER, society A).
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget, withDatabase } = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { TEST_PASSWORD } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const session = createSession(target);
const { societies } = target.ready.fixtures;

const RUN = Date.now();
let counter = 0;
const nextEmail = () => `policy-${RUN}-${++counter}@integration.test`;
const payload = (extra = {}) => ({ name: "Policy Subject", email: nextEmail(), password: TEST_PASSWORD, ...extra });

async function raw(method, route, { token, body } = {}) {
  const res = await fetch(`${target.baseUrl}/api/v1${route}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text };
}
const usersWithEmail = (email) => withDatabase(target, (db) => db.collection("users").find({ email: email.toLowerCase() }).toArray());
const userCount = () => withDatabase(target, (db) => db.collection("users").countDocuments({}));
const hasToken = (res) => /"token"|eyJ[A-Za-z0-9_-]{10,}\./.test(res.text);

describe("who can create an account", () => {
  test("an anonymous request is rejected with 401, creates no user and returns no token", async () => {
    const before = await userCount();
    const body = payload();

    const res = await raw("POST", "/auth/register", { body });

    assert.equal(res.status, 401, res.text.slice(0, 160));
    assert.equal(res.json.success, false);
    assert.equal(hasToken(res), false);
    assert.deepEqual(await usersWithEmail(body.email), []);
    assert.equal(await userCount(), before);
  });

  test("an invalid or malformed token is rejected the same way", async () => {
    const before = await userCount();
    for (const token of ["not-a-jwt", "a.b.c", "x".repeat(300)]) {
      const body = payload();
      const res = await raw("POST", "/auth/register", { token, body });

      assert.equal(res.status, 401, res.text.slice(0, 120));
      assert.equal(hasToken(res), false);
      assert.deepEqual(await usersWithEmail(body.email), []);
    }
    assert.equal(await userCount(), before);
  });

  test("an ordinary authenticated user cannot create accounts (403, nothing created, no token)", async () => {
    const before = await userCount();
    for (const key of ["memberA", "chairA", "chairB", "loner"]) {
      const body = payload();
      const res = await raw("POST", "/auth/register", { token: await session.tokenFor(key), body });

      assert.equal(res.status, 403, `${key}: ${res.text.slice(0, 120)}`);
      assert.equal(hasToken(res), false);
      assert.deepEqual(await usersWithEmail(body.email), [], `${key} created a user`);
    }
    assert.equal(await userCount(), before);
  });

  test("an administrator can still create an account, which then logs in", async () => {
    const body = payload();

    const res = await raw("POST", "/auth/register", { token: await session.tokenFor("admin"), body });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(res.json.data.user.email, body.email);
    assert.equal(res.json.data.user.role, "OFFICE_BEARER");
    const stored = await usersWithEmail(body.email);
    assert.equal(stored.length, 1);
    assert.notEqual(stored[0].password, body.password, "the password must be stored hashed");

    const login = await raw("POST", "/auth/login", { body: { email: body.email, password: body.password } });
    assert.equal(login.status, 200);
    assert.equal(login.json.data.user.role, "OFFICE_BEARER");
    assert.ok(login.json.data.token);
  });
});

describe("the new account's privileges are fixed by the server", () => {
  test("forged role, society and approval fields are ignored, even from an administrator", async () => {
    const body = payload({
      role: "ADMIN",
      societyId: societies.A.id,
      society: societies.A.id,
      approved: true,
      isApproved: true,
      status: "APPROVED",
      roles: ["sb_faculty_advisor"],
      roleName: "sb_faculty_advisor",
      permissions: ["*"],
      isAdmin: true,
    });

    const res = await raw("POST", "/auth/register", { token: await session.tokenFor("admin"), body });

    assert.equal(res.status, 201, res.text.slice(0, 200));
    assert.equal(res.json.data.user.role, "OFFICE_BEARER");
    const [stored] = await usersWithEmail(body.email);
    assert.equal(stored.role, "OFFICE_BEARER");
    assert.ok(!stored.societyId, "a society was assigned from the request body");
    for (const field of ["approved", "isApproved", "status", "roles", "roleName", "permissions", "isAdmin", "society"]) {
      assert.equal(field in stored, false, `${field} was stored`);
    }
    const roleAssignments = await withDatabase(target, (db) => db.collection("userroles").countDocuments({ user: stored._id }));
    assert.equal(roleAssignments, 0, "an RBAC role was assigned");
  });

  test("an ordinary user cannot escalate by forging the same fields", async () => {
    const before = await userCount();
    const body = payload({ role: "ADMIN", societyId: societies.A.id, approved: true });

    const res = await raw("POST", "/auth/register", { token: await session.tokenFor("memberA"), body });

    assert.equal(res.status, 403);
    assert.deepEqual(await usersWithEmail(body.email), []);
    assert.equal(await userCount(), before);
  });

  test("the token issued to an administrator-created account carries only OFFICE_BEARER", async () => {
    const body = payload({ role: "ADMIN" });
    const res = await raw("POST", "/auth/register", { token: await session.tokenFor("admin"), body });

    const claims = JSON.parse(Buffer.from(res.json.data.token.split(".")[1], "base64url").toString("utf8"));
    assert.equal(claims.role, "OFFICE_BEARER");
    const me = await raw("GET", "/users", { token: res.json.data.token });
    assert.equal(me.status, 403, "the new account reached an administrator route");
  });
});

describe("existing validation is preserved for administrators", () => {
  test("short, non-string, missing and duplicate inputs are still rejected and create nothing", async () => {
    const admin = await session.tokenFor("admin");
    const before = await userCount();
    const existing = payload();
    assert.equal((await raw("POST", "/auth/register", { token: admin, body: existing })).status, 201);

    const cases = [
      [payload({ password: "short" }), 400],
      [payload({ name: 5 }), 400],
      [payload({ email: { $ne: null } }), 400],
      [{ name: "No Email", password: TEST_PASSWORD }, 400],
      [{ ...existing, name: "Duplicate" }, 409],
    ];
    for (const [body, status] of cases) {
      const res = await raw("POST", "/auth/register", { token: admin, body });
      assert.equal(res.status, status, `${JSON.stringify(body).slice(0, 80)} -> ${res.status}`);
      assert.equal(hasToken(res), false);
    }
    assert.equal(await userCount(), before + 1);
  });
});

describe("login is unaffected", () => {
  test("fixture users still log in, wrong passwords and unknown users are still 401", async () => {
    assert.ok(await session.tokenFor("chairA"));
    assert.ok(await session.tokenFor("memberA"));

    const wrong = await raw("POST", "/auth/login", { body: { email: "chair.a@integration.test", password: "wrong-password-value" } });
    const unknown = await raw("POST", "/auth/login", { body: { email: "nobody@integration.test", password: TEST_PASSWORD } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
  });

  test("change-password still works for an authenticated user on its own account", async () => {
    const body = payload();
    const created = await raw("POST", "/auth/register", { token: await session.tokenFor("admin"), body });
    const token = created.json.data.token;

    const res = await raw("POST", "/auth/change-password", { token, body: { currentPassword: body.password, newPassword: "another-long-password-9" } });

    assert.equal(res.status, 200, res.text.slice(0, 160));
  });
});

describe("no alternate entry point creates an account", () => {
  test("aliases and look-alike routes are 401/403/404 for anonymous and ordinary callers and create nothing", async () => {
    const before = await userCount();
    const routes = [
      ["POST", "/register"],
      ["POST", "/auth/signup"],
      ["POST", "/auth/users"],
      ["POST", "/auth/register/"],
      ["POST", "/users"],
      ["POST", "/users/register"],
      ["PUT", "/auth/register"],
      ["POST", "/api/v1/auth/register"],
    ];
    for (const [method, route] of routes) {
      for (const token of [undefined, await session.tokenFor("memberA")]) {
        const body = payload();
        const res = await raw(method, route, { token, body });

        assert.ok([401, 403, 404].includes(res.status), `${method} ${route} (${token ? "user" : "anon"}) -> ${res.status}`);
        assert.equal(hasToken(res), false, `${method} ${route} returned a token`);
        assert.deepEqual(await usersWithEmail(body.email), [], `${method} ${route} created a user`);
      }
    }
    assert.equal(await userCount(), before);
  });

  test("there is no administrator route besides /auth/register that creates a user", async () => {
    const admin = await session.tokenFor("admin");
    const before = await userCount();
    for (const [method, route] of [["POST", "/users"], ["POST", "/users/register"], ["POST", "/auth/signup"], ["POST", "/auth/users"]]) {
      const res = await raw(method, route, { token: admin, body: payload() });
      assert.ok([404, 405].includes(res.status) || res.status === 400, `${route} -> ${res.status}`);
    }
    assert.equal(await userCount(), before);
  });
});
