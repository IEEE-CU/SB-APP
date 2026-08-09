const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const taskSchema = new mongoose.Schema(
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
    completed: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"],
      default: "NOT_STARTED",
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    categoryName: {
      type: String,
      default: "General",
    },
    categoryColor: {
      type: String,
      default: "#3b82f6",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
      index: true,
    },
    blockedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
  },
  {
    timestamps: true,
  },
);

taskSchema.index({ userId: 1, societyId: 1, dueDate: 1 });
taskSchema.plugin(toJson);

module.exports = mongoose.model("Task", taskSchema);
