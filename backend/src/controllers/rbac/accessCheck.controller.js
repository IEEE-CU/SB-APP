const { resolvePermissions } = require("../../services/resolvePermissions");
const { logAudit } = require("../../services/auditLogger");
const { isGrantingLevel } = require("../../middleware/rbac");
const UserRole = require("../../models/UserRole");
const User = require("../../models/User");

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const PERMISSION_DENIED_BODY = {
  success: false,
  error: {
    code: "PERMISSION_DENIED",
    message:
      "Only Super Admin and Faculty Advisors can view other users' permissions",
  },
};

/**
 * Inspecting another user's permissions is limited to UserRole levels
 * super_admin and faculty_advisor. User.role === "ADMIN" alone is not enough.
 */
async function canInspectOtherUsers(callerId) {
  const callerRole = await UserRole.findOne({ user: callerId }).populate(
    "role",
  );
  return Boolean(
    callerRole &&
      callerRole.role &&
      (callerRole.role.level === "super_admin" ||
        callerRole.role.level === "faculty_advisor"),
  );
}

/**
 * GET /api/user/permissions
 * Return the resolved, effective permission set for the logged-in user
 */
const getUserPermissions = async (req, res, next) => {
  try {
    let targetUserId = req.user._id;
    const { userId } = req.query;

    if (userId) {
      if (!(await canInspectOtherUsers(req.user._id))) {
        return res.status(403).json(PERMISSION_DENIED_BODY);
      }
      targetUserId = userId;
    }

    const resolved = await resolvePermissions(targetUserId);

    const mapAccessLevel = (lvl) => {
      if (lvl === "full") return "superadmin";
      if (lvl === "limited_own_scope") return "admin";
      if (lvl === "approval") return "write";
      return lvl || "none";
    };

    const permissionsArray = [];
    Object.keys(resolved.permissions).forEach((key) => {
      if (!key.includes(":")) {
        permissionsArray.push({
          module: key,
          accessLevel: mapAccessLevel(resolved.permissions[key]),
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        role: resolved.role,
        scope: resolved.scope,
        permissions: permissionsArray,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/access/check
 * Programmatic access check.
 */
const checkAccess = async (req, res, next) => {
  try {
    const {
      userId,
      module: targetModule,
      action: targetAction,
    } = req.body || {};

    if (!userId || !targetModule || !targetAction) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: userId, module, action",
        },
      });
    }

    if (typeof userId !== "string" || !OBJECT_ID_PATTERN.test(userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "userId must be a valid user id",
        },
      });
    }

    // Normalised so a differently-cased id cannot be told apart from the same id.
    const targetUserId = userId.toLowerCase();
    const callerId = String(req.user._id).toLowerCase();

    if (targetUserId !== callerId) {
      // Checked before any target lookup so an unprivileged caller learns
      // nothing about whether the target exists.
      if (!(await canInspectOtherUsers(req.user._id))) {
        return res.status(403).json(PERMISSION_DENIED_BODY);
      }
      if (!(await User.exists({ _id: targetUserId }))) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        });
      }
    }

    const resolved = await resolvePermissions(targetUserId);
    const permKey = `${targetModule}:${targetAction}`;
    // Same rule as requirePermission: only a recognized granting level counts.
    const resolvedLevel = resolved.permissions[permKey];
    const accessLevel = isGrantingLevel(resolvedLevel) ? resolvedLevel : "none";
    const allowed = accessLevel !== "none";

    let reason = allowed
      ? `Permission key ${permKey} granted with level: ${accessLevel}`
      : `Insufficient permission for key ${permKey}. Assigned level: none`;

    if (
      allowed &&
      resolved.scope.type === "society" &&
      !resolved.scope.societyId &&
      resolved.role !== "sb_faculty_advisor"
    ) {
      return res.status(200).json({
        success: true,
        data: {
          allowed: false,
          accessLevel: "none",
          reason:
            "Role requires a society scope, but no society was assigned to user.",
        },
      });
    }

    const ipAddress =
      req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const route = req.originalUrl || "/api/access/check";

    await logAudit({
      user: req.user._id,
      action: "access_check",
      module: targetModule,
      route,
      method: req.method,
      result: allowed ? "allowed" : "denied",
      reason,
      ipAddress,
      metadata: { requestedAction: targetAction, targetUserId },
    });

    return res.status(200).json({
      success: true,
      data: {
        allowed,
        accessLevel,
        reason,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserPermissions,
  checkAccess,
};
