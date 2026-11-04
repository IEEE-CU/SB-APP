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
    },
    // AUD-005 approval workflow. All three are optional so records created before
    // the workflow (which have none of them) stay valid and unchanged.
    // Who approved or rejected the transaction, and when (approvedBy additionally
    // stays set for approvals, as before).
    decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    decidedAt: {
        type: Date
    },
    // Set only on a reversal: the approved transaction it offsets. The original is
    // never modified; the reversal is a separate, opposite-type record of the same
    // amount that goes through the normal approval workflow.
    reversalOf: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
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
// An approved transaction can be reversed at most once: while a reversal of it is
// pending, and once one is approved, no second one can exist. A rejected reversal
// frees the original for another attempt. (Two partial unique indexes, because a
// partial filter cannot express "not rejected".)
transactionSchema.index(
    { reversalOf: 1 },
    { unique: true, partialFilterExpression: { reversalOf: { $exists: true }, approvalStatus: 'PENDING' }, name: 'one_pending_reversal_per_transaction' }
);
transactionSchema.index(
    { reversalOf: 1 },
    { unique: true, partialFilterExpression: { reversalOf: { $exists: true }, approvalStatus: 'APPROVED' }, name: 'one_approved_reversal_per_transaction' }
);

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
