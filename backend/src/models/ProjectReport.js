const mongoose = require('mongoose');

const projectReportSchema = new mongoose.Schema({
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: true,
        index: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    outcome: {
        type: String,
        default: ''
    },
    beneficiaries: {
        type: Number,
        default: 0
    },
    actualAmountSpent: {
        type: Number,
        default: 0
    },
    images: [{
        type: String // URLs
    }],
    status: {
        type: String,
        enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
        default: 'DRAFT'
    }
}, {
    timestamps: true
});

// Index for efficient queries
projectReportSchema.index({ societyId: 1, status: 1 });
projectReportSchema.index({ projectId: 1 });

// Transform output
projectReportSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('ProjectReport', projectReportSchema);
