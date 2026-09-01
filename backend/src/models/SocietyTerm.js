const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const societyTermSchema = new mongoose.Schema({
  society: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true,
  },
  academicYear: {
    type: String,
    required: true, // e.g. "2025-26"
    trim: true,
  },
  chair: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  treasurer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  allocatedBudget: {
    type: Number,
    default: 0,
    min: 0,
  },
  openingBalance: {
    type: Number,
    default: 0,
  },
  closingBalance: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["OPEN", "TERM_CLOSING", "ARCHIVED_TERM"],
    default: "OPEN",
  },
  handoverChecklist: {
    reportsSubmitted: { type: Boolean, default: false },
    balanceReconciled: { type: Boolean, default: false },
    assetsTransferred: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },
}, { timestamps: true });

societyTermSchema.index({ society: 1, academicYear: 1 }, { unique: true });
societyTermSchema.plugin(toJson);

module.exports = mongoose.model("SocietyTerm", societyTermSchema);
