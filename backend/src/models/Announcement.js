const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        default: null // null for global announcements
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    senderName: {
        type: String,
        required: true,
        trim: true
    },
    targetAudience: {
        type: String,
        enum: ['ALL', 'LEADERSHIP', 'SOCIETY'],
        required: true,
        default: 'ALL'
    }
}, {
    timestamps: true
});

// Index for efficient queries
announcementSchema.index({ date: -1 });
announcementSchema.index({ targetAudience: 1, societyId: 1 });

// Transform output
announcementSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Announcement', announcementSchema);
