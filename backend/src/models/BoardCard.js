const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const cardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"],
      default: "TODO",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    order: {
      type: Number,
      default: 0,
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dueDate: {
      type: Date,
      default: null,
    },
    parentCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoardCard",
      default: null,
    },
    blockedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BoardCard",
      },
    ],
  },
  {
    timestamps: true,
  },
);

cardSchema.index({ channelId: 1, status: 1, order: 1 });
cardSchema.plugin(toJson);

module.exports = mongoose.model("BoardCard", cardSchema);
