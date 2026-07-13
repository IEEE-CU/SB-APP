const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema(
  {
    // Placeholder: define persisted metadata for uploaded files.
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("File", FileSchema);
