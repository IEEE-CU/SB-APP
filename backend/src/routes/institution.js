const express = require('express');
const Institution = require('../models/Institution');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/institution
 * @desc    Get institution settings
 * @access  All authenticated users
 */
router.get('/', async (req, res, next) => {
    try {
        let institution = await Institution.findById('institution-settings');

        // If no institution settings exist yet, create default one
        if (!institution) {
            institution = await Institution.create({
                _id: 'institution-settings',
                name: 'CHRIST (Deemed to be University)',
                logoUrl: ''
            });
        }

        res.json({
            success: true,
            data: institution
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PATCH /api/institution/logo
 * @desc    Update institution logo
 * @access  Admin only
 */
router.patch('/logo', adminOnly, async (req, res, next) => {
    try {
        const { logoUrl } = req.body;

        let institution = await Institution.findById('institution-settings');

        if (!institution) {
            // Create if doesn't exist
            institution = await Institution.create({
                _id: 'institution-settings',
                logoUrl: logoUrl || ''
            });
        } else {
            // Update existing
            institution.logoUrl = logoUrl || '';
            await institution.save();
        }

        res.json({
            success: true,
            data: institution
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
