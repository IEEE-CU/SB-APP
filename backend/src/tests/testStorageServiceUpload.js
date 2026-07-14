#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const StorageService = require('../services/storage/StorageService');

async function main() {
  try {
    const storageService = new StorageService();

    const content = 'StorageService validation test';
    const file = {
      originalname: 'storage-service-validation.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength(content),
      buffer: Buffer.from(content)
    };

    const result = await storageService.uploadFile(file);

    if (!result || typeof result !== 'object') {
      throw new Error('StorageService.uploadFile() did not return a metadata object.');
    }

    if (result.originalName !== file.originalname) {
      throw new Error(
        `Expected originalName to match uploaded filename "${file.originalname}", but received "${result.originalName}".`
      );
    }

    if (!result.storedName || result.storedName === result.originalName) {
      throw new Error('Expected storedName to be different from originalName.');
    }

    if (!result.url) {
      throw new Error('Expected URL to be populated after upload.');
    }

    if (typeof result.size !== 'number' || result.size <= 0) {
      throw new Error('Expected size to be greater than zero.');
    }

    if (result.contentType !== 'text/plain') {
      throw new Error(`Expected contentType to equal "text/plain", but received "${result.contentType}".`);
    }

    if (!result.uploadedAt) {
      throw new Error('Expected uploadedAt to exist.');
    }

    console.log('=========================================');
    console.log('StorageService Upload Test');
    console.log('=========================================');
    console.log(`Original Name : ${result.originalName}`);
    console.log(`Stored Name   : ${result.storedName}`);
    console.log(`Path          : ${result.path}`);
    console.log(`URL           : ${result.url}`);
    console.log(`Content Type  : ${result.contentType}`);
    console.log(`Size          : ${result.size}`);
    console.log(`Uploaded At   : ${result.uploadedAt}`);
    console.log('=========================================');
    console.log('✓ ALL STORAGE SERVICE TESTS PASSED');
    console.log('=========================================');

    process.exit(0);
  } catch (error) {
    console.error('StorageService upload test failed.');
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  }
}

main();
