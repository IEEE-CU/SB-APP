const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate } = require('../middleware/auth');
const Note = require('../models/Note');

// GET /api/v1/societies/:societyId/notes
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { societyId } = req.params;
    const { channelId } = req.query;
    const filter = { societyId };
    if (channelId) filter.channelId = channelId;

    const notes = await Note.find(filter)
      .populate('authorId', 'name email avatar')
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: notes.length, data: notes });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/societies/:societyId/notes
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { societyId } = req.params;
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
});

// GET /api/v1/societies/:societyId/notes/:noteId
router.get('/:noteId', authenticate, async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.noteId).populate(
      'authorId',
      'name email avatar'
    );
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }
    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/societies/:societyId/notes/:noteId
router.put('/:noteId', authenticate, async (req, res, next) => {
  try {
    const { title, content, isPublic } = req.body;
    const note = await Note.findById(req.params.noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (isPublic !== undefined) note.isPublic = isPublic;

    await note.save();
    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/societies/:societyId/notes/:noteId
router.delete('/:noteId', authenticate, async (req, res, next) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
