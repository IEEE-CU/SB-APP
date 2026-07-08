const express = require('express');
const ProjectReport = require('../models/ProjectReport');
const Project = require('../models/Project');
const { authenticate, societyAccess } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/project-reports/project/:projectId
 * @desc    Get reports for a specific project
 * @access  All users
 */
router.get('/project/:projectId', async (req, res, next) => {
    try {
        const reports = await ProjectReport.find({ projectId: req.params.projectId })
            .populate('societyId', 'name shortName')
            .sort({ date: -1 });

        res.json({
            success: true,
            count: reports.length,
            data: reports
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/project-reports
 * @desc    Create new project report
 * @access  Society Office Bearers
 */
router.post('/', societyAccess, async (req, res, next) => {
    try {
        const {
            societyId, projectId, title, date, type,
            participants, description, outcome, images,
            highlights, takeaways, followUpPlan
        } = req.body;

        // ensure project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        const report = await ProjectReport.create({
            societyId: societyId || req.user.societyId,
            projectId,
            title,
            date,
            type,
            participants,
            description,
            outcome,
            images,
            highlights,
            takeaways,
            followUpPlan,
            status: 'SUBMITTED'
        });

        res.status(201).json({
            success: true,
            data: report
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/project-reports/:id
 * @desc    Get project report by ID
 * @access  All users
 */
router.get('/:id', async (req, res, next) => {
    try {
        const report = await ProjectReport.findById(req.params.id)
            .populate('societyId', 'name shortName')
            .populate('projectId', 'title category');

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
