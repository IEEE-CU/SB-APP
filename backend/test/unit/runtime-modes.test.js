// AUD-012B: safe runtime modes - the access-check limit, TRUST_PROXY at start-up and cluster mode.
//
// Before: the access-check limiter allowed 1000 requests/minute whenever NODE_ENV was "test" or
// "development" (a production host with the wrong NODE_ENV was silently ten times weaker); the
// server hard-coded `trust proxy = 1`; ENABLE_CLUSTER=true forked workers whose rooms, presence
// and rate-limit counters are per process, and any value other than the exact string "true"
// (for example "TRUE" or "1") silently meant "off".
//
// Now: 100 per minute everywhere except in a process that explicitly calls
// enableTestRateLimits() (only the isolated harness and the CI test server do; it throws under
// NODE_ENV=production); TRUST_PROXY must be valid, and stated in production; ENABLE_CLUSTER=true
// refuses to start and malformed values are refused rather than read as off.
//
// The start-up cases run the real src/server.js in a CHILD PROCESS with its own minimal
// environment and an empty working directory (no .env), against an unreachable loopback database
// URI: refusals exit before any connection, and the cases that start are killed once listening.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const BACKEND = path.join(__dirname, "../..");
const SERVER = path.join(BACKEND, "src/server.js");
const OVERRIDES = path.join(BACKEND, "src/config/testOverrides.js");
const SECRET = "runtime-modes-test-only-0f1e2d3c4b5a69788796a5b4c3d2e1f0";

// ---- access-check limiter -----------------------------------------------------------------------------

function limitIn(nodeEnv, { enable = false } = {}) {
  const code = `
    const o = require(${JSON.stringify(OVERRIDES)});
    let enabled = "n/a";
    if (${enable}) { try { o.enableTestRateLimits(); enabled = "yes"; } catch (e) { enabled = "refused"; } }
    process.stdout.write(JSON.stringify({ limit: o.accessCheckLimit(), enabled }));
  `;
  const env = { PATH: process.env.PATH || process.env.Path || "", SystemRoot: process.env.SystemRoot || "" };
  if (nodeEnv !== undefined) env.NODE_ENV = nodeEnv;
  const run = spawnSync(process.execPath, ["-e", code], { env, encoding: "utf8", timeout: 20000 });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test("the access-check limit is 100 per minute in production, development, test and unset - NODE_ENV cannot relax it", () => {
  for (const nodeEnv of ["production", "development", "test", undefined, "staging", "TEST"]) {
    assert.deepEqual(limitIn(nodeEnv), { limit: 100, enabled: "n/a" }, String(nodeEnv));
  }
});

test("a process that explicitly enables test limits gets 1000, except under NODE_ENV=production", () => {
  for (const nodeEnv of ["test", "development", undefined]) {
    assert.deepEqual(limitIn(nodeEnv, { enable: true }), { limit: 1000, enabled: "yes" }, String(nodeEnv));
  }
  assert.deepEqual(limitIn("production", { enable: true }), { limit: 100, enabled: "refused" });
});

test("only the isolated harness and the CI test server enable the relaxation; the route reads no environment", () => {
  const rbac = fs.readFileSync(path.join(BACKEND, "src/routes/rbac.js"), "utf8");
  assert.match(rbac, /limit: \(\) => accessCheckLimit\(\)/);
  assert.equal(/NODE_ENV/.test(rbac), false, "routes/rbac.js still branches on NODE_ENV");

  const callers = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js") && /testOverrides"\)\.enableTestRateLimits\(\)/.test(fs.readFileSync(full, "utf8"))) callers.push(path.relative(BACKEND, full).replace(/\\/g, "/"));
    }
  };
  walk(path.join(BACKEND, "src"));
  walk(path.join(BACKEND, "scripts"));
  assert.deepEqual(callers.sort(), ["scripts/start-integration-server.js", "scripts/start-test-server.js"]);
});

// ---- start-up --------------------------------------------------------------------------------------------

function childEnv(extra) {
  const env = {};
  for (const keep of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP"]) {
    if (process.env[keep] !== undefined) env[keep] = process.env[keep];
  }
  return { ...env, JWT_SECRET: SECRET, MONGODB_URI: "mongodb://127.0.0.1:1/unused", PORT: "0", ...extra };
}
const emptyDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "sbapp-modes-"));

/** Runs the server until it either exits or prints its banner; returns what happened. */
async function startServer(extraEnv) {
  const cwd = emptyDir();
  const child = spawn(process.execPath, [SERVER], { cwd, env: childEnv(extraEnv), stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  try {
    const outcome = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ started: false, timedOut: true }), 30000);
      const poll = setInterval(() => {
        if (output.includes("IEEE Campus Community Hub")) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve({ started: true });
        }
      }, 50);
      child.on("exit", (code) => {
        clearTimeout(timer);
        clearInterval(poll);
        resolve({ started: output.includes("IEEE Campus Community Hub"), exitCode: code });
      });
    });
    return { ...outcome, output };
  } finally {
    child.kill("SIGKILL");
    await new Promise((resolve) => (child.exitCode !== null ? resolve() : child.on("exit", resolve)));
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

test("ordinary single-process start-up is unchanged: unset and false cluster values start", async () => {
  for (const ENABLE_CLUSTER of [undefined, "", "false", "FALSE", " false "]) {
    const result = await startServer({ NODE_ENV: "development", ...(ENABLE_CLUSTER === undefined ? {} : { ENABLE_CLUSTER }) });

    assert.equal(result.started, true, `ENABLE_CLUSTER=${JSON.stringify(ENABLE_CLUSTER)}\n${result.output.slice(0, 300)}`);
  }
});

test("ENABLE_CLUSTER=true, in any letter case, refuses to start before listening or connecting", async () => {
  for (const ENABLE_CLUSTER of ["true", "TRUE", " True "]) {
    const result = await startServer({ NODE_ENV: "development", ENABLE_CLUSTER });

    assert.equal(result.exitCode, 1, ENABLE_CLUSTER);
    assert.equal(result.started, false);
    assert.match(result.output, /ENABLE_CLUSTER=true is not supported/);
    assert.equal(result.output.includes("Primary"), false, "a primary process began forking");
  }
});

test("a malformed ENABLE_CLUSTER is refused, never read as an opt-out", async () => {
  for (const ENABLE_CLUSTER of ["1", "yes", "on", "tru", "enabled", "0", "no", "truee"]) {
    const result = await startServer({ NODE_ENV: "development", ENABLE_CLUSTER });

    assert.equal(result.exitCode, 1, ENABLE_CLUSTER);
    assert.equal(result.started, false);
    assert.match(result.output, /ENABLE_CLUSTER must be exactly true or false/);
  }
});

test("production without TRUST_PROXY refuses to start; invalid values are refused everywhere", async () => {
  const missing = await startServer({ NODE_ENV: "production" });
  assert.equal(missing.exitCode, 1);
  assert.equal(missing.started, false);
  assert.match(missing.output, /TRUST_PROXY must be set explicitly in production/);

  for (const [NODE_ENV, TRUST_PROXY] of [["production", "true"], ["production", "*"], ["development", "true"], ["development", "11"], ["development", "10.0.0.1/99"]]) {
    const result = await startServer({ NODE_ENV, TRUST_PROXY });

    assert.equal(result.exitCode, 1, `${NODE_ENV} ${TRUST_PROXY}`);
    assert.equal(result.started, false);
    assert.match(result.output, /TRUST_PROXY/);
    assert.equal(result.output.includes(TRUST_PROXY) && TRUST_PROXY.length > 4, false, "the value was echoed");
  }
});

test("valid TRUST_PROXY values start; development may omit it (trusting nothing)", async () => {
  for (const extra of [{ NODE_ENV: "production", TRUST_PROXY: "0" }, { NODE_ENV: "production", TRUST_PROXY: "1" }, { NODE_ENV: "production", TRUST_PROXY: "10.0.0.0/8" }, { NODE_ENV: "development" }]) {
    const result = await startServer(extra);

    assert.equal(result.started, true, JSON.stringify(extra) + "\n" + result.output.slice(0, 300));
  }
});

test("the cluster npm script that could only fail is gone", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(BACKEND, "package.json"), "utf8"));

  assert.equal("start:cluster" in manifest.scripts, false);
});
