const rateLimit = require('express-rate-limit');

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
        message: 'Too many requests. Please try again later.'
    }
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
        message: 'Too many attempts. Please try again in 15 minutes.'
    }
});

module.exports = { generalLimiter, authLimiter };
