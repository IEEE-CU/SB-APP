const StorageService = require("../services/storage/StorageService");

const storageService = new StorageService();

/**
 * StorageController handles HTTP-level file upload requests and delegates the
 * actual storage work to StorageService.
 */
class StorageController {
  /**
   * Uploads a single file from req.file and returns the storage metadata.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express error handler.
   * @returns {Promise<void>}
   */
  async upload(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });
      }

      const result = await storageService.uploadFile(req.file);

      return res.status(201).json({
        success: true,
        message: "File uploaded successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Deletes a blob identified by req.params.blobName and returns delete metadata.
   *
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   * @param {Function} next - Express error handler.
   * @returns {Promise<void>}
   */
  async delete(req, res, next) {
    try {
      const { blobName } = req.params;

      if (!blobName) {
        return res.status(400).json({
          success: false,
          message: "Blob name is required.",
        });
      }

      const result = await storageService.deleteFile(blobName);

      return res.status(200).json({
        success: true,
        message: "File deleted successfully.",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = StorageController;
