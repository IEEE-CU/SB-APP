const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate } = require('../middleware/auth');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const Task = require('../models/Task');

// POST /api/v1/societies/:societyId/importer/slack
router.post('/slack', authenticate, async (req, res, next) => {
  try {
    const { societyId } = req.params;
    const { channels = [], messages = [] } = req.body;

    let importedChannels = 0;
    let importedMessages = 0;

    // Batch process channels
    for (const ch of channels) {
      let existing = await Channel.findOne({ societyId, name: ch.name });
      if (!existing) {
        existing = await Channel.create({
          name: ch.name || 'imported-slack-channel',
          type: 'chat',
          societyId,
        });
        importedChannels++;
      }

      // Filter messages for this channel
      const channelMsgs = messages.filter((m) => m.channel === ch.name);
      for (const m of channelMsgs) {
        await Message.create({
          channelId: existing._id,
          senderId: req.user.id || req.user._id,
          content: m.text || m.content || '',
        });
        importedMessages++;
      }
    }

    res.json({
      success: true,
      message: 'Slack import completed',
      importedChannels,
      importedMessages,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/societies/:societyId/importer/todoist
router.post('/todoist', authenticate, async (req, res, next) => {
  try {
    const { societyId } = req.params;
    const { tasks = [] } = req.body;

    let importedTasks = 0;

    for (const t of tasks) {
      await Task.create({
        title: t.content || t.title || 'Imported Task',
        description: t.description || '',
        societyId,
        userId: req.user.id || req.user._id,
        status: t.is_completed ? 'COMPLETED' : 'NOT_STARTED',
        priority: t.priority === 4 ? 'HIGH' : t.priority === 3 ? 'MEDIUM' : 'LOW',
      });
      importedTasks++;
    }

    res.json({
      success: true,
      message: 'Todoist import completed',
      importedTasks,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
