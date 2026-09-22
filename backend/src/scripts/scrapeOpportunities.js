/**
 * Scrapes award/grant/scholarship listings from official IEEE society pages
 * and upserts them into the Opportunity collection.
 *
 * Usage: node src/scripts/scrapeOpportunities.js
 */
require("dotenv").config();
const connectDB = require("../config/database");
const { scrapeAllSocieties } = require("../services/opportunityScraper");

async function run() {
  await connectDB();
  const results = await scrapeAllSocieties();

  for (const r of results) {
    if (r.ok) {
      console.log(`[${r.society}] ${r.items.length} item(s) from ${r.sourceUrl}`);
    } else {
      console.log(`[${r.society}] FAILED (${r.error}) — falling back to link only`);
    }
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Opportunity scrape failed:", err);
  process.exit(1);
});
