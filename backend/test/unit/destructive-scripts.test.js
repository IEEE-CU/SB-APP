// AUD-002: destructive database utilities must be import-safe and must refuse
// to touch a database unless the target is validated and explicitly
// authorized.
//
// Everything here runs against stubs. `mongoose.connect`, the database
// connection helper, model `deleteMany` calls and `process.exit` are replaced
// before the scripts are loaded, so no database is ever contacted. The
// connection strings used are inert placeholders.
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const mongoose = require("mongoose");

const FAKE_TARGET = "mongodb://127.0.0.1:27017/sbapp_unit_fixture";
const AUTHORIZED_ENV = {
  MONGODB_URI: FAKE_TARGET,
  ALLOW_DESTRUCTIVE_DB_OPS: "sbapp_unit_fixture",
};

const calls = { connect: 0, connectDB: 0, deleteMany: 0, exit: [], mkdir: [] };
let realConnect;
let realExit;
let realMkdirSync;
const modelStubs = [];

// Lets any asynchronous work started by an import settle while the stubs are
// still installed (an unguarded script otherwise reaches the real
// process.exit after the test has restored the stub).
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

function stubModuleExports(relPath, exportsValue) {
  const resolved = require.resolve(path.join(__dirname, relPath));
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
}

function installStubs() {
  calls.connect = 0;
  calls.connectDB = 0;
  calls.deleteMany = 0;
  calls.exit = [];
  calls.mkdir = [];

  // Never let an unguarded script create directories during these tests.
  realMkdirSync = fs.mkdirSync;
  fs.mkdirSync = (target) => {
    calls.mkdir.push(String(target));
  };

  realConnect = mongoose.connect;
  mongoose.connect = async () => {
    calls.connect += 1;
    throw new Error("blocked: test must never connect to a database");
  };

  realExit = process.exit;
  process.exit = (code) => {
    calls.exit.push(code);
  };

  // The connection helper must not be reached in any of these tests.
  stubModuleExports("../../src/config/database.js", async () => {
    calls.connectDB += 1;
    throw new Error("blocked: connectDB must not be reached");
  });

  // Count (and neutralize) every bulk delete on the real models.
  for (const name of [
    "User",
    "Society",
    "Project",
    "CalendarEvent",
    "Announcement",
    "Role",
    "Permission",
    "RolePermission",
    "UserRole",
    "Transaction",
    "Event",
  ]) {
    const Model = require(`../../src/models/${name}.js`);
    const original = Model.deleteMany;
    Model.deleteMany = async () => {
      calls.deleteMany += 1;
      return { deletedCount: 0 };
    };
    modelStubs.push(() => {
      Model.deleteMany = original;
    });
  }
}

function restoreStubs() {
  mongoose.connect = realConnect;
  process.exit = realExit;
  fs.mkdirSync = realMkdirSync;
  while (modelStubs.length) modelStubs.pop()();
}

beforeEach(installStubs);
afterEach(restoreStubs);

function freshRequire(rel) {
  const resolved = require.resolve(path.join(__dirname, rel));
  delete require.cache[resolved];
  return require(resolved);
}

// ---- clearData -----------------------------------------------------------

test("importing clearData.js does not connect or delete anything", async () => {
  const savedUri = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  try {
    freshRequire("../../src/scripts/clearData.js");
    await settle();
  } finally {
    if (savedUri !== undefined) process.env.MONGODB_URI = savedUri;
  }

  assert.equal(calls.connect, 0, "mongoose.connect was called at import time");
  assert.equal(calls.deleteMany, 0, "deleteMany was called at import time");
  assert.deepEqual(calls.exit, [], "process.exit was called at import time");
});

test("clearAllData refuses without authorization and performs no database operation", async () => {
  const clear = freshRequire("../../src/scripts/clearData.js");

  await assert.rejects(
    () => clear.clearAllData({ env: { MONGODB_URI: FAKE_TARGET } }),
    /authorization|refus/i,
  );
  assert.equal(calls.connect, 0);
  assert.equal(calls.deleteMany, 0);
});

test("clearAllData refuses a NODE_ENV=test-only configuration", async () => {
  const clear = freshRequire("../../src/scripts/clearData.js");

  await assert.rejects(
    () =>
      clear.clearAllData({
        env: { MONGODB_URI: FAKE_TARGET, NODE_ENV: "test" },
      }),
    /authorization|refus/i,
  );
  assert.equal(calls.connect, 0);
  assert.equal(calls.deleteMany, 0);
});

test("clearAllData does not delete when the connection cannot be established", async () => {
  const clear = freshRequire("../../src/scripts/clearData.js");

  // Authorized, but mongoose.connect is stubbed to fail: no delete may run.
  await assert.rejects(() => clear.clearAllData({ env: AUTHORIZED_ENV }));
  assert.equal(calls.connect, 1);
  assert.equal(calls.deleteMany, 0);
});

// ---- seed ----------------------------------------------------------------

test("seed refuses without authorization before connecting or deleting", async () => {
  const seed = freshRequire("../../src/scripts/seed.js");

  await assert.rejects(
    () => seed({ env: { MONGODB_URI: FAKE_TARGET } }),
    /authorization|refus/i,
  );
  assert.equal(calls.connectDB, 0, "connectDB was reached before validation");
  assert.equal(calls.deleteMany, 0);
});

test("seed refuses a production environment even with an authorization token", async () => {
  const seed = freshRequire("../../src/scripts/seed.js");

  await assert.rejects(
    () =>
      seed({
        env: { ...AUTHORIZED_ENV, NODE_ENV: "production" },
      }),
    /production|refus/i,
  );
  assert.equal(calls.connectDB, 0);
  assert.equal(calls.deleteMany, 0);
});

test("seed refuses a missing database URI before connecting", async () => {
  const seed = freshRequire("../../src/scripts/seed.js");

  await assert.rejects(() => seed({ env: {} }), /uri|refus/i);
  assert.equal(calls.connectDB, 0);
  assert.equal(calls.deleteMany, 0);
});

// ---- restore -------------------------------------------------------------

test("importing restore.js does not run a restore", async () => {
  freshRequire("../../src/scripts/restore.js");
  await settle();

  assert.equal(calls.connectDB, 0, "connectDB was called at import time");
  assert.equal(calls.connect, 0);
  assert.deepEqual(calls.exit, [], "process.exit was called at import time");
});

test("importing backup.js does not run a backup or create directories", async () => {
  freshRequire("../../src/scripts/backup.js");
  await settle();

  assert.equal(calls.connectDB, 0, "connectDB was called at import time");
  assert.deepEqual(calls.exit, [], "process.exit was called at import time");
  assert.deepEqual(calls.mkdir, [], "a directory was created at import time");
});

function writeTempBackup(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbapp-restore-test-"));
  const file = path.join(dir, "backup-test.json");
  fs.writeFileSync(file, content, "utf8");
  return { dir, file };
}

test("restore rejects a malformed backup before connecting or deleting", async () => {
  const restore = freshRequire("../../src/scripts/restore.js");
  const { dir, file } = writeTempBackup("{ this is not json");
  try {
    await assert.rejects(() =>
      restore.performRestore({ file, env: AUTHORIZED_ENV }),
    );
    assert.equal(calls.connectDB, 0);
    assert.equal(calls.deleteMany, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("restore rejects a structurally invalid backup before connecting", async () => {
  const restore = freshRequire("../../src/scripts/restore.js");
  const invalidBackups = [
    {},
    { database: "sbapp_unit_fixture" },
    { database: "sbapp_unit_fixture", collections: [] },
    { database: "sbapp_unit_fixture", collections: { users: "not-an-array" } },
    { database: "sbapp_unit_fixture", collections: { "system.users": [] } },
    { database: "sbapp_unit_fixture", collections: { "bad$name": [] } },
    { database: "sbapp_unit_fixture", collections: { users: [1, 2] } },
    { database: "sbapp_unit_fixture", collections: { users: [{ _id: "not-an-object-id" }] } },
  ];

  for (const data of invalidBackups) {
    const { dir, file } = writeTempBackup(JSON.stringify(data));
    try {
      await assert.rejects(
        () => restore.performRestore({ file, env: AUTHORIZED_ENV }),
        undefined,
        `backup ${JSON.stringify(data)} was accepted`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  assert.equal(calls.connectDB, 0);
  assert.equal(calls.deleteMany, 0);
});

test("restore refuses without authorization even for a valid backup", async () => {
  const restore = freshRequire("../../src/scripts/restore.js");
  const { dir, file } = writeTempBackup(
    JSON.stringify({ database: "sbapp_unit_fixture", collections: { users: [] } }),
  );
  try {
    await assert.rejects(
      () => restore.performRestore({ file, env: { MONGODB_URI: FAKE_TARGET } }),
      /authorization|refus/i,
    );
    assert.equal(calls.connectDB, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
