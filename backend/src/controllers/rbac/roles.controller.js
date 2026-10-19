const Role = require("../../models/Role");
const { logAudit } = require("../../services/auditLogger");
const { invalidateCache } = require("../../services/resolvePermissions");

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
      success: true,
      data: roles,
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

/**
 * POST /api/roles
 * Create a new custom role.
 */
const createRole = async (req, res, next) => {
  try {
    const { name, displayName, level, scope, description, isSystemRole } =
      req.body;

    if (!name || !displayName || !level || !scope) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: name, displayName, level, scope",
        },
      });
    }

    // Free text that is compared and trimmed below must be text (a client could
    // otherwise send an array or object to slip past the checks).
    if (
      typeof name !== "string" ||
      typeof displayName !== "string" ||
      typeof level !== "string" ||
      typeof scope !== "string" ||
      (description !== undefined && description !== null && typeof description !== "string")
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "name, displayName, level, scope and description must be strings",
        },
      });
    }

    const normalizedName = name.toLowerCase().trim();

    // AUD-027: the privileged tier is reserved to the SB Faculty Advisor. Anyone who
    // holds roles_access:create may create ordinary roles, but not:
    //   - a system role,
    //   - a role at the super_admin or faculty_advisor level - the two levels the
    //     rest of the RBAC code treats as privileged (they may view other users'
    //     permissions, read the audit log and edit the role-permission matrix), or
    //   - a role named like the super admin (the resolver and requireSuperAdmin
    //     recognise that name).
    // This check runs before the duplicate-name lookup so it reveals nothing.
    const isSuperAdmin = req.userRole === "sb_faculty_advisor";
    const touchesPrivilegedTier =
      isSystemRole ||
      level === "super_admin" ||
      level === "faculty_advisor" ||
      normalizedName === "sb_faculty_advisor";

    if (touchesPrivilegedTier && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: "PERMISSION_DENIED",
          message:
            "Only the SB Faculty Advisor (Super Admin) can create system roles, super_admin or faculty_advisor level roles",
        },
      });
    }

    const existingRole = await Role.findOne({ name: normalizedName });
    if (existingRole) {
      return res.status(409).json({
        success: false,
        error: {
          code: "DUPLICATE_RESOURCE",
          message: `Role with name "${name}" already exists`,
        },
      });
    }

    const newRole = new Role({
      name: normalizedName,
      displayName: displayName.trim(),
      level,
      scope,
      description: description ? description.trim() : "",
      isSystemRole: !!isSystemRole,
    });

    await newRole.save();

    invalidateCache();

    const ipAddress =
      req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    await logAudit({
      user: req.user._id,
      action: "role_created",
      module: "roles_access",
      route: "/api/roles",
      method: "POST",
      result: "allowed",
      reason: `Successfully created role: ${normalizedName}`,
      ipAddress,
      metadata: { roleName: normalizedName, level, scope },
    });

    return res.status(201).json({
      success: true,
      data: newRole,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRoles,
  createRole,
};
