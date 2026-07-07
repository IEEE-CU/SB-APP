const mongoose = require('mongoose');
const RolePermission = require('../models/RolePermission');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const UserRole = require('../models/UserRole');
const { logAudit } = require('../services/auditLogger');
const { invalidateCache } = require('../services/resolvePermissions');

/**
 * GET /api/role-permissions
 * Get the full matrix, or filter by ?role= (ID or name) or ?module=.
 */
const getRolePermissions = async (req, res, next) => {
  try {
    const { role: roleFilter, module: moduleFilter } = req.query;
    const filter = {};

    // Filter by role (can be Role ID or Role name)
    if (roleFilter) {
      if (mongoose.isValidObjectId(roleFilter)) {
        filter.role = roleFilter;
      } else {
        const roleDoc = await Role.findOne({ name: roleFilter.toLowerCase().trim() });
        if (roleDoc) {
          filter.role = roleDoc._id;
        } else {
          // If role name not found, return empty data
          return res.status(200).json({ data: [] });
        }
      }
    }

    // Filter by module (requires populating and filtering on permission module)
    let permissionsFilterList = null;
    if (moduleFilter) {
      const perms = await Permission.find({ module: moduleFilter.toLowerCase().trim() });
      permissionsFilterList = perms.map(p => p._id);
      
      // If no permissions match the module, return empty list
      if (permissionsFilterList.length === 0) {
        return res.status(200).json({ data: [] });
      }
      
      filter.permission = { $in: permissionsFilterList };
    }

    const matrix = await RolePermission.find(filter)
      .populate('role')
      .populate('permission');

    return res.status(200).json({
      data: matrix
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/role-permissions
 * Assign/update accessLevel for a role+permission pair (upsert).
 * Restrict to super admin / faculty advisor.
 */
const updateRolePermission = async (req, res, next) => {
  try {
    const { role: roleInput, permission: permissionInput, accessLevel } = req.body;

    if (!roleInput || !permissionInput || !accessLevel) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing required fields: role, permission, accessLevel'
        }
      });
    }

    // Validate accessLevel
    const validLevels = ['full', 'limited_own_scope', 'approval', 'none'];
    if (!validLevels.includes(accessLevel)) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: `Invalid accessLevel. Must be one of: ${validLevels.join(', ')}`
        }
      });
    }

    // Resolve current user's role level to ensure they are authorized
    const currentUserRole = await UserRole.findOne({ user: req.user._id }).populate('role');
    const isAuthorized = currentUserRole && currentUserRole.role && (
      currentUserRole.role.level === 'super_admin' || 
      currentUserRole.role.level === 'faculty_advisor'
    );

    if (!isAuthorized) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only Super Admin or Faculty Advisors can assign or update role permissions'
        }
      });
    }

    // Resolve Role ID
    let roleId;
    if (mongoose.isValidObjectId(roleInput)) {
      roleId = roleInput;
    } else {
      const roleDoc = await Role.findOne({ name: roleInput.toLowerCase().trim() });
      if (!roleDoc) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Role "${roleInput}" not found` }
        });
      }
      roleId = roleDoc._id;
    }

    // Resolve Permission ID
    let permissionId;
    if (mongoose.isValidObjectId(permissionInput)) {
      permissionId = permissionInput;
    } else {
      const permissionDoc = await Permission.findOne({ key: permissionInput.trim() });
      if (!permissionDoc) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Permission key "${permissionInput}" not found` }
        });
      }
      permissionId = permissionDoc._id;
    }

    // Perform Upsert
    const updated = await RolePermission.findOneAndUpdate(
      { role: roleId, permission: permissionId },
      { accessLevel },
      { upsert: true, new: true, runValidators: true }
    ).populate('role').populate('permission');

    // Invalidate entire cache as matrix has changed
    invalidateCache();

    // Log audit
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await logAudit({
      user: req.user._id,
      action: 'role_permission_updated',
      module: 'roles_access',
      route: '/api/role-permissions',
      method: 'POST',
      result: 'allowed',
      reason: `Successfully updated permission for role: ${updated.role.name}, perm: ${updated.permission.key} -> level: ${accessLevel}`,
      ipAddress,
      metadata: {
        role: updated.role.name,
        permission: updated.permission.key,
        accessLevel
      }
    });

    return res.status(200).json({
      message: 'Role permission matrix updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRolePermissions,
  updateRolePermission
};
