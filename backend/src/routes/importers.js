const express = require('express');
const mongoose = require('mongoose');
const router = express.Router({ mergeParams: true });
const { authenticate, societyAccessByParam } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const Task = require('../models/Task');
const Society = require('../models/Society');

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// AUD-019: the target society comes only from the URL. Before any write the
// caller must hold community_hub:create, belong to that society (ADMIN is
// unrestricted, as elsewhere), and the society must exist.
const requireExistingSociety = async (req, res, next) => {
  try {
    const { societyId } = req.params;
    if (!OBJECT_ID_PATTERN.test(societyId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format.' });
    }
    if (!(await Society.exists({ _id: societyId }))) {
      return res.status(404).json({ success: false, message: 'Society not found.' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

const importGuards = [
  authenticate,
  requirePermission('community_hub', 'create'),
  societyAccessByParam('societyId'),
  requireExistingSociety,
];

const DEFAULT_SLACK_CHANNEL_NAME = 'imported-slack-channel';
const MAX_REPORTED_ERRORS = 20;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Validates the whole Slack payload and every channel and message document
 * against the real Channel and Message schemas, without touching the database.
 * Nothing is written unless this returns no errors, so a validation failure can
 * no longer leave a channel (or any message) behind.
 *
 * Messages are mapped to the Message schema: text/content -> body and plainText,
 * the authenticated caller -> authorId, the path society -> societyId. The
 * channel reference is only known after the channel exists, so a placeholder id
 * stands in while validating. Fields in the payload cannot set authorId,
 * societyId or channelId.
 *
 * @returns {{ errors: string[], plan: Array }} plan: one entry per channel
 */
function buildSlackImportPlan(body, societyId, authorId) {
  const errors = [];
  if (!isPlainObject(body)) {
    return { errors: ['Request body must be a JSON object.'], plan: [] };
  }
  const { channels = [], messages = [] } = body;
  if (!Array.isArray(channels)) errors.push('channels must be an array.');
  if (!Array.isArray(messages)) errors.push('messages must be an array.');
  if (errors.length) return { errors, plan: [] };

  const schemaErrors = (doc) => {
    const failure = doc.validateSync();
    return failure ? Object.values(failure.errors).map((e) => e.message) : [];
  };

  const parsedMessages = messages.map((m, i) => {
    const label = `messages[${i}]`;
    if (!isPlainObject(m)) {
      errors.push(`${label} must be an object.`);
      return null;
    }
    if (typeof m.channel !== 'string' || m.channel === '') {
      errors.push(`${label}.channel must be a non-empty string.`);
    }
    const text = m.text || m.content;
    if (typeof text !== 'string' || text.trim() === '') {
      errors.push(`${label} needs non-empty text (or content) as a string.`);
      return null;
    }
    const doc = new Message({
      body: text,
      plainText: text,
      authorId,
      societyId,
      channelId: new mongoose.Types.ObjectId(),
    });
    schemaErrors(doc).forEach((message) => errors.push(`${label}: ${message}`));
    return { channel: m.channel, text };
  });

  const plan = channels.map((ch, i) => {
    const label = `channels[${i}]`;
    if (!isPlainObject(ch)) {
      errors.push(`${label} must be an object.`);
      return null;
    }
    if (ch.name && typeof ch.name !== 'string') {
      errors.push(`${label}.name must be a string.`);
      return null;
    }
    const doc = new Channel({
      name: ch.name || DEFAULT_SLACK_CHANNEL_NAME,
      type: 'chat',
      societyId,
    });
    schemaErrors(doc).forEach((message) => errors.push(`${label}: ${message}`));
    return {
      // The schema lowercases names; look up and create by the stored form.
      name: doc.name,
      messages: parsedMessages.filter((m) => m && m.channel === ch.name),
    };
  });

  return { errors, plan };
}

// POST /api/v1/societies/:societyId/importer/slack
router.post('/slack', importGuards, async (req, res, next) => {
  try {
    const { societyId } = req.params;
    const authorId = req.user._id;

    const { errors, plan } = buildSlackImportPlan(req.body, societyId, authorId);
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors.slice(0, MAX_REPORTED_ERRORS),
      });
    }

    let importedChannels = 0;
    let importedMessages = 0;

    // Batch process channels
    for (const entry of plan) {
      let existing = await Channel.findOne({ societyId, name: entry.name });
      if (!existing) {
        existing = await Channel.create({
          name: entry.name,
          type: 'chat',
          societyId,
        });
        importedChannels++;
      }

      for (const m of entry.messages) {
        await Message.create({
          body: m.text,
          plainText: m.text,
          authorId,
          societyId,
          channelId: existing._id,
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
router.post('/todoist', importGuards, async (req, res, next) => {
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
