/**
 * Restores a JSON backup produced by backup.js.
 *
 * DESTRUCTIVE: each collection named in the backup is emptied and replaced.
 * Importing this module does nothing; the restore only runs when the file is
 * executed directly or performRestore() is called explicitly. Before any
 * connection or write, the target database is validated and explicitly
 * authorized (see utils/dbSafety.js), and the entire backup is validated and
 * converted up front so that a malformed input cannot fail halfway through
 * after earlier collections were already replaced.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const {
  assertDestructiveTargetAllowed,
  assertConnectedToValidatedTarget,
  DestructiveOperationRefused,
} = require("../utils/dbSafety");

const BACKUP_DIR = path.join(__dirname, "../../../backups");
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,63}$/;

/**
 * The only collections a restore may replace: the collections of every
 * Mongoose model in src/models (32 models, default pluralized collection
 * names, no custom `collection:` options, and no raw collection access
 * elsewhere in the application). A unit test asserts that this list stays
 * identical to the collections the models actually declare, so adding a model
 * without updating it fails the suite.
 *
 * A backup containing any other collection is rejected as a whole. Legacy
 * collections from the retired server/ models (for example `reports`) are
 * deliberately not included.
 */
const RESTORABLE_COLLECTIONS = Object.freeze([
  "announcements",
  "auditlogs",
  "boardcards",
  "calendarevents",
  "channels",
  "communitymessages",
  "conversations",
  "eventregistrations",
  "events",
  "files",
  "institutions",
  "memberships",
  "messages",
  "milestones",
  "notes",
  "notifications",
  "opportunities",
  "permissions",
  "projectreports",
  "projects",
  "reactions",
  "reportsnapshots",
  "roleassignments",
  "rolepermissions",
  "roles",
  "societies",
  "societyterms",
  "sprints",
  "tasks",
  "transactions",
  "userroles",
  "users",
]);
const RESTORABLE_SET = new Set(RESTORABLE_COLLECTIONS);

// Names that must never be used as object keys or collection names, even if
// someone later extends the allowlist.
const PROTOTYPE_SENSITIVE_NAMES = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
]);

const invalidBackup = (message) => {
  throw new DestructiveOperationRefused("INVALID_BACKUP", message);
};

// Names come from the backup file, so keep them short and unambiguous.
const describeName = (value) => JSON.stringify(String(value).slice(0, 60));

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Parse date strings back to Date objects and ObjectId strings to ObjectIds.
 * (Unchanged conversion rules from the original script.)
 */
function parseDocument(doc) {
  const parsed = { ...doc };
  for (const [key, val] of Object.entries(parsed)) {
    // Convert standard ISO date strings back to Date objects
    if (typeof val === "string" && ISO_DATE_PATTERN.test(val)) {
      parsed[key] = new Date(val);
    }
    // If the field is _id or ends in Id, convert to ObjectId if it matches the format
    if (key === "_id" && typeof val === "string") {
      parsed[key] = new mongoose.Types.ObjectId(val);
    } else if (
      key.endsWith("Id") &&
      typeof val === "string" &&
      mongoose.Types.ObjectId.isValid(val)
    ) {
      parsed[key] = new mongoose.Types.ObjectId(val);
    } else if (Array.isArray(val)) {
      parsed[key] = val.map((item) => {
        if (typeof item === "string" && mongoose.Types.ObjectId.isValid(item)) {
          return new mongoose.Types.ObjectId(item);
        }
        return item;
      });
    }
  }
  return parsed;
}

/**
 * Validates the structure of a parsed backup and converts every document.
 * Pure: performs no I/O. Throws DestructiveOperationRefused (INVALID_BACKUP)
 * for anything untrusted or malformed.
 *
 * @returns {{database: string, plan: Array<{name: string, documents: object[]}>}}
 */
function buildRestorePlan(backupData) {
  if (!isPlainObject(backupData)) {
    invalidBackup("Backup file is not a JSON object.");
  }
  // The source database is mandatory: every backup this repository's
  // backup.js has ever produced records it, so a file without it is not a
  // legitimate backup and its origin cannot be established.
  if (
    typeof backupData.database !== "string" ||
    !DATABASE_NAME_PATTERN.test(backupData.database)
  ) {
    invalidBackup("Backup file does not name a valid source database.");
  }
  if (!isPlainObject(backupData.collections)) {
    invalidBackup("Backup file has no collections object.");
  }

  const plan = [];
  for (const [name, documents] of Object.entries(backupData.collections)) {
    if (name.startsWith("system.")) {
      invalidBackup(
        `Backup file contains a system collection (${describeName(name)}).`,
      );
    }
    if (PROTOTYPE_SENSITIVE_NAMES.has(name)) {
      invalidBackup(
        `Backup file contains a reserved collection name (${describeName(name)}).`,
      );
    }
    if (!RESTORABLE_SET.has(name)) {
      invalidBackup(
        `Backup file contains a collection that is not restorable (${describeName(name)}).`,
      );
    }
    if (!Array.isArray(documents)) {
      invalidBackup(`Collection "${name}" in the backup is not an array.`);
    }

    const parsedDocs = documents.map((doc, index) => {
      if (!isPlainObject(doc)) {
        invalidBackup(
          `Collection "${name}" contains a non-object document at position ${index}.`,
        );
      }
      try {
        return parseDocument(doc);
      } catch {
        return invalidBackup(
          `Collection "${name}" contains an invalid identifier at position ${index}.`,
        );
      }
    });

    plan.push({ name, documents: parsedDocs });
  }

  return { database: backupData.database, plan };
}

/**
 * A backup may only be restored into the database it was taken from. There
 * is intentionally no override: restoring a different database's data would
 * replace this one's contents with foreign data.
 */
function assertBackupMatchesTarget(sourceDatabase, targetDatabase) {
  if (sourceDatabase !== targetDatabase) {
    throw new DestructiveOperationRefused(
      "CROSS_DATABASE_RESTORE",
      `Refusing to restore: the backup was taken from database ${describeName(sourceDatabase)}, which is not the target database ${describeName(targetDatabase)}.`,
    );
  }
}

function resolveBackupFile(requested) {
  let targetFile = requested;
  if (
    targetFile === "seed" ||
    targetFile === "test" ||
    (targetFile && !targetFile.endsWith(".json"))
  ) {
    targetFile = undefined;
  }

  if (!targetFile) {
    if (!fs.existsSync(BACKUP_DIR)) {
      throw new Error("Backups directory does not exist. Run backup first.");
    }

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      throw new Error("No backup files found.");
    }

    return path.join(BACKUP_DIR, files[0].name);
  }

  return path.isAbsolute(targetFile)
    ? targetFile
    : path.resolve(process.cwd(), targetFile);
}

async function performRestore({ file, env = process.env } = {}) {
  // 1. Validate and authorize the target BEFORE anything else.
  const target = assertDestructiveTargetAllowed({
    operation: "restore",
    env,
  });

  // 2. Load and fully validate the backup. No database access yet.
  const targetFile = resolveBackupFile(file);
  if (!fs.existsSync(targetFile)) {
    throw new Error(`Backup file not found: ${targetFile}`);
  }

  console.log(`📦 Loading backup file: ${targetFile}`);
  let backupData;
  try {
    backupData = JSON.parse(fs.readFileSync(targetFile, "utf8"));
  } catch {
    invalidBackup("Backup file is not valid JSON.");
  }

  const { database, plan } = buildRestorePlan(backupData);
  console.log(`- Backup Timestamp: ${backupData.timestamp}`);
  console.log(`- Source Database: ${database}`);

  // A named target is known before connecting: refuse a cross-database
  // restore without ever opening a connection. (A registered in-memory
  // target has no name until connected; it is checked below.)
  if (target.dbName) {
    assertBackupMatchesTarget(database, target.dbName);
  }

  // 3. Connect, then confirm the live connection is the validated target and
  //    the backup's source before the first destructive write.
  const conn = await connectDB();
  if (!conn) {
    throw new Error("Database connection failed; restore aborted.");
  }

  try {
    assertConnectedToValidatedTarget(target, mongoose.connection.name);
    assertBackupMatchesTarget(database, mongoose.connection.name);
    const db = mongoose.connection.db;

    // 4. Only now perform destructive writes.
    for (const { name, documents } of plan) {
      console.log(
        `- Restoring collection: ${name} (${documents.length} documents)...`,
      );

      // Clean collection first
      await db.collection(name).deleteMany({});

      if (documents.length > 0) {
        await db.collection(name).insertMany(documents);
      }
      console.log(`  ✓ Restored ${documents.length} documents.`);
    }

    console.log("\n✅ Database restore completed successfully!");
  } finally {
    await mongoose.connection.close();
  }
}

module.exports = {
  performRestore,
  buildRestorePlan,
  assertBackupMatchesTarget,
  resolveBackupFile,
  RESTORABLE_COLLECTIONS,
};

if (require.main === module) {
  performRestore({ file: process.argv[2] })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Restore process failed:", error.message || error);
      process.exit(1);
    });
}
