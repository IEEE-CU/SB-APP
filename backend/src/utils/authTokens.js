/**
 * Signing and revocation rules for the application's JWTs (AUD-007B).
 *
 * Claims and lifetime are unchanged: { id, role } signed with JWT_SECRET, expiring after
 * JWT_EXPIRES_IN (default 8h).
 *
 * Revocation: a password change or administrator reset stamps User.passwordChangedAt (see
 * models/User.js). A token is refused when it was issued at or before that moment. JWT `iat`
 * has one-second precision, so the comparison is made in whole seconds and "at or before the
 * second of the change" is revoked: a token minted in the same second as the change cannot
 * survive it. The replacement token issued by the password-change endpoint therefore carries
 * an `iat` of the NEXT second (never earlier than now), which the comparison accepts; its
 * expiry is computed from that `iat`, so the lifetime differs from a normal token by at most
 * one second. Login does the same for an account with a marker, so signing in within the second
 * of a change still yields a usable token.
 *
 * Users without a marker (every existing account until their next password change) are not
 * affected. For a user who has a marker, a token without a usable numeric `iat` is refused.
 */

const jwt = require("jsonwebtoken");

const nowSeconds = () => Math.floor(Date.now() / 1000);

function markerSeconds(value) {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
}

/**
 * True when `decoded` (a verified token payload) was issued before the user's password last changed.
 * @param {{ iat?: unknown }} decoded
 * @param {{ passwordChangedAt?: Date|string|null }} user  the user record already loaded by the caller
 */
function isTokenRevoked(decoded, user) {
  const marker = markerSeconds(user && user.passwordChangedAt);
  if (marker === null) return false;
  if (Number.isNaN(marker)) return true; // an unreadable marker fails closed
  const issuedAt = decoded && decoded.iat;
  if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt)) return true;
  return issuedAt <= marker;
}

/**
 * Signs the standard token for `user`. For an account with a password-change marker the token's
 * `iat` is never earlier than the second after the change, so a token minted right after a
 * change (the replacement token, or a login in the same second) is accepted by isTokenRevoked
 * while every token issued before the change is not.
 */
function signAuthToken(user) {
  const payload = { id: user._id, role: user.role };
  const marker = markerSeconds(user.passwordChangedAt);
  if (marker !== null && Number.isFinite(marker)) payload.iat = Math.max(nowSeconds(), marker + 1);
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });
}

module.exports = { isTokenRevoked, signAuthToken };
