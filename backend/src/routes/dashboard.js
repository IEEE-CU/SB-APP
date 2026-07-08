const express = require('express');
const Transaction = require('../models/Transaction');
const Society = require('../models/Society');
const Event = require('../models/Event');
const Project = require('../models/Project');
const CalendarEvent = require('../models/CalendarEvent');
const { authenticate, societyAccess, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/dashboard
 * @desc    Get overall dashboard stats (Admin only)
 * @access  Admin only
 */
router.get('/', adminOnly, async (req, res, next) => {
    try {
        // Get all societies with balances
        const societies = await Society.find().lean();

        // Calculate total budget and balances
        const totalBudget = societies.reduce((sum, s) => sum + s.budget, 0);

        // Get transaction stats
        const transactionStats = await Transaction.aggregate([
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        let totalIncome = 0, totalExpense = 0, incomeCount = 0, expenseCount = 0;
        transactionStats.forEach(stat => {
            if (stat._id === 'INCOME') {
                totalIncome = stat.total;
                incomeCount = stat.count;
            } else {
                totalExpense = stat.total;
                expenseCount = stat.count;
            }
        });

        // Get recent activity
        const recentTransactions = await Transaction.find()
            .populate('societyId', 'name shortName')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get event stats
        const eventCount = await Event.countDocuments();
        const upcomingEvents = await CalendarEvent.find({
            date: { $gte: new Date() },
            status: { $ne: 'CANCELLED' }
        }).sort({ date: 1 }).limit(5).populate('societyId', 'name shortName');

        // Get project stats
        const projectStats = await Project.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                summary: {
                    totalBudget,
                    totalBalance: totalBudget + totalIncome - totalExpense,
                    totalIncome,
                    totalExpense,
                    transactionCount: incomeCount + expenseCount,
                    societyCount: societies.length,
                    eventCount
                },
                projectStats,
                recentTransactions,
                upcomingEvents
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/dashboard/society/:societyId
 * @desc    Get dashboard stats for a specific society
 * @access  Admin or Own Office Bearer
 */
router.get('/society/:societyId', societyAccess, async (req, res, next) => {
    try {
        const { societyId } = req.params;

        // Get society
        const society = await Society.findById(societyId).lean();
        if (!society) {
            return res.status(404).json({
                success: false,
                message: 'Society not found'
            });
        }

        // Get transaction stats for this society
        const transactionStats = await Transaction.aggregate([
            { $match: { societyId: society._id } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        let totalIncome = 0, totalExpense = 0;
        transactionStats.forEach(stat => {
            if (stat._id === 'INCOME') totalIncome = stat.total;
            else totalExpense = stat.total;
        });

        // Get recent transactions
        const recentTransactions = await Transaction.find({ societyId })
            .sort({ createdAt: -1 })
            .limit(10);

        // Get events for this society
        const events = await Event.find({ societyId })
            .sort({ date: -1 })
            .limit(5);

        // Get upcoming calendar events
        const upcomingEvents = await CalendarEvent.find({
            societyId,
            date: { $gte: new Date() },
            status: { $ne: 'CANCELLED' }
        }).sort({ date: 1 }).limit(5);

        // Get projects
        const projects = await Project.find({ societyId })
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            data: {
                society: {
                    ...society,
                    id: society._id,
                    balance: society.budget + totalIncome - totalExpense
                },
                summary: {
                    budget: society.budget,
                    balance: society.budget + totalIncome - totalExpense,
                    totalIncome,
                    totalExpense,
                    memberCount: society.members?.length || 0,
                    officeBearerCount: society.officeBearers?.length || 0
                },
                recentTransactions,
                events,
                upcomingEvents,
                projects
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
