#!/usr/bin/env node
const { MongoMemoryServer } = require("mongodb-memory-server");
const { registerEphemeralTarget } = require("../src/utils/dbSafety");
const { secretForLocalRun } = require("../src/utils/jwtSecret");

if (process.env.NODE_ENV === "production") {
  console.error("This development server refuses to run with NODE_ENV=production.");
  process.exit(1);
}

async function main() {
  console.log("🚀 Starting MongoDB Memory Server...");
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGODB_URI = uri;
  // This process owns the disposable in-memory database; it is the only
  // target the seed script may wipe without explicit operator authorization.
  registerEphemeralTarget(uri);
  // Never a literal: a configured valid secret is kept, otherwise a random per-run one is
  // used (tokens do not survive a restart of this disposable local server).
  const { secret, generated } = secretForLocalRun(process.env);
  process.env.JWT_SECRET = secret;
  if (generated) console.log("🔑 Using a random per-run JWT secret (JWT_SECRET not set to a valid value).");
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
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
  const seed = require("../src/scripts/seed.js");
  seed()
    .then(() => {
      process.exit = originalExit; // Restore original exit
      console.log("✅ Seeding completed. Booting Express server...");
      bootServer();
    })
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      originalExit(1);
    });
}

function bootServer() {
  // Require server.js to start express app
  require("../src/server.js");
}

module.exports = { main };

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Failed to start dev server:", err);
    process.exit(1);
  });
}
