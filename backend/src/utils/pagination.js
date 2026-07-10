const MAX_LIMIT = 500;

/**
 * Parses a user-supplied "limit" query param, capping it so a client can't
 * force an unbounded find() (e.g. ?limit=999999999) and overload the DB.
 */
const parseLimit = (value, fallback = 100) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, MAX_LIMIT);
};

module.exports = { parseLimit, MAX_LIMIT };
