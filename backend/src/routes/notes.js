const express = require("express");
const router = express.Router({ mergeParams: true });
const { authenticate } = require("../middleware/auth");
const {
  requirePermission,
  attachScope,
  isSocietyInScope,
} = require("../middleware/rbac");
const Note = require("../models/Note");

// AUD-032: Note.isPublic controls who may READ a note; it never widens what a caller may
// edit or delete (community_hub permissions and society scope still apply).
//   - public (isPublic true, or the field absent - the schema default is true, so legacy
//     records written before the field existed stay visible): every caller who passes the
//     community_hub:view and society-scope checks;
//   - private (isPublic false): its creator (the server-assigned authorId) and
//     administrators (legacy role ADMIN, the convention used for ownership elsewhere);
//   - anything else (null or a non-boolean stored value): treated as private - there is no
//     evidence it was meant to be public. Nothing is migrated.
// A note the caller may not see is a 404, identical to one that does not exist.
const isAdmin = (user) => user.role === "ADMIN";
const userId = (user) => String(user._id || user.id);
const isAuthor = (user, note) => Boolean(note.authorId) && String(note.authorId._id || note.authorId) === userId(user);

function visibilityFilter(user) {
  if (isAdmin(user)) return {};
  return {
    $or: [
      { isPublic: true },
      { isPublic: { $exists: false } },
      { authorId: user._id || user.id },
    ],
  };
}

const isBoolean = (value) => typeof value === "boolean";
const invalidIsPublic = (res) =>
  res.status(400).json({ success: false, message: "isPublic must be true or false" });
const notFound = (res) => res.status(404).json({ success: false, message: "Note not found" });

/** The note with this id in the URL's society, only if the caller may see it. */
const findVisible = (req, populate) => {
  const query = Note.findOne({
    $and: [{ _id: req.params.noteId, societyId: req.params.societyId }, visibilityFilter(req.user)],
  });
  return populate ? query.populate("authorId", "name email avatar") : query;
};

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
      const filter = { $and: [{ societyId }, visibilityFilter(req.user)] };
      if (channelId) filter.$and.push({ channelId });

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
      if (isPublic !== undefined && !isBoolean(isPublic)) return invalidIsPublic(res);

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
      const note = await findVisible(req, true);
      if (!note) return notFound(res);
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
      if (isPublic !== undefined && !isBoolean(isPublic)) return invalidIsPublic(res);
      const note = await findVisible(req);
      if (!note) return notFound(res);
      if (!isSocietyInScope(req, note.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this note.",
        });
      }
      // Only the creator or an administrator may change who can see a note.
      if (isPublic !== undefined && isPublic !== note.isPublic && !isAdmin(req.user) && !isAuthor(req.user, note)) {
        return res.status(403).json({
          success: false,
          message: "Only the note's author can change its visibility.",
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
      const note = await findVisible(req);
      if (!note) return notFound(res);
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
