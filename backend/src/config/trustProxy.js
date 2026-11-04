/**
 * Trusted-proxy configuration (AUD-012B).
 *
 * Express derives req.ip, and therefore every rate-limit key and every audit-log address,
 * from the X-Forwarded-For header for as many hops as it is told to trust. Trusting hops
 * that do not exist lets any client choose its own address: with a hard-coded
 * `trust proxy = 1` and the app reached directly, 14 failed logins each claiming a
 * different X-Forwarded-For were never limited.
 *
 * The repository contains no deployment manifest, proxy configuration or hosting
 * documentation, so the topology cannot be established from it and no hop count is guessed.
 * It is configured explicitly through TRUST_PROXY:
 *
 *   unset / "" / "0" / "false" / "none"   trust nothing: req.ip is the socket's address and
 *                                         forwarding headers are ignored (safe default;
 *                                         correct when clients connect directly)
 *   "1" .. "10"                           trust that many proxy hops in front of the app
 *                                         (each hop must set/append X-Forwarded-For itself
 *                                         and the app must not be reachable except through
 *                                         the proxy)
 *   "10.0.0.0/8,127.0.0.1,loopback,..."   trust exactly these proxy addresses / CIDRs /
 *                                         names (loopback, linklocal, uniquelocal)
 *
 * In production TRUST_PROXY must be set explicitly (use 0 when the app is reached
 * directly) so the operator states the topology instead of inheriting a guess. "true",
 * "*" and any unrecognised value are refused: "true" would trust every client's header.
 * Error messages never echo the configured value.
 */

const net = require("net");

const NAMED_SUBNETS = new Set(["loopback", "linklocal", "uniquelocal"]);
const MAX_HOPS = 10;
const NONE = new Set(["", "0", "false", "none"]);

function isAddressOrCidr(token) {
  const [address, prefix, ...rest] = token.split("/");
  if (rest.length > 0) return false;
  const family = net.isIP(address);
  if (!family) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= (family === 4 ? 32 : 128);
}

/**
 * @param {string|undefined} raw  the TRUST_PROXY value
 * @param {{ production?: boolean }} [options]
 * @returns {{ setting: boolean|number|string[], mode: "none"|"hops"|"addresses" }}
 * @throws {Error} when the value is missing in production or is not a supported form
 */
function parseTrustProxy(raw, { production = false } = {}) {
  const value = typeof raw === "string" ? raw.trim() : "";
  const lowered = value.toLowerCase();

  if (value === "" && raw === undefined && production) {
    throw new Error(
      "TRUST_PROXY must be set explicitly in production: a hop count (1-10), a list of proxy addresses, or 0 when the app is reached directly",
    );
  }
  if (NONE.has(lowered)) return { setting: false, mode: "none" };

  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops >= 1 && hops <= MAX_HOPS) return { setting: hops, mode: "hops" };
    throw new Error(`TRUST_PROXY hop count must be between 1 and ${MAX_HOPS}`);
  }

  const tokens = value.split(",").map((token) => token.trim());
  if (tokens.every((token) => token && (NAMED_SUBNETS.has(token.toLowerCase()) || isAddressOrCidr(token)))) {
    return { setting: tokens.map((token) => (NAMED_SUBNETS.has(token.toLowerCase()) ? token.toLowerCase() : token)), mode: "addresses" };
  }

  throw new Error(
    "TRUST_PROXY is not a supported value: use 0, a hop count (1-10), or a comma-separated list of proxy IP addresses, CIDR ranges or loopback/linklocal/uniquelocal ('true' and '*' are not allowed)",
  );
}

module.exports = { parseTrustProxy, MAX_HOPS };
