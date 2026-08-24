const express = require("express");
const router = express.Router({ mergeParams: true });
const { authenticate } = require("../middleware/auth");
const {
  requirePermission,
  attachScope,
  isSocietyInScope,
} = require("../middleware/rbac");
const Sprint = require("../models/Sprint");
const Milestone = require("../models/Milestone");

// GET /api/v1/societies/:societyId/sprints
router.get(
  "/sprints",
  authenticate,
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      if (!isSocietyInScope(req, req.params.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this society.",
        });
      }
      const sprints = await Sprint.find({
        societyId: req.params.societyId,
      }).sort({ startDate: -1 });
      res.json({ success: true, count: sprints.length, data: sprints });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/societies/:societyId/sprints
router.post(
  "/sprints",
  authenticate,
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      if (!isSocietyInScope(req, req.params.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this society.",
        });
      }
      const { name, goal, startDate, endDate, status } = req.body;
      const sprint = await Sprint.create({
        name,
        goal,
        societyId: req.params.societyId,
        startDate,
        endDate,
        status: status || "planned",
      });
      res.status(201).json({ success: true, data: sprint });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/societies/:societyId/sprints/:sprintId
router.put(
  "/sprints/:sprintId",
  authenticate,
  requirePermission("community_hub", "edit"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      const sprint = await Sprint.findById(req.params.sprintId);
      if (!sprint)
        return res
          .status(404)
          .json({ success: false, message: "Sprint not found" });
      if (!isSocietyInScope(req, sprint.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this sprint.",
        });
      }
      Object.assign(sprint, req.body);
      await sprint.save();
      res.json({ success: true, data: sprint });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/societies/:societyId/milestones
router.get(
  "/milestones",
  authenticate,
  requirePermission("community_hub", "view"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      if (!isSocietyInScope(req, req.params.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this society.",
        });
      }
      const milestones = await Milestone.find({
        societyId: req.params.societyId,
      }).sort({ dueDate: 1 });
      res.json({ success: true, count: milestones.length, data: milestones });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/societies/:societyId/milestones
router.post(
  "/milestones",
  authenticate,
  requirePermission("community_hub", "create"),
  attachScope("societyId"),
  async (req, res, next) => {
    try {
      if (!isSocietyInScope(req, req.params.societyId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You do not have access to this society.",
        });
      }
      const { title, description, dueDate, status } = req.body;
      const milestone = await Milestone.create({
        title,
        description,
        societyId: req.params.societyId,
        dueDate,
        status: status || "pending",
      });
      res.status(201).json({ success: true, data: milestone });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
