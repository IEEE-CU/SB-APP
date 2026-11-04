// AUD-002 closure: importing a database script must do nothing, and the scripts that write
// must follow the existing dbSafety rules before they connect.
//
// Found before the fix (all executed their work merely by being required):
//   - src/scripts/seedUsersAndSocieties.js: connected to MONGODB_URI and inserted societies and
//     accounts with known passwords, with no target check at all;
//   - src/scripts/scrapeOpportunities.js: connected, scraped and wrote/removed listings;
//   - src/scripts/testConnection.js, src/scripts/runWithMemoryDb.js, scripts/start-dev-server.js,
//     scripts/start-test-server.js, backend/scripts/verify-rbac-matrix.js: ran on import;
//   - scripts/verify-rbac-matrix.js (root): ran on import and, with --baseUrl, connected to
//     MONGODB_URI or a DEFAULT local database (mongodb://127.0.0.1:27017/ieee_finance_pro) and
//     created test users with a known password and role assignments there.
//
// Every child process below runs with a preload that REPLACES mongoose.connect,
// MongoMemoryServer.create, the Model write methods and http listen with recorders that never
// perform the action, so nothing here can reach any database or port, whatever the code under
// test does. The child's environment is minimal and its working directory is empty (no .env).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const BACKEND = path.join(__dirname, "../..");
const REPO = path.join(BACKEND, "..");
const CANARY_URI = "mongodb://127.0.0.1:1/script_import_canary";

const SCRIPTS = {
  seedUsersAndSocieties: path.join(BACKEND, "src/scripts/seedUsersAndSocieties.js"),
  scrapeOpportunities: path.join(BACKEND, "src/scripts/scrapeOpportunities.js"),
  testConnection: path.join(BACKEND, "src/scripts/testConnection.js"),
  runWithMemoryDb: path.join(BACKEND, "src/scripts/runWithMemoryDb.js"),
  seed: path.join(BACKEND, "src/scripts/seed.js"),
  clearData: path.join(BACKEND, "src/scripts/clearData.js"),
  restore: path.join(BACKEND, "src/scripts/restore.js"),
  backup: path.join(BACKEND, "src/scripts/backup.js"),
  startDevServer: path.join(BACKEND, "scripts/start-dev-server.js"),
  startTestServer: path.join(BACKEND, "scripts/start-test-server.js"),
  backendVerifyRbac: path.join(BACKEND, "scripts/verify-rbac-matrix.js"),
  rootVerifyRbac: path.join(REPO, "scripts/verify-rbac-matrix.js"),
};

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sbapp-script-safety-"));
const PRELOAD = path.join(workDir, "preload.js");
fs.writeFileSync(
  PRELOAD,
  `
const path = require("path");
const backend = process.env.SBAPP_BACKEND;
const calls = { connect: 0, memoryServer: 0, writes: 0, listen: 0 };
const mongoose = require(path.join(backend, "node_modules", "mongoose"));
mongoose.connect = async () => { calls.connect += 1; throw new Error("blocked by test"); };
try {
  const mm = require(path.join(backend, "node_modules", "mongodb-memory-server"));
  mm.MongoMemoryServer.create = async () => { calls.memoryServer += 1; throw new Error("blocked by test"); };
} catch { /* not installed */ }
for (const name of ["insertMany", "deleteMany", "deleteOne", "create", "updateMany", "bulkWrite", "findOneAndUpdate", "findByIdAndUpdate"]) {
  mongoose.Model[name] = function blocked() { calls.writes += 1; throw new Error("blocked by test"); };
}
mongoose.Model.prototype.save = function blocked() { calls.writes += 1; throw new Error("blocked by test"); };
require("http").Server.prototype.listen = function blocked() { calls.listen += 1; return this; };
process.on("exit", () => process.stdout.write("\\nCALLS " + JSON.stringify(calls) + "\\n"));
`,
);
test.after(() => fs.rmSync(workDir, { recursive: true, force: true }));

function childEnv(extra = {}) {
  const env = {};
  for (const keep of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP"]) {
    if (process.env[keep] !== undefined) env[keep] = process.env[keep];
  }
  return { ...env, SBAPP_BACKEND: BACKEND, ...extra };
}

/** Runs `code` in a fresh node process with the blocking preload; returns output and recorded calls. */
function runChild(code, { env = {}, args = [] } = {}) {
  const run = spawnSync(process.execPath, ["-r", PRELOAD, "-e", code, "--", ...args], {
    cwd: workDir,
    env: childEnv(env),
    encoding: "utf8",
    timeout: 45000,
  });
  const output = `${run.stdout}${run.stderr}`;
  const match = /CALLS (\{.*\})/.exec(run.stdout);
  return { status: run.status, output, calls: match ? JSON.parse(match[1]) : null, imported: run.stdout.includes("IMPORTED") };
}
const importOnly = (file) => `require(${JSON.stringify(file)}); process.stdout.write("IMPORTED\\n");`;
const runScript = (file, env, args = []) =>
  runChild(`process.argv.splice(1, 0, ${JSON.stringify(file)}); require("module")._load(${JSON.stringify(file)}, null, true);`, { env, args });

// ---- importing does nothing ----------------------------------------------------------------------

test("importing any database script connects, writes and listens to nothing, and does not exit the process", () => {
  // Even with a URI configured AND authorized for it, importing must not act on it.
  const env = {
    MONGODB_URI: CANARY_URI,
    ALLOW_DESTRUCTIVE_DB_OPS: "script_import_canary",
    JWT_SECRET: "import-safety-test-only-secret-0123456789abcdef",
  };
  for (const [name, file] of Object.entries(SCRIPTS)) {
    const result = runChild(importOnly(file), { env });

    assert.equal(result.imported, true, `${name}: the process exited during import\n${result.output.slice(0, 400)}`);
    assert.equal(result.status, 0, `${name}: exit ${result.status}`);
    assert.deepEqual(result.calls, { connect: 0, memoryServer: 0, writes: 0, listen: 0 }, name);
  }
});

test("a script that exports a function exposes it for callers and tests", () => {
  assert.equal(typeof require(SCRIPTS.seedUsersAndSocieties), "function");
  assert.equal(typeof require(SCRIPTS.scrapeOpportunities), "function");
  assert.equal(typeof require(SCRIPTS.testConnection).testConnection, "function");
  assert.equal(typeof require(SCRIPTS.startTestServer).main, "function");
  assert.equal(typeof require(SCRIPTS.startDevServer).main, "function");
});

// ---- running directly follows the existing safety rules ----------------------------------------------

test("seedUsersAndSocieties, run directly, refuses unsafe targets BEFORE connecting", () => {
  const refusals = [
    [{}, /explicit|configured|MONGODB_URI/i],
    [{ MONGODB_URI: CANARY_URI }, /authorization required/i], // no opt-in
    [{ MONGODB_URI: CANARY_URI, ALLOW_DESTRUCTIVE_DB_OPS: "some_other_db" }, /does not match/i],
    [{ MONGODB_URI: CANARY_URI, ALLOW_DESTRUCTIVE_DB_OPS: "script_import_canary", NODE_ENV: "production" }, /production/i],
    [{ MONGODB_URI: "mongodb+srv://u:p@cluster0.example.mongodb.net/app", ALLOW_DESTRUCTIVE_DB_OPS: "app" }, /hosted|production/i],
    [{ MONGODB_URI: "mongodb://127.0.0.1:27017", ALLOW_DESTRUCTIVE_DB_OPS: "x" }, /name a database|explicitly/i],
    [{ MONGODB_URI: "mongodb://127.0.0.1:27017/prod_ieee", ALLOW_DESTRUCTIVE_DB_OPS: "prod_ieee" }, /production/i],
  ];
  for (const [env, message] of refusals) {
    const result = runScript(SCRIPTS.seedUsersAndSocieties, env);

    assert.equal(result.status, 1, JSON.stringify(Object.keys(env)) + "\n" + result.output.slice(0, 300));
    assert.match(result.output, message);
    assert.deepEqual(result.calls, { connect: 0, memoryServer: 0, writes: 0, listen: 0 }, "work happened before the refusal");
    assert.equal(result.output.includes("script_import_canary") && /mongodb:\/\//.test(result.output), false, "the URI was printed");
  }
});

test("seedUsersAndSocieties with an authorized isolated target proceeds to connect (and only then)", () => {
  const result = runScript(SCRIPTS.seedUsersAndSocieties, { MONGODB_URI: CANARY_URI, ALLOW_DESTRUCTIVE_DB_OPS: "script_import_canary" });

  assert.equal(result.status, 1); // the blocked connect fails; the point is that it was attempted
  assert.equal(result.calls.connect >= 1, true, "an authorized target never reached the connection step");
  assert.equal(result.calls.writes, 0);
});

test("scrapeOpportunities, run directly, needs an explicit parseable database target before connecting", () => {
  for (const env of [{}, { MONGODB_URI: "" }, { MONGODB_URI: "not-a-mongodb-uri" }, { MONGODB_URI: "http://127.0.0.1/x" }]) {
    const result = runScript(SCRIPTS.scrapeOpportunities, env);

    assert.equal(result.status, 1, JSON.stringify(env) + "\n" + result.output.slice(0, 300));
    assert.deepEqual(result.calls, { connect: 0, memoryServer: 0, writes: 0, listen: 0 }, JSON.stringify(env));
  }
  const explicit = runScript(SCRIPTS.scrapeOpportunities, { MONGODB_URI: CANARY_URI });
  assert.equal(explicit.calls.connect >= 1, true, "an explicit target did not reach the connection step");
});

test("the root RBAC script, run with --baseUrl, refuses a missing, unauthorized or default database before connecting", () => {
  const cases = [
    { env: {}, message: /explicit|configured|MONGODB_URI/i },
    { env: { MONGODB_URI: "mongodb://127.0.0.1:27017/ieee_finance_pro" }, message: /authorization required/i },
    { env: { MONGODB_URI: "mongodb://127.0.0.1:27017/ieee_finance_pro", ALLOW_DESTRUCTIVE_DB_OPS: "other" }, message: /does not match/i },
  ];
  for (const { env, message } of cases) {
    const result = runScript(SCRIPTS.rootVerifyRbac, { ...env, JWT_SECRET: "import-safety-test-only-secret-0123456789abcdef" }, ["--baseUrl=http://127.0.0.1:1"]);

    assert.notEqual(result.status, 0, result.output.slice(0, 300));
    assert.match(result.output, message);
    assert.deepEqual(result.calls, { connect: 0, memoryServer: 0, writes: 0, listen: 0 }, "it connected or wrote before refusing");
  }
});

test("the root RBAC script no longer contains a default database URI", () => {
  const text = fs.readFileSync(SCRIPTS.rootVerifyRbac, "utf8");

  assert.equal(/MONGODB_URI\s*\|\|/.test(text), false);
  assert.equal(text.includes("27017/ieee_finance_pro"), false);
});

// ---- the existing destructive scripts keep their entry-point and guard structure -----------------------

test("the destructive scripts still run only as entry points and call the guard before connecting", () => {
  for (const name of ["seed", "clearData", "restore"]) {
    const text = fs.readFileSync(SCRIPTS[name], "utf8");
    const guard = text.indexOf("assertDestructiveTargetAllowed(");
    const connect = Math.min(...["mongoose.connect(", "connectDB()"].map((token) => (text.indexOf(token) === -1 ? Infinity : text.indexOf(token))));

    assert.ok(guard !== -1, `${name}: no guard`);
    assert.ok(guard < connect, `${name}: connects before the guard`);
    assert.match(text, /require\.main === module/, name);
  }
  const seedUsers = fs.readFileSync(SCRIPTS.seedUsersAndSocieties, "utf8");
  assert.ok(seedUsers.indexOf("assertDestructiveTargetAllowed(") < seedUsers.indexOf("await connectDB()"));
});

test("dbSafety still refuses by default (behavior unchanged)", () => {
  const { assertDestructiveTargetAllowed, DestructiveOperationRefused } = require("../../src/utils/dbSafety");

  assert.throws(() => assertDestructiveTargetAllowed({ operation: "x", env: {} }), DestructiveOperationRefused);
  assert.throws(
    () => assertDestructiveTargetAllowed({ operation: "x", env: { MONGODB_URI: CANARY_URI } }),
    (error) => error.code === "AUTHORIZATION_REQUIRED",
  );
  assert.doesNotThrow(() =>
    assertDestructiveTargetAllowed({ operation: "x", env: { MONGODB_URI: CANARY_URI, ALLOW_DESTRUCTIVE_DB_OPS: "script_import_canary" } }),
  );
});
