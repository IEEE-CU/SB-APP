const express = require('express');
const rateLimit = require('express-rate-limit');

const { authenticate } = require('../../../middleware/auth');
const { requirePermission, requireSuperAdmin } = require('../middleware/rbac');

const rolesController = require('../controllers/roles.controller');
const permissionsController = require('../controllers/permissions.controller');
const rolePermissionsController = require('../controllers/rolePermissions.controller');
const auditLogsController = require('../controllers/auditLogs.controller');
const accessCheckController = require('../controllers/accessCheck.controller');

const router = express.Router();

// Rate limiter for access check endpoint to prevent abuse
const accessCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // Limit each IP to 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many access check requests, please try again later.'
    }
  }
});

// Roles Endpoints
router.get('/roles', 
  authenticate, 
  requirePermission('roles_access', 'view'), 
  rolesController.getRoles
);

router.post('/roles', 
  authenticate, 
  requirePermission('roles_access', 'create'), 
  rolesController.createRole
);

// Permissions Endpoints
router.get('/permissions', 
  authenticate, 
  permissionsController.getPermissions
);

router.post('/permissions', 
  authenticate, 
  requireSuperAdmin, 
  permissionsController.createPermission
);

// Role-Permissions Matrix Endpoints
router.get('/role-permissions', 
  authenticate, 
  rolePermissionsController.getRolePermissions
);

router.post('/role-permissions', 
  authenticate, 
  rolePermissionsController.updateRolePermission
);

// Resolved User Permissions Endpoint
router.get('/user/permissions', 
  authenticate, 
  accessCheckController.getUserPermissions
);

// Audit Logs Endpoint
router.get('/audit-logs', 
  authenticate, 
  requirePermission('roles_access', 'view'), 
  auditLogsController.getAuditLogs
);

// Programmatic Access Check Endpoint (rate limited)
router.post('/access/check', 
  authenticate, 
  accessCheckLimiter, 
  accessCheckController.checkAccess
);

module.exports = router;
