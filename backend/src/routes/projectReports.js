const express = require("express");
const ProjectReport = require("../models/ProjectReport");
const Project = require("../models/Project");
const { authenticate, societyAccess } = require("../middleware/auth");
const { requirePermission } = require("../middleware/rbac");
const { parseLimit } = require("../utils/pagination");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/project-reports
 * @desc    Get all reports
 * @access  All users
 */
router.get("/", async (req, res, next) => {
  try {
    const { societyId, projectId, limit = 100 } = req.query;
    const filter = {};

    if (societyId) filter.societyId = societyId;
    if (projectId) filter.projectId = projectId;

    const reports = await ProjectReport.find(filter)
      .populate("societyId", "name shortName")
      .populate("projectId", "title category")
      .sort({ createdAt: -1 })
      .limit(parseLimit(limit));

    res.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/project-reports/project/:projectId
 * @desc    Get reports for a specific project
 * @access  All users
 */
router.get("/project/:projectId", async (req, res, next) => {
  try {
    const reports = await ProjectReport.find({
      projectId: req.params.projectId,
    })
      .populate("societyId", "name shortName")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/project-reports/:id
 * @desc    Get report by ID
 * @access  All users
 */
router.get("/:id", async (req, res, next) => {
  try {
    const report = await ProjectReport.findById(req.params.id)
      .populate("societyId", "name shortName")
      .populate("projectId", "title category");

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/project-reports
 * @desc    Create new project report
 * @access  Society Office Bearers / Admin
 */
router.post(
  "/",
  requirePermission("reports", "create"),
  societyAccess,
  async (req, res, next) => {
    try {
      const {
        societyId,
        projectId,
        title,
        content,
        description,
        type,
        participants,
        outcome,
        images,
        highlights,
        takeaways,
        followUpPlan,
      } = req.body;

      const finalSocietyId = societyId || req.user.societyId;
      if (!finalSocietyId) {
        return res
          .status(400)
          .json({ success: false, message: "Society ID is required" });
      }

      // If projectId is provided, check if it exists
      if (projectId) {
        const project = await Project.findById(projectId);
        if (!project) {
          return res
            .status(404)
            .json({ success: false, message: "Project not found" });
        }
      }

      const report = await ProjectReport.create({
        societyId: finalSocietyId,
        projectId: projectId || null,
        title,
        description: description || content || "",
        type: type || "general",
        participants,
        outcome,
        images,
        highlights,
        takeaways,
        followUpPlan,
        status: "SUBMITTED",
      });

      res.status(201).json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   PATCH /api/project-reports/:id
 * @desc    Update project report
 * @access  Society Office Bearers / Admin
 */
router.patch(
  "/:id",
  requirePermission("reports", "edit"),
  societyAccess,
  async (req, res, next) => {
    try {
      const {
        title,
        content,
        description,
        type,
        participants,
        outcome,
        images,
        highlights,
        takeaways,
        followUpPlan,
        status,
      } = req.body;

      const report = await ProjectReport.findById(req.params.id);
      if (!report) {
        return res
          .status(404)
          .json({ success: false, message: "Report not found" });
      }

      // Update fields if provided
      if (title !== undefined) report.title = title;
      if (description !== undefined) report.description = description;
      else if (content !== undefined) report.description = content;
      if (type !== undefined) report.type = type;
      if (participants !== undefined) report.participants = participants;
      if (outcome !== undefined) report.outcome = outcome;
      if (images !== undefined) report.images = images;
      if (highlights !== undefined) report.highlights = highlights;
      if (takeaways !== undefined) report.takeaways = takeaways;
      if (followUpPlan !== undefined) report.followUpPlan = followUpPlan;
      if (status !== undefined) report.status = status;

      await report.save();

      const populated = await ProjectReport.findById(report._id)
        .populate("societyId", "name shortName")
        .populate("projectId", "title category");

      res.json({
        success: true,
        data: populated,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   DELETE /api/project-reports/:id
 * @desc    Delete project report
 * @access  Society Office Bearers / Admin
 */
router.delete(
  "/:id",
  requirePermission("reports", "delete"),
  societyAccess,
  async (req, res, next) => {
    try {
      const report = await ProjectReport.findById(req.params.id);
      if (!report) {
        return res
          .status(404)
          .json({ success: false, message: "Report not found" });
      }

      await ProjectReport.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Report deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
