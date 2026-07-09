const express = require("express");
const upload = require("../middleware/upload");
const StorageController = require("../controllers/storageController");

const router = express.Router();

const storageController = new StorageController();

/**
 * Storage router for Team 4 external service uploads.
 *
 * This router only wires multipart upload parsing to the storage controller
 * and does not contain any business logic, Azure SDK calls, or persistence.
 */

/**
 * POST /upload
 * Accepts a single uploaded file and delegates handling to StorageController.
 */
router.post(
  "/upload",
  upload.single("file"),
  storageController.upload.bind(storageController),
);

/**
 * GET /files
 * Returns metadata for every stored blob in the configured container.
 */
router.get("/files", storageController.list.bind(storageController));

/**
 * GET /download/:blobName
 * Streams a stored blob by name without using Multer.
 */
router.get(
  "/download/:blobName",
  storageController.download.bind(storageController),
);

/**
 * DELETE /:blobName
 * Deletes a stored blob by its name without using Multer.
 */
router.delete("/:blobName", storageController.delete.bind(storageController));

module.exports = router;
