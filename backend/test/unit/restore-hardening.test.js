// AUD-002 follow-up: restore scope and target hardening.
//
// - Only collections that the application's models actually use may be
//   restored; system and prototype-sensitive names are rejected.
// - A backup taken from a different database is refused (never downgraded to
//   a warning), and a backup that does not name its source is refused.
// - Everything is decided before any database connection or deletion.
//
// All database entry points are stubbed; URIs are inert placeholders.
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const mongoose = require("mongoose");

const TARGET_DB = "sbapp_unit_fixture";
const AUTHORIZED_ENV = {
  MONGODB_URI: `mongodb://127.0.0.1:27017/${TARGET_DB}`,
  ALLOW_DESTRUCTIVE_DB_OPS: TARGET_DB,
};

const calls = { connect: 0, connectDB: 0, deleteMany: 0 };
let realConnect;

function stubModuleExports(relPath, exportsValue) {
  const resolved = require.resolve(path.join(__dirname, relPath));
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
}

beforeEach(() => {
  calls.connect = 0;
  calls.connectDB = 0;
  calls.deleteMany = 0;
  realConnect = mongoose.connect;
  mongoose.connect = async () => {
    calls.connect += 1;
    throw new Error("blocked: test must never connect to a database");
  };
  stubModuleExports("../../src/config/database.js", async () => {
    calls.connectDB += 1;
    throw new Error("blocked: connectDB must not be reached");
  });
});

afterEach(() => {
  mongoose.connect = realConnect;
});

function loadRestore() {
  const resolved = require.resolve("../../src/scripts/restore.js");
  delete require.cache[resolved];
  return require(resolved);
}

function writeTempBackup(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbapp-restore-hardening-"));
  const file = path.join(dir, "backup-test.json");
  fs.writeFileSync(
    file,
    typeof data === "string" ? data : JSON.stringify(data),
    "utf8",
  );
  return { dir, file };
}

async function restoreFrom(data, env = AUTHORIZED_ENV) {
  const restore = loadRestore();
  const { dir, file } = writeTempBackup(data);
  try {
    return await restore.performRestore({ file, env });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const validBackup = (collections, database = TARGET_DB) => ({
  timestamp: "2026-01-01T00:00:00.000Z",
  database,
  collections,
});

// ---- collection policy ---------------------------------------------------

test("restorable collections exactly match the collections of the application's models", () => {
  const { RESTORABLE_COLLECTIONS } = loadRestore();
  const modelsDir = path.join(__dirname, "../../src/models");
  const fromModels = fs
    .readdirSync(modelsDir)
    .filter((f) => f.endsWith(".js") && f !== "index.js")
    .map((f) => require(path.join(modelsDir, f)).collection.name)
    .sort();

  assert.ok(Array.isArray(RESTORABLE_COLLECTIONS));
  assert.equal(Object.isFrozen(RESTORABLE_COLLECTIONS), true);
  assert.deepEqual([...RESTORABLE_COLLECTIONS].sort(), fromModels);
});

test("a plan for approved collections is accepted", () => {
  const { buildRestorePlan, RESTORABLE_COLLECTIONS } = loadRestore();
  const collections = {};
  for (const name of RESTORABLE_COLLECTIONS) collections[name] = [];

  const { plan, database } = buildRestorePlan(validBackup(collections));

  assert.equal(database, TARGET_DB);
  assert.deepEqual(
    plan.map((p) => p.name).sort(),
    [...RESTORABLE_COLLECTIONS].sort(),
  );
});

test("an unknown collection is rejected", () => {
  const { buildRestorePlan } = loadRestore();

  for (const name of ["not_an_app_collection", "reports", "admin", "Users"]) {
    assert.throws(
      () => buildRestorePlan(validBackup({ [name]: [] })),
      (err) => err.code === "INVALID_BACKUP",
      `accepted unknown collection ${name}`,
    );
  }
});

test("system collections are rejected", () => {
  const { buildRestorePlan } = loadRestore();

  for (const name of ["system.users", "system.indexes", "system.profile"]) {
    assert.throws(
      () => buildRestorePlan(validBackup({ [name]: [] })),
      (err) => err.code === "INVALID_BACKUP",
      name,
    );
  }
});

test("prototype-sensitive collection names are rejected (as parsed from a file)", () => {
  const { buildRestorePlan } = loadRestore();

  for (const name of [
    "__proto__",
    "constructor",
    "prototype",
    "toString",
    "hasOwnProperty",
  ]) {
    // JSON.parse creates `__proto__` as an own, enumerable key like a file would.
    const data = JSON.parse(
      `{"database":"${TARGET_DB}","collections":{${JSON.stringify(name)}:[]}}`,
    );
    assert.throws(
      () => buildRestorePlan(data),
      (err) => err.code === "INVALID_BACKUP",
      `accepted ${name}`,
    );
  }
});

test("one unknown collection rejects the whole plan, including valid ones", () => {
  const { buildRestorePlan } = loadRestore();

  assert.throws(
    () =>
      buildRestorePlan(
        validBackup({ users: [{ name: "a" }], unexpected: [], societies: [] }),
      ),
    (err) => err.code === "INVALID_BACKUP",
  );
});

test("a malformed document anywhere rejects the whole plan", () => {
  const { buildRestorePlan } = loadRestore();

  assert.throws(
    () =>
      buildRestorePlan(
        validBackup({
          users: [{ name: "ok" }],
          societies: [{ _id: "not-an-object-id" }],
        }),
      ),
    (err) => err.code === "INVALID_BACKUP",
  );
});

test("every collection is validated before any database connection is attempted", async () => {
  await assert.rejects(
    () =>
      restoreFrom(
        validBackup({
          users: [],
          societies: [],
          events: [],
          surprise_collection: [],
        }),
      ),
    (err) => err.code === "INVALID_BACKUP",
  );

  assert.equal(calls.connectDB, 0);
  assert.equal(calls.connect, 0);
  assert.equal(calls.deleteMany, 0);
});

// ---- source / target database -------------------------------------------

test("a backup whose source database differs from the target is refused before connecting", async () => {
  await assert.rejects(
    () => restoreFrom(validBackup({ users: [] }, "some_other_database")),
    (err) => err.code === "CROSS_DATABASE_RESTORE",
  );

  assert.equal(calls.connectDB, 0, "connected despite a database mismatch");
  assert.equal(calls.connect, 0);
});

test("a database-name mismatch is not accepted merely because the case differs", async () => {
  await assert.rejects(
    () => restoreFrom(validBackup({ users: [] }, TARGET_DB.toUpperCase())),
    (err) => err.code === "CROSS_DATABASE_RESTORE",
  );
  assert.equal(calls.connectDB, 0);
});

test("a backup without source-database metadata is refused (fail closed)", async () => {
  for (const database of [undefined, null, "", 42, {}]) {
    const data = { timestamp: "2026-01-01T00:00:00.000Z", collections: { users: [] } };
    if (database !== undefined) data.database = database;

    await assert.rejects(
      () => restoreFrom(data),
      (err) => err.code === "INVALID_BACKUP",
      `accepted database=${JSON.stringify(database)}`,
    );
  }
  assert.equal(calls.connectDB, 0);
});

test("a matching source and target database is accepted up to the connection step", async () => {
  // The connection helper is stubbed to fail, so reaching it proves that every
  // pre-connection check (authorization, backup validation, database match)
  // passed, and that no delete happened.
  await assert.rejects(
    () => restoreFrom(validBackup({ users: [], societies: [] })),
    /blocked: connectDB must not be reached/,
  );

  assert.equal(calls.connectDB, 1);
  assert.equal(calls.deleteMany, 0);
});

test("assertBackupMatchesTarget compares names exactly", () => {
  const { assertBackupMatchesTarget } = loadRestore();

  assert.doesNotThrow(() => assertBackupMatchesTarget("db_a", "db_a"));
  assert.throws(
    () => assertBackupMatchesTarget("db_a", "db_b"),
    (err) => err.code === "CROSS_DATABASE_RESTORE",
  );
  assert.throws(
    () => assertBackupMatchesTarget("db_a", "DB_A"),
    (err) => err.code === "CROSS_DATABASE_RESTORE",
  );
});

// ---- messages -------------------------------------------------------------

test("errors never contain credentials or query parameters from the URI", async () => {
  const secretEnv = {
    MONGODB_URI: `mongodb://svc_user:Sup3rS3cretPw@127.0.0.1:27017/${TARGET_DB}?authSource=admin&secret=QueryS3cret`,
    ALLOW_DESTRUCTIVE_DB_OPS: TARGET_DB,
  };
  const scenarios = [
    validBackup({ users: [] }, "some_other_database"), // cross-database
    validBackup({ unexpected_collection: [] }), // unknown collection
    { collections: { users: [] } }, // missing source database
  ];

  for (const data of scenarios) {
    let error;
    try {
      await restoreFrom(data, secretEnv);
    } catch (e) {
      error = e;
    }
    assert.ok(error, "expected a refusal");
    const text = `${error.message}`;
    for (const leaked of ["Sup3rS3cretPw", "svc_user", "QueryS3cret", "authSource"]) {
      assert.equal(text.includes(leaked), false, `message leaked ${leaked}`);
    }
  }
});

// ---- conversion compatibility ---------------------------------------------

test("valid documents are converted exactly as before (ObjectIds and Dates)", () => {
  const { buildRestorePlan } = loadRestore();
  const id = "64b7f8f2a1b2c3d4e5f60718";
  const societyId = "64b7f8f2a1b2c3d4e5f60719";
  const memberId = "64b7f8f2a1b2c3d4e5f6071a";

  const { plan } = buildRestorePlan(
    validBackup({
      users: [
        {
          _id: id,
          name: "Alice",
          societyId,
          members: [memberId, "plain text", 7],
          createdAt: "2026-02-03T04:05:06.000Z",
          email: "a@example.com",
          nested: { keep: "as-is" },
        },
      ],
    }),
  );

  const doc = plan[0].documents[0];
  assert.equal(plan[0].name, "users");
  assert.ok(doc._id instanceof mongoose.Types.ObjectId);
  assert.equal(doc._id.toString(), id);
  assert.ok(doc.societyId instanceof mongoose.Types.ObjectId);
  assert.equal(doc.societyId.toString(), societyId);
  assert.ok(doc.members[0] instanceof mongoose.Types.ObjectId);
  assert.equal(doc.members[1], "plain text");
  assert.equal(doc.members[2], 7);
  assert.ok(doc.createdAt instanceof Date);
  assert.equal(doc.createdAt.toISOString(), "2026-02-03T04:05:06.000Z");
  assert.equal(doc.name, "Alice");
  assert.equal(doc.email, "a@example.com");
  assert.deepEqual(doc.nested, { keep: "as-is" });
});
