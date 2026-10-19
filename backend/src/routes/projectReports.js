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
 * Object-level scope check for a loaded report. A report belongs to the
 * society in `report.societyId`; `societyAccess` cannot enforce this on
 * `/:id` routes because they carry no society parameter. Administrators are
 * unrestricted (same policy as `societyAccess`); everyone else may only act on
 * their own society's reports. Fails closed when either society is missing.
 */
const isReportInCallerScope = (user, report) => {
  if (user.role === "ADMIN") return true;

  const userSocietyId =
    user.societyId?._id?.toString() || user.societyId?.toString();
  const reportSocietyId =
    report.societyId?._id?.toString() || report.societyId?.toString();

  return Boolean(userSocietyId) && userSocietyId === reportSocietyId;
};

const outOfScope = (res) =>
  res.status(403).json({
    success: false,
    message: "Access restricted to your own society",
  });

// Id of a society reference that may be a bare id or a populated document.
// A populated document without an _id (for example a deleted society) has no id.
const societyIdOf = (ref) => {
  if (!ref) return undefined;
  const id = ref._id !== undefined ? ref._id : ref;
  return id ? id.toString() : undefined;
};

/**
 * @route   GET /api/project-reports
 * @desc    Get reports (own society; administrators: any)
 * @access  Authenticated users with a society, and administrators
 */
router.get("/", async (req, res, next) => {
  try {
    const { societyId, projectId, limit = 100, page = 1 } = req.query;
    const filter = {};

    // AUD-021: administrators may filter by any society. Everyone else is
    // forced to their own stored society; a society named in the query is
    // ignored, and a caller without a society gets no unscoped list.
    if (req.user.role === "ADMIN") {
      if (societyId) filter.societyId = societyId;
    } else {
      const ownSocietyId = societyIdOf(req.user.societyId);
      if (!ownSocietyId) return outOfScope(res);
      filter.societyId = ownSocietyId;
    }
    if (projectId) filter.projectId = projectId;

    const parsedLimit = parseLimit(limit);
    const parsedPage = parseInt(page, 10) || 1;
    const skip = (parsedPage - 1) * parsedLimit;

    const [reports, totalItems] = await Promise.all([
      ProjectReport.find(filter)
        .populate("societyId", "name shortName")
        .populate("projectId", "title category")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      ProjectReport.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: reports.length,
      data: reports,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems,
        totalPages: Math.ceil(totalItems / parsedLimit) || 1,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/project-reports/project/:projectId
 * @desc    Get reports for a specific project (own society's projects; administrators: any)
 * @access  Authenticated users with a society, and administrators
 */
router.get("/project/:projectId", async (req, res, next) => {
  try {
    const filter = { projectId: req.params.projectId };

    // AUD-021: for non-admins the project is resolved from the database and
    // its stored society must be the caller's; an unknown project and a
    // foreign one look the same. Reports are also restricted to the caller's
    // society, so a mismatched legacy report cannot leak through its project.
    if (req.user.role !== "ADMIN") {
      const ownSocietyId = societyIdOf(req.user.societyId);
      if (!ownSocietyId) return outOfScope(res);
      const project = await Project.findById(req.params.projectId)
        .select("societyId")
        .lean();
      if (!project || societyIdOf(project.societyId) !== ownSocietyId) {
        return res
          .status(404)
          .json({ success: false, message: "Project not found" });
      }
      filter.societyId = ownSocietyId;
    }

    const reports = await ProjectReport.find(filter)
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
 * @desc    Get report by ID (own society's reports; administrators: any)
 * @access  Authenticated users with a society, and administrators
 */
router.get("/:id", async (req, res, next) => {
  try {
    const report = await ProjectReport.findById(req.params.id)
      .populate("societyId", "name shortName")
      .populate("projectId", "title category");

    // AUD-021: a report outside the caller's scope is indistinguishable from
    // a nonexistent one.
    if (!report || !isReportInCallerScope(req.user, report)) {
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
        // AUD-021: a report belongs to its project's society, for every
        // caller including administrators. The project's society is the
        // stored one, never a client-supplied value.
        if (societyIdOf(project.societyId) !== societyIdOf(finalSocietyId)) {
          return res.status(400).json({
            success: false,
            message: "Project does not belong to the report's society",
          });
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

      if (!isReportInCallerScope(req.user, report)) {
        return outOfScope(res);
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

      if (!isReportInCallerScope(req.user, report)) {
        return outOfScope(res);
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
