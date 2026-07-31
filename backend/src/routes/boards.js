const express = require("express");
const BoardCard = require("../models/BoardCard");
const Channel = require("../models/Channel");
const Message = require("../models/Message");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

/**
 * @route   GET /api/boards/:channelId/cards
 * @desc    Get all board cards for a channel
 */
router.get("/:channelId/cards", async (req, res, next) => {
  try {
    const cards = await BoardCard.find({ channelId: req.params.channelId })
      .populate("assignees", "name email")
      .sort({ order: 1 });
    res.json({ success: true, count: cards.length, data: cards });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/boards/:channelId/cards
 * @desc    Create a new card on a board channel
 */
router.post("/:channelId/cards", async (req, res, next) => {
  try {
    const { title, description, status, priority, dueDate, assignees, projectId, blockedBy } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "Card title is required" });
    }

    const maxCard = await BoardCard.findOne({ channelId: req.params.channelId, status: status || "TODO" })
      .sort({ order: -1 });
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
});

/**
 * @route   PUT /api/boards/cards/:id
 * @desc    Update card status, title, order, or priority
 */
router.put("/cards/:id", async (req, res, next) => {
  try {
    const card = await BoardCard.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ success: false, message: "Card not found" });
    }

    const prevStatus = card.status;
    Object.assign(card, req.body);
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
});

/**
 * @route   DELETE /api/boards/cards/:id
 * @desc    Delete a card
 */
router.delete("/cards/:id", async (req, res, next) => {
  try {
    const card = await BoardCard.findByIdAndDelete(req.params.id);
    if (!card) {
      return res.status(404).json({ success: false, message: "Card not found" });
    }
    res.json({ success: true, message: "Card deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
