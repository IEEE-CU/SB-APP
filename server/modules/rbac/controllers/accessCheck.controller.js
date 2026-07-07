const { resolvePermissions } = require('../services/resolvePermissions');
const { logAudit } = require('../services/auditLogger');
const Role = require('../models/Role');
const User = require('../../../models/User');


/**
 * GET /api/user/permissions
 * Return the resolved, effective permission set for the logged-in user
 * (or ?userId= to inspect another user's permissions - restricted to Advisors/Admins).
 */
const getUserPermissions = async (req, res, next) => {
  try {
    let targetUserId = req.user._id;
    const { userId } = req.query;

    if (userId) {
      // Accessing another user's permissions is restricted to super_admin and faculty_advisor
      const userRoleDoc = await Role.findOne({ name: req.userRole });
      const isAuthorized = userRoleDoc && (
        userRoleDoc.level === 'super_admin' || 
        userRoleDoc.level === 'faculty_advisor'
      );

      if (!isAuthorized) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only Super Admin and Faculty Advisors can view other users\' permissions'
          }
        });
      }
      targetUserId = userId;
    }

    const resolved = await resolvePermissions(targetUserId);
    return res.status(200).json(resolved);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/access/check
 * Programmatic access check. Used by other microservices or systems.
 * Request body: { userId, module, action }
 * Response: { allowed: boolean, accessLevel, reason }
 */
const checkAccess = async (req, res, next) => {
  try {
    const { userId, module: targetModule, action: targetAction } = req.body;

    if (!userId || !targetModule || !targetAction) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing required fields: userId, module, action'
        }
      });
    }

    // Resolve target user permissions
    const resolved = await resolvePermissions(userId);
    const permKey = `${targetModule}:${targetAction}`;
    const accessLevel = resolved.permissions[permKey] || 'none';
    const allowed = accessLevel !== 'none';

    let reason = allowed 
      ? `Permission key ${permKey} granted with level: ${accessLevel}`
      : `Insufficient permission for key ${permKey}. Assigned level: none`;

    // Check society scoping constraint
    if (allowed && resolved.scope.type === 'society' && !resolved.scope.societyId && resolved.role !== 'sb_faculty_advisor') {
      return res.status(200).json({
        allowed: false,
        accessLevel: 'none',
        reason: 'Role requires a society scope, but no society was assigned to user.'
      });
    }

    // Write audit log entry
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const route = req.originalUrl || '/api/access/check';

    await logAudit({
      user: userId,
      action: 'access_check',
      module: targetModule,
      route,
      method: req.method,
      result: allowed ? 'allowed' : 'denied',
      reason,
      ipAddress,
      metadata: { requestedAction: targetAction }
    });

    return res.status(200).json({
      allowed,
      accessLevel,
      reason
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserPermissions,
  checkAccess
};
