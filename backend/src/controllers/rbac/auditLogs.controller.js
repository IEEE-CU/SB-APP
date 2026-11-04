const AuditLog = require("../../models/AuditLog");
const UserRole = require("../../models/UserRole");

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * Flat API entry from a stored row. The logger saves the actor as userId and
 * route/method/result/reason/metadata under details; rows written before that
 * (userId null, no details) map to nulls and an empty metadata object.
 */
function toEntry(row) {
  const actor = row.userId && row.userId._id ? row.userId : null;
  const details = row.details || {};
  return {
    id: String(row._id),
    user: actor
      ? { id: String(actor._id), name: actor.name, email: actor.email }
      : null,
    action: row.action,
    module: row.module,
    route: details.route ?? null,
    method: details.method ?? null,
    result: details.result ?? null,
    reason: details.reason ?? null,
    metadata: details.metadata ?? {},
    timestamp: row.createdAt,
  };
}


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

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const invalid = (message) =>
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message },
      });

    // Filters are applied to the fields the AuditLog schema actually stores:
    // actor -> userId, result -> details.result, timestamp -> createdAt.
    // Each must be a plain string so a query-string object cannot become an
    // operator (for example ?module[$ne]=x).
    const filter = {};

    const { user, module: moduleName, result, dateFrom, dateTo } = req.query;
    for (const [name, value] of Object.entries({ user, module: moduleName, result, dateFrom, dateTo })) {
      if (value !== undefined && typeof value !== "string") {
        return invalid(`${name} must be a single value`);
      }
    }

    if (user) {
      if (!OBJECT_ID_PATTERN.test(user)) return invalid("user must be a valid user id");
      filter.userId = user;
    }
    if (moduleName) {
      filter.module = moduleName;
    }
    if (result) {
      filter["details.result"] = result;
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (Number.isNaN(from.getTime())) return invalid("dateFrom is not a valid date");
        filter.createdAt.$gte = from;
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        if (Number.isNaN(endOfDay.getTime())) return invalid("dateTo is not a valid date");
        endOfDay.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endOfDay;
      }
    }

    // Only name and email of the actor are populated; nothing else of the user
    // document (and never its credentials) reaches the response.
    const rows = await AuditLog.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AuditLog.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: rows.map(toEntry),
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
