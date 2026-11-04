// AUD-002 follow-up: backup/restore consistency.
//
// restore.js only accepts the collections listed in RESTORABLE_COLLECTIONS and
// rejects a backup containing anything else. backup.js must therefore refuse to
// produce a file that restore would reject, instead of writing it.
//
// No database is used: `connectDB` is stubbed and the connection's `db` is a
// fake. Files are only ever written inside a per-test temporary directory; any
// attempt to write elsewhere (for example the repository's backups/ folder) is
// recorded and suppressed.
const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const mongoose = require("mongoose");

const DB_NAME = "sbapp_unit_fixture";
const ENV = { MONGODB_URI: `mongodb://127.0.0.1:27017/${DB_NAME}` };

let tmpRoot;
let realWrite;
let realMkdir;
let realClose;
let dbDescriptor;
const attempted = { writes: [], mkdirs: [] };
const calls = { connectDB: 0, find: [] };

function stubModuleExports(relPath, exportsValue) {
  const resolved = require.resolve(path.join(__dirname, relPath));
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
}

function useFakeDatabase(collectionsToDocs) {
  const fakeDb = {
    databaseName: DB_NAME,
    listCollections: () => ({
      toArray: async () => Object.keys(collectionsToDocs).map((name) => ({ name })),
    }),
    collection: (name) => ({
      find: () => {
        calls.find.push(name);
        return { toArray: async () => collectionsToDocs[name] };
      },
    }),
  };
  Object.defineProperty(mongoose.connection, "db", {
    configurable: true,
    get: () => fakeDb,
  });
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sbapp-backup-test-"));
  attempted.writes = [];
  attempted.mkdirs = [];
  calls.connectDB = 0;
  calls.find = [];

  realWrite = fs.writeFileSync;
  fs.writeFileSync = (target, ...rest) => {
    attempted.writes.push(String(target));
    if (String(target).startsWith(tmpRoot)) return realWrite(target, ...rest);
    return undefined; // never write outside the temp directory
  };
  realMkdir = fs.mkdirSync;
  fs.mkdirSync = (target, ...rest) => {
    attempted.mkdirs.push(String(target));
    if (String(target).startsWith(tmpRoot)) return realMkdir(target, ...rest);
    return undefined;
  };

  dbDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, "db");
  realClose = mongoose.connection.close;
  mongoose.connection.close = async () => {};

  stubModuleExports("../../src/config/database.js", async () => {
    calls.connectDB += 1;
    return { connection: { name: DB_NAME } };
  });
});

afterEach(() => {
  mock.timers.reset();
  fs.writeFileSync = realWrite;
  fs.mkdirSync = realMkdir;
  mongoose.connection.close = realClose;
  delete mongoose.connection.db;
  if (dbDescriptor) Object.defineProperty(mongoose.connection, "db", dbDescriptor);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function loadBackup() {
  const resolved = require.resolve("../../src/scripts/backup.js");
  delete require.cache[resolved];
  return require(resolved);
}

const listDir = () => fs.readdirSync(tmpRoot).sort();

// ---- supported collections: existing behavior ------------------------------

test("a database with only approved collections is backed up", async () => {
  useFakeDatabase({
    users: [{ _id: "64b7f8f2a1b2c3d4e5f60718", name: "Alice" }],
    societies: [],
  });
  const { performBackup } = loadBackup();

  const file = await performBackup({ env: ENV, backupDir: tmpRoot });

  assert.equal(path.dirname(file), tmpRoot);
  assert.equal(listDir().length, 1);
  assert.ok(path.basename(file).startsWith(`backup-${DB_NAME}-`));
});

test("the backup file format is unchanged for approved collections", async () => {
  const docs = {
    users: [{ _id: "64b7f8f2a1b2c3d4e5f60718", name: "Alice", email: "a@example.com" }],
    events: [{ _id: "64b7f8f2a1b2c3d4e5f60719", title: "Talk" }],
  };
  useFakeDatabase(docs);
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-04T05:06:07.000Z") });
  const { performBackup } = loadBackup();

  const file = await performBackup({ env: ENV, backupDir: tmpRoot });

  assert.equal(
    path.basename(file),
    `backup-${DB_NAME}-2026-03-04T05-06-07-000Z.json`,
  );
  assert.equal(
    fs.readFileSync(file, "utf8"),
    JSON.stringify(
      {
        timestamp: "2026-03-04T05:06:07.000Z",
        database: DB_NAME,
        collections: docs,
      },
      null,
      2,
    ),
  );
});

test("system collections are still skipped, not treated as unsupported", async () => {
  useFakeDatabase({ users: [], "system.views": [] });
  const { performBackup } = loadBackup();

  const file = await performBackup({ env: ENV, backupDir: tmpRoot });

  const written = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(written.collections), ["users"]);
});

test("a backup produced for approved collections is accepted by restore's validation", async () => {
  useFakeDatabase({
    users: [{ _id: "64b7f8f2a1b2c3d4e5f60718", name: "Alice" }],
    projects: [{ _id: "64b7f8f2a1b2c3d4e5f60719", societyId: "64b7f8f2a1b2c3d4e5f6071a" }],
  });
  const { performBackup } = loadBackup();
  const { buildRestorePlan } = require("../../src/scripts/restore.js");

  const file = await performBackup({ env: ENV, backupDir: tmpRoot });

  const { database, plan } = buildRestorePlan(JSON.parse(fs.readFileSync(file, "utf8")));
  assert.equal(database, DB_NAME);
  assert.deepEqual(plan.map((p) => p.name).sort(), ["projects", "users"]);
});

// ---- unsupported collections -------------------------------------------------

test("an unsupported collection aborts the backup with an actionable error", async () => {
  useFakeDatabase({ users: [], reports: [], legacy_things: [] });
  const { performBackup } = loadBackup();

  await assert.rejects(
    () => performBackup({ env: ENV, backupDir: tmpRoot }),
    (err) => {
      assert.equal(err.code, "UNSUPPORTED_COLLECTIONS");
      assert.deepEqual([...err.collections].sort(), ["legacy_things", "reports"]);
      assert.match(err.message, /reports/);
      assert.match(err.message, /legacy_things/);
      assert.match(err.message, /no backup file was written/i);
      return true;
    },
  );
});

test("an unsupported collection is never silently omitted", async () => {
  useFakeDatabase({ users: [{ name: "a" }], reports: [{ x: 1 }] });
  const { performBackup } = loadBackup();

  await assert.rejects(() => performBackup({ env: ENV, backupDir: tmpRoot }));

  assert.deepEqual(listDir(), [], "a backup file was produced without the collection");
});

test("validation happens before any document is read or any file is written", async () => {
  useFakeDatabase({ users: [{ name: "a" }], reports: [{ x: 1 }], societies: [] });
  const { performBackup } = loadBackup();

  await assert.rejects(() => performBackup({ env: ENV, backupDir: tmpRoot }));

  assert.deepEqual(calls.find, [], "documents were read before validation");
  assert.deepEqual(attempted.writes, [], "a file write was attempted");
  assert.deepEqual(attempted.mkdirs, [], "a directory was created");
  assert.deepEqual(listDir(), []);
});

test("a failed validation leaves existing backups untouched", async () => {
  const existing = path.join(tmpRoot, "backup-previous-2026-01-01T00-00-00-000Z.json");
  fs.writeFileSync(existing, "ORIGINAL CONTENT", "utf8");
  useFakeDatabase({ users: [], reports: [] });
  const { performBackup } = loadBackup();

  await assert.rejects(() => performBackup({ env: ENV, backupDir: tmpRoot }));

  assert.deepEqual(listDir(), ["backup-previous-2026-01-01T00-00-00-000Z.json"]);
  assert.equal(fs.readFileSync(existing, "utf8"), "ORIGINAL CONTENT");
});

test("an existing backup with the same name is not overwritten", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-03-04T05:06:07.000Z") });
  const clash = path.join(tmpRoot, `backup-${DB_NAME}-2026-03-04T05-06-07-000Z.json`);
  fs.writeFileSync(clash, "ORIGINAL CONTENT", "utf8");
  useFakeDatabase({ users: [{ name: "new" }] });
  const { performBackup } = loadBackup();

  await assert.rejects(
    () => performBackup({ env: ENV, backupDir: tmpRoot }),
    (err) => err.code === "EEXIST",
  );

  assert.equal(fs.readFileSync(clash, "utf8"), "ORIGINAL CONTENT");
  assert.equal(listDir().length, 1);
});

test("the error names collections but never exposes connection details", async () => {
  useFakeDatabase({ users: [], reports: [] });
  const { performBackup } = loadBackup();
  const secretEnv = {
    MONGODB_URI: `mongodb://svc_user:Sup3rS3cretPw@127.0.0.1:27017/${DB_NAME}?authSource=admin&token=QueryS3cret`,
  };

  await assert.rejects(
    () => performBackup({ env: secretEnv, backupDir: tmpRoot }),
    (err) => {
      for (const leaked of ["Sup3rS3cretPw", "svc_user", "QueryS3cret", "authSource"]) {
        assert.equal(err.message.includes(leaked), false, `leaked ${leaked}`);
      }
      return true;
    },
  );
});

// ---- existing safety checks --------------------------------------------------

test("a missing database URI is still refused before connecting", async () => {
  useFakeDatabase({ users: [] });
  const { performBackup } = loadBackup();

  await assert.rejects(
    () => performBackup({ env: {}, backupDir: tmpRoot }),
    (err) => err.code === "MISSING_URI",
  );
  assert.equal(calls.connectDB, 0);
});

test("a malformed database URI is still refused before connecting", async () => {
  useFakeDatabase({ users: [] });
  const { performBackup } = loadBackup();

  await assert.rejects(
    () => performBackup({ env: { MONGODB_URI: "not-a-uri" }, backupDir: tmpRoot }),
    (err) => err.code === "MALFORMED_URI",
  );
  assert.equal(calls.connectDB, 0);
});

test("the connection is closed when the backup is aborted", async () => {
  useFakeDatabase({ users: [], reports: [] });
  let closed = 0;
  mongoose.connection.close = async () => {
    closed += 1;
  };
  const { performBackup } = loadBackup();

  await assert.rejects(() => performBackup({ env: ENV, backupDir: tmpRoot }));

  assert.equal(closed, 1);
});
