const AuditLog = require("../../models/AuditLog");
const Role = require("../../models/Role");
const UserRole = require("../../models/UserRole");

/**
 * GET /api/audit-logs
 * Returns a paginated, filterable audit trail.
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const currentUserRole = await UserRole.findOne({
      user: req.user._id,
    }).populate("role");
    const isAuthorized =
      currentUserRole &&
      currentUserRole.role &&
      (currentUserRole.role.level === "super_admin" ||
        currentUserRole.role.level === "faculty_advisor");

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: {
          code: "PERMISSION_DENIED",
          message:
            "Only Super Admin (SB Faculty Advisor) and Faculty Advisors can view audit logs",
        },
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.user) {
      filter.user = req.query.user;
    }
    if (req.query.module) {
      filter.module = req.query.module;
    }
    if (req.query.result) {
      filter.result = req.query.result;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.timestamp = {};
      if (req.query.dateFrom) {
        filter.timestamp.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        const endOfDay = new Date(req.query.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = endOfDay;
      }
    }

    const logs = await AuditLog.find(filter)
      .populate("user", "name email")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AuditLog.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: logs,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
};
