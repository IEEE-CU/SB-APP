const AuditLog = require("../models/AuditLog");

/**
 * Utility function to create an audit log entry.
 * Can be imported and called anywhere in the application.
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
    const auditEntry = new AuditLog({
      user: user || null,
      action,
      module,
      route,
      method,
      result,
      reason,
      ipAddress,
      metadata,
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
