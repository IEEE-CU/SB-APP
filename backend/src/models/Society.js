const mongoose = require('mongoose');

// Sub-schema for Office Bearers
const officeBearerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    position: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    termYear: { type: Number, default: new Date().getFullYear() }
}, { _id: true });

// Sub-schema for Members
const memberSchema = new mongoose.Schema({
    ieeeId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    contactNumber: { type: String, default: '' },
    grade: { type: String, required: true }
}, { _id: true });

const societySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    shortName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['SOCIETY', 'AFFINITY_GROUP', 'COUNCIL'],
        default: 'SOCIETY'
    },
    budget: {
        type: Number,
        default: 0,
        min: 0
    },
    logoUrl: {
        type: String,
        default: null
    },
    advisorSignatureUrl: {
        type: String,
        default: null
    },
    officeBearers: [officeBearerSchema],
    members: [memberSchema]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for calculating balance from transactions
societySchema.virtual('balance').get(function () {
    // This will be calculated when querying with transactions
    return this._balance !== undefined ? this._balance : this.budget;
});

// Transform output
societySchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        // Transform nested arrays
        if (ret.officeBearers) {
            ret.officeBearers = ret.officeBearers.map(ob => ({
                ...ob,
                id: ob._id,
                _id: undefined
            }));
        }
        if (ret.members) {
            ret.members = ret.members.map(m => ({
                ...m,
                id: m._id,
                _id: undefined
            }));
        }
        return ret;
    }
});

module.exports = mongoose.model('Society', societySchema);
