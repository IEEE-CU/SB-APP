#!/usr/bin/env node
"use strict";

/**
 * Runs the backend integration test files, each against its OWN fresh isolated harness
 * (scripts/start-integration-server.js: in-memory MongoDB, 127.0.0.1:5057, no external services).
 * A fresh harness per file keeps the general rate limit (300 requests / 15 minutes per address)
 * and all fixture data from carrying over between files; the limit is never relaxed.
 *
 *   node scripts/run-integration-tests.js                       every test/integration/*.test.js
 *   node scripts/run-integration-tests.js test/integration/a.test.js [...]
 *
 * Needs no environment variables or secrets. It must run on its own (one harness at a time: the
 * port is fixed). Never touches a persistent database; the launcher refuses MONGODB_URI.
 * Exit code: 0 when every file passed and every harness stopped cleanly, 1 otherwise.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { startHarness } = require("../test/integration/helpers/test-server.js");

const backendRoot = path.resolve(__dirname, "..");
const integrationDir = path.join(backendRoot, "test", "integration");

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs
      .readdirSync(integrationDir)
      .filter((name) => name.endsWith(".test.js"))
      .sort()
      .map((name) => path.join("test", "integration", name));

const runFile = (file, env) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test", file], { cwd: backendRoot, env, stdio: "inherit" });
    child.on("exit", (code) => resolve(code));
  });

(async () => {
  const results = [];
  for (const file of files) {
    console.log(`\n[integration] ===== ${file}`);
    const harness = await startHarness({ timeoutMs: 120_000, maxSeconds: 600 });
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_TLS_REJECT_UNAUTHORIZED;
    delete env.MONGODB_URI;
    env.TEST_BASE_URL = harness.info.baseUrl;
    env.TEST_READY_FILE = harness.readyFile;

    const code = await runFile(file, env);
    const stopped = await harness.stop();
    const ok = code === 0 && stopped.exitCode === 0 && stopped.readyFileRemoved;
    results.push({ file, ok, code, harnessExit: stopped.exitCode });
    console.log(`[integration] ${file}: tests exit=${code}; harness exit=${stopped.exitCode}; ready file removed=${stopped.readyFileRemoved}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[integration] ${results.length - failed.length}/${results.length} files passed`);
  for (const r of failed) console.log(`[integration] FAILED: ${r.file} (tests exit=${r.code}, harness exit=${r.harnessExit})`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error("[integration] ERROR", error.message);
  process.exit(2);
});
