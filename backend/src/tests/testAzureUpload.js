#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { BlobServiceClient } = require('@azure/storage-blob');
const envPath = path.resolve(__dirname, '..', '.env');

console.log(`Resolved .env path: ${envPath}`);
dotenv.config({ path: envPath });

const AzureBlobProvider = require('../services/storage/storage-provider/AzureBlobProvider');

function getProviderConfig() {
  const provider = new AzureBlobProvider();
  if (!provider || !provider.config) {
    throw new Error('AzureBlobProvider did not expose configuration.');
  }

  const { connectionString, containerName } = provider.config;
  if (!connectionString) {
    throw new Error('Missing AZURE_STORAGE_CONNECTION_STRING in backend/src/.env');
  }
  if (!containerName) {
    throw new Error('Missing AZURE_STORAGE_CONTAINER_NAME in backend/src/.env');
  }

  return { provider, connectionString, containerName };
}

async function runAzureUploadTest() {
  try {
    const azureEnvKeys = Object.keys(process.env)
      .filter((key) => key.startsWith('AZURE_'))
      .sort();

    console.log('Azure environment variables:');
    for (const key of azureEnvKeys) {
      console.log(`- ${key}`);
    }

    const { connectionString, containerName } = getProviderConfig();

    console.log('✓ Connecting to Azure...');
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    await containerClient.createIfNotExists();
    await containerClient.getProperties();
    console.log('✓ Connected successfully');

    console.log('✓ Uploading file...');
    const blobName = `test-${Date.now()}.txt`;
    const content = 'Hello from IEEE ERP Azure Storage Test!';
    const buffer = Buffer.from(content, 'utf8');
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'text/plain; charset=utf-8'
      }
    });

    console.log('✓ Upload successful');
    console.log(`Blob Name: ${blobName}`);
    console.log(`Blob URL: ${blockBlobClient.url}`);

    process.exitCode = 0;
  } catch (error) {
    console.error('Azure upload test failed.');
    console.error(error instanceof Error ? error.message : String(error));

    if (error && error.stack) {
      console.error(error.stack);
    }

    process.exitCode = 1;
  }
}

runAzureUploadTest();
