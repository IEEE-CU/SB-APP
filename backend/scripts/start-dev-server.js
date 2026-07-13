#!/usr/bin/env node
const { MongoMemoryServer } = require("mongodb-memory-server");

async function main() {
  console.log("🚀 Starting MongoDB Memory Server...");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || "your-secret-key-change-in-production";
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
  process.env.NODE_ENV = "development";
  process.env.PORT = process.env.PORT || 5000;

  console.log(`📡 In-Memory MongoDB running at: ${uri}`);
  console.log(
    "🌱 Seeding database with IEEE societies, admins, and sample data...",
  );

  // Monkey patch process.exit to prevent seed script from exiting the process
  const originalExit = process.exit;
  process.exit = (code) => {
    if (code !== 0) {
      console.error(`❌ Seeding failed with exit code ${code}`);
      originalExit(code);
    }
    process.exit = originalExit; // Restore original exit
    console.log("✅ Seeding completed. Booting Express server...");
    bootServer();
  };

  // Load and run seed script
  require("../src/scripts/seed.js");
}

function bootServer() {
  // Require server.js to start express app
  require("../src/server.js");
}

main().catch((err) => {
  console.error("❌ Failed to start dev server:", err);
  process.exit(1);
});
