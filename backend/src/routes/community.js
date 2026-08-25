const express = require("express");
const CommunityMessage = require("../models/CommunityMessage");
const { authenticate } = require("../middleware/auth");
const { requirePermission, attachScope } = require("../middleware/rbac");
const { parseLimit } = require("../utils/pagination");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/community/messages
 * @desc    Get recent community messages, scoped to the caller's society
 * @access  All authenticated users (own society only, unless globally scoped)
 */
router.get(
  "/messages",
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { limit = 50 } = req.query;

      const messages = await CommunityMessage.find({ ...req.scopeFilter })
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
  },
);

/**
 * @route   POST /api/community/messages
 * @desc    Send a community message
 * @access  All authenticated users
 */
router.post(
  "/messages",
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { content } = req.body;

      if (!content) {
        return res
          .status(400)
          .json({ success: false, message: "Content is required" });
      }

      // Persist against the scope-resolved society so created messages match
      // the req.scopeFilter the GET handler reads them back with.
      const societyId =
        req.userScope?.societyId ||
        req.user.societyId?._id ||
        req.user.societyId ||
        null;
      if (!societyId) {
        return res
          .status(400)
          .json({ success: false, message: "Society ID is required" });
      }

      const message = await CommunityMessage.create({
        content,
        authorId: req.user._id,
        societyId,
      });

      const populated = await CommunityMessage.findById(message._id).populate(
        "authorId",
        "name email",
      );

      // Real-time broadcast scoped to the owning society's room, so a message
      // is not delivered to every connected socket regardless of society.
      const io = req.app.get("io");
      if (io && message.societyId) {
        io.to(`society:${message.societyId}`).emit(
          "community:message",
          populated,
        );
      }

      res.status(201).json({
        success: true,
        data: populated,
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
