const Role = require('../models/Role');
const { logAudit } = require('../services/auditLogger');
const { invalidateCache } = require('../services/resolvePermissions');

/**
 * GET /api/roles
 * List all roles with pagination and filtering by level/scope.
 */
const getRoles = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.level) {
      filter.level = req.query.level;
    }
    if (req.query.scope) {
      filter.scope = req.query.scope;
    }

    const roles = await Role.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Role.countDocuments(filter);

    return res.status(200).json({
      data: roles,
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

/**
 * POST /api/roles
 * Create a new custom role.
 */
const createRole = async (req, res, next) => {
  try {
    const { name, displayName, level, scope, description, isSystemRole } = req.body;

    if (!name || !displayName || !level || !scope) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing required fields: name, displayName, level, scope'
        }
      });
    }

    // Only super_admin (sb_faculty_advisor) can create a system role or super_admin level role
    const isSuperAdmin = req.userRole === 'sb_faculty_advisor';
    
    if ((isSystemRole || level === 'super_admin') && !isSuperAdmin) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only the SB Faculty Advisor (Super Admin) can create system roles or super_admin level roles'
        }
      });
    }

    // Check if role name already exists
    const normalizedName = name.toLowerCase().trim();
    const existingRole = await Role.findOne({ name: normalizedName });
    if (existingRole) {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: `Role with name "${name}" already exists`
        }
      });
    }

    const newRole = new Role({
      name: normalizedName,
      displayName: displayName.trim(),
      level,
      scope,
      description: description ? description.trim() : '',
      isSystemRole: !!isSystemRole
    });

    await newRole.save();

    // Invalidate entire cache to ensure the new role resolves correctly
    invalidateCache();

    // Log audit
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAudit({
      user: req.user._id,
      action: 'role_created',
      module: 'roles_access',
      route: '/api/roles',
      method: 'POST',
      result: 'allowed',
      reason: `Successfully created role: ${normalizedName}`,
      ipAddress,
      metadata: { roleName: normalizedName, level, scope }
    });

    return res.status(201).json({
      message: 'Role created successfully',
      data: newRole
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRoles,
  createRole
};
