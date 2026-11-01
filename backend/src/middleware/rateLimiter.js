const rateLimit = require("express-rate-limit");

/**
 * General API limiter - applied to every request.
 * Generous enough for normal dashboard usage, tight enough to blunt scraping/DoS.
 *
 * Note: uses the default in-memory store, which is per-process. If this app is
 * ever scaled across multiple machines (not just cluster workers on one host),
 * swap the store for a shared one (e.g. rate-limit-redis) so limits are enforced
 * consistently across instances.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

/**
 * Strict limiter for authentication endpoints (login, password change/reset).
 * Keyed by IP, small window, low ceiling to blunt credential-stuffing/brute force.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

/**
 * Limiter for account registration. Unlike authLimiter it counts successful
 * requests too, since each signup costs a bcrypt hash and a DB write.
 */
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again in 15 minutes.",
  },
});

/**
 * AI audit limiter (AUD-013). Each request is a paid call to Gemini, so it is limited per
 * signed-in user (not per address) on top of the general limiter. Mounted after the
 * permission check, so refused requests do not use it up.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user && req.user._id),
  message: {
    success: false,
    message: "Too many AI audit requests. Please try again later.",
  },
});

module.exports = { generalLimiter, authLimiter, registrationLimiter, aiLimiter };
