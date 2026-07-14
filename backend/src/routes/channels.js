const express = require("express");
const Channel = require("../models/Channel");
const Message = require("../models/Message");
const Reaction = require("../models/Reaction");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Apply JWT verification using authenticate middleware
router.use(authenticate);

/**
 * @route   GET /api/channels
 * @desc    Get all channels for the user's society or specified societyId
 * @access  Private
 */
router.get("/", async (req, res, next) => {
  try {
    const societyId = req.query.societyId || req.user.societyId?._id || req.user.societyId;
    if (!societyId) {
      return res.status(400).json({ success: false, message: "Society ID is required" });
    }
    const channels = await Channel.find({ societyId }).sort({ name: 1 });
    res.json({ success: true, count: channels.length, data: channels });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/channels/:id
 * @desc    Get channel details by ID
 * @access  Private
 */
router.get("/:id", async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }
    res.json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/channels
 * @desc    Create a new channel
 * @access  Private
 */
router.post("/", async (req, res, next) => {
  try {
    const { name, societyId, icon, type } = req.body;
    const targetSocietyId = societyId || req.user.societyId?._id || req.user.societyId;

    if (!name) {
      return res.status(400).json({ success: false, message: "Channel name is required" });
    }
    if (!targetSocietyId) {
      return res.status(400).json({ success: false, message: "Society ID is required" });
    }

    const channel = await Channel.create({
      name,
      societyId: targetSocietyId,
      icon,
      type: type || "chat",
    });

    res.status(201).json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/channels/:id
 * @desc    Update channel details
 * @access  Private
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { name, icon, type } = req.body;
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    if (name !== undefined) channel.name = name;
    if (icon !== undefined) channel.icon = icon;
    if (type !== undefined) channel.type = type;

    await channel.save();
    res.json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/channels/:id
 * @desc    Delete a channel
 * @access  Private
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }
    // Delete messages in this channel
    await Message.deleteMany({ channelId: req.params.id });
    res.json({ success: true, message: "Channel and its messages deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/channels/:id/messages
 * @desc    Get messages for a channel (only top-level messages, i.e., parentMessageId is null)
 * @access  Private
 */
router.get("/:id/messages", async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    const messages = await Message.find({ channelId: req.params.id, parentMessageId: null })
      .populate("authorId", "name email")
      .sort({ createdAt: 1 });

    // For each message, fetch its reactions
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
 * @route   POST /api/channels/:id/messages
 * @desc    Create a message in a channel
 * @access  Private
 */
router.post("/:id/messages", async (req, res, next) => {
  try {
    const { body, plainText, imageUrl, calendarEvent } = req.body;
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    if (!body) {
      return res.status(400).json({ success: false, message: "Message body is required" });
    }

    const message = await Message.create({
      body,
      plainText: plainText || body,
      imageUrl,
      authorId: req.user._id,
      societyId: channel.societyId,
      channelId: channel._id,
      calendarEvent,
    });

    const populated = await Message.findById(message._id).populate("authorId", "name email");

    const io = req.app.get("io");
    if (io) {
      io.to(`channel_${channel._id}`).emit("message:new", { ...populated.toJSON(), reactions: [] });
    }

    res.status(201).json({ success: true, data: { ...populated.toJSON(), reactions: [] } });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/channels/messages/:messageId/replies
 * @desc    Get thread replies for a message
 * @access  Private
 */
router.get("/messages/:messageId/replies", async (req, res, next) => {
  try {
    const parentMessage = await Message.findById(req.params.messageId);
    if (!parentMessage) {
      return res.status(404).json({ success: false, message: "Parent message not found" });
    }

    const replies = await Message.find({ parentMessageId: req.params.messageId })
      .populate("authorId", "name email")
      .sort({ createdAt: 1 });

    const repliesWithReactions = await Promise.all(
      replies.map(async (reply) => {
        const reactions = await Reaction.find({ messageId: reply._id }).populate("userId", "name email");
        return {
          ...reply.toJSON(),
          reactions,
        };
      })
    );

    res.json({ success: true, count: repliesWithReactions.length, data: repliesWithReactions });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/channels/messages/:messageId/replies
 * @desc    Create a thread reply for a message
 * @access  Private
 */
router.post("/messages/:messageId/replies", async (req, res, next) => {
  try {
    const { body, plainText, imageUrl } = req.body;
    const parentMessage = await Message.findById(req.params.messageId);
    if (!parentMessage) {
      return res.status(404).json({ success: false, message: "Parent message not found" });
    }

    if (!body) {
      return res.status(400).json({ success: false, message: "Message body is required" });
    }

    const reply = await Message.create({
      body,
      plainText: plainText || body,
      imageUrl,
      authorId: req.user._id,
      societyId: parentMessage.societyId,
      channelId: parentMessage.channelId,
      conversationId: parentMessage.conversationId,
      parentMessageId: parentMessage._id,
    });

    // Update parent message thread stats
    parentMessage.replyCount = (parentMessage.replyCount || 0) + 1;
    parentMessage.lastReplyTime = reply.createdAt;
    parentMessage.lastReplyAuthorId = req.user._id;
    await parentMessage.save();

    const populatedReply = await Message.findById(reply._id).populate("authorId", "name email");

    const io = req.app.get("io");
    if (io) {
      const room = parentMessage.channelId ? `channel_${parentMessage.channelId}` : `conversation_${parentMessage.conversationId}`;
      io.to(room).emit("message:reply", {
        parentMessageId: parentMessage._id,
        reply: { ...populatedReply.toJSON(), reactions: [] },
        replyCount: parentMessage.replyCount,
        lastReplyTime: parentMessage.lastReplyTime,
        lastReplyAuthorId: parentMessage.lastReplyAuthorId,
      });
    }

    res.status(201).json({ success: true, data: { ...populatedReply.toJSON(), reactions: [] } });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/channels/messages/:messageId/reactions
 * @desc    Add/toggle a reaction to a message
 * @access  Private
 */
router.post("/messages/:messageId/reactions", async (req, res, next) => {
  try {
    const { value } = req.body;
    if (!value) {
      return res.status(400).json({ success: false, message: "Reaction value is required" });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Toggle reaction: if exists, remove it. Otherwise, create it.
    const existingReaction = await Reaction.findOne({
      messageId: message._id,
      userId: req.user._id,
      value,
    });

    if (existingReaction) {
      await Reaction.findByIdAndDelete(existingReaction._id);
    } else {
      await Reaction.create({
        messageId: message._id,
        userId: req.user._id,
        value,
      });
    }

    // Fetch all reactions for the message to emit/return
    const allReactions = await Reaction.find({ messageId: message._id }).populate("userId", "name email");

    const io = req.app.get("io");
    if (io) {
      const room = message.channelId ? `channel_${message.channelId}` : `conversation_${message.conversationId}`;
      io.to(room).emit("message:reactions", {
        messageId: message._id,
        reactions: allReactions,
      });
    }

    res.json({ success: true, data: allReactions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
