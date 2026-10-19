"use strict";

/**
 * Starts and stops the isolated integration harness
 * (scripts/start-integration-server.js) from a test process.
 *
 *   const harness = await startHarness();
 *   harness.info.baseUrl            // http://127.0.0.1:5057
 *   harness.info.fixtures           // identifiers (no credentials)
 *   await harness.stop();           // graceful, ordered shutdown
 *
 * The launcher refuses to start if MONGODB_URI is present, so the caller's
 * environment is passed through unchanged apart from two TLS/loader settings
 * that are dropped for the launcher process only.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const LAUNCHER = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "scripts",
  "start-integration-server.js",
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startHarness({ timeoutMs = 120_000, maxSeconds = 300 } = {}) {
  const readyFile = path.join(
    os.tmpdir(),
    `sb-app-integration-${process.pid}-${crypto.randomBytes(6).toString("hex")}.ready`,
  );

  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_TLS_REJECT_UNAUTHORIZED;

  const child = spawn(
    process.execPath,
    [LAUNCHER, `--ready-file=${readyFile}`, `--max-seconds=${maxSeconds}`],
    { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );

  let output = "";
  const collect = (chunk) => {
    output = (output + chunk.toString()).slice(-20_000);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  let exited = false;
  let exitCode = null;
  const exitPromise = new Promise((resolve) => {
    child.on("exit", (code) => {
      exited = true;
      exitCode = code;
      resolve(code);
    });
  });

  const deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(readyFile)) {
    if (exited) {
      throw new Error(
        `integration harness exited early (code ${exitCode}):\n${output}`,
      );
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`integration harness not ready within ${timeoutMs} ms:\n${output}`);
    }
    await sleep(100);
  }

  const info = JSON.parse(fs.readFileSync(readyFile, "utf8"));

  const stop = async ({ graceMs = 40_000 } = {}) => {
    if (!exited) {
      try {
        child.stdin.write("shutdown\n");
      } catch {
        /* process already gone */
      }
      const result = await Promise.race([
        exitPromise,
        sleep(graceMs).then(() => "timeout"),
      ]);
      if (result === "timeout") {
        child.kill();
        await exitPromise;
      }
    }
    return {
      exitCode,
      readyFileRemoved: !fs.existsSync(readyFile),
      output,
    };
  };

  return { info, readyFile, pid: child.pid, stop, output: () => output };
}

module.exports = { startHarness };
