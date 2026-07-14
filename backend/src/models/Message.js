const mongoose = require("mongoose");
const toJson = require("./plugins/toJson");

const messageSchema = new mongoose.Schema(
  {
    body: {
      type: String,
      required: true,
    },
    plainText: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    authorId: {
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
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      default: null,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true,
    },
    parentMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      index: true,
    },
    replyCount: {
      type: Number,
      default: 0,
    },
    lastReplyTime: {
      type: Date,
      default: null,
    },
    lastReplyAuthorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    calendarEvent: {
      date: { type: Date },
      time: { type: String },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
messageSchema.index({ societyId: 1, parentMessageId: 1 });
messageSchema.index({ channelId: 1, parentMessageId: 1 });
messageSchema.index({ plainText: "text" });

messageSchema.plugin(toJson);

module.exports = mongoose.model("Message", messageSchema);
