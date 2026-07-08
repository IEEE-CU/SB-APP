// Team 4 placeholder configuration for Azure Blob Storage.
// Placeholder: validate required environment variables and normalize values here.

const azureConfig = {
  accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
  containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || '',
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
  maxFileSize: Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024),
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/png,image/jpeg,application/pdf')
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean)
};

module.exports = azureConfig;
