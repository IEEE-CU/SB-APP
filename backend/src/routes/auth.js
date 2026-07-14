const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email, and password'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Create user (default role OFFICE_BEARER for testing)
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: 'OFFICE_BEARER'
        });

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                societyId: user.societyId ? user.societyId._id || user.societyId : undefined
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/login', authLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Please provide email and password'
                }
            });
        }

        // Find user with password
        const user = await User.findOne({ email: email.toLowerCase() })
            .select('+password')
            .populate('societyId');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHENTICATED',
                    message: 'Invalid email address'
                }
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHENTICATED',
                    message: 'Incorrect password'
                }
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    societyId: user.societyId ? user.societyId._id || user.societyId : undefined
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change current user's password
 * @access  Private
 */
router.post('/change-password', authenticate, authLimiter, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
        }

        if (newPassword.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 4 characters'
            });
        }

        // Get user with password
        const user = await User.findById(req.user._id).select('+password');

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
