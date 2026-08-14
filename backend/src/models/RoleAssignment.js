const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const roleAssignmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ["CHAIR", "VICE_CHAIR", "TREASURER", "SECRETARY", "WEBMASTER", "MEMBER", "ADMIN"],
    required: true,
  },
  society: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    default: null, // null for branch-wide central roles
    index: true,
  },
  academicYear: {
    type: String,
    required: true, // e.g. "2025-26"
    trim: true,
  },
  termStart: {
    type: Date,
    required: true,
  },
  termEnd: {
    type: Date,
    default: null, // null = currently active
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

roleAssignmentSchema.index({ user: 1, society: 1, academicYear: 1 });
roleAssignmentSchema.plugin(toJson);

module.exports = mongoose.model("RoleAssignment", roleAssignmentSchema);
