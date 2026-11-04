/**
 * Scrapes award/grant/scholarship listings from official IEEE society pages
 * and upserts them into the Opportunity collection.
 *
 * Usage: node src/scripts/scrapeOpportunities.js
 */
require("dotenv").config();
const connectDB = require("../config/database");
const { scrapeAllSocieties } = require("../services/opportunityScraper");
const { assertExplicitTarget } = require("../utils/dbSafety");

// Importing this module does nothing; the scrape (which writes and removes stale listings)
// only runs when the file is executed directly, against an explicitly configured database
// (no default).
async function run({ env = process.env } = {}) {
  assertExplicitTarget({ operation: "scrape opportunities", env });
  await connectDB();
  const results = await scrapeAllSocieties();

  for (const r of results) {
    if (r.ok) {
      console.log(`[${r.society}] ${r.items.length} item(s) from ${r.sourceUrl}`);
    } else {
      console.log(`[${r.society}] FAILED (${r.error}) — falling back to link only`);
    }
  }

}

module.exports = run;

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Opportunity scrape failed:", err);
      process.exit(1);
    });
}
