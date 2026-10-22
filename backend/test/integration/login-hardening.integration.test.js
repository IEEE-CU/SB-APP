"use strict";

/**
 * AUTH-CLOSE-01 (AUD-008) over HTTP: POST /auth/login.
 *
 * Before: a non-string email crashed the handler (a 500) and an unknown e-mail
 * ("Invalid email address") differed from a wrong password ("Incorrect password").
 * Now malformed input is a 400, and an unknown account and a wrong password return the same
 * status and body ("Invalid email or password", no data, no token).
 *
 * The login rate limiter allows 10 non-successful attempts per IP per 15 minutes, counting
 * 400s and 401s (successful logins are skipped). This file is therefore ONE ordered
 * sequence of exactly 10 failing attempts, then the 11th, which must be refused with 429.
 * Do not add failing login attempts before the last describe block.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");
const { TEST_PASSWORD, USERS } = require("./helpers/fixtures");

const target = requireHarnessTarget();

const UNIFIED = "Invalid email or password";
const GENERIC = { success: false, message: UNIFIED };

async function login(body, { rawBody } = {}) {
  const res = await target.api("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody !== undefined ? rawBody : JSON.stringify(body),
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
const noLeak = (res) => {
  assert.equal(/\$2[aby]\$/.test(res.text), false, "a password hash was returned");
  assert.equal(res.text.includes(TEST_PASSWORD), false, "the password was echoed");
  assert.equal(/\bat .*\.js:\d+/.test(res.text), false, "a stack trace was returned");
  assert.equal(res.text.includes("token"), false, "a token was returned");
};

describe("valid credentials (successful logins are not counted by the limiter)", () => {
  test("still succeed with the unchanged token contract", async () => {
    const res = await login({ email: USERS.chairA.email, password: TEST_PASSWORD });

    assert.equal(res.status, 200, res.text.slice(0, 160));
    assert.deepEqual(Object.keys(res.json.data).sort(), ["token", "user"]);
    assert.equal(res.json.data.user.email, USERS.chairA.email);
    assert.equal(res.json.data.user.role, USERS.chairA.role);
    assert.equal("password" in res.json.data.user, false);
    const claims = JSON.parse(Buffer.from(res.json.data.token.split(".")[1], "base64url").toString("utf8"));
    assert.equal(claims.role, USERS.chairA.role);
  });

  test("the e-mail is matched case-insensitively and ignoring surrounding spaces", async () => {
    const res = await login({ email: `  ${USERS.chairA.email.toUpperCase()} `, password: TEST_PASSWORD });

    assert.equal(res.status, 200, res.text.slice(0, 160));
  });
});

describe("failures (attempts 1-10 of the rate-limit window)", () => {
  let unknown;
  let wrong;

  test("1. a syntactically valid e-mail with no account is a 401 with the unified body", async () => {
    unknown = await login({ email: "nobody@integration.test", password: TEST_PASSWORD });

    assert.equal(unknown.status, 401);
    assert.deepEqual(unknown.json, GENERIC);
    noLeak(unknown);
  });

  test("2. an existing account with a wrong password is indistinguishable from attempt 1", async () => {
    wrong = await login({ email: USERS.chairA.email, password: `${TEST_PASSWORD}-wrong` });

    assert.equal(wrong.status, unknown.status);
    assert.deepEqual(wrong.json, unknown.json);
    assert.equal(wrong.text, unknown.text, "the raw response bodies differ");
    noLeak(wrong);
  });

  test("3-9. missing, null, array, object, numeric and operator-injection input are 400s, not 500s", async () => {
    const cases = [
      {}, // 3
      { password: TEST_PASSWORD }, // 4
      { email: USERS.chairA.email }, // 5
      { email: null, password: TEST_PASSWORD }, // 6
      { email: [USERS.chairA.email], password: TEST_PASSWORD }, // 7
      { email: { $ne: null }, password: TEST_PASSWORD }, // 8
      { email: 12345, password: TEST_PASSWORD }, // 9
    ];
    for (const body of cases) {
      const res = await login(body);

      assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${res.status} ${res.text.slice(0, 120)}`);
      assert.deepEqual(res.json, { success: false, message: "Please provide email and password" });
      noLeak(res);
    }
  });

  test("10. a malformed e-mail string is just another failed login (401, unified body)", async () => {
    const res = await login({ email: "not-an-email", password: TEST_PASSWORD });

    assert.equal(res.status, 401);
    assert.deepEqual(res.json, GENERIC);
  });

  test("an unparseable JSON body is rejected before the handler (not counted), without a token or stack", async () => {
    const res = await login(undefined, { rawBody: "{ not json" });

    assert.equal(res.status, 400);
    assert.equal(res.text.includes("token"), false);
    assert.equal(/\bat .*\.js:\d+/.test(res.text), false, "a stack trace was returned");
  });
});

describe("rate limiting remains effective (attempt 11 and later)", () => {
  test("the 11th failed attempt in the window is refused with 429, even for a correct password, and issues no token", async () => {
    const refused = await login({ email: "nobody@integration.test", password: TEST_PASSWORD });
    const correct = await login({ email: USERS.chairA.email, password: TEST_PASSWORD });

    assert.equal(refused.status, 429, refused.text.slice(0, 160));
    assert.equal(refused.json.success, false);
    assert.equal(correct.status, 429, "the limiter no longer blocks after 10 failures");
    for (const res of [refused, correct]) assert.equal(res.text.includes("token"), false);
  });
});
