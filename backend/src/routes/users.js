const express = require('express');
const User = require('../models/User');
const { authenticate, adminOnly } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Admin only
 */
router.get('/', adminOnly, async (req, res, next) => {
    try {
        const users = await User.find()
            .populate('societyId', 'name shortName')
            .sort({ name: 1 });

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Admin only
 */
router.get('/:id', adminOnly, async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('societyId', 'name shortName');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Reset user's password (Admin only)
 * @access  Admin only
 */
router.post('/:id/reset-password', adminOnly, authLimiter, async (req, res, next) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 4 characters'
            });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: `Password reset for ${user.name}`
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
