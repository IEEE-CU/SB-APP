const express = require('express');
const Society = require('../models/Society');
const Transaction = require('../models/Transaction');
const { authenticate, adminOnly, societyAccess } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Helper: Calculate society balance from transactions
 */
const calculateBalance = async (societyId, budget) => {
    const result = await Transaction.aggregate([
        { $match: { societyId: societyId } },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' }
            }
        }
    ]);

    let income = 0, expense = 0;
    result.forEach(r => {
        if (r._id === 'INCOME') income = r.total;
        if (r._id === 'EXPENSE') expense = r.total;
    });

    return budget + income - expense;
};

/**
 * @route   GET /api/societies
 * @desc    Get all societies with calculated balances
 * @access  All authenticated users
 */
router.get('/', async (req, res, next) => {
    try {
        const societies = await Society.find().sort({ name: 1 }).lean();

        // Calculate balances for all societies
        const societiesWithBalances = await Promise.all(
            societies.map(async (society) => ({
                ...society,
                id: society._id,
                balance: await calculateBalance(society._id, society.budget)
            }))
        );

        res.json({
            success: true,
            count: societiesWithBalances.length,
            data: societiesWithBalances
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/societies/:id
 * @desc    Get society by ID
 * @access  All authenticated users
 */
router.get('/:id', async (req, res, next) => {
    try {
        const society = await Society.findById(req.params.id).lean();

        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        society.id = society._id;
        society.balance = await calculateBalance(society._id, society.budget);

        res.json({
            success: true,
            data: society
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PATCH /api/societies/:id/budget
 * @desc    Update society budget
 * @access  Admin only
 */
router.patch('/:id/budget', adminOnly, async (req, res, next) => {
    try {
        const { budget } = req.body;

        if (budget === undefined || budget < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid budget amount required'
            });
        }

        const society = await Society.findByIdAndUpdate(
            req.params.id,
            { budget },
            { new: true, runValidators: true }
        );

        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        res.json({
            success: true,
            data: society
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PATCH /api/societies/:id/logo
 * @desc    Update society logo URL
 * @access  Admin or Own Office Bearer
 */
router.patch('/:id/logo', societyAccess, async (req, res, next) => {
    try {
        const { logoUrl } = req.body;

        const society = await Society.findByIdAndUpdate(
            req.params.id,
            { logoUrl },
            { new: true }
        );

        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        res.json({
            success: true,
            data: society
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PATCH /api/societies/:id/signature
 * @desc    Update advisor signature URL
 * @access  Admin or Own Office Bearer
 */
router.patch('/:id/signature', societyAccess, async (req, res, next) => {
    try {
        const { advisorSignatureUrl } = req.body;

        const society = await Society.findByIdAndUpdate(
            req.params.id,
            { advisorSignatureUrl },
            { new: true }
        );

        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        res.json({
            success: true,
            data: society
        });
    } catch (error) {
        next(error);
    }
});

// ============== OFFICE BEARERS ==============

/**
 * @route   GET /api/societies/:id/office-bearers
 * @desc    Get office bearers for a society
 * @access  All authenticated users
 */
router.get('/:id/office-bearers', async (req, res, next) => {
    try {
        const society = await Society.findById(req.params.id).select('officeBearers name');

        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        res.json({
            success: true,
            data: society.officeBearers
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/societies/:id/office-bearers
 * @desc    Add office bearer to society
 * @access  Admin or Own Office Bearer
 */
router.post('/:id/office-bearers', societyAccess, async (req, res, next) => {
    try {
        const { name, position, email, phone, termYear } = req.body;

        const society = await Society.findById(req.params.id);
        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        society.officeBearers.push({
            name,
            position,
            email,
            phone: phone || '',
            termYear: termYear || new Date().getFullYear()
        });

        await society.save();

        res.status(201).json({
            success: true,
            data: society.officeBearers
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/societies/:id/office-bearers/:obId
 * @desc    Update office bearer
 * @access  Admin or Own Office Bearer
 */
router.put('/:id/office-bearers/:obId', societyAccess, async (req, res, next) => {
    try {
        const society = await Society.findById(req.params.id);
        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        const ob = society.officeBearers.id(req.params.obId);
        if (!ob) {
            return res.status(404).json({
                success: false,
                message: 'Office bearer not found'
            });
        }

        // Whitelist updatable fields so a caller can't inject unexpected
        // keys (e.g. _id) via the request body.
        const updatableFields = ['name', 'position', 'email', 'phone', 'termYear'];
        updatableFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                ob[field] = req.body[field];
            }
        });
        await society.save();

        res.json({
            success: true,
            data: ob
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/societies/:id/office-bearers/:obId
 * @desc    Delete office bearer
 * @access  Admin or Own Office Bearer
 */
router.delete('/:id/office-bearers/:obId', societyAccess, async (req, res, next) => {
    try {
        const society = await Society.findById(req.params.id);
        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        society.officeBearers.pull({ _id: req.params.obId });
        await society.save();

        res.json({
            success: true,
            message: 'Office bearer removed'
        });
    } catch (error) {
        next(error);
    }
});

// ============== MEMBERS ==============

/**
 * @route   GET /api/societies/:id/members
 * @desc    Get members for a society
 * @access  All authenticated users
 */
router.get('/:id/members', async (req, res, next) => {
    try {
        const society = await Society.findById(req.params.id).select('members name');

        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        res.json({
            success: true,
            data: society.members
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/societies/:id/members
 * @desc    Add member to society
 * @access  Admin or Own Office Bearer
 */
router.post('/:id/members', societyAccess, async (req, res, next) => {
    try {
        const { ieeeId, name, email, contactNumber, grade } = req.body;

        const society = await Society.findById(req.params.id);
        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        // Check for duplicate IEEE ID
        const exists = society.members.some(m => m.ieeeId === ieeeId);
        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Member with this IEEE ID already exists'
            });
        }

        society.members.push({
            ieeeId,
            name,
            email,
            contactNumber: contactNumber || '',
            grade
        });

        await society.save();

        res.status(201).json({
            success: true,
            data: society.members
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/societies/:id/members/:memberId
 * @desc    Remove member from society
 * @access  Admin or Own Office Bearer
 */
router.delete('/:id/members/:memberId', societyAccess, async (req, res, next) => {
    try {
        const society = await Society.findById(req.params.id);
        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        society.members.pull({ _id: req.params.memberId });
        await society.save();

        res.json({
            success: true,
            message: 'Member removed'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/societies/:id/office-bearers
 * @desc    Replace all office bearers (bulk update)
 * @access  Admin or Own Office Bearer
 */
router.put('/:id/office-bearers', societyAccess, async (req, res, next) => {
    try {
        const { officeBearers } = req.body;

        const society = await Society.findById(req.params.id);
        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        society.officeBearers = officeBearers || [];
        await society.save();

        res.json({
            success: true,
            data: society.officeBearers
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/societies/:id/members
 * @desc    Replace all members (bulk update)
 * @access  Admin or Own Office Bearer
 */
router.put('/:id/members', societyAccess, async (req, res, next) => {
    try {
        const { members } = req.body;

        const society = await Society.findById(req.params.id);
        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        society.members = members || [];
        await society.save();

        res.json({
            success: true,
            data: society.members
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
