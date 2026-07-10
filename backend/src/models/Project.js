const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['TECHNICAL_PROJECT', 'TRAVEL_GRANT', 'SCHOLARSHIP', 'AWARD'],
        required: true
    },
    sanctioningBody: {
        type: String,
        required: true,
        trim: true
    },
    amountSanctioned: {
        type: Number,
        required: true,
        min: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['PROPOSED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ANNOUNCED', 'AWARDED'],
        required: true,
        default: 'PROPOSED'
    },
    description: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Index for efficient queries
projectSchema.index({ societyId: 1, status: 1 });

// Transform output
projectSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Project', projectSchema);
