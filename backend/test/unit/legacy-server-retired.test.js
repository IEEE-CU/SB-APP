// AUD-006: the legacy top-level server/ tree is gone and nothing points at it.
//
// Evidence gathered before removing it: no package script, CI workflow, git hook, deployment
// file or import referenced it; its RBAC controllers, middleware, services, routes and models
// all had counterparts in backend/src; its tests required a ../../app that never existed; its
// scripts ran on import with default database URIs and one of them (restore) wiped collections.
// The root package.json "main" named server/app.js, which did not exist.
//
// These checks keep it that way: the directory stays gone, every root and backend script and
// the root "main" resolve to a real file, and no tracked source requires a path into a
// top-level server/ directory.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const BACKEND = path.join(__dirname, "../..");
const REPO = path.join(BACKEND, "..");

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "coverage", "test-results", ".vite"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

test("the legacy top-level server/ directory no longer exists", () => {
  assert.equal(fs.existsSync(path.join(REPO, "server")), false);
});

test("the root package.json main and every root script target resolve to existing files", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8"));

  assert.ok(fs.existsSync(path.join(REPO, manifest.main)), `main -> ${manifest.main}`);
  assert.equal(manifest.main, "backend/src/server.js");
  for (const [name, command] of Object.entries(manifest.scripts)) {
    for (const target of command.match(/(?:backend|frontend|scripts)\/[\w./-]+\.js|\bstart\.js/g) || []) {
      assert.ok(fs.existsSync(path.join(REPO, target)), `script "${name}" -> ${target}`);
    }
  }
});

test("every backend package script target resolves to an existing file", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(BACKEND, "package.json"), "utf8"));

  for (const [name, command] of Object.entries(manifest.scripts)) {
    for (const target of command.match(/(?:src|scripts)\/[\w./-]+\.js/g) || []) {
      assert.ok(fs.existsSync(path.join(BACKEND, target)), `script "${name}" -> ${target}`);
    }
  }
});

test("no source file, workflow or hook refers to a path inside a top-level server/ directory", () => {
  const files = [
    ...walk(BACKEND).filter((file) => /\.(js|cjs|mjs|json|ya?ml)$/.test(file) && !file.endsWith(path.join("test", "unit", "legacy-server-retired.test.js"))),
    ...walk(path.join(REPO, "scripts")),
    ...walk(path.join(REPO, ".github")),
    ...walk(path.join(REPO, ".husky")),
    path.join(REPO, "package.json"),
    path.join(REPO, "start.js"),
  ].filter((file) => !file.includes("package-lock.json"));
  assert.ok(files.length > 100);

  const offenders = [];
  const pattern = /(?:['"`]|\.\.?\/)(?:\.\.\/)*server\/(?:app|config|models|modules|scripts)\b/;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    if (pattern.test(text)) offenders.push(path.relative(REPO, file));
  }
  assert.deepEqual(offenders, []);
});

test("the active backend entry point and the shared RBAC modules the legacy tree duplicated still exist", () => {
  for (const relative of [
    "src/server.js",
    "src/middleware/rbac.js",
    "src/services/resolvePermissions.js",
    "src/services/auditLogger.js",
    "src/routes/rbac.js",
    "src/controllers/rbac/roles.controller.js",
    "src/models/User.js",
    "src/models/Society.js",
  ]) {
    assert.ok(fs.existsSync(path.join(BACKEND, relative)), relative);
  }
});
