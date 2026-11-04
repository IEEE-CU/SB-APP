// Unit tests for src/lib/reactionRequest.ts (AUD-009: the reaction request matches the mounted route).
//
// Run with Node's built-in runner, no extra dependency:
//   node --test tests/unit/reaction-request.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { reactionRequest } from "../../src/lib/reactionRequest.ts";

test("the URL is the mounted channels route and the body carries `value` (not `emoji`)", () => {
  const request = reactionRequest("6ad91c70177aaddd9b1e4a99", "👍");

  assert.equal(request.url, "/channels/messages/6ad91c70177aaddd9b1e4a99/reactions");
  assert.deepEqual(request.body, { value: "👍" });
  assert.equal("emoji" in request.body, false);
});

test("it is not the path the client used before (/messages/:id/reactions)", () => {
  assert.notEqual(reactionRequest("m1", "🎉").url, "/messages/m1/reactions");
  assert.ok(reactionRequest("m1", "🎉").url.startsWith("/channels/messages/"));
});

test("the message id is encoded as one path segment", () => {
  assert.equal(reactionRequest("a/b?c", "👍").url, "/channels/messages/a%2Fb%3Fc/reactions");
});

test("multi-codepoint emoji are sent unchanged", () => {
  for (const emoji of ["❤️", "👨‍👩‍👧", "🇮🇳"]) assert.equal(reactionRequest("m1", emoji).body.value, emoji);
});

test("the channels service builds every reaction request with this helper and uses POST only", () => {
  const source = readFileSync(new URL("../../src/services/channels.ts", import.meta.url), "utf8");

  assert.match(source, /reactionRequest\(/);
  assert.equal(/\/messages\/\$\{messageId\}\/reactions/.test(source), false, "a hand-written reaction URL is back");
  assert.equal(/api\.delete[^;]*reactions/s.test(source), false, "a DELETE reaction call is back");
});
