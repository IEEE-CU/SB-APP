const express = require("express");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Reaction = require("../models/Reaction");
const Society = require("../models/Society");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/rbac");
const { withLastMessages } = require("../utils/conversationPreview");

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const idOf = (ref) =>
  ref && ref._id ? String(ref._id) : ref ? String(ref) : null;
const isId = (value) =>
  typeof value === "string" && OBJECT_ID_PATTERN.test(value);

const router = express.Router();

// Apply JWT verification using authenticate middleware
router.use(authenticate);

const MAX_RECIPIENTS = 100;
const MAX_SEARCH_LENGTH = 50;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * @route   GET /api/conversations/recipients[?q=<name fragment>]
 * @desc    The people the caller may start a direct message with: the members of the caller's
 *          OWN society, never the caller. This is not the user directory (GET /users stays
 *          administrator-only); it returns only { id, name }.
 * @access  community_hub:view
 *
 * The society comes from the authenticated user's own record (loaded by `authenticate`),
 * never from the request: a societyId in the query string or body is not read at all. A caller
 * with no society gets an empty list rather than a wider one. This is the same rule POST
 * /conversations enforces for the recipient, so everyone listed here can actually be messaged.
 */
router.get(
  "/recipients",
  requirePermission("community_hub", "view"),
  async (req, res, next) => {
    try {
      const { q } = req.query;
      if (
        q !== undefined &&
        (typeof q !== "string" || q.length > MAX_SEARCH_LENGTH)
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid search text" });
      }

      const societyId = idOf(req.user.societyId);
      if (!societyId) {
        return res.json({ success: true, count: 0, data: [] });
      }

      const filter = { societyId, _id: { $ne: req.user._id } };
      const term = typeof q === "string" ? q.trim() : "";
      if (term) filter.name = new RegExp(escapeRegex(term), "i");

      const members = await User.find(filter)
        .select("name")
        .sort({ name: 1 })
        .limit(MAX_RECIPIENTS)
        .lean();
      const data = members.map((member) => ({
        id: String(member._id),
        name: member.name,
      }));
      res.json({ success: true, count: data.length, data });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations (DMs) for the current user in a society
 * @access  Private
 */
router.get("/", async (req, res, next) => {
  try {
    let societyId =
      req.query.societyId || req.user.societyId?._id || req.user.societyId;
    if (!societyId) {
      const firstSociety = await require("../models/Society")
        .findOne()
        .sort({ createdAt: 1 });
      societyId = firstSociety?._id;
    }
    if (!societyId) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const userId = req.user._id;
    const conversations = await Conversation.find({
      societyId,
      $or: [{ userOneId: userId }, { userTwoId: userId }],
    })
      .populate("userOneId", "name email")
      .populate("userTwoId", "name email")
      .sort({ updatedAt: -1 });

    // `conversations` was filtered to the caller's own above; lastMessage is looked up only for those.
    const data = await withLastMessages(conversations);
    res.json({ success: true, count: data.length, data });
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
    const body = req.body && typeof req.body === "object" ? req.body : {};
    // The web client sends { participantIds: [otherUserId] }; direct callers send
    // { recipientId }. Either way a direct message has exactly one OTHER participant; the
    // caller is always the authenticated user and is never taken from the request.
    let recipientId = body.recipientId;
    if (recipientId === undefined && Array.isArray(body.participantIds)) {
      if (body.participantIds.length !== 1) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Exactly one other participant is required",
          });
      }
      recipientId = body.participantIds[0];
    }
    const callerId = String(req.user._id);

    if (
      recipientId === undefined ||
      recipientId === null ||
      recipientId === ""
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Recipient User ID is required" });
    }
    if (
      !isId(recipientId) ||
      (body.societyId !== undefined && !isId(body.societyId))
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }
    if (recipientId.toLowerCase() === callerId.toLowerCase()) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You cannot start a conversation with yourself",
        });
    }

    const isAdmin = req.user.role === "ADMIN";
    const callerSocietyId = idOf(req.user.societyId);
    const targetSocietyId = body.societyId || callerSocietyId;
    if (!targetSocietyId) {
      return res
        .status(400)
        .json({ success: false, message: "Society ID is required" });
    }
    // Only administrators may open a conversation in a society that is not their own.
    if (
      !isAdmin &&
      targetSocietyId.toLowerCase() !==
        String(callerSocietyId || "").toLowerCase()
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access restricted to your own society only.",
        });
    }
    if (!(await Society.exists({ _id: targetSocietyId }))) {
      return res
        .status(404)
        .json({ success: false, message: "Society not found" });
    }
    const recipient = await User.findById(recipientId).select("role societyId");
    if (!recipient) {
      return res
        .status(404)
        .json({ success: false, message: "Recipient not found" });
    }
    // The other participant must belong to the same society (administrators belong to none
    // and may be messaged from any society).
    if (
      recipient.role !== "ADMIN" &&
      idOf(recipient.societyId) !== String(targetSocietyId)
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "The recipient is not a member of this society.",
        });
    }

    const userOneId =
      callerId < recipientId.toLowerCase() ? callerId : recipientId;
    const userTwoId =
      callerId < recipientId.toLowerCase() ? recipientId : callerId;
    const pair = { societyId: targetSocietyId, userOneId, userTwoId };

    // Find or create. Two simultaneous requests for the same pair both pass the lookup; the
    // unique (society, userOne, userTwo) index makes one create fail, which is then read back.
    let conversation = await Conversation.findOne(pair);
    if (!conversation) {
      try {
        conversation = await Conversation.create(pair);
      } catch (createError) {
        if (createError.code !== 11000) throw createError;
        conversation = await Conversation.findOne(pair);
      }
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
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    // Security check: Verify user is part of the conversation
    const isParticipant =
      conversation.userOneId.toString() === req.user._id.toString() ||
      conversation.userTwoId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Access denied. You are not a participant in this conversation.",
        });
    }

    const messages = await Message.find({
      conversationId: req.params.id,
      parentMessageId: null,
    })
      .populate("authorId", "name email")
      .sort({ createdAt: 1 });

    const messagesWithReactions = await Promise.all(
      messages.map(async (msg) => {
        const reactions = await Reaction.find({ messageId: msg._id }).populate(
          "userId",
          "name email",
        );
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
});

/**
 * @route   POST /api/conversations/:id/messages
 * @desc    Send a message in a conversation
 * @access  Private
 */
router.post("/:id/messages", async (req, res, next) => {
  try {
    const { plainText, imageUrl, calendarEvent } = req.body;
    // The web client sends `content`; direct callers send `body` (the channel route accepts both).
    const body = req.body.body || req.body.content;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    // Security check: Verify user is part of the conversation
    const isParticipant =
      conversation.userOneId.toString() === req.user._id.toString() ||
      conversation.userTwoId.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Access denied. You are not a participant in this conversation.",
        });
    }

    if (!body) {
      return res
        .status(400)
        .json({ success: false, message: "Message body is required" });
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

    const populated = await Message.findById(message._id).populate(
      "authorId",
      "name email",
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`conversation_${conversation._id}`).emit("message:new", {
        ...populated.toJSON(),
        reactions: [],
      });
    }

    res
      .status(201)
      .json({ success: true, data: { ...populated.toJSON(), reactions: [] } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
