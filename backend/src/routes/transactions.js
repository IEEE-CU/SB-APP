const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Society = require('../models/Society');
const SocietyTerm = require('../models/SocietyTerm');
const { authenticate, adminOnly, societyAccess } = require('../middleware/auth');
const { requirePermission, isGrantingLevel } = require('../middleware/rbac');
const { resolvePermissions } = require('../services/resolvePermissions');
const { logAudit } = require('../services/auditLogger');
const { parseLimit } = require('../utils/pagination');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/*
 * AUD-005 finance workflow.
 *
 *  - Every route requires the matching RBAC permission (finance:view / create /
 *    edit / delete / approve) in addition to the society scope. The legacy
 *    User.role is used only for the society scope (administrators are unrestricted)
 *    and for the one creator-versus-approver exception below; it never grants a
 *    permission.
 *  - New transactions start PENDING; createdBy is the authenticated caller. A
 *    client cannot set createdBy, approvedBy or approvalStatus.
 *  - PENDING -> APPROVED or REJECTED, once, through PATCH /:id/approve|reject
 *    (finance:approve). The decision is a conditional update on status PENDING, so
 *    two concurrent decisions cannot both succeed. A creator cannot approve their
 *    own transaction unless they are an administrator (who still needs the
 *    permission).
 *  - Only PENDING transactions can be edited or deleted. An APPROVED transaction is
 *    never changed or removed: it is offset by a reversal (POST /:id/reverse), a
 *    separate PENDING transaction that goes through the same approval.
 *  - Balances and dashboards count APPROVED transactions only.
 */

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

// Id of a society reference that may be a bare id or a populated document.
const societyIdOf = (ref) => {
    if (!ref) return undefined;
    const id = ref._id !== undefined ? ref._id : ref;
    return id ? id.toString() : undefined;
};

const isAdmin = (user) => user.role === 'ADMIN';

// Administrators are unrestricted; everyone else only acts on their own society.
// Fails closed when either society is missing.
const inCallerScope = (user, societyRef) => {
    if (isAdmin(user)) return true;
    const own = societyIdOf(user.societyId);
    return Boolean(own) && own === societyIdOf(societyRef);
};

// Owner decision D-36: a legacy ADMIN is unrestricted only while they genuinely hold an RBAC
// role that grants it (the real "main admin", sb_faculty_advisor, already passes through
// requirePermission on its own merit - nothing special-cased for that case). A legacy ADMIN
// with NO RBAC role at all is not unrestricted: they may see transactions only for the
// society/societies where a SocietyTerm names them as chair or treasurer - "their period" -
// and nothing else. SocietyTerm has no start/end date field (only a free-text academicYear
// string), so this scopes by SOCIETY, not by exact calendar date; narrowing further would mean
// guessing this institution's academic-year date convention, which is not done here.
const legacyServedSocietyIds = async (userId) => {
    const ids = await SocietyTerm.find({ $or: [{ chair: userId }, { treasurer: userId }] }).distinct('society');
    return ids.map((id) => String(id));
};

// View-only guard for the three read routes below. A real RBAC permission (including
// sb_faculty_advisor's blanket grant) passes exactly as requirePermission alone would. A
// legacy ADMIN with no RBAC role is neither denied outright nor given full access: they pass
// with req.legacyScopedSocietyIds set to the societies they served, enforced by the handler.
// With no served society, there is nothing to scope to, so the request is denied, in the same
// shape and with the same audit entry requirePermission itself would produce.
const viewScopedToLegacyPeriod = (module, action) => {
    const permission = requirePermission(module, action);
    return async (req, res, next) => {
        if (!isAdmin(req.user)) return permission(req, res, next);

        const resolved = await resolvePermissions(req.user._id);
        if (isGrantingLevel(resolved.permissions[`${module}:${action}`])) return next();

        const societyIds = await legacyServedSocietyIds(req.user._id);
        if (societyIds.length === 0) {
            await logAudit({
                user: req.user._id,
                action: 'access_check',
                module,
                route: req.originalUrl,
                method: req.method,
                result: 'denied',
                reason: `Legacy ADMIN with no RBAC role and no served SocietyTerm for key ${module}:${action}`,
                ipAddress: req.ip,
            });
            return res.status(403).json({
                success: false,
                error: { code: 'PERMISSION_DENIED', message: 'You do not have permission to perform this action' },
            });
        }
        req.legacyScopedSocietyIds = societyIds;
        next();
    };
};

const invalidId = (res) =>
    res.status(400).json({ success: false, message: 'Invalid ID format.' });

const outOfScope = (res) =>
    res.status(403).json({ success: false, message: 'Access restricted to your own society' });

const conflict = (res, message) => res.status(409).json({ success: false, message });

const populated = (id) =>
    Transaction.findById(id)
        .populate('societyId', 'name shortName')
        .populate('approvedBy', 'name');

// For :id routes, after the permission check: 400 for a malformed id, 404 for an
// unknown one, 403 for another society's transaction. Returns the document, or
// null after having answered.
const loadInScope = async (req, res) => {
    if (!OBJECT_ID_PATTERN.test(req.params.id)) {
        invalidId(res);
        return null;
    }
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
        res.status(404).json({ success: false, message: 'Transaction not found' });
        return null;
    }
    if (!inCallerScope(req.user, transaction.societyId)) {
        outOfScope(res);
        return null;
    }
    return transaction;
};

const audit = (req, action, transaction, extra = {}) =>
    logAudit({
        user: req.user._id,
        action,
        module: 'finance',
        route: req.originalUrl,
        method: req.method,
        result: 'allowed',
        reason: `${action} ${transaction._id}`,
        ipAddress: req.ip,
        metadata: { transactionId: String(transaction._id), societyId: societyIdOf(transaction.societyId), ...extra },
    });

// Shared list filter (type, category, dates, approvalStatus). Returns null after
// answering 400 for an invalid approvalStatus.
const buildFilter = (req, res, base) => {
    const { type, category, startDate, endDate, approvalStatus } = req.query;
    const filter = { ...base };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (approvalStatus) {
        if (!APPROVAL_STATUSES.includes(approvalStatus)) {
            res.status(400).json({ success: false, message: 'Invalid approval status' });
            return null;
        }
        filter.approvalStatus = approvalStatus;
    }
    if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
    }
    return filter;
};

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions, every status (Admin only)
 * @access  finance:view AND administrator. A legacy administrator with no RBAC role (D-36)
 *          sees only the society/societies they served a SocietyTerm in, not every society.
 */
router.get('/', viewScopedToLegacyPeriod('finance', 'view'), adminOnly, async (req, res, next) => {
    try {
        const base = req.legacyScopedSocietyIds ? { societyId: { $in: req.legacyScopedSocietyIds } } : {};
        const filter = buildFilter(req, res, base);
        if (!filter) return;

        const transactions = await Transaction.find(filter)
            .populate('societyId', 'name shortName')
            .populate('approvedBy', 'name')
            .sort({ date: -1 })
            .limit(parseLimit(req.query.limit === undefined ? 100 : req.query.limit));

        res.json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/transactions/society/:societyId
 * @desc    Get transactions for a specific society, every status
 * @access  finance:view AND (Admin or Own Society). A legacy administrator with no RBAC role
 *          (D-36) may only name a society they served a SocietyTerm in.
 */
router.get('/society/:societyId', societyAccess, viewScopedToLegacyPeriod('finance', 'view'), async (req, res, next) => {
    try {
        if (req.legacyScopedSocietyIds && !req.legacyScopedSocietyIds.includes(req.params.societyId)) {
            return outOfScope(res);
        }
        const filter = buildFilter(req, res, { societyId: req.params.societyId });
        if (!filter) return;

        const transactions = await Transaction.find(filter)
            .populate('societyId', 'name shortName')
            .populate('approvedBy', 'name')
            .sort({ date: -1 })
            .limit(parseLimit(req.query.limit === undefined ? 100 : req.query.limit));

        res.json({
            success: true,
            count: transactions.length,
            data: transactions
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get transaction by ID
 * @access  finance:view AND (Admin or Own Society). A legacy administrator with no RBAC role
 *          (D-36) may only read a transaction belonging to a society they served a
 *          SocietyTerm in.
 */
router.get('/:id', viewScopedToLegacyPeriod('finance', 'view'), async (req, res, next) => {
    try {
        if (!OBJECT_ID_PATTERN.test(req.params.id)) return invalidId(res);

        const transaction = await populated(req.params.id);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        const inScope = req.legacyScopedSocietyIds
            ? req.legacyScopedSocietyIds.includes(societyIdOf(transaction.societyId))
            : inCallerScope(req.user, transaction.societyId);
        if (!inScope) return outOfScope(res);

        res.json({
            success: true,
            data: transaction
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/transactions
 * @desc    Create new transaction (starts PENDING)
 * @access  finance:create AND (Admin or Own Society)
 */
router.post('/', societyAccess, requirePermission('finance', 'create'), async (req, res, next) => {
    try {
        const { societyId, type, amount, category, description, date } = req.body;

        // For non-admins, use their society if not specified
        const targetSocietyId = societyId || req.user.societyId?._id || req.user.societyId;

        if (!targetSocietyId) {
            return res.status(400).json({
                success: false,
                message: 'Society ID is required'
            });
        }

        // A society named by the client must be well formed and exist (a non-admin
        // has already been limited to their own by societyAccess). When a non-admin
        // names none, societyAccess fills in their own society as an ObjectId; that
        // value comes from the server, so it is accepted as is. Anything else that
        // is not a well-formed id string (arrays, objects, numbers) is rejected.
        if (societyId && !(societyId instanceof mongoose.Types.ObjectId)) {
            if (typeof societyId !== 'string' || !OBJECT_ID_PATTERN.test(societyId)) return invalidId(res);
            if (!(await Society.exists({ _id: societyId }))) {
                return res.status(404).json({ success: false, message: 'Society not found.' });
            }
        }

        // approvalStatus, createdBy and approvedBy are server-controlled: whatever
        // the body says is ignored.
        const transaction = await Transaction.create({
            societyId: targetSocietyId,
            type,
            amount,
            category,
            description,
            date: date || Date.now(),
            approvalStatus: 'PENDING',
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            data: await populated(transaction._id)
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/transactions/:id
 * @desc    Update a PENDING transaction
 * @access  finance:edit AND (Admin or Own Society)
 */
router.put('/:id', requirePermission('finance', 'edit'), async (req, res, next) => {
    try {
        const transaction = await loadInScope(req, res);
        if (!transaction) return;

        if (transaction.reversalOf) {
            return conflict(res, 'A reversal cannot be edited; reject or delete it and create another');
        }
        if (transaction.approvalStatus === 'APPROVED') {
            return conflict(res, 'Approved transactions cannot be edited; create a reversal instead');
        }
        if (transaction.approvalStatus !== 'PENDING') {
            return conflict(res, 'Only pending transactions can be edited');
        }

        // Update allowed fields
        const { type, amount, category, description, date } = req.body;
        const updates = {};
        if (type) updates.type = type;
        if (amount !== undefined) updates.amount = amount;
        if (category) updates.category = category;
        if (description) updates.description = description;
        if (date) updates.date = date;

        // Conditional on still being PENDING, so a concurrent approval wins cleanly.
        const updated = await Transaction.findOneAndUpdate(
            { _id: transaction._id, approvalStatus: 'PENDING' },
            { $set: updates },
            { new: true, runValidators: true }
        );
        if (!updated) return conflict(res, 'The transaction was decided while it was being edited');

        res.json({
            success: true,
            data: await populated(updated._id)
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete a PENDING transaction (approved and rejected ones are kept)
 * @access  finance:delete AND (Admin or Own Society)
 */
router.delete('/:id', requirePermission('finance', 'delete'), async (req, res, next) => {
    try {
        const transaction = await loadInScope(req, res);
        if (!transaction) return;

        if (transaction.approvalStatus === 'APPROVED') {
            return conflict(res, 'Approved transactions cannot be deleted; create a reversal instead');
        }
        if (transaction.approvalStatus !== 'PENDING') {
            return conflict(res, 'Only pending transactions can be deleted; rejected ones are kept for the record');
        }

        const removed = await Transaction.findOneAndDelete({ _id: transaction._id, approvalStatus: 'PENDING' });
        if (!removed) return conflict(res, 'The transaction was decided while it was being deleted');

        res.json({
            success: true,
            message: 'Transaction deleted'
        });
    } catch (error) {
        next(error);
    }
});

// Approve or reject a PENDING transaction.
const decide = (decision) => async (req, res, next) => {
    try {
        const transaction = await loadInScope(req, res);
        if (!transaction) return;

        if (transaction.approvalStatus !== 'PENDING') {
            return conflict(res, `Transaction is already ${transaction.approvalStatus.toLowerCase()}`);
        }

        // A creator may not approve their own transaction; an administrator (who
        // still needed finance:approve to get here) may. Legacy records without a
        // createdBy have no known creator to compare against.
        if (
            decision === 'APPROVED' &&
            !isAdmin(req.user) &&
            transaction.createdBy &&
            String(transaction.createdBy) === String(req.user._id)
        ) {
            return res.status(403).json({
                success: false,
                message: 'You cannot approve a transaction you created'
            });
        }

        // A reversal only makes sense while the transaction it offsets is approved.
        if (decision === 'APPROVED' && transaction.reversalOf) {
            const original = await Transaction.findOne({
                _id: transaction.reversalOf,
                societyId: transaction.societyId,
                approvalStatus: 'APPROVED'
            });
            if (!original) return conflict(res, 'The transaction being reversed is no longer approved');
        }

        const decided = { approvalStatus: decision, decidedBy: req.user._id, decidedAt: new Date() };
        if (decision === 'APPROVED') decided.approvedBy = req.user._id;

        // Conditional on still being PENDING: only one concurrent decision can win.
        const result = await Transaction.findOneAndUpdate(
            { _id: transaction._id, approvalStatus: 'PENDING' },
            { $set: decided },
            { new: true }
        );
        if (!result) return conflict(res, 'Transaction was already decided');

        await audit(req, decision === 'APPROVED' ? 'finance_transaction_approved' : 'finance_transaction_rejected', result);

        res.json({
            success: true,
            data: await populated(result._id)
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   PATCH /api/transactions/:id/approve
 * @desc    Approve a PENDING transaction
 * @access  finance:approve AND (Admin or Own Society)
 */
router.patch('/:id/approve', requirePermission('finance', 'approve'), decide('APPROVED'));

/**
 * @route   PATCH /api/transactions/:id/reject
 * @desc    Reject a PENDING transaction
 * @access  finance:approve AND (Admin or Own Society)
 */
router.patch('/:id/reject', requirePermission('finance', 'approve'), decide('REJECTED'));

/**
 * @route   POST /api/transactions/:id/reverse
 * @desc    Offset an APPROVED transaction with a PENDING reversal (opposite type, same
 *          amount, linked through reversalOf). The original is never modified.
 * @access  finance:edit AND (Admin or Own Society)
 */
router.post('/:id/reverse', requirePermission('finance', 'edit'), async (req, res, next) => {
    try {
        const original = await loadInScope(req, res);
        if (!original) return;

        const { reason } = req.body || {};
        if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
            return res.status(400).json({ success: false, message: 'reason must be a string of at most 500 characters' });
        }

        if (original.reversalOf) return conflict(res, 'A reversal cannot itself be reversed');
        if (original.approvalStatus !== 'APPROVED') {
            return conflict(res, 'Only approved transactions can be reversed');
        }

        const alreadyReversed = 'This transaction already has a pending or approved reversal';
        const existing = await Transaction.findOne({
            reversalOf: original._id,
            approvalStatus: { $in: ['PENDING', 'APPROVED'] }
        });
        if (existing) return conflict(res, alreadyReversed);

        let reversal;
        try {
            reversal = await Transaction.create({
                societyId: original.societyId,
                type: original.type === 'INCOME' ? 'EXPENSE' : 'INCOME',
                amount: original.amount,
                category: original.category,
                description: `Reversal of transaction ${original._id}`,
                date: new Date(),
                notes: reason,
                approvalStatus: 'PENDING',
                createdBy: req.user._id,
                reversalOf: original._id
            });
        } catch (error) {
            // The partial unique indexes make a concurrent duplicate fail here.
            if (error && error.code === 11000) return conflict(res, alreadyReversed);
            throw error;
        }

        await audit(req, 'finance_transaction_reversal_created', reversal, { reversalOf: String(original._id) });

        res.status(201).json({
            success: true,
            data: await populated(reversal._id)
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
