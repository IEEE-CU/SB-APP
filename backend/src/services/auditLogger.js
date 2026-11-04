const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");

/**
 * Utility function to create an audit log entry.
 * Can be imported and called anywhere in the application.
 *
 * Persistence: the AuditLog schema stores the actor as `userId` and free-form
 * context in `details`. `user` is saved as `userId`; route, method, result,
 * reason and metadata are saved under `details`. Fields outside the schema
 * are never passed to the model, because Mongoose would silently drop them.
 *
 * `user` must be the authenticated actor. Describe anyone the action was
 * performed on in `metadata` (for example `metadata.targetUserId`).
 *
 * @param {Object} params - Audit log parameters
 * @param {string} params.user - User ID
 * @param {string} params.action - Action performed (e.g., "access_check", "role_assigned")
 * @param {string} params.module - Target module (e.g., "finance", "roles_access")
 * @param {string} params.route - The API endpoint route
 * @param {string} params.method - The HTTP method
 * @param {string} params.result - "allowed" or "denied"
 * @param {string} [params.reason] - Explanation for result
 * @param {string} [params.ipAddress] - IP address of request
 * @param {Object} [params.metadata] - Extra metadata context
 */
async function logAudit({
  user,
  action,
  module,
  route,
  method,
  result,
  reason,
  ipAddress,
  metadata = {},
}) {
  try {
    const actorIsObjectId = Boolean(user) && mongoose.isValidObjectId(user);
    const details = { route, method, result, reason, metadata };
    // An actor that cannot be stored as an ObjectId is kept as text, not lost.
    if (user && !actorIsObjectId) details.actor = String(user).slice(0, 100);

    const auditEntry = new AuditLog({
      userId: actorIsObjectId ? user : null,
      action,
      module,
      details,
      ipAddress,
    });

    await auditEntry.save();

    // Log to console for development visibility
    const statusColor =
      result === "allowed" ? "\x1b[32mAllowed\x1b[0m" : "\x1b[31mDenied\x1b[0m";
    console.log(
      `[AUDIT] ${statusColor} | User: ${user || "Guest"} | Action: ${action} | Module: ${module} | Route: ${method} ${route} | Reason: ${reason || "N/A"}`,
    );

    return auditEntry;
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

module.exports = {
  logAudit,
};
