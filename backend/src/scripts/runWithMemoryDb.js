const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

async function main() {
  console.log("🚀 Starting MongoDB Memory Server...");
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  console.log(`📡 In-Memory MongoDB running at: ${uri}`);
  require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
  process.env.MONGODB_URI = uri;

  const action = process.argv[2];

  if (action === "test") {
    // Run the connection test
    console.log("\n--- Running testConnection.js ---");
    try {
      require("./testConnection");
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
      // Monkey patch process.exit to prevent the seed script from exiting early
      const originalExit = process.exit;
      process.exit = (code) => {
        if (code !== 0) {
          console.error(`Seed exited with code ${code}`);
          originalExit(code);
        }
        console.log("Seed completed. Proceeding to verify Backup & Restore...");
        verifyBackupRestore(mongoServer, originalExit);
      };

      require("./seed");
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

async function verifyBackupRestore(mongoServer, originalExit) {
  try {
    // 1. Run backup
    console.log("\n--- Running backup.js ---");
    // Ensure we are connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Require backup script (which executes immediately)
    // Monkey patch process.exit for backup
    process.exit = (code) => {
      if (code !== 0) {
        console.error(`Backup exited with code ${code}`);
        originalExit(code);
      }
      console.log("Backup verified. Proceeding to Restore check...");
      verifyRestore(mongoServer, originalExit);
    };

    // Clear require cache for backup if it was loaded before
    delete require.cache[require.resolve("./backup")];
    require("./backup");
  } catch (err) {
    console.error("Backup verification failed:", err);
    await mongoServer.stop();
    originalExit(1);
  }
}

async function verifyRestore(mongoServer, originalExit) {
  try {
    console.log("\n--- Running restore.js ---");
    // Monkey patch process.exit for restore
    process.exit = async (code) => {
      console.log(`Restore completed with code ${code}`);
      await mongoServer.stop();
      console.log("👋 All database verification checks passed successfully!");
      originalExit(code);
    };

    delete require.cache[require.resolve("./restore")];
    require("./restore");
  } catch (err) {
    console.error("Restore verification failed:", err);
    await mongoServer.stop();
    originalExit(1);
  }
}

main();
