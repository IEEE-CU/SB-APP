const Permission = require("../../models/Permission");
const { logAudit } = require("../../services/auditLogger");
const { invalidateCache } = require("../../services/resolvePermissions");

/**
 * GET /api/permissions
 * List all permissions grouped by module.
 */
const getPermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.find({}).sort({
      module: 1,
      action: 1,
    });

    const grouped = {};
    permissions.forEach((perm) => {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    });

    return res.status(200).json({
      success: true,
      data: grouped,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/permissions
 * Create a new permission (Super Admin only).
 */
const createPermission = async (req, res, next) => {
  try {
    const { module: modName, action, description } = req.body;

    if (!modName || !action) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: module, action",
        },
      });
    }

    if (req.userRole !== "sb_faculty_advisor") {
      return res.status(403).json({
        success: false,
        error: {
          code: "PERMISSION_DENIED",
          message:
            "Only the SB Faculty Advisor (Super Admin) can create permissions",
        },
      });
    }

    const key = `${modName}:${action}`;
    const existingPermission = await Permission.findOne({ key });
    if (existingPermission) {
      return res.status(409).json({
        success: false,
        error: {
          code: "DUPLICATE_RESOURCE",
          message: `Permission with key "${key}" already exists`,
        },
      });
    }

    const newPermission = new Permission({
      module: modName,
      action,
      description: description ? description.trim() : "",
    });

    await newPermission.save();

    invalidateCache();

    const ipAddress =
      req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    await logAudit({
      user: req.user._id,
      action: "permission_created",
      module: "roles_access",
      route: "/api/permissions",
      method: "POST",
      result: "allowed",
      reason: `Successfully created permission: ${key}`,
      ipAddress,
      metadata: { permissionKey: key },
    });

    return res.status(201).json({
      success: true,
      data: newPermission,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPermissions,
  createPermission,
};
