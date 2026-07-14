#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: envPath });

const StorageService = require("../services/storage/StorageService");

async function main() {
  try {
    const storageService = new StorageService();
    const blobName = process.argv[2] || "REPLACE_WITH_AZURE_BLOB_NAME";

    if (blobName === "REPLACE_WITH_AZURE_BLOB_NAME") {
      console.error(
        "Please replace REPLACE_WITH_AZURE_BLOB_NAME with an actual Azure blob name or pass it as the first argument.",
      );
      process.exit(1);
    }

    const result = await storageService.deleteFile(blobName);

    console.log("=========================================");
    console.log("StorageService Delete Test");
    console.log("=========================================");
    console.log(`Blob Name   : ${result.blobName}`);
    console.log(`Deleted     : ${result.deleted}`);
    console.log(`Deleted At  : ${result.deletedAt}`);
    console.log("=========================================");

    process.exit(0);
  } catch (error) {
    console.error("StorageService delete test failed.");
    console.error(
      error instanceof Error ? error.stack || error.message : String(error),
    );
    process.exit(1);
  }
}

main();
