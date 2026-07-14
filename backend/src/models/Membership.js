const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const membershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// A user can only have one role/membership in a particular society
membershipSchema.index({ userId: 1, societyId: 1 }, { unique: true });
membershipSchema.plugin(toJson);

const Membership = mongoose.model("Membership", membershipSchema);
module.exports = Membership;
