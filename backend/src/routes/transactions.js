const express = require('express');
const Transaction = require('../models/Transaction');
const { authenticate, adminOnly, societyAccess, officeBearerOrAdmin } = require('../middleware/auth');
const { parseLimit } = require('../utils/pagination');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions (Admin only)
 * @access  Admin only
 */
router.get('/', adminOnly, async (req, res, next) => {
    try {
        const { type, category, startDate, endDate, limit = 100 } = req.query;

        const filter = {};
        if (type) filter.type = type;
        if (category) filter.category = category;
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(filter)
            .populate('societyId', 'name shortName')
            .populate('approvedBy', 'name')
            .sort({ date: -1 })
            .limit(parseLimit(limit));

        res.json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/transactions/society/:societyId
 * @desc    Get transactions for a specific society
 * @access  Admin or Own Office Bearer
 */
router.get('/society/:societyId', societyAccess, async (req, res, next) => {
    try {
        const { type, category, startDate, endDate, limit = 100 } = req.query;

        const filter = { societyId: req.params.societyId };
        if (type) filter.type = type;
        if (category) filter.category = category;
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(filter)
            .populate('societyId', 'name shortName')
            .populate('approvedBy', 'name')
            .sort({ date: -1 })
            .limit(parseLimit(limit));

        res.json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get transaction by ID
 * @access  Admin or Own Office Bearer
 */
router.get('/:id', officeBearerOrAdmin, async (req, res, next) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('societyId', 'name shortName')
            .populate('approvedBy', 'name');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Check society access for office bearers
        if (req.user.role === 'OFFICE_BEARER') {
            const userSocietyId = req.user.societyId?._id?.toString() || req.user.societyId?.toString();
            if (transaction.societyId._id.toString() !== userSocietyId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access restricted to your own society'
                });
            }
        }

        res.json({
            success: true,
            data: transaction
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/transactions
 * @desc    Create new transaction
 * @access  Admin or Own Office Bearer
 */
router.post('/', societyAccess, async (req, res, next) => {
    try {
        const { societyId, type, amount, category, description, date } = req.body;

        // For office bearers, use their society if not specified
        const targetSocietyId = societyId || req.user.societyId?._id || req.user.societyId;

        if (!targetSocietyId) {
            return res.status(400).json({
                success: false,
                message: 'Society ID is required'
            });
        }

        const transaction = await Transaction.create({
            societyId: targetSocietyId,
            type,
            amount,
            category,
            description,
            date: date || Date.now(),
            approvedBy: req.user._id
        });

        const populated = await Transaction.findById(transaction._id)
            .populate('societyId', 'name shortName')
            .populate('approvedBy', 'name');

        res.status(201).json({
            success: true,
            data: populated
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/transactions/:id
 * @desc    Update transaction
 * @access  Admin or Own Office Bearer
 */
router.put('/:id', societyAccess, async (req, res, next) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Check society access for office bearers
        if (req.user.role === 'OFFICE_BEARER') {
            const userSocietyId = req.user.societyId?._id?.toString() || req.user.societyId?.toString();
            if (transaction.societyId.toString() !== userSocietyId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access restricted to your own society'
                });
            }
        }

        // Update allowed fields
        const { type, amount, category, description, date } = req.body;
        if (type) transaction.type = type;
        if (amount !== undefined) transaction.amount = amount;
        if (category) transaction.category = category;
        if (description) transaction.description = description;
        if (date) transaction.date = date;

        await transaction.save();

        const populated = await Transaction.findById(transaction._id)
            .populate('societyId', 'name shortName')
            .populate('approvedBy', 'name');

        res.json({
            success: true,
            data: populated
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete transaction
 * @access  Admin or Own Office Bearer
 */
router.delete('/:id', societyAccess, async (req, res, next) => {
    try {
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Check society access for office bearers
        if (req.user.role === 'OFFICE_BEARER') {
            const userSocietyId = req.user.societyId?._id?.toString() || req.user.societyId?.toString();
            if (transaction.societyId.toString() !== userSocietyId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access restricted to your own society'
                });
            }
        }

        await Transaction.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Transaction deleted'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
