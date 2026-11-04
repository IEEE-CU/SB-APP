/**
 * JWT signing-secret rules (AUTH-CLOSE-02 / AUD-010).
 *
 * The production start-up contract is unchanged: JWT_SECRET must be provided by the
 * deployment. What is new is that a value which is blank, or which is one of the published
 * placeholder strings shipped in this repository (.env.example, README, the old dev/test
 * script fallbacks), is treated as NOT provided, because anyone can read those values and
 * forge tokens with them.
 *
 * Local development and test start-up scripts must never fall back to a literal: they use
 * secretForLocalRun(), which keeps a valid configured secret and otherwise generates a
 * random one for that run only (tokens do not survive a restart, which is acceptable for a
 * disposable local server and impossible to guess).
 *
 * Values are never logged or included in error messages.
 */

const crypto = require("crypto");

const PLACEHOLDER_PATTERN = /change[-_ ]?in[-_ ]?production|do[-_ ]not[-_ ]use[-_ ]in[-_ ]production/i;

/** A short reason the value cannot be used, or null if it can. */
function jwtSecretProblem(value) {
  if (typeof value !== "string") return "is not set";
  if (value.trim() === "") return "is empty";
  if (PLACEHOLDER_PATTERN.test(value)) return "is a published placeholder value, not a real secret";
  return null;
}

/** Throws (without echoing the value) unless env.JWT_SECRET is usable. */
function assertJwtSecret(env = process.env) {
  const problem = jwtSecretProblem(env.JWT_SECRET);
  if (problem) throw new Error(`JWT_SECRET ${problem}`);
}

/**
 * The secret for a disposable local (development or test) server: the configured one when
 * it is valid, otherwise a fresh random one. `generated` tells the caller which happened.
 */
function secretForLocalRun(env = process.env) {
  if (jwtSecretProblem(env.JWT_SECRET) === null) return { secret: env.JWT_SECRET, generated: false };
  return { secret: crypto.randomBytes(48).toString("hex"), generated: true };
}

module.exports = { jwtSecretProblem, assertJwtSecret, secretForLocalRun };
