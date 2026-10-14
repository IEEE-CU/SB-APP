/**
 * Exports every collection of the configured database to a JSON file in the
 * repository-level `backups/` directory (git-ignored).
 *
 * Read-only with respect to the database. Importing this module does nothing;
 * the backup only runs when the file is executed directly or performBackup()
 * is called explicitly. The target must be explicitly configured and
 * parseable (no silent default).
 *
 * NOTE: the export is the raw collection contents. That includes the `users`
 * collection with bcrypt password hashes, so the resulting file must be
 * treated as sensitive.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const { assertExplicitTarget } = require("../utils/dbSafety");
// Single source of truth: restore.js decides which collections can be
// restored, so a backup must contain only those.
const { RESTORABLE_COLLECTIONS } = require("./restore");

const BACKUP_DIR = path.join(__dirname, "../../../backups");
const MAX_LISTED_COLLECTIONS = 20;

/**
 * Throws if the database holds any (non-system) collection that restore.js
 * would reject. Never skips collections silently: a backup that cannot be
 * restored completely is not written at all.
 */
function assertBackupCollectionsSupported(collectionNames) {
  const unsupported = collectionNames.filter(
    (name) => !RESTORABLE_COLLECTIONS.includes(name),
  );
  if (unsupported.length === 0) return;

  const shown = unsupported
    .slice(0, MAX_LISTED_COLLECTIONS)
    .map((name) => JSON.stringify(String(name).slice(0, 60)));
  const more =
    unsupported.length > MAX_LISTED_COLLECTIONS
      ? ` and ${unsupported.length - MAX_LISTED_COLLECTIONS} more`
      : "";

  const error = new Error(
    `Backup aborted: the database contains collections that restore does not support: ${shown.join(", ")}${more}. ` +
      "No backup file was written. Remove or migrate these collections, or deliberately extend " +
      "RESTORABLE_COLLECTIONS in src/scripts/restore.js, before backing up.",
  );
  error.code = "UNSUPPORTED_COLLECTIONS";
  error.collections = unsupported;
  throw error;
}

const performBackup = async ({
  env = process.env,
  backupDir = BACKUP_DIR,
} = {}) => {
  // Refuse a missing or malformed target before connecting.
  assertExplicitTarget({ operation: "backup", env });

  console.log("📦 Starting MongoDB Backup process...");

  // Connect to database
  const conn = await connectDB();
  if (!conn) {
    throw new Error("Database connection failed; backup aborted.");
  }

  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    // Validate every collection BEFORE reading documents or touching the
    // filesystem. System collections are skipped (as before); anything else
    // restore would reject aborts the backup.
    assertBackupCollectionsSupported(
      collections
        .map((collectionInfo) => collectionInfo.name)
        .filter((name) => !name.startsWith("system.")),
    );

    const backupData = {
      timestamp: new Date().toISOString(),
      database: db.databaseName,
      collections: {},
    };

    for (const collectionInfo of collections) {
      const colName = collectionInfo.name;

      // Skip system collections or index specs if any
      if (colName.startsWith("system.")) continue;

      console.log(`- Fetching documents from: ${colName}...`);
      const documents = await db.collection(colName).find({}).toArray();
      backupData.collections[colName] = documents;
      console.log(`  ✓ Read ${documents.length} documents.`);
    }

    // Ensure backups directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilename = `backup-${db.databaseName}-${timestampStr}.json`;
    const backupFilePath = path.join(backupDir, backupFilename);

    // Flag "wx": fail instead of overwriting an existing backup.
    fs.writeFileSync(
      backupFilePath,
      JSON.stringify(backupData, null, 2),
      { encoding: "utf8", flag: "wx" },
    );

    console.log(`\n✅ Backup completed successfully!`);
    console.log(`📂 Saved to: ${backupFilePath}`);

    return backupFilePath;
  } finally {
    await mongoose.connection.close();
  }
};

module.exports = { performBackup };

if (require.main === module) {
  performBackup()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Backup process failed:", error.message || error);
      process.exit(1);
    });
}
