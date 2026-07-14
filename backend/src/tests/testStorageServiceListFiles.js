#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: envPath });

const StorageService = require("../services/storage/StorageService");

async function main() {
  try {
    const storageService = new StorageService();
    const files = await storageService.listFiles();

    if (!Array.isArray(files)) {
      throw new Error("StorageService.listFiles() did not return an array.");
    }

    for (const file of files) {
      if (!file || typeof file !== "object") {
        throw new Error("Expected each file entry to be an object.");
      }

      if (!file.blobName) {
        throw new Error("Expected blobName to exist for each file.");
      }

      if (typeof file.size !== "number") {
        throw new Error(
          `Expected size to be a number for blob "${file.blobName}".`,
        );
      }

      if (!file.contentType) {
        throw new Error(
          `Expected contentType to exist for blob "${file.blobName}".`,
        );
      }

      if (!file.lastModified) {
        throw new Error(
          `Expected lastModified to exist for blob "${file.blobName}".`,
        );
      }

      if (!file.etag) {
        throw new Error(`Expected etag to exist for blob "${file.blobName}".`);
      }
    }

    console.log("=========================================");
    console.log("StorageService List Files Test");
    console.log("=========================================");
    console.log(`Number of Files: ${files.length}`);

    for (const file of files) {
      console.log("-----------------------------------------");
      console.log(`Blob Name      : ${file.blobName}`);
      console.log(`Size           : ${file.size}`);
      console.log(`Content Type   : ${file.contentType}`);
      console.log(`Last Modified  : ${file.lastModified}`);
    }

    console.log("=========================================");
    console.log("✓ ALL STORAGE LIST TESTS PASSED");
    console.log("=========================================");

    process.exit(0);
  } catch (error) {
    console.error("StorageService list files test failed.");
    console.error(
      error instanceof Error ? error.stack || error.message : String(error),
    );
    process.exit(1);
  }
}

main();
