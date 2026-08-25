const express = require("express");
const Channel = require("../models/Channel");
const Message = require("../models/Message");
const Reaction = require("../models/Reaction");
const Conversation = require("../models/Conversation");
const { authenticate } = require("../middleware/auth");
const {
  requirePermission,
  attachScope,
  isSocietyInScope,
} = require("../middleware/rbac");

const router = express.Router();

// Apply JWT verification using authenticate middleware
router.use(authenticate);

/**
 * Resolves whether the current request is authorized to read/act on a given
 * message, based on whichever parent it belongs to:
 * - channel messages are scoped to the user's society (via requirePermission/attachScope)
 * - conversation (DM) messages are scoped to conversation participants only
 */
async function canAccessMessage(req, message) {
  if (message.channelId) {
    const channel = await Channel.findById(message.channelId);
    if (!channel) return false;
    return isSocietyInScope(req, channel.societyId);
  }
  if (message.conversationId) {
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation) return false;
    const uid = req.user._id.toString();
    return (
      conversation.userOneId.toString() === uid ||
      conversation.userTwoId.toString() === uid
    );
  }
  return false;
}

/**
 * @route   GET /api/channels
 * @desc    Get all channels for the user's society or specified societyId
 * @access  Private
 */
router.get(
  "/",
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      let societyId;
      if (req.query.societyId) {
        if (!isSocietyInScope(req, req.query.societyId)) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. You do not have access to this society's channels.",
          });
        }
        societyId = req.query.societyId;
      } else {
        societyId =
          req.userScope?.societyId ||
          req.user.societyId?._id ||
          req.user.societyId;
      }
      if (!societyId) {
        return res
          .status(400)
          .json({ success: false, message: "Society ID is required" });
      }
      const channels = await Channel.find({ societyId }).sort({ name: 1 });
      res.json({ success: true, count: channels.length, data: channels });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   GET /api/channels/:id
 * @desc    Get channel details by ID
 * @access  Private
 */
router.get(
  "/:id",
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const channel = await Channel.findById(req.params.id);
      if (!channel) {
        return res
          .status(404)
          .json({ success: false, message: "Channel not found" });
      }
      if (!isSocietyInScope(req, channel.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this channel.",
        });
      }
      res.json({ success: true, data: channel });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   POST /api/channels
 * @desc    Create a new channel
 * @access  Private
 */
router.post(
  "/",
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { name, societyId, icon, type, categoryName } = req.body;

      let targetSocietyId;
      if (societyId) {
        if (!isSocietyInScope(req, societyId)) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. You cannot create a channel in this society.",
          });
        }
        targetSocietyId = societyId;
      } else {
        targetSocietyId =
          req.userScope?.societyId ||
          req.user.societyId?._id ||
          req.user.societyId;
      }

      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "Channel name is required" });
      }
      if (!targetSocietyId) {
        return res
          .status(400)
          .json({ success: false, message: "Society ID is required" });
      }

      const channel = await Channel.create({
        name,
        societyId: targetSocietyId,
        icon,
        categoryName: categoryName || "text channels",
        type: type || "chat",
      });

      res.status(201).json({ success: true, data: channel });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   PUT /api/channels/:id
 * @desc    Update channel details
 * @access  Private
 */
router.put(
  "/:id",
  requirePermission("community_hub", "edit"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { name, icon, type, categoryName } = req.body;
      const channel = await Channel.findById(req.params.id);
      if (!channel) {
        return res
          .status(404)
          .json({ success: false, message: "Channel not found" });
      }
      if (!isSocietyInScope(req, channel.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this channel.",
        });
      }

      if (name !== undefined) channel.name = name;
      if (icon !== undefined) channel.icon = icon;
      if (categoryName !== undefined) channel.categoryName = categoryName;
      if (type !== undefined) channel.type = type;

      await channel.save();
      res.json({ success: true, data: channel });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   DELETE /api/channels/:id
 * @desc    Delete a channel
 * @access  Private
 */
router.delete(
  "/:id",
  requirePermission("community_hub", "delete"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const channel = await Channel.findById(req.params.id);
      if (!channel) {
        return res
          .status(404)
          .json({ success: false, message: "Channel not found" });
      }
      if (!isSocietyInScope(req, channel.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this channel.",
        });
      }

      await Channel.findByIdAndDelete(req.params.id);
      // Delete messages in this channel
      await Message.deleteMany({ channelId: req.params.id });
      res.json({
        success: true,
        message: "Channel and its messages deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   GET /api/channels/:id/messages
 * @desc    Get messages for a channel (only top-level messages, i.e., parentMessageId is null)
 * @access  Private
 */
router.get(
  "/:id/messages",
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const channel = await Channel.findById(req.params.id);
      if (!channel) {
        return res
          .status(404)
          .json({ success: false, message: "Channel not found" });
      }
      if (!isSocietyInScope(req, channel.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this channel.",
        });
      }

      const messages = await Message.find({
        channelId: req.params.id,
        parentMessageId: null,
      })
        .populate("authorId", "name email")
        .sort({ createdAt: 1 });

      // For each message, fetch its reactions
      const messagesWithReactions = await Promise.all(
        messages.map(async (msg) => {
          const reactions = await Reaction.find({
            messageId: msg._id,
          }).populate("userId", "name email");
          return {
            ...msg.toJSON(),
            reactions,
          };
        }),
      );

      res.json({
        success: true,
        count: messagesWithReactions.length,
        data: messagesWithReactions,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   POST /api/channels/:id/messages
 * @desc    Create a message in a channel
 * @access  Private
 */
router.post(
  "/:id/messages",
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const {
        body,
        content,
        plainText,
        imageUrl,
        attachments,
        calendarEvent,
        poll,
        parentId,
        parentMessageId,
      } = req.body;
      const channel = await Channel.findById(req.params.id);
      if (!channel) {
        return res
          .status(404)
          .json({ success: false, message: "Channel not found" });
      }
      if (!isSocietyInScope(req, channel.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this channel.",
        });
      }

      const messageContent = body || content;
      if (!messageContent) {
        return res
          .status(400)
          .json({ success: false, message: "Message content is required" });
      }

      // A reply may only target a parent inside this same channel, otherwise a
      // caller could graft a message onto a thread in another channel/society.
      const requestedParentId = parentMessageId || parentId || null;
      let validatedParentId = null;
      if (requestedParentId) {
        const parent = await Message.findById(requestedParentId);
        if (
          !parent ||
          !parent.channelId ||
          parent.channelId.toString() !== channel._id.toString()
        ) {
          return res.status(400).json({
            success: false,
            message: "Parent message does not belong to this channel",
          });
        }
        validatedParentId = parent._id;
      }

      const message = await Message.create({
        body: messageContent,
        plainText: plainText || messageContent,
        imageUrl: imageUrl || (attachments && attachments[0]) || null,
        authorId: req.user._id,
        societyId: channel.societyId,
        channelId: channel._id,
        calendarEvent,
        poll,
        parentMessageId: validatedParentId,
      });

      const populated = await Message.findById(message._id).populate(
        "authorId",
        "name email",
      );

      const io = req.app.get("io");
      if (io) {
        io.to(`channel_${channel._id}`).emit("message:new", {
          ...populated.toJSON(),
          reactions: [],
        });
      }

      res.status(201).json({
        success: true,
        data: { ...populated.toJSON(), reactions: [] },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   GET /api/channels/messages/:messageId/replies
 * @desc    Get thread replies for a message
 * @access  Private
 */
router.get(
  "/messages/:messageId/replies",
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const parentMessage = await Message.findById(req.params.messageId);
      if (!parentMessage) {
        return res
          .status(404)
          .json({ success: false, message: "Parent message not found" });
      }
      if (!(await canAccessMessage(req, parentMessage))) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You do not have access to this conversation.",
        });
      }

      const replies = await Message.find({
        parentMessageId: req.params.messageId,
      })
        .populate("authorId", "name email")
        .sort({ createdAt: 1 });

      const repliesWithReactions = await Promise.all(
        replies.map(async (reply) => {
          const reactions = await Reaction.find({
            messageId: reply._id,
          }).populate("userId", "name email");
          return {
            ...reply.toJSON(),
            reactions,
          };
        }),
      );

      res.json({
        success: true,
        count: repliesWithReactions.length,
        data: repliesWithReactions,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   POST /api/channels/messages/:messageId/replies
 * @desc    Create a thread reply for a message
 * @access  Private
 */
router.post(
  "/messages/:messageId/replies",
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { body, plainText, imageUrl } = req.body;
      const parentMessage = await Message.findById(req.params.messageId);
      if (!parentMessage) {
        return res
          .status(404)
          .json({ success: false, message: "Parent message not found" });
      }
      if (!(await canAccessMessage(req, parentMessage))) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You do not have access to this conversation.",
        });
      }

      if (!body) {
        return res
          .status(400)
          .json({ success: false, message: "Message body is required" });
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

      const populatedReply = await Message.findById(reply._id).populate(
        "authorId",
        "name email",
      );

      const io = req.app.get("io");
      if (io) {
        const room = parentMessage.channelId
          ? `channel_${parentMessage.channelId}`
          : `conversation_${parentMessage.conversationId}`;
        io.to(room).emit("message:reply", {
          parentMessageId: parentMessage._id,
          reply: { ...populatedReply.toJSON(), reactions: [] },
          replyCount: parentMessage.replyCount,
          lastReplyTime: parentMessage.lastReplyTime,
          lastReplyAuthorId: parentMessage.lastReplyAuthorId,
        });
      }

      res.status(201).json({
        success: true,
        data: { ...populatedReply.toJSON(), reactions: [] },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   POST /api/channels/messages/:messageId/reactions
 * @desc    Add/toggle a reaction to a message
 * @access  Private
 */
router.post(
  "/messages/:messageId/reactions",
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { value } = req.body;
      if (!value) {
        return res
          .status(400)
          .json({ success: false, message: "Reaction value is required" });
      }

      const message = await Message.findById(req.params.messageId);
      if (!message) {
        return res
          .status(404)
          .json({ success: false, message: "Message not found" });
      }
      if (!(await canAccessMessage(req, message))) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You do not have access to this conversation.",
        });
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
      const allReactions = await Reaction.find({
        messageId: message._id,
      }).populate("userId", "name email");

      const io = req.app.get("io");
      if (io) {
        const room = message.channelId
          ? `channel_${message.channelId}`
          : `conversation_${message.conversationId}`;
        io.to(room).emit("message:reactions", {
          messageId: message._id,
          reactions: allReactions,
        });
      }

      res.json({ success: true, data: allReactions });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   POST /api/channels/messages/:messageId/poll/vote
 * @desc    Toggle user vote on a poll option
 * @access  Private
 */
router.post(
  "/messages/:messageId/poll/vote",
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { optionIndex } = req.body;
      const message = await Message.findById(req.params.messageId);
      if (!message || !message.poll || !message.poll.question) {
        return res
          .status(404)
          .json({ success: false, message: "Poll message not found" });
      }
      if (!(await canAccessMessage(req, message))) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You do not have access to this conversation.",
        });
      }

      if (
        optionIndex === undefined ||
        optionIndex < 0 ||
        optionIndex >= message.poll.options.length
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid option index" });
      }

      const userId = req.user._id;
      const option = message.poll.options[optionIndex];

      const userVoteIdx = option.votes.findIndex(
        (v) => v.toString() === userId.toString(),
      );
      if (userVoteIdx > -1) {
        // User already voted for this option, remove vote
        option.votes.splice(userVoteIdx, 1);
      } else {
        // Add vote (and optionally remove their vote from other options if single-choice style)
        // Here we allow multi-option selection like standard Discord polls. To make it single-choice:
        message.poll.options.forEach((opt) => {
          const idx = opt.votes.findIndex(
            (v) => v.toString() === userId.toString(),
          );
          if (idx > -1) opt.votes.splice(idx, 1);
        });
        option.votes.push(userId);
      }

      await message.save();

      const populated = await Message.findById(message._id).populate(
        "authorId",
        "name email",
      );
      const reactions = await Reaction.find({
        messageId: message._id,
      }).populate("userId", "name email");
      const updatedMessage = {
        ...populated.toJSON(),
        reactions,
      };

      const io = req.app.get("io");
      if (io) {
        const room = message.channelId
          ? `channel_${message.channelId}`
          : `conversation_${message.conversationId}`;
        io.to(room).emit("message:poll:update", updatedMessage);
      }

      res.json({ success: true, data: updatedMessage });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
