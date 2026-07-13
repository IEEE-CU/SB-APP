const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: [true, 'Society ID is required'],
        index: true
    },
    type: {
        type: String,
        enum: ['INCOME', 'EXPENSE'],
        required: [true, 'Transaction type is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    approvalStatus: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'APPROVED' // Auto-approve for now
    },
    attachmentUrl: {
        type: String
    },
    notes: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
transactionSchema.index({ societyId: 1, date: -1 });
transactionSchema.index({ societyId: 1, type: 1 });
transactionSchema.index({ type: 1, category: 1 });
transactionSchema.index({ approvalStatus: 1 });
transactionSchema.index({ createdBy: 1 });

// Transform output to use 'id' instead of '_id' for frontend compatibility
transactionSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Transaction', transactionSchema);
