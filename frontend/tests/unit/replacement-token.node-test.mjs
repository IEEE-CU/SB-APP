// Unit tests for src/lib/replacementToken.ts (AUD-007B: the token returned by a password change).
//
// Run with Node's built-in runner, no extra dependency:
//   node --test tests/unit/replacement-token.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import { acceptReplacementToken } from "../../src/lib/replacementToken.ts";

const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJBRE1JTiJ9.c2lnbmF0dXJlLXBhcnQ_-A";

test("a JWT-shaped string in data.token is accepted unchanged", () => {
  assert.equal(acceptReplacementToken({ token: JWT }), JWT);
  assert.equal(acceptReplacementToken({ token: JWT, extra: 1 }), JWT);
});

test("an absent response field never produces a token", () => {
  for (const data of [undefined, null, {}, { other: JWT }, [], "token", 5, true]) {
    assert.equal(acceptReplacementToken(data), null, JSON.stringify(data));
  }
});

test("a non-string, empty or malformed token is rejected", () => {
  for (const token of [null, undefined, 5, {}, [JWT], "", "   ", "abc", "a.b", "a.b.c.d", "a..c", ".b.c", "a.b.", "a b.c.d", "a.b.c d", "<script>.x.y", "a.b.c\n", `${JWT} `]) {
    assert.equal(acceptReplacementToken({ token }), null, JSON.stringify(token));
  }
});
