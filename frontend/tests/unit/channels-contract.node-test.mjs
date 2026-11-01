// NEW-08: every /channels request that src/services/channels.ts makes must be a route the backend
// actually registers (backend/src/routes/channels.js). The service used to define addMember and
// removeMember (POST/DELETE /channels/:id/members), which the backend never had; channels are
// society-wide and have no member list (D-B1).
//
// Static check, no server: both files are read as text.
//   node --test tests/unit/channels-contract.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(new URL("../../src/services/channels.ts", import.meta.url), "utf8");
const routes = readFileSync(new URL("../../../backend/src/routes/channels.js", import.meta.url), "utf8");

const calls = [...service.matchAll(/api\s*\.\s*(get|post|put|patch|delete)\s*<[^(]*?>\(\s*([`"])(\/channels[^`"]*)\2/g)].map((m) => ({
  method: m[1],
  path: m[3].replace(/\$\{[^}]*\}/g, ":p"),
}));
const registered = [...routes.matchAll(/router\s*\.\s*(get|post|put|patch|delete)\(\s*"([^"]*)"/g)].map((m) => ({
  method: m[1],
  path: "/channels" + (m[2] === "/" ? "" : m[2]),
}));

const same = (a, b) => {
  const x = a.split("/");
  const y = b.split("/");
  return x.length === y.length && x.every((seg, i) => seg === y[i] || seg.startsWith(":") || y[i].startsWith(":"));
};

test("the parser finds the service's channel calls and the backend's channel routes", () => {
  assert.ok(calls.length >= 8, `found ${calls.length} service calls`);
  assert.ok(registered.length >= 10, `found ${registered.length} backend routes`);
});

test("every channel request the service makes has a matching backend route", () => {
  const missing = calls.filter((c) => !registered.some((r) => r.method === c.method && same(r.path, c.path)));
  assert.deepEqual(missing, [], "service calls with no backend route");
});

test("the member endpoints that never existed are not offered", () => {
  assert.ok(!/addMember|removeMember|\/members/.test(service));
});
