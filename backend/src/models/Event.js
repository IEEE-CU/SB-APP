const mongoose = require('mongoose');

// Sub-schema for Speakers
const speakerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    designation: { type: String, required: true },
    organization: { type: String, required: true },
    presentationTitle: { type: String, required: true },
    profileText: { type: String, default: '' }
}, { _id: true });

const eventSchema = new mongoose.Schema({
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
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        default: ''
    },
    venue: {
        type: String,
        default: ''
    },
    eventType: {
        type: String,
        required: true,
        enum: ['Workshop', 'Seminar', 'Conference', 'Competition', 'Field Trip', 'Outreach', 'Social Event', 'Other']
    },
    participants: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true
    },
    outcome: {
        type: String,
        default: ''
    },
    participantType: {
        type: String,
        default: ''
    },
    highlights: {
        type: String,
        default: ''
    },
    takeaways: {
        type: String,
        default: ''
    },
    followUpPlan: {
        type: String,
        default: ''
    },
    organizerName: {
        type: String,
        default: ''
    },
    organizerDesignation: {
        type: String,
        default: ''
    },
    collaboration: {
        type: String,
        default: ''
    },
    images: [{
        type: String // URLs to images
    }],
    speakers: [speakerSchema]
}, {
    timestamps: true
});

// Index for efficient queries
eventSchema.index({ societyId: 1, date: -1 });

// Transform output
eventSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        // Map eventType to type for frontend compatibility
        if (ret.eventType) {
            ret.type = ret.eventType;
        }
        if (ret.speakers) {
            ret.speakers = ret.speakers.map(s => ({
                ...s,
                id: s._id,
                _id: undefined
            }));
        }
        return ret;
    }
});

module.exports = mongoose.model('Event', eventSchema);
