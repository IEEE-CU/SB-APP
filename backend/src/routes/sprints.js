const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken } = require('../middleware/auth');
const Sprint = require('../models/Sprint');
const Milestone = require('../models/Milestone');

// GET /api/v1/societies/:societyId/sprints
router.get('/sprints', authenticateToken, async (req, res, next) => {
  try {
    const sprints = await Sprint.find({ societyId: req.params.societyId }).sort({ startDate: -1 });
    res.json({ success: true, count: sprints.length, data: sprints });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/societies/:societyId/sprints
router.post('/sprints', authenticateToken, async (req, res, next) => {
  try {
    const { name, goal, startDate, endDate, status } = req.body;
    const sprint = await Sprint.create({
      name,
      goal,
      societyId: req.params.societyId,
      startDate,
      endDate,
      status: status || 'planned',
    });
    res.status(201).json({ success: true, data: sprint });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/societies/:societyId/sprints/:sprintId
router.put('/sprints/:sprintId', authenticateToken, async (req, res, next) => {
  try {
    const sprint = await Sprint.findByIdAndUpdate(req.params.sprintId, req.body, { new: true });
    if (!sprint) return res.status(404).json({ success: false, message: 'Sprint not found' });
    res.json({ success: true, data: sprint });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/societies/:societyId/milestones
router.get('/milestones', authenticateToken, async (req, res, next) => {
  try {
    const milestones = await Milestone.find({ societyId: req.params.societyId }).sort({ dueDate: 1 });
    res.json({ success: true, count: milestones.length, data: milestones });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/societies/:societyId/milestones
router.post('/milestones', authenticateToken, async (req, res, next) => {
  try {
    const { title, description, dueDate, status } = req.body;
    const milestone = await Milestone.create({
      title,
      description,
      societyId: req.params.societyId,
      dueDate,
      status: status || 'pending',
    });
    res.status(201).json({ success: true, data: milestone });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
