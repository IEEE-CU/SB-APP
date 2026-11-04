"use strict";

/**
 * AUD-012 over HTTP: the general rate limiter counts requests that the body parser rejects.
 *
 * Reproduced before the fix: 330 malformed-JSON requests from one address were all answered
 * 400 and never limited, because express.json() rejected them before the limiter (which sat
 * after the parsers) ever ran. The limiter now sits before the parsers (after CORS, so a 429
 * still carries the CORS headers).
 *
 * The general limit is 300 requests per 15 minutes per address and is shared by every request
 * of the harness process. The harness is reached directly and TRUST_PROXY is unset (trust
 * nothing), so every request here comes from one address (the connecting socket's): the
 * X-Forwarded-For header sent below is ignored. This file does nothing else, and changes no
 * threshold.
 *
 * Needs a running harness: TEST_BASE_URL + TEST_READY_FILE (helpers/target.js).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { requireHarnessTarget } = require("./helpers/target");

const target = requireHarnessTarget();
const ADDRESS = "198.51.100.200";
const ORIGIN = "http://localhost:5173";

const malformed = () =>
  fetch(`${target.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ADDRESS, Origin: ORIGIN },
    body: "{ this is not json",
  });

describe("requests rejected by the body parser are rate limited", () => {
  test("malformed-JSON requests start returning 429 within the general limit", async () => {
    const statuses = [];
    let limited = null;
    for (let i = 0; i < 320; i += 1) {
      const res = await malformed();
      statuses.push(res.status);
      if (res.status === 429 && !limited) limited = { body: await res.json(), cors: res.headers.get("access-control-allow-origin") };
      else await res.arrayBuffer();
    }

    assert.ok(statuses.includes(400), "the parser never produced its usual 400");
    assert.ok(statuses.includes(429), `330 malformed requests were never limited: ${JSON.stringify({ 400: statuses.filter((s) => s === 400).length })}`);
    assert.equal(statuses.indexOf(429) > 250, true, "limited suspiciously early");
    assert.deepEqual(limited.body, { success: false, message: "Too many requests. Please try again later." });
    assert.equal(limited.cors, ORIGIN, "the 429 lacks the CORS header, so a browser could not read it");
  });

  test("once limited, valid requests from that address are limited too (one shared counter)", async () => {
    const res = await fetch(`${target.baseUrl}/api/v1/health`, { headers: { "X-Forwarded-For": ADDRESS } });

    assert.equal(res.status, 429);
  });

  test("a different claimed address does not get a fresh counter (the header is not trusted)", async () => {
    const res = await fetch(`${target.baseUrl}/api/v1/health`, { headers: { "X-Forwarded-For": "198.51.100.201" } });

    assert.equal(res.status, 429);
  });
});
