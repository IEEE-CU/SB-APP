const express = require("express");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Reaction = require("../models/Reaction");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Apply JWT verification using authenticate middleware
router.use(authenticate);

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations (DMs) for the current user in a society
 * @access  Private
 */
router.get("/", async (req, res, next) => {
  try {
    const societyId = req.query.societyId || req.user.societyId?._id || req.user.societyId;
    if (!societyId) {
      return res.status(400).json({ success: false, message: "Society ID is required" });
    }

    const userId = req.user._id;
    const conversations = await Conversation.find({
      societyId,
      $or: [{ userOneId: userId }, { userTwoId: userId }],
    })
      .populate("userOneId", "name email")
      .populate("userTwoId", "name email")
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: conversations.length, data: conversations });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/conversations
 * @desc    Create or get a DM conversation between current user and another user
 * @access  Private
 */
router.post("/", async (req, res, next) => {
  try {
    const { recipientId, societyId } = req.body;
    const targetSocietyId = societyId || req.user.societyId?._id || req.user.societyId;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: "Recipient User ID is required" });
    }
    if (!targetSocietyId) {
      return res.status(400).json({ success: false, message: "Society ID is required" });
    }

    const userOneId = req.user._id.toString() < recipientId.toString() ? req.user._id : recipientId;
    const userTwoId = req.user._id.toString() < recipientId.toString() ? recipientId : req.user._id;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      societyId: targetSocietyId,
      userOneId,
      userTwoId,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        societyId: targetSocietyId,
        userOneId,
        userTwoId,
      });
    }

    const populated = await Conversation.findById(conversation._id)
      .populate("userOneId", "name email")
      .populate("userTwoId", "name email");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/conversations/:id/messages
 * @desc    Get all messages for a DM conversation
 * @access  Private
 */
router.get("/:id/messages", async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    // Security check: Verify user is part of the conversation
    const isParticipant =
      conversation.userOneId.toString() === req.user._id.toString() ||
      conversation.userTwoId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied. You are not a participant in this conversation." });
    }

    const messages = await Message.find({ conversationId: req.params.id, parentMessageId: null })
      .populate("authorId", "name email")
      .sort({ createdAt: 1 });

    const messagesWithReactions = await Promise.all(
      messages.map(async (msg) => {
        const reactions = await Reaction.find({ messageId: msg._id }).populate("userId", "name email");
        return {
          ...msg.toJSON(),
          reactions,
        };
      })
    );

    res.json({ success: true, count: messagesWithReactions.length, data: messagesWithReactions });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/conversations/:id/messages
 * @desc    Send a message in a conversation
 * @access  Private
 */
router.post("/:id/messages", async (req, res, next) => {
  try {
    const { body, plainText, imageUrl, calendarEvent } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    // Security check: Verify user is part of the conversation
    const isParticipant =
      conversation.userOneId.toString() === req.user._id.toString() ||
      conversation.userTwoId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Access denied. You are not a participant in this conversation." });
    }

    if (!body) {
      return res.status(400).json({ success: false, message: "Message body is required" });
    }

    const message = await Message.create({
      body,
      plainText: plainText || body,
      imageUrl,
      authorId: req.user._id,
      societyId: conversation.societyId,
      conversationId: conversation._id,
      calendarEvent,
    });

    // Touch conversation updated timestamp
    conversation.changed = true; // dummy change to trigger timestamp update if hook needed, or save() directly
    await conversation.save();

    const populated = await Message.findById(message._id).populate("authorId", "name email");

    const io = req.app.get("io");
    if (io) {
      io.to(`conversation_${conversation._id}`).emit("message:new", { ...populated.toJSON(), reactions: [] });
    }

    res.status(201).json({ success: true, data: { ...populated.toJSON(), reactions: [] } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
