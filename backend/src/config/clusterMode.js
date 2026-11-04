/**
 * ENABLE_CLUSTER parsing (AUD-012B).
 *
 * Cluster mode is not supported: Socket.IO rooms and delivery, presence, typing state and all
 * rate-limit counters live in each worker's own memory (no adapter, no shared store, no sticky
 * sessions), so with several workers real-time delivery and the effective limits are
 * inconsistent. The server therefore refuses to start when it is requested.
 *
 * Only the exact words true / false are understood (any letter case, surrounding spaces
 * ignored), plus unset or empty meaning off. Anything else ("1", "yes", "on", ...) is refused
 * as malformed instead of being read as an opt-out, because the operator's intent is unknown.
 */

function parseClusterFlag(raw) {
  if (raw === undefined || raw === null) return false;
  const value = String(raw).trim().toLowerCase();
  if (value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error("ENABLE_CLUSTER must be exactly true or false (cluster mode is not supported; leave it unset or false)");
}

module.exports = { parseClusterFlag };
