#!/usr/bin/env node
"use strict";

/**
 * Runs the Playwright session specs, ONE SPEC FILE PER FRESH ISOLATED HARNESS (in-memory MongoDB
 * backend on 127.0.0.1:5057; the frontend dev server on 5174 is started by Playwright's own
 * webServer config). One spec per harness because all browser traffic from one address shares the
 * backend's general rate limit (300 requests / 15 minutes); the limit is never relaxed.
 *
 *   node scripts/run-session-tests.cjs                              every tests/session/*.spec.ts
 *   node scripts/run-session-tests.cjs tests/session/a.spec.ts      one or more specs
 *
 * Traces of failing tests are kept (--trace retain-on-failure) in test-results/session.
 * Browser: Playwright's own Chromium (npx playwright install chromium), or an existing one named
 * by PW_CHROMIUM_PATH. Needs no secrets. Targets the isolated harness only - never localhost:5000.
 * Exit code: 0 when every spec passed and every harness stopped cleanly, 1 otherwise.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const frontendRoot = path.resolve(__dirname, "..");
const { startHarness } = require(path.join(frontendRoot, "..", "backend", "test", "integration", "helpers", "test-server.js"));

const sessionDir = path.join(frontendRoot, "tests", "session");
const specs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs
      .readdirSync(sessionDir)
      .filter((name) => name.endsWith(".spec.ts"))
      .sort()
      .map((name) => path.posix.join("tests", "session", name));

const runSpec = (spec, env) =>
  new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["playwright", "test", "-c", "playwright.session.config.ts", spec, "--trace", "retain-on-failure"],
      { cwd: frontendRoot, env, stdio: "inherit", shell: true },
    );
    child.on("exit", (code) => resolve(code));
  });

(async () => {
  const results = [];
  for (const spec of specs) {
    console.log(`\n[session] ===== ${spec}`);
    const harness = await startHarness({ timeoutMs: 120_000, maxSeconds: 900 });
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_TLS_REJECT_UNAUTHORIZED;
    delete env.MONGODB_URI;
    env.TEST_BASE_URL = harness.info.baseUrl;
    env.TEST_READY_FILE = harness.readyFile;

    const code = await runSpec(spec, env);
    const stopped = await harness.stop();
    const ok = code === 0 && stopped.exitCode === 0 && stopped.readyFileRemoved;
    results.push({ spec, ok, code, harnessExit: stopped.exitCode });
    console.log(`[session] ${spec}: playwright exit=${code}; harness exit=${stopped.exitCode}; ready file removed=${stopped.readyFileRemoved}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[session] ${results.length - failed.length}/${results.length} specs passed`);
  for (const r of failed) console.log(`[session] FAILED: ${r.spec} (playwright exit=${r.code}, harness exit=${r.harnessExit})`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error("[session] ERROR", error.message);
  process.exit(2);
});
