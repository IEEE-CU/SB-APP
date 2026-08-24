const express = require("express");
const router = express.Router({ mergeParams: true });
const { authenticate } = require("../middleware/auth");
const {
  requirePermission,
  attachScope,
  isSocietyInScope,
} = require("../middleware/rbac");
const Note = require("../models/Note");

// GET /api/v1/societies/:societyId/notes
router.get(
  "/",
  authenticate,
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { societyId } = req.params;
      if (!isSocietyInScope(req, societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this society.",
        });
      }

      const { channelId } = req.query;
      const filter = { societyId };
      if (channelId) filter.channelId = channelId;

      const notes = await Note.find(filter)
        .populate("authorId", "name email avatar")
        .sort({ updatedAt: -1 });

      res.json({ success: true, count: notes.length, data: notes });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/societies/:societyId/notes
router.post(
  "/",
  authenticate,
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { societyId } = req.params;
      if (!isSocietyInScope(req, societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this society.",
        });
      }

      const { title, content, channelId, isPublic } = req.body;

      const note = await Note.create({
        title,
        content,
        societyId,
        channelId: channelId || null,
        authorId: req.user.id || req.user._id,
        isPublic: isPublic !== undefined ? isPublic : true,
      });

      res.status(201).json({ success: true, data: note });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/societies/:societyId/notes/:noteId
router.get(
  "/:noteId",
  authenticate,
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const note = await Note.findById(req.params.noteId).populate(
        "authorId",
        "name email avatar",
      );
      if (!note) {
        return res
          .status(404)
          .json({ success: false, message: "Note not found" });
      }
      if (!isSocietyInScope(req, note.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this note.",
        });
      }
      res.json({ success: true, data: note });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/societies/:societyId/notes/:noteId
router.put(
  "/:noteId",
  authenticate,
  requirePermission("community_hub", "edit"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const { title, content, isPublic } = req.body;
      const note = await Note.findById(req.params.noteId);
      if (!note) {
        return res
          .status(404)
          .json({ success: false, message: "Note not found" });
      }
      if (!isSocietyInScope(req, note.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this note.",
        });
      }

      if (title !== undefined) note.title = title;
      if (content !== undefined) note.content = content;
      if (isPublic !== undefined) note.isPublic = isPublic;

      await note.save();
      res.json({ success: true, data: note });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/societies/:societyId/notes/:noteId
router.delete(
  "/:noteId",
  authenticate,
  requirePermission("community_hub", "delete"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const note = await Note.findById(req.params.noteId);
      if (!note) {
        return res
          .status(404)
          .json({ success: false, message: "Note not found" });
      }
      if (!isSocietyInScope(req, note.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this note.",
        });
      }

      await Note.findByIdAndDelete(req.params.noteId);
      res.json({ success: true, message: "Note deleted successfully" });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
