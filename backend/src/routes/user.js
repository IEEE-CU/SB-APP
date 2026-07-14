const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/user/permissions
 * @desc    Get permissions for the current user
 * @access  Private
 */
router.get('/permissions', (req, res) => {
    const role = req.user.role;
    let accessLevel = 'read';
    let userAccessLevel = 'none';

    if (role === 'ADMIN') {
        accessLevel = 'superadmin';
        userAccessLevel = 'superadmin';
    } else if (role === 'OFFICE_BEARER' || role === 'FACULTY') {
        accessLevel = 'admin';
    }

    res.json({
        success: true,
        data: {
            permissions: [
                { module: "societies", action: "view", accessLevel },
                { module: "events", action: "view", accessLevel },
                { module: "projects", action: "view", accessLevel },
                { module: "reports", action: "view", accessLevel },
                { module: "announcements", action: "view", accessLevel },
                { module: "community", action: "view", accessLevel: "read" },
                { module: "users", action: "view", accessLevel: userAccessLevel },
            ]
        }
    });
});

module.exports = router;
