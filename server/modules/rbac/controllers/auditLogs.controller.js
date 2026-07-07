const AuditLog = require('../models/AuditLog');
const Role = require('../models/Role');

/**
 * GET /api/audit-logs
 * Returns a paginated, filterable audit trail.
 * Restricted to Advisors and Admins (role level super_admin or faculty_advisor).
 */
const getAuditLogs = async (req, res, next) => {
  try {
    // Restrict access to super_admin or faculty_advisor level roles
    const userRoleDoc = await Role.findOne({ name: req.userRole });
    const isAuthorized = userRoleDoc && (
      userRoleDoc.level === 'super_admin' || 
      userRoleDoc.level === 'faculty_advisor'
    );

    if (!isAuthorized) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only Super Admin (SB Faculty Advisor) and Faculty Advisors can view audit logs'
        }
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
    
    // Date filtering: ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
    if (req.query.dateFrom || req.query.dateTo) {
      filter.timestamp = {};
      if (req.query.dateFrom) {
        filter.timestamp.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        // Set to end of the specified day
        const endOfDay = new Date(req.query.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = endOfDay;
      }
    }

    const logs = await AuditLog.find(filter)
      .populate('user', 'name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AuditLog.countDocuments(filter);

    return res.status(200).json({
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs
};
