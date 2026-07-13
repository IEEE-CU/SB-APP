const express = require('express');
const router = express.Router();
const CommunityMessage = require('../models/CommunityMessage');
const { authenticate } = require('../middleware/auth');

// GET /messages
router.get('/messages', authenticate, async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const skip = (page - 1) * limit;

        const messages = await CommunityMessage.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', 'name email role');

        res.json({
            success: true,
            count: messages.length,
            data: messages
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

// POST /messages
router.post('/messages', authenticate, async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Please provide message content'
            });
        }

        let message = await CommunityMessage.create({
            content,
            sender: req.user._id
        });

        message = await message.populate('sender', 'name email role');

        req.app.get('io').emit('new_message', message);

        res.status(201).json({
            success: true,
            data: message
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

module.exports = router;
