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
      throw new Error(
        "Please provide an actual Azure blob name as the first argument.",
      );
    }

    const result = await storageService.downloadFile(blobName);

    if (!result || typeof result !== "object") {
      throw new Error(
        "StorageService.downloadFile() did not return a metadata object.",
      );
    }

    if (!result.stream || typeof result.stream.pipe !== "function") {
      throw new Error("Expected stream to be present and pipeable.");
    }

    if (!result.contentType) {
      throw new Error("Expected contentType to be populated.");
    }

    if (typeof result.contentLength !== "number" || result.contentLength <= 0) {
      throw new Error("Expected contentLength to be greater than zero.");
    }

    if (!result.lastModified) {
      throw new Error("Expected lastModified to exist.");
    }

    console.log("=========================================");
    console.log("StorageService Download Test");
    console.log("=========================================");
    console.log(`Blob Name      : ${result.blobName}`);
    console.log(`Content Type   : ${result.contentType}`);
    console.log(`Content Length  : ${result.contentLength}`);
    console.log(`Last Modified   : ${result.lastModified}`);
    console.log("=========================================");
    console.log("✓ ALL STORAGE DOWNLOAD TESTS PASSED");
    console.log("=========================================");

    process.exit(0);
  } catch (error) {
    console.error("StorageService download test failed.");
    console.error(
      error instanceof Error ? error.stack || error.message : String(error),
    );
    process.exit(1);
  }
}

main();
