// Unit tests for src/lib/safeUrl.ts (AUD-030: safe rendering of scraped links).
//
// Run with Node's built-in runner, no extra dependency:
//   node --test tests/unit/safe-url.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import { safeExternalUrl } from "../../src/lib/safeUrl.ts";

test("plain http(s) URLs are returned normalized", () => {
  assert.equal(safeExternalUrl("https://example.org/award"), "https://example.org/award");
  assert.equal(safeExternalUrl("  http://example.org  "), "http://example.org/");
  assert.equal(safeExternalUrl("HTTPS://Example.ORG/A?b=1#c"), "https://example.org/A?b=1#c");
});

test("script and other non-web schemes are rejected, including obfuscated spellings", () => {
  for (const value of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\u0000javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///C:/Windows/win.ini",
    "ftp://example.org/x",
    "blob:https://example.org/id",
    "mailto:a@example.org",
  ]) {
    assert.equal(safeExternalUrl(value), null, JSON.stringify(value));
  }
});

test("credentials, relative, malformed, empty, oversized and non-string values are rejected", () => {
  for (const value of [
    "https://user:pw@example.org/",
    "https://user@example.org/",
    "//example.org/x",
    "/relative/path",
    "example.org",
    "http://",
    "not a url",
    "",
    "   ",
    `https://example.org/${"a".repeat(3000)}`,
    null,
    undefined,
    42,
    {},
    ["https://example.org"],
  ]) {
    assert.equal(safeExternalUrl(value), null, String(value));
  }
});
