const express = require("express");
const BoardCard = require("../models/BoardCard");
const Channel = require("../models/Channel");
const Message = require("../models/Message");
const { authenticate } = require("../middleware/auth");
const {
  requirePermission,
  attachScope,
  isSocietyInScope,
} = require("../middleware/rbac");

const router = express.Router();
router.use(authenticate);

// Fields a caller may update via PUT /cards/:id. Deliberately excludes
// `channelId` (and any other relationship field that determines the card's
// society scope) so an edit cannot be used to relocate a card past the
// authorization check already performed against its original channel.
const EDITABLE_CARD_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "order",
  "dueDate",
  "assignees",
  "projectId",
  "parentCardId",
  "blockedBy",
];

/**
 * Fetches the channel a board belongs to and verifies the caller's scope
 * covers that channel's society. Returns the channel on success, or null
 * after already writing the appropriate 404/403 response.
 */
async function loadScopedChannel(req, res, channelId) {
  const channel = await Channel.findById(channelId);
  if (!channel) {
    res.status(404).json({ success: false, message: "Channel not found" });
    return null;
  }
  if (!isSocietyInScope(req, channel.societyId)) {
    res.status(403).json({
      success: false,
      message: "Access denied. You do not have access to this board.",
    });
    return null;
  }
  return channel;
}

/**
 * @route   GET /api/boards/:channelId/cards
 * @desc    Get all board cards for a channel
 */
router.get(
  "/:channelId/cards",
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const channel = await loadScopedChannel(req, res, req.params.channelId);
      if (!channel) return;

      const cards = await BoardCard.find({ channelId: req.params.channelId })
        .populate("assignees", "name email")
        .sort({ order: 1 });
      res.json({ success: true, count: cards.length, data: cards });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   POST /api/boards/:channelId/cards
 * @desc    Create a new card on a board channel
 */
router.post(
  "/:channelId/cards",
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const channel = await loadScopedChannel(req, res, req.params.channelId);
      if (!channel) return;

      const {
        title,
        description,
        status,
        priority,
        dueDate,
        assignees,
        projectId,
        blockedBy,
      } = req.body;
      if (!title) {
        return res
          .status(400)
          .json({ success: false, message: "Card title is required" });
      }

      const maxCard = await BoardCard.findOne({
        channelId: req.params.channelId,
        status: status || "TODO",
      }).sort({ order: -1 });
      const newOrder = maxCard ? maxCard.order + 1 : 0;

      const card = await BoardCard.create({
        channelId: req.params.channelId,
        title,
        description: description || "",
        status: status || "TODO",
        priority: priority || "MEDIUM",
        dueDate: dueDate || null,
        assignees: assignees || [],
        projectId: projectId || null,
        blockedBy: blockedBy || [],
        order: newOrder,
      });

      res.status(201).json({ success: true, data: card });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   PUT /api/boards/cards/:id
 * @desc    Update card status, title, order, or priority
 */
router.put(
  "/cards/:id",
  requirePermission("community_hub", "edit"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const card = await BoardCard.findById(req.params.id);
      if (!card) {
        return res
          .status(404)
          .json({ success: false, message: "Card not found" });
      }
      const channel = await loadScopedChannel(req, res, card.channelId);
      if (!channel) return;

      const prevStatus = card.status;
      EDITABLE_CARD_FIELDS.forEach((field) => {
        if (req.body[field] !== undefined) {
          card[field] = req.body[field];
        }
      });
      await card.save();

      // Auto-post announcement to connected channel if status changed to DONE
      if (req.body.status === "DONE" && prevStatus !== "DONE") {
        const channel = await Channel.findById(card.channelId);
        if (channel) {
          await Message.create({
            body: `🎉 Task Completed: **${card.title}** has been marked as DONE on board #${channel.name}!`,
            plainText: `🎉 Task Completed: ${card.title} has been marked as DONE on board #${channel.name}!`,
            authorId: req.user._id,
            societyId: channel.societyId,
            channelId: channel._id,
          });
        }
      }

      res.json({ success: true, data: card });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   DELETE /api/boards/cards/:id
 * @desc    Delete a card
 */
router.delete(
  "/cards/:id",
  requirePermission("community_hub", "delete"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const card = await BoardCard.findById(req.params.id);
      if (!card) {
        return res
          .status(404)
          .json({ success: false, message: "Card not found" });
      }
      const channel = await loadScopedChannel(req, res, card.channelId);
      if (!channel) return;

      await BoardCard.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: "Card deleted" });
    } catch (error) {
      next(error);
    }
  },
);

// Exposed for unit testing the PUT /cards/:id allow-list without a DB.
router.EDITABLE_CARD_FIELDS = EDITABLE_CARD_FIELDS;

module.exports = router;
