// API-F2: every /conversations request that src/services/conversations.ts makes must be a route the
// backend registers (backend/src/routes/conversations.js). getConversation (GET /conversations/:id)
// had no backend route and was removed.
//
// Static check, no server: both files are read as text.
//   node --test tests/unit/conversations-contract.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(new URL("../../src/services/conversations.ts", import.meta.url), "utf8");
const routes = readFileSync(new URL("../../../backend/src/routes/conversations.js", import.meta.url), "utf8");

const calls = [...service.matchAll(/api\s*\.\s*(get|post|put|patch|delete)\s*<[^(]*?>\(\s*([`"'])(\/conversations[^`"']*)\2/g)].map((m) => ({
  method: m[1],
  path: m[3].replace(/\$\{[^}]*\}/g, ":p"),
}));
const registered = [...routes.matchAll(/router\s*\.\s*(get|post|put|patch|delete)\(\s*"([^"]*)"/g)].map((m) => ({
  method: m[1],
  path: "/conversations" + (m[2] === "/" ? "" : m[2]),
}));

const same = (a, b) => {
  const x = a.split("/");
  const y = b.split("/");
  return x.length === y.length && x.every((seg, i) => seg === y[i] || seg.startsWith(":") || y[i].startsWith(":"));
};

test("the parser finds the service's conversation calls and the backend's routes", () => {
  assert.ok(calls.length >= 5, `found ${calls.length} service calls`);
  assert.ok(registered.length >= 5, `found ${registered.length} backend routes`);
  // every api.* call in the file was captured (guards against a call style the regex misses)
  assert.equal(calls.length, (service.match(/\bapi\s*\.\s*(get|post|put|patch|delete)\b/g) || []).length);
});

test("every conversation request the service makes has a matching backend route", () => {
  const missing = calls.filter((c) => !registered.some((r) => r.method === c.method && same(r.path, c.path)));
  assert.deepEqual(missing, [], "service calls with no backend route");
});

test("the unused getConversation wrapper is gone", () => {
  assert.ok(!/getConversation\b/.test(service));
});
