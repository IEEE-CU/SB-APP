// NEW-09: unit tests for src/lib/rateLimit.ts (429 handling in the shared API layer).
//   node --test tests/unit/rate-limit.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyRateLimitMessage, rateLimitMessage, RATE_LIMIT_MESSAGE } from "../../src/lib/rateLimit.ts";

test("a 429 gets the readable message on err.message and response.data.message", () => {
  const err = { message: "Request failed with status code 429", response: { status: 429, headers: {}, data: { error: "x" } } };
  assert.equal(applyRateLimitMessage(err), err);
  assert.equal(err.message, RATE_LIMIT_MESSAGE);
  assert.deepEqual(err.response.data, { error: "x", message: RATE_LIMIT_MESSAGE });
});

test("a 429 with a non-object body still gets a message", () => {
  const err = { response: { status: 429, headers: {}, data: "Too Many Requests" } };
  applyRateLimitMessage(err);
  assert.equal(err.response.data.message, RATE_LIMIT_MESSAGE);
});

test("Retry-After seconds are mentioned only when valid", () => {
  assert.match(rateLimitMessage("30"), /30 seconds/);
  assert.match(rateLimitMessage(1), /1 second and/);
  for (const bad of [undefined, null, "", "abc", "0", "-5", "Wed, 21 Oct 2026 07:28:00 GMT"]) {
    assert.equal(rateLimitMessage(bad), RATE_LIMIT_MESSAGE);
  }
});

test("other statuses and network errors are left untouched", () => {
  const e500 = { message: "boom", response: { status: 500, data: { message: "server" } } };
  const e401 = { message: "unauth", response: { status: 401, data: { message: "no" } } };
  const net = { message: "Network Error" };
  applyRateLimitMessage(e500);
  applyRateLimitMessage(e401);
  applyRateLimitMessage(net);
  assert.equal(e500.message, "boom");
  assert.equal(e500.response.data.message, "server");
  assert.equal(e401.message, "unauth");
  assert.equal(net.message, "Network Error");
});

test("api.ts wires the helper, never retries, and keeps the 401 branch", () => {
  const api = readFileSync(new URL("../../src/lib/api.ts", import.meta.url), "utf8");
  assert.match(api, /applyRateLimitMessage\(err\)/);
  assert.match(api, /status === 401[\s\S]*removeItem\((["'])token\1\)[\s\S]*window\.location\.href = \1\/login\1/);
  assert.ok(!/retry/i.test(api.replace(/no automatic retry/, "")));
});
