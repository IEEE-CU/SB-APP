const { resolvePermissions } = require('../services/resolvePermissions');
const { logAudit } = require('../services/auditLogger');

/**
 * Middleware to require a specific permission for a module and action.
 * Enforces data-driven permission checks and logs the attempt.
 * 
 * @param {string} module - The module name (e.g., 'finance', 'events')
 * @param {string} action - The action (e.g., 'view', 'create')
 */
const requirePermission = (module, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User is not authenticated'
          }
        });
      }

      const userId = req.user._id;
      const resolved = await resolvePermissions(userId);
      const permKey = `${module}:${action}`;
      const accessLevel = resolved.permissions[permKey];

      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const route = req.originalUrl || req.baseUrl + req.path;

      // Check if permission is granted (any level other than 'none' or undefined)
      if (!accessLevel || accessLevel === 'none') {
        // Log access denied
        await logAudit({
          user: userId,
          action: 'access_check',
          module,
          route,
          method: req.method,
          result: 'denied',
          reason: `Insufficient permission for key ${permKey}. Assigned level: ${accessLevel || 'none'}`,
          ipAddress
        });

        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to perform this action'
          }
        });
      }

      // If scope is 'society' and user has no society assigned (for a society-scoped role), deny access
      if (resolved.scope.type === 'society' && !resolved.scope.societyId && resolved.role !== 'sb_faculty_advisor') {
        await logAudit({
          user: userId,
          action: 'access_check',
          module,
          route,
          method: req.method,
          result: 'denied',
          reason: `Role requires a society scope, but no society was assigned to user.`,
          ipAddress
        });

        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied: No society scope assigned to your role'
          }
        });
      }

      // Attach accessLevel and scope metadata to the request object for downstream use
      req.accessLevel = accessLevel;
      req.userRole = resolved.role;
      req.userScope = resolved.scope;

      // Log access allowed
      await logAudit({
        user: userId,
        action: 'access_check',
        module,
        route,
        method: req.method,
        result: 'allowed',
        reason: `Access granted for key ${permKey} with level ${accessLevel}`,
        ipAddress
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware for coarse-grained checks based on role names.
 * 
 * @param {...string} roleNames - Permitted role names
 */
const requireRole = (...roleNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'User is not authenticated' }
        });
      }

      const resolved = await resolvePermissions(req.user._id);
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const route = req.originalUrl || req.baseUrl + req.path;

      if (!roleNames.includes(resolved.role)) {
        await logAudit({
          user: req.user._id,
          action: 'role_check',
          module: 'roles_access',
          route,
          method: req.method,
          result: 'denied',
          reason: `Required roles: [${roleNames.join(', ')}]. User had role: ${resolved.role}`,
          ipAddress
        });

        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied: Insufficient role privileges'
          }
        });
      }

      // Attach resolved information
      req.userRole = resolved.role;
      req.userScope = resolved.scope;

      await logAudit({
        user: req.user._id,
        action: 'role_check',
        module: 'roles_access',
        route,
        method: req.method,
        result: 'allowed',
        reason: `Role verified: ${resolved.role}`,
        ipAddress
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Shortcut middleware to require Super Admin (SB Faculty Advisor) role.
 */
const requireSuperAdmin = async (req, res, next) => {
  return requireRole('sb_faculty_advisor')(req, res, next);
};

/**
 * Middleware helper that automatically injects a Mongoose filter query into `req.scopeFilter`
 * based on the user's role scope.
 * 
 * Usage:
 * router.get('/api/finance', requirePermission('finance', 'view'), attachScope('society'), controller.getExpenses);
 * 
 * In controller:
 * const expenses = await Expense.find({ ...req.scopeFilter });
 * 
 * @param {string} fieldName - The database field name for society filtering (default: 'society')
 */
const attachScope = (fieldName = 'society') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'User is not authenticated' }
        });
      }

      // Fetch or use already resolved userScope
      const userScope = req.userScope || (await resolvePermissions(req.user._id)).scope;
      const userRole = req.userRole || (await resolvePermissions(req.user._id)).role;

      // Super Admins or global roles bypass all scoping filters
      if (userRole === 'sb_faculty_advisor' || userScope.type === 'global' || userScope.type === 'student_branch') {
        req.scopeFilter = {};
      } else if (userScope.type === 'society' && userScope.societyId) {
        req.scopeFilter = { [fieldName]: userScope.societyId };
      } else {
        // Safe fallback: filter by a non-existent ID so no records are returned
        req.scopeFilter = { [fieldName]: '000000000000000000000000' };
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware for direct audit logging of specific route activities.
 * Can be attached to log successful visits or actions.
 * 
 * @param {string} action - The action description
 * @param {string} module - The module name
 */
const auditLogger = (action, module) => {
  return async (req, res, next) => {
    try {
      // Proceed with next middleware first
      next();

      // Log after the request has finished to capture the result
      // Wait, we log asynchronously without blocking
      const userId = req.user ? req.user._id : null;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const route = req.originalUrl || req.baseUrl + req.path;
      const result = res.statusCode >= 400 ? 'denied' : 'allowed';
      const reason = res.statusCode >= 400 ? `HTTP status ${res.statusCode}` : 'route_accessed';

      logAudit({
        user: userId,
        action,
        module,
        route,
        method: req.method,
        result,
        reason,
        ipAddress
      });
    } catch (error) {
      console.error('Audit logger middleware error:', error);
    }
  };
};

module.exports = {
  requirePermission,
  requireRole,
  requireSuperAdmin,
  attachScope,
  auditLogger
};
