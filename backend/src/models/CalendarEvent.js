const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
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
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['PROPOSED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
        required: true,
        default: 'PROPOSED'
    }
}, {
    timestamps: true
});

// Index for efficient queries
calendarEventSchema.index({ societyId: 1, date: 1 });
calendarEventSchema.index({ date: 1, status: 1 });

// Transform output
calendarEventSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
