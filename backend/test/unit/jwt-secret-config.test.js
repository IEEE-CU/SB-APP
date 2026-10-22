// AUTH-CLOSE-02 (AUD-010): no predictable JWT signing secret anywhere.
//
// Found before the fix: scripts/start-dev-server.js and scripts/start-test-server.js fell
// back to the literals "your-secret-key-change-in-production" and
// "test-jwt-secret-do-not-use-in-production", the root scripts/verify-rbac-matrix.js signed
// tokens with the same guessable fallback, and src/server.js accepted ANY non-empty
// JWT_SECRET, including the placeholder copied from .env.example.
//
// Now: server.js refuses to start on a missing, blank or published-placeholder secret; the
// dev and test start-up scripts keep a valid configured secret or generate a random per-run
// one (never a literal) and refuse NODE_ENV=production; the RBAC script has no default.
// Secret values are never printed by the code under test, and these tests never print them.
//
// The start-up cases run the real src/server.js in a CHILD PROCESS with its own environment
// and an empty working directory (so no .env file is read). The database URI points at an
// unreachable loopback port: the failure cases exit before any connection, and the one case
// that starts is killed as soon as it has listened.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const jwt = require("jsonwebtoken");

const { jwtSecretProblem, assertJwtSecret, secretForLocalRun } = require("../../src/utils/jwtSecret");

const BACKEND = path.join(__dirname, "../..");
const REPO = path.join(BACKEND, "..");
const SERVER = path.join(BACKEND, "src/server.js");
const GOOD_SECRET = "k3Jx9-unit-test-only-0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const PLACEHOLDERS = [
  "your-secret-key-change-in-production",
  "your-super-secret-jwt-key-change-in-production",
  "test-jwt-secret-do-not-use-in-production",
  "Please-CHANGE-IN-PRODUCTION",
];

// ---- the rules ------------------------------------------------------------------------------

test("a missing, non-string, blank or placeholder secret is unusable; a real one is usable", () => {
  for (const bad of [undefined, null, 5, {}, "", "   ", "\t\n", ...PLACEHOLDERS]) {
    assert.notEqual(jwtSecretProblem(bad), null, String(bad));
    assert.throws(() => assertJwtSecret({ JWT_SECRET: bad }), /^Error: JWT_SECRET /);
  }
  assert.equal(jwtSecretProblem(GOOD_SECRET), null);
  assert.doesNotThrow(() => assertJwtSecret({ JWT_SECRET: GOOD_SECRET }));
});

test("error messages never contain the secret value", () => {
  for (const value of PLACEHOLDERS) {
    assert.throws(
      () => assertJwtSecret({ JWT_SECRET: value }),
      (error) => !error.message.includes(value) && /published placeholder/.test(error.message),
    );
  }
});

test("local runs keep a valid configured secret and otherwise get a fresh random one, never a literal", () => {
  assert.deepEqual(secretForLocalRun({ JWT_SECRET: GOOD_SECRET }), { secret: GOOD_SECRET, generated: false });

  const seen = new Set();
  const unusable = [{}, { JWT_SECRET: "" }, { JWT_SECRET: "  " }, ...PLACEHOLDERS.map((JWT_SECRET) => ({ JWT_SECRET }))];
  for (const env of unusable) {
    const { secret, generated } = secretForLocalRun(env);

    assert.equal(generated, true);
    assert.match(secret, /^[0-9a-f]{96}$/);
    assert.equal(jwtSecretProblem(secret), null);
    assert.equal(PLACEHOLDERS.includes(secret), false);
    seen.add(secret);
  }
  assert.equal(seen.size, unusable.length, "generated secrets repeated");
});

// ---- no literal fallback anywhere in the active code --------------------------------------------

function sourceFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.(js|cjs|mjs)$/.test(entry.name)) found.push(full);
  }
  return found;
}

test("no active script or source file falls back to a literal secret or contains a published placeholder", () => {
  const files = [
    ...sourceFiles(path.join(BACKEND, "src")),
    ...sourceFiles(path.join(BACKEND, "scripts")),
    ...sourceFiles(path.join(REPO, "scripts")),
    path.join(REPO, "start.js"),
  ];
  assert.ok(files.length > 20);
  const offenders = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    if (/JWT_SECRET\s*(\|\||\?\?)\s*['"`]/.test(text)) offenders.push(`${path.relative(REPO, file)}: literal fallback`);
    for (const placeholder of PLACEHOLDERS.slice(0, 3)) {
      if (file !== path.join(BACKEND, "src/utils/jwtSecret.js") && text.includes(placeholder)) {
        offenders.push(`${path.relative(REPO, file)}: placeholder`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("the dev and test start-up scripts use the shared helper and refuse NODE_ENV=production", () => {
  for (const name of ["start-dev-server.js", "start-test-server.js"]) {
    const text = fs.readFileSync(path.join(BACKEND, "scripts", name), "utf8");

    assert.match(text, /secretForLocalRun/, name);
    assert.match(text, /NODE_ENV === "production"/, name);
  }
});

test("the isolated integration harness supplies its own explicit test-only secret", () => {
  const harness = fs.readFileSync(path.join(BACKEND, "scripts/start-integration-server.js"), "utf8");
  const { TEST_JWT_SECRET } = require("../integration/helpers/fixtures");

  assert.match(harness, /process\.env\.JWT_SECRET = TEST_JWT_SECRET/);
  assert.equal(jwtSecretProblem(TEST_JWT_SECRET), null, "the harness secret must pass the same validation as production");
});

// ---- real start-up, in child processes -----------------------------------------------------------

function childEnv(extra) {
  const env = {};
  for (const keep of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP"]) {
    if (process.env[keep] !== undefined) env[keep] = process.env[keep];
  }
  return { ...env, NODE_ENV: "production", MONGODB_URI: "mongodb://127.0.0.1:1/unused", PORT: "0", ...extra };
}
const emptyDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "sbapp-jwt-test-"));

test("production start-up fails before listening on a missing, empty, blank or placeholder secret", () => {
  const cwd = emptyDir();
  const cases = [{}, { JWT_SECRET: "" }, { JWT_SECRET: "   " }, ...PLACEHOLDERS.map((JWT_SECRET) => ({ JWT_SECRET }))];
  try {
    for (const extra of cases) {
      const run = spawnSync(process.execPath, [SERVER], { cwd, env: childEnv(extra), encoding: "utf8", timeout: 30000 });
      const output = `${run.stdout}${run.stderr}`;

      assert.equal(run.status, 1, JSON.stringify(Object.keys(extra)) + " -> exit " + run.status);
      assert.match(output, /JWT_SECRET/);
      assert.equal(output.includes("IEEE Campus Community Hub"), false, "the server started");
      if (extra.JWT_SECRET && extra.JWT_SECRET.trim().length > 10) assert.equal(output.includes(extra.JWT_SECRET), false, "the secret value was printed");
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("production start-up with a valid secret listens, and never prints the secret", async () => {
  const cwd = emptyDir();
  const child = spawn(process.execPath, [SERVER], { cwd, env: childEnv({ JWT_SECRET: GOOD_SECRET, TRUST_PROXY: "0" }), stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  try {
    const listened = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 30000);
      const poll = setInterval(() => {
        if (output.includes("IEEE Campus Community Hub")) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve(true);
        }
      }, 100);
      child.on("exit", () => {
        clearTimeout(timer);
        clearInterval(poll);
        resolve(output.includes("IEEE Campus Community Hub"));
      });
    });

    assert.equal(listened, true, "the server did not start with a valid secret");
    assert.equal(output.includes(GOOD_SECRET), false, "the secret value was printed");
  } finally {
    child.kill("SIGKILL");
    await new Promise((resolve) => (child.exitCode !== null ? resolve() : child.on("exit", resolve)));
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// ---- one environment's tokens are not another's -------------------------------------------------------

test("a token signed with one secret is rejected by an environment configured with another", async () => {
  const User = require("../../src/models/User");
  const realFindById = User.findById;
  const savedSecret = process.env.JWT_SECRET;
  const { authenticate } = require("../../src/middleware/auth");
  User.findById = () => ({ populate: async () => ({ _id: "u1", role: "OFFICE_BEARER" }) });
  const secretA = `${GOOD_SECRET}-A`;
  const secretB = `${GOOD_SECRET}-B`;
  const run = async (secret, token) => {
    process.env.JWT_SECRET = secret;
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let passed = false;
    await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, () => {
      passed = true;
    });
    return { passed, res };
  };
  try {
    const token = jwt.sign({ id: "u1", role: "ADMIN" }, secretA, { expiresIn: "1h" });

    const sameEnvironment = await run(secretA, token);
    const otherEnvironment = await run(secretB, token);

    assert.equal(sameEnvironment.passed, true);
    assert.equal(otherEnvironment.passed, false);
    assert.equal(otherEnvironment.res.statusCode, 401);
    assert.equal(otherEnvironment.res.body.message, "Invalid token.");
  } finally {
    User.findById = realFindById;
    if (savedSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedSecret;
  }
});
