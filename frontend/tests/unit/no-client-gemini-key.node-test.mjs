// AUD-013: the browser must not need, read or bundle a Gemini key. The audit goes through the
// backend (POST /ai/financial-insights), which holds the key.
//
// Static check on the frontend sources and Vite config; the built bundle is checked separately
// by building with a fake VITE_GEMINI_API_KEY and searching dist/ for it.
//   node --test tests/unit/no-client-gemini-key.node-test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx|mjs|html)$/.test(name)) files.push(full);
  }
};
walk(join(root, "src"));
for (const extra of ["index.html", "vite.config.ts"]) files.push(join(root, extra));

test("no frontend source reads a Gemini key or imports the Google client", () => {
  const forbidden = /VITE_GEMINI|GEMINI_API_KEY|@google\/genai|GoogleGenAI|process\.env\.API_KEY/;
  const hits = files.filter((file) => forbidden.test(readFileSync(file, "utf8"))).map((file) => file.slice(root.length));
  assert.deepEqual(hits, []);
});

test("the audit service calls the backend endpoint", () => {
  const source = readFileSync(join(root, "src/services/geminiService.ts"), "utf8");
  assert.match(source, /\/ai\/financial-insights/);
});
