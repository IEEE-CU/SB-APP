const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
    // Singleton pattern - there should only be one document
    _id: {
        type: String,
        default: 'institution-settings'
    },
    name: {
        type: String,
        default: 'CHRIST (Deemed to be University)'
    },
    logoUrl: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Ensure only one document can exist
institutionSchema.pre('save', function(next) {
    this._id = 'institution-settings';
    next();
});

const Institution = mongoose.model('Institution', institutionSchema);

module.exports = Institution;
