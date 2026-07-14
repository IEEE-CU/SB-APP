const express = require("express");
const Project = require("../models/Project");
const { authenticate, societyAccess } = require("../middleware/auth");
const { requirePermission } = require("../middleware/rbac");
const { parseLimit } = require("../utils/pagination");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/projects
 * @desc    Get all projects (read access for all)
 * @access  All authenticated users
 */
router.get("/", async (req, res, next) => {
  try {
    const { societyId, category, status, limit = 100 } = req.query;

    const filter = {};
    if (societyId) filter.societyId = societyId;
    if (category) filter.category = category;
    if (status) filter.status = status;

    const projects = await Project.find(filter)
      .populate("societyId", "name shortName")
      .sort({ startDate: -1 })
      .limit(parseLimit(limit));

    res.json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  All authenticated users
 */
router.get("/:id", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate(
      "societyId",
      "name shortName",
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Admin or Own Office Bearer
 */
router.post(
  "/",
  requirePermission("projects", "create"),
  societyAccess,
  async (req, res, next) => {
    try {
      const {
        societyId,
        title,
        category,
        sanctioningBody,
        amountSanctioned,
        startDate,
        status,
        description,
      } = req.body;

      // For office bearers, use their society if not specified
      const targetSocietyId =
        societyId || req.user.societyId?._id || req.user.societyId;

      if (!targetSocietyId) {
        return res.status(400).json({
          success: false,
          message: "Society ID is required",
        });
      }

      const project = await Project.create({
        societyId: targetSocietyId,
        title,
        category,
        sanctioningBody,
        amountSanctioned,
        startDate,
        status: status || "PROPOSED",
        description,
      });

      const populated = await Project.findById(project._id).populate(
        "societyId",
        "name shortName",
      );

      res.status(201).json({
        success: true,
        data: populated,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Admin or Own Office Bearer
 */
router.put(
  "/:id",
  requirePermission("projects", "edit"),
  societyAccess,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.id);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Check society access for office bearers
      if (req.user.role === "OFFICE_BEARER") {
        const userSocietyId =
          req.user.societyId?._id?.toString() || req.user.societyId?.toString();
        if (project.societyId.toString() !== userSocietyId) {
          return res.status(403).json({
            success: false,
            message: "Access restricted to your own society",
          });
        }
      }

      // Update fields
      const updateFields = [
        "title",
        "category",
        "sanctioningBody",
        "amountSanctioned",
        "startDate",
        "status",
        "description",
      ];

      updateFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          project[field] = req.body[field];
        }
      });

      await project.save();

      const populated = await Project.findById(project._id).populate(
        "societyId",
        "name shortName",
      );

      res.json({
        success: true,
        data: populated,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id",
  requirePermission("projects", "edit"),
  societyAccess,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.id);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Check society access for office bearers
      if (req.user.role === "OFFICE_BEARER") {
        const userSocietyId =
          req.user.societyId?._id?.toString() || req.user.societyId?.toString();
        if (project.societyId.toString() !== userSocietyId) {
          return res.status(403).json({
            success: false,
            message: "Access restricted to your own society",
          });
        }
      }

      // Update fields
      const updateFields = [
        "title",
        "category",
        "sanctioningBody",
        "amountSanctioned",
        "startDate",
        "status",
        "description",
      ];

      updateFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          project[field] = req.body[field];
        }
      });

      await project.save();

      const populated = await Project.findById(project._id).populate(
        "societyId",
        "name shortName",
      );

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
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Admin or Own Office Bearer
 */
router.delete(
  "/:id",
  requirePermission("projects", "delete"),
  societyAccess,
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.id);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Check society access for office bearers
      if (req.user.role === "OFFICE_BEARER") {
        const userSocietyId =
          req.user.societyId?._id?.toString() || req.user.societyId?.toString();
        if (project.societyId.toString() !== userSocietyId) {
          return res.status(403).json({
            success: false,
            message: "Access restricted to your own society",
          });
        }
      }

      await Project.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: "Project deleted",
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
