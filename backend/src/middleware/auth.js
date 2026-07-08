const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware - verifies JWT token
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user
        const user = await User.findById(decoded.id).populate('societyId');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. User not found.'
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

/**
 * Role-based authorization middleware
 * @param {...string} allowedRoles - Roles allowed to access the route
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action.'
            });
        }

        next();
    };
};

/**
 * Society-level access guard
 * Ensures Office Bearers can only access their own society's data
 */
const societyAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    // Admins have full access
    if (req.user.role === 'ADMIN') {
        return next();
    }

    // Get societyId from params, body, or query
    const societyId = req.params.societyId || req.body.societyId || req.query.societyId;

    // If no societyId specified, use user's own society
    if (!societyId) {
        req.body.societyId = req.user.societyId?._id || req.user.societyId;
        return next();
    }

    // Check if user belongs to the society
    const userSocietyId = req.user.societyId?._id?.toString() || req.user.societyId?.toString();

    if (societyId.toString() !== userSocietyId) {
        return res.status(403).json({
            success: false,
            message: 'Access restricted to your own society only.'
        });
    }

    next();
};

/**
 * Admin-only middleware
 */
const adminOnly = authorize('ADMIN');

/**
 * Office Bearer or Admin middleware
 */
const officeBearerOrAdmin = authorize('ADMIN', 'OFFICE_BEARER');

module.exports = {
    authenticate,
    authorize,
    societyAccess,
    adminOnly,
    officeBearerOrAdmin
};
