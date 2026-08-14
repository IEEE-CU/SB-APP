const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const reportSnapshotSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  society: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true,
  },
  academicYear: {
    type: String,
    required: true,
  },
  snapshotData: {
    type: mongoose.Schema.Types.Mixed,
    required: true, // Frozen snapshot JSON data (budget, transactions, balance)
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["DRAFT", "SUBMITTED", "TREASURER_REVIEWED", "COUNSELLOR_APPROVED", "LOCKED"],
    default: "DRAFT",
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

reportSnapshotSchema.plugin(toJson);

module.exports = mongoose.model("ReportSnapshot", reportSnapshotSchema);
