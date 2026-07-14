const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, "Channel name must be kebab-case (a-z, 0-9, -)"],
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
      index: true,
    },
    icon: {
      type: String,
      default: "💬",
    },
    type: {
      type: String,
      enum: ["chat", "board"],
      default: "chat",
    },
  },
  {
    timestamps: true,
  },
);

// Society must have unique channel names
channelSchema.index({ societyId: 1, name: 1 }, { unique: true });
channelSchema.plugin(toJson);

module.exports = mongoose.model("Channel", channelSchema);
