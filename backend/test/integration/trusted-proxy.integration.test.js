"use strict";

/**
 * AUD-012B over HTTP: X-Forwarded-For cannot be used to evade the login rate limiter.
 *
 * Reproduced before the fix (hard-coded `trust proxy = 1`, app reached directly): 14 failed
 * logins, each claiming a different address in X-Forwarded-For, were all answered 401 and never
 * limited. The isolated harness is the "reached directly" topology and leaves TRUST_PROXY unset,
 * which now means nothing is trusted: the limiter keys on the connecting socket's address and
 * ignores the header.
 *
 * The login limiter allows 10 non-successful attempts per address per 15 minutes (successful
 * logins are skipped). This file is one ordered sequence, so it is the only thing that
 * touches the login limiter in its own harness process.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");
const { USERS, TEST_PASSWORD } = require("./helpers/fixtures");

const target = requireHarnessTarget();

const login = (forwardedFor, { email = "nobody@integration.test", password = TEST_PASSWORD } = {}) =>
  fetch(`${target.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}) },
    body: JSON.stringify({ email, password }),
  });

describe("rotating X-Forwarded-For does not evade the login limiter", () => {
  test("ten failures are answered 401 and every later attempt is 429, whatever address it claims", async () => {
    const statuses = [];
    for (let i = 0; i < 14; i += 1) {
      const res = await login(`203.0.113.${i + 1}`);
      statuses.push(res.status);
      await res.arrayBuffer();
    }

    assert.deepEqual(statuses, [...Array(10).fill(401), ...Array(4).fill(429)]);
  });

  test("a spoofed address does not reset the counter, and a correct password is limited too", async () => {
    const spoofed = await login("198.51.100.250", { email: USERS.chairA.email });
    const forgedChain = await login("1.1.1.1, 2.2.2.2, 3.3.3.3", { email: USERS.chairA.email });

    assert.equal(spoofed.status, 429);
    assert.equal(forgedChain.status, 429);
    assert.equal((await spoofed.text()).includes("token"), false);
  });

  test("the limited response is the unchanged JSON contract", async () => {
    const res = await login("203.0.113.99");

    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { success: false, message: "Too many attempts. Please try again in 15 minutes." });
  });
});
