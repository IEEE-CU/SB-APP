const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const conversationSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
      index: true,
    },
    userOneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userTwoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Unique DM context between two members in a specific society/workspace
conversationSchema.index({ societyId: 1, userOneId: 1, userTwoId: 1 }, { unique: true });
conversationSchema.plugin(toJson);

module.exports = mongoose.model("Conversation", conversationSchema);
