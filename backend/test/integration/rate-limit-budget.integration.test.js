"use strict";

/**
 * AUD-034: what spends the general rate-limit quota (300 requests / 15 minutes per address).
 *
 * The measurement behind this file: normal browsing is cheap (a login plus the dashboard is
 * ~10 requests in a production build, each further page 1-2), and the quota was only ever
 * exhausted by many test cases sharing one harness - and so one address and one in-memory
 * counter. These tests pin down the accounting that conclusion rests on, without changing any
 * threshold:
 *
 *   - every API request - health, anonymous, authenticated, unknown path, successful login -
 *     costs exactly 1;
 *   - a CORS preflight and Socket.IO transport traffic cost nothing, so realtime
 *     (re)connection never spends the API quota;
 *   - the counter belongs to the address, not the user: different users on one address spend
 *     the same quota.
 *
 * Each measurement reads RateLimit-Remaining from /health before and after the action (the
 * read itself costs 1). Needs a running harness: TEST_BASE_URL + TEST_READY_FILE.
 */

const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");
const { createSession } = require("./helpers/session");
const { USERS, TEST_PASSWORD } = require("./helpers/fixtures");

const target = requireHarnessTarget();
const session = createSession(target);
const ORIGIN = "http://localhost:5173";
let tokenA;
let tokenB;

const remaining = async () => {
  const res = await fetch(`${target.baseUrl}/api/v1/health`);
  assert.equal(res.status, 200);
  return Number(res.headers.get("ratelimit-remaining"));
};

// Requests the action spent, excluding the two /health reads around it.
async function spent(action) {
  const before = await remaining();
  await action();
  const after = await remaining();
  return before - after - 1;
}

before(async () => {
  tokenA = await session.tokenFor("memberA");
  tokenB = await session.tokenFor("chairB");
});

describe("what costs one request", () => {
  test("health, anonymous and authenticated requests, and an unknown path", async () => {
    assert.equal(await spent(() => fetch(`${target.baseUrl}/api/v1/health`)), 1);
    assert.equal(await spent(() => fetch(`${target.baseUrl}/api/v1/channels`)), 1, "anonymous 401");
    assert.equal(
      await spent(() => fetch(`${target.baseUrl}/api/v1/channels`, { headers: { Authorization: `Bearer ${tokenA}` } })),
      1,
      "authenticated 200",
    );
    assert.equal(await spent(() => fetch(`${target.baseUrl}/api/v1/no-such-route`)), 1, "404");
  });

  test("a successful login", async () => {
    const login = () =>
      fetch(`${target.baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: USERS.memberA.email, password: TEST_PASSWORD }),
      });

    let status;
    const cost = await spent(async () => {
      status = (await login()).status;
    });

    assert.equal(status, 200);
    assert.equal(cost, 1);
  });
});

describe("what costs nothing", () => {
  test("a CORS preflight", async () => {
    let status;
    const cost = await spent(async () => {
      status = (
        await fetch(`${target.baseUrl}/api/v1/channels`, {
          method: "OPTIONS",
          headers: { Origin: ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" },
        })
      ).status;
    });

    assert.ok([200, 204].includes(status), `${status}`);
    assert.equal(cost, 0);
  });

  test("Socket.IO transport requests (the realtime handshake and reconnects)", async () => {
    let status;
    const cost = await spent(async () => {
      for (let i = 0; i < 5; i += 1) {
        status = (await fetch(`${target.baseUrl}/socket.io/?EIO=4&transport=polling`)).status;
      }
    });

    assert.equal(status, 200);
    assert.equal(cost, 0);
  });
});

describe("whose quota it is", () => {
  test("different users on one address spend the same counter", async () => {
    const asA = () => fetch(`${target.baseUrl}/api/v1/channels`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const asB = () => fetch(`${target.baseUrl}/api/v1/channels`, { headers: { Authorization: `Bearer ${tokenB}` } });

    const cost = await spent(async () => {
      await asA();
      await asB();
      await asA();
    });

    assert.equal(cost, 3);
  });
});
