const express = require("express");
const CommunityMessage = require("../models/CommunityMessage");
const { authenticate } = require("../middleware/auth");
const { parseLimit } = require("../utils/pagination");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/community/messages
 * @desc    Get recent community messages
 * @access  All authenticated users
 */
router.get("/messages", async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;

    const messages = await CommunityMessage.find()
      .populate("authorId", "name email")
      .sort({ createdAt: 1 })
      .limit(parseLimit(limit, 50));

    res.json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/community/messages
 * @desc    Send a community message
 * @access  All authenticated users
 */
router.post("/messages", async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res
        .status(400)
        .json({ success: false, message: "Content is required" });
    }

    const message = await CommunityMessage.create({
      content,
      authorId: req.user._id,
      societyId: req.user.societyId || null,
    });

    const populated = await CommunityMessage.findById(message._id).populate(
      "authorId",
      "name email",
    );

    // Real-time socket broadcast
    const io = req.app.get("io");
    if (io) {
      io.emit("community:message", populated);
    }

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
