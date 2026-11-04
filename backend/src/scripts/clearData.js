/**
 * Clears the main application collections.
 *
 * DESTRUCTIVE. Importing this module does nothing; the wipe only runs when the
 * file is executed directly (`node src/scripts/clearData.js`) or when
 * clearAllData() is called explicitly. Before any connection or write the
 * target database is validated and the operation must be explicitly
 * authorized (see utils/dbSafety.js).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const {
  assertDestructiveTargetAllowed,
  assertConnectedToValidatedTarget,
} = require("../utils/dbSafety");

const COLLECTION_LABELS = [
  ["User", "Users"],
  ["Society", "Societies"],
  ["Transaction", "Transactions"],
  ["Event", "Events"],
  ["Project", "Projects"],
  ["CalendarEvent", "CalendarEvents"],
  ["Announcement", "Announcements"],
];

async function clearAllData({ env = process.env } = {}) {
  // Validate and authorize BEFORE connecting or touching any collection.
  const target = assertDestructiveTargetAllowed({
    operation: "clearData",
    env,
  });

  const models = require("../models");

  try {
    await mongoose.connect(env.MONGODB_URI);
    assertConnectedToValidatedTarget(target, mongoose.connection.name);
    console.log(`Connected to database "${mongoose.connection.name}"`);

    console.log("\nClearing all collections...\n");

    const results = await Promise.all(
      COLLECTION_LABELS.map(([modelName]) => models[modelName].deleteMany({})),
    );

    results.forEach((result, index) => {
      console.log(
        `✅ ${COLLECTION_LABELS[index][1]}: ${result.deletedCount} documents deleted`,
      );
    });

    console.log("\n✅ All data cleared successfully!");
    return results;
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed.");
  }
}

module.exports = { clearAllData };

if (require.main === module) {
  clearAllData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error clearing data:", error.message);
      process.exit(1);
    });
}
