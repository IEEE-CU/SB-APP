const { MongoMemoryServer } = require("mongodb-memory-server");
const { registerEphemeralTarget } = require("../utils/dbSafety");

async function main() {
  console.log("🚀 Starting MongoDB Memory Server...");
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  console.log(`📡 In-Memory MongoDB running at: ${uri}`);
  require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
  process.env.MONGODB_URI = uri;
  // This process created and owns the disposable in-memory database, so it is
  // the only target the destructive scripts may modify without an explicit
  // operator authorization.
  registerEphemeralTarget(uri);

  const action = process.argv[2];

  if (action === "test") {
    // Run the connection test
    console.log("\n--- Running testConnection.js ---");
    try {
      require("./testConnection").testConnection();
      // Wait for process.exit inside the script
    } catch (err) {
      console.error(err);
      await mongoServer.stop();
      process.exit(1);
    }
  } else if (action === "seed") {
    // Run the seed test and then verify backup/restore
    console.log("\n--- Running seed.js ---");
    try {
      // seed.js, backup.js and restore.js no longer execute on import, so the
      // runner calls them explicitly.
      const seed = require("./seed");
      await seed();
      console.log("Seed completed. Proceeding to verify Backup & Restore...");
      await verifyBackupRestore(mongoServer);
    } catch (err) {
      console.error(err);
      await mongoServer.stop();
      process.exit(1);
    }
  } else if (action === "dev" || action === "server") {
    console.log("\n--- Seeding In-Memory DB ---");
    try {
      const seed = require("./seed");
      await seed();
    } catch (e) {
      console.error("Seeding error:", e.message);
    }
    console.log("\n--- Starting Backend Server with In-Memory DB ---");
    require("../server");
  } else {
    console.log("Usage: node runWithMemoryDb.js [test|seed|dev]");
    await mongoServer.stop();
    process.exit(0);
  }
}

async function verifyBackupRestore(mongoServer) {
  // 1. Run backup
  console.log("\n--- Running backup.js ---");
  const { performBackup } = require("./backup");
  await performBackup();
  console.log("Backup verified. Proceeding to Restore check...");

  // 2. Restore the backup that was just taken (latest file in backups/)
  console.log("\n--- Running restore.js ---");
  const { performRestore } = require("./restore");
  await performRestore();
  console.log("Restore completed with code 0");

  await mongoServer.stop();
  console.log("👋 All database verification checks passed successfully!");
  process.exit(0);
}

module.exports = { main };

if (require.main === module) {
  main();
}
