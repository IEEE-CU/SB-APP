const AzureBlobProvider = require("./storage-provider/AzureBlobProvider");
const path = require("path");
const { randomUUID } = require("crypto");

// Storage provider abstraction. Placeholder: add provider selection and mapping here.
class StorageService {
  constructor(provider = new AzureBlobProvider()) {
    this.provider = provider;
  }

  /**
   * Uploads a Multer file through the configured cloud storage provider.
   *
   * @param {Object} file - Multer file object.
   * @param {string} file.originalname - Original client filename.
   * @param {string} file.mimetype - MIME type reported by Multer.
   * @param {number} file.size - File size in bytes.
   * @param {Buffer} file.buffer - In-memory file contents.
   * @returns {Promise<Object>} Provider-independent file metadata.
   */
  async uploadFile(file) {
    this.#validateUploadFile(file);

    const extension = path.extname(file.originalname || "");
    const storedName = `stored-${Date.now()}-${randomUUID()}${extension}`;

    if (!this.provider || typeof this.provider.uploadBlob !== "function") {
      throw new Error(
        "Storage provider does not implement uploadBlob({ buffer, blobName, contentType }).",
      );
    }

    const providerResponse = await this.provider.uploadBlob({
      buffer: file.buffer,
      blobName: storedName,
      contentType: file.mimetype,
    });

    const uploadedAt = new Date().toISOString();

    return {
      originalName: file.originalname,
      storedName: providerResponse?.blobName || storedName,
      path: providerResponse?.path || providerResponse?.blobPath || storedName,
      url: providerResponse?.url || providerResponse?.blobUrl || "",
      contentType: providerResponse?.contentType || file.mimetype,
      size: providerResponse?.size || file.size,
      uploadedAt: providerResponse?.uploadedAt || uploadedAt,
    };
  }

  /**
   * Validates the Multer file contract expected by uploadFile().
   *
   * @param {Object} file - Multer file object.
   * @private
   */
  #validateUploadFile(file) {
    if (!file || typeof file !== "object") {
      throw new Error("A file object is required.");
    }

    if (!file.originalname || typeof file.originalname !== "string") {
      throw new Error("File originalname is required.");
    }

    if (!file.mimetype || typeof file.mimetype !== "string") {
      throw new Error("File mimetype is required.");
    }

    if (typeof file.size !== "number" || Number.isNaN(file.size)) {
      throw new Error("File size must be a valid number.");
    }

    if (!Buffer.isBuffer(file.buffer)) {
      throw new Error("File buffer must be a Buffer instance.");
    }
  }

  async upload(req, res, next) {
    throw new Error("TODO: implement storage upload service");
  }

  /**
   * Deletes a blob through the configured storage provider.
   *
   * @param {string} blobName - Blob name supplied by the caller.
   * @returns {Promise<Object>} Provider-independent delete metadata.
   */
  async deleteFile(blobName) {
    if (!blobName || typeof blobName !== "string") {
      throw new Error("Blob name is required.");
    }

    if (!this.provider || typeof this.provider.deleteBlob !== "function") {
      throw new Error(
        "Storage provider does not implement deleteBlob(blobName).",
      );
    }

    const providerResponse = await this.provider.deleteBlob(blobName);

    return {
      blobName: providerResponse?.blobName || blobName,
      deleted: providerResponse?.deleted === true,
      deletedAt: providerResponse?.deletedAt || new Date().toISOString(),
    };
  }

  async remove(req, res, next) {
    throw new Error("TODO: implement storage remove service");
  }

  async list(req, res, next) {
    throw new Error("TODO: implement storage list service");
  }
}

module.exports = StorageService;
