const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const reactionSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

reactionSchema.index({ messageId: 1, userId: 1, value: 1 }, { unique: true });
reactionSchema.plugin(toJson);

module.exports = mongoose.model("Reaction", reactionSchema);
