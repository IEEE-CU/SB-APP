const azureConfig = require("../../../config/azure");
const { BlobServiceClient } = require("@azure/storage-blob");

// Azure SDK calls must remain isolated in this provider.
// Placeholder: implement provider methods with the chosen Azure SDK.
class AzureBlobProvider {
  constructor(config = azureConfig) {
    this.config = config;
  }

  /**
   * Uploads a buffer to Azure Blob Storage and returns normalized blob metadata.
   *
   * @param {Object} params - Upload parameters.
   * @param {Buffer} params.buffer - File contents.
   * @param {string} params.blobName - Target blob name.
   * @param {string} params.contentType - Blob content type.
   * @returns {Promise<Object>} Normalized upload result.
   */
  async uploadBlob({ buffer, blobName, contentType }) {
    try {
      if (!Buffer.isBuffer(buffer)) {
        throw new Error("Invalid buffer: expected a Buffer instance.");
      }

      if (!blobName || typeof blobName !== "string") {
        throw new Error("Invalid blobName: a non-empty string is required.");
      }

      if (!contentType || typeof contentType !== "string") {
        throw new Error("Invalid contentType: a non-empty string is required.");
      }

      const { connectionString, containerName } = this.config || {};

      if (!connectionString) {
        throw new Error(
          "Azure configuration is missing AZURE_STORAGE_CONNECTION_STRING.",
        );
      }

      if (!containerName) {
        throw new Error(
          "Azure configuration is missing AZURE_STORAGE_CONTAINER_NAME.",
        );
      }

      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      await containerClient.createIfNotExists();

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      });

      const properties = await blockBlobClient.getProperties();

      return {
        blobName,
        blobUrl: blockBlobClient.url,
        contentType: properties.contentType || contentType,
        size: properties.contentLength,
        etag: properties.etag,
        lastModified: properties.lastModified,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `AzureBlobProvider.uploadBlob failed for "${blobName || "unknown"}": ${message}`,
      );
    }
  }

  /**
   * Downloads a blob from Azure Blob Storage and returns normalized stream metadata.
   *
   * @param {string} blobName - Name of the blob to download.
   * @returns {Promise<Object>} Normalized download result.
   */
  async downloadBlob(blobName) {
    try {
      if (!blobName || typeof blobName !== "string") {
        throw new Error("Invalid blobName: a non-empty string is required.");
      }

      const { connectionString, containerName } = this.config || {};

      if (!connectionString) {
        throw new Error(
          "Azure configuration is missing AZURE_STORAGE_CONNECTION_STRING.",
        );
      }

      if (!containerName) {
        throw new Error(
          "Azure configuration is missing AZURE_STORAGE_CONTAINER_NAME.",
        );
      }

      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);

      const exists = await blobClient.exists();

      if (!exists) {
        throw new Error(
          `Blob "${blobName}" does not exist in container "${containerName}".`,
        );
      }

      const downloadResponse = await blobClient.download();
      const properties = await blobClient.getProperties();
      const stream = downloadResponse.readableStreamBody;

      if (!stream) {
        throw new Error(
          `Azure did not return a readable stream for blob "${blobName}".`,
        );
      }

      return {
        blobName,
        stream,
        contentType:
          downloadResponse.contentType ||
          properties.contentType ||
          "application/octet-stream",
        contentLength:
          downloadResponse.contentLength || properties.contentLength || 0,
        lastModified: downloadResponse.lastModified || properties.lastModified,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `AzureBlobProvider.downloadBlob failed for "${blobName || "unknown"}": ${message}`,
      );
    }
  }

  /**
   * Lists all blobs in Azure Blob Storage and returns normalized metadata.
   *
   * @returns {Promise<Array<Object>>} Normalized blob metadata list.
   */
  async listBlobs() {
    try {
      const { connectionString, containerName } = this.config || {};

      if (!connectionString) {
        throw new Error(
          "Azure configuration is missing AZURE_STORAGE_CONNECTION_STRING.",
        );
      }

      if (!containerName) {
        throw new Error(
          "Azure configuration is missing AZURE_STORAGE_CONTAINER_NAME.",
        );
      }

      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      const blobs = [];

      for await (const blobItem of containerClient.listBlobsFlat()) {
        blobs.push({
          blobName: blobItem.name,
          size: blobItem.properties?.contentLength || 0,
          contentType:
            blobItem.properties?.contentType || "application/octet-stream",
          lastModified: blobItem.properties?.lastModified,
          etag: blobItem.properties?.etag,
        });
      }

      return blobs;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `AzureBlobProvider.listBlobs failed for container "${this.config?.containerName || "unknown"}": ${message}`,
      );
    }
  }

  /**
   * Deletes a blob from Azure Blob Storage and returns normalized delete metadata.
   *
   * @param {string} blobName - Name of the blob to delete.
   * @returns {Promise<Object>} Normalized delete result.
   */
  async deleteBlob(blobName) {
    try {
      if (!blobName || typeof blobName !== "string") {
        throw new Error("Invalid blobName: a non-empty string is required.");
      }

      const { connectionString, containerName } = this.config || {};

      if (!connectionString) {
        throw new Error(
          "Azure configuration is missing AZURE_STORAGE_CONNECTION_STRING.",
        );
      }

      if (!containerName) {
        throw new Error(
          "Azure configuration is missing AZURE_STORAGE_CONTAINER_NAME.",
        );
      }

      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connectionString);
      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);

      await blobClient.delete();

      return {
        blobName,
        deleted: true,
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `AzureBlobProvider.deleteBlob failed for "${blobName || "unknown"}": ${message}`,
      );
    }
  }

  async list() {
    throw new Error("TODO: implement Azure blob list");
  }
}

module.exports = AzureBlobProvider;
