const multer = require("multer");

/**
 * Configured Multer instance for Team 4 upload handling.
 *
 * The route layer chooses the specific upload mode, such as single, array,
 * or fields, so this module stays reusable for future upload flows.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = upload;
