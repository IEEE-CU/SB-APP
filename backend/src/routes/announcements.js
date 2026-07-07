const express = require('express');
const Announcement = require('../models/Announcement');
const { authenticate, officeBearerOrAdmin } = require('../middleware/auth');
const { parseLimit } = require('../utils/pagination');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/announcements
 * @desc    Get announcements filtered by user's access level
 * @access  All authenticated users (filtered)
 */
router.get('/', async (req, res, next) => {
    try {
        const { limit = 50 } = req.query;
        const user = req.user;

        let filter = {};

        if (user.role === 'ADMIN') {
            // Admins see all announcements
            filter = {};
        } else if (user.role === 'OFFICE_BEARER') {
            // Office bearers see:
            // 1. ALL announcements (targetAudience: 'ALL')
            // 2. LEADERSHIP announcements (targetAudience: 'LEADERSHIP')
            // 3. SOCIETY announcements for their own society
            const userSocietyId = user.societyId?._id || user.societyId;
            filter = {
                $or: [
                    { targetAudience: 'ALL' },
                    { targetAudience: 'LEADERSHIP' },
                    { targetAudience: 'SOCIETY', societyId: userSocietyId }
                ]
            };
        }

        const announcements = await Announcement.find(filter)
            .populate('societyId', 'name shortName')
            .sort({ date: -1 })
            .limit(parseLimit(limit, 50));

        res.json({
            success: true,
            count: announcements.length,
            data: announcements
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/announcements/:id
 * @desc    Get announcement by ID
 * @access  All authenticated users
 */
router.get('/:id', async (req, res, next) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .populate('societyId', 'name shortName');

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        res.json({
            success: true,
            data: announcement
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/announcements
 * @desc    Create new announcement
 * @access  Admin or Office Bearer
 */
router.post('/', officeBearerOrAdmin, async (req, res, next) => {
    try {
        const { title, message, date, senderName, targetAudience, societyId } = req.body;

        // Validate target audience
        if (!['ALL', 'LEADERSHIP', 'SOCIETY'].includes(targetAudience)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid target audience'
            });
        }

        // For SOCIETY-specific announcements, require societyId
        if (targetAudience === 'SOCIETY' && !societyId) {
            return res.status(400).json({
                success: false,
                message: 'Society ID is required for society-specific announcements'
            });
        }

        // Office bearers can only send to their own society or leadership
        if (req.user.role === 'OFFICE_BEARER') {
            if (targetAudience === 'ALL') {
                return res.status(403).json({
                    success: false,
                    message: 'Only admins can send announcements to all members'
                });
            }
            if (targetAudience === 'SOCIETY') {
                const userSocietyId = req.user.societyId?._id?.toString() || req.user.societyId?.toString();
                if (societyId !== userSocietyId) {
                    return res.status(403).json({
                        success: false,
                        message: 'You can only send announcements to your own society'
                    });
                }
            }
        }

        const announcement = await Announcement.create({
            title,
            message,
            date: date || Date.now(),
            senderName: senderName || req.user.name,
            targetAudience,
            societyId: targetAudience === 'SOCIETY' ? societyId : null
        });

        const populated = await Announcement.findById(announcement._id)
            .populate('societyId', 'name shortName');

        res.status(201).json({
            success: true,
            data: populated
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/announcements/:id
 * @desc    Delete announcement
 * @access  Admin or own sender
 */
router.delete('/:id', officeBearerOrAdmin, async (req, res, next) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        // Office bearers can only delete their own announcements
        if (req.user.role === 'OFFICE_BEARER') {
            if (announcement.senderName !== req.user.name) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only delete your own announcements'
                });
            }
        }

        await Announcement.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Announcement deleted'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
