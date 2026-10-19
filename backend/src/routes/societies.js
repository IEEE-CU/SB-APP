const express = require("express");
const Society = require("../models/Society");
const Transaction = require("../models/Transaction");
const {
  authenticate,
  adminOnly,
  societyAccessByParam,
} = require("../middleware/auth");
const { parseLimit } = require("../utils/pagination");
const { requirePermission } = require("../middleware/rbac");

// Every society-guarded route in this router declares the target society as
// `:id`. The shared `societyAccess` guard only reads `:societyId` and falls
// back to the caller's own society, which let any office bearer act on any
// society (AUD-018), so authorize against `:id` explicitly.
const societyAccess = societyAccessByParam("id");

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Helper: Calculate society balance from transactions. Only APPROVED
 * transactions count (AUD-005): pending and rejected ones never affect a balance.
 */
const calculateBalance = async (societyId, budget) => {
  const result = await Transaction.aggregate([
    { $match: { societyId: societyId, approvalStatus: "APPROVED" } },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
      },
    },
  ]);

  let income = 0,
    expense = 0;
  result.forEach((r) => {
    if (r._id === "INCOME") income = r.total;
    if (r._id === "EXPENSE") expense = r.total;
  });

  return budget + income - expense;
};

/**
 * Normalizes a society reference (id, ObjectId, or populated document) to a
 * comparable string. Returns null when no usable identifier is present.
 */
const societyKey = (ref) => {
  if (ref === null || ref === undefined) return null;
  const value = ref._id !== undefined && ref._id !== null ? ref._id : ref;
  // A plain object without an identifier has no meaningful string form.
  if (typeof value === "object" && value.toString === Object.prototype.toString) {
    return null;
  }
  const key = String(value);
  return key === "" ? null : key;
};

/**
 * Member rosters and office-bearer phone numbers are visible only to the
 * target society's own users (User.societyId) and administrators. Fails
 * closed when either side has no identifier.
 */
const canSeeSocietyPii = (user, societyId) => {
  if (user && user.role === "ADMIN") return true;
  const own = user ? societyKey(user.societyId) : null;
  return own !== null && own === societyKey(societyId);
};

/** Office bearers without their phone numbers (names, positions, emails stay). */
const withoutPhones = (officeBearers) =>
  officeBearers.map((ob) => {
    const plain = typeof ob.toObject === "function" ? ob.toObject() : { ...ob };
    delete plain.phone;
    return plain;
  });

/**
 * Returns the society as the caller may see it. Authorized callers get the
 * object unchanged; others get a copy without `members` and without
 * office-bearer phone numbers. The input is never mutated.
 */
const redactSociety = (society, user) => {
  if (canSeeSocietyPii(user, society._id)) return society;

  const redacted = { ...society };
  delete redacted.members;
  if (Array.isArray(society.officeBearers)) {
    redacted.officeBearers = withoutPhones(society.officeBearers);
  }
  return redacted;
};

/**
 * @route   GET /api/societies
 * @desc    Get all societies with calculated balances
 * @access  All authenticated users (member rosters and office-bearer phone
 *          numbers only for the caller's own society and administrators)
 */
router.get("/", async (req, res, next) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    
    const parsedLimit = parseLimit(limit);
    const parsedPage = parseInt(page, 10) || 1;
    const skip = (parsedPage - 1) * parsedLimit;

    const [societies, totalItems] = await Promise.all([
      Society.find().sort({ name: 1 }).skip(skip).limit(parsedLimit).lean(),
      Society.countDocuments()
    ]);

    // Calculate balances for all societies
    const societiesWithBalances = await Promise.all(
      societies.map(async (society) => ({
        ...redactSociety(society, req.user),
        id: society._id,
        balance: await calculateBalance(society._id, society.budget),
      })),
    );

    res.json({
      success: true,
      count: societiesWithBalances.length,
      data: societiesWithBalances,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems,
        totalPages: Math.ceil(totalItems / parsedLimit) || 1,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/societies/:id
 * @desc    Get society by ID
 * @access  All authenticated users
 */
router.get("/:id", async (req, res, next) => {
  try {
    const society = await Society.findById(req.params.id).lean();

    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    const data = redactSociety(society, req.user);
    data.id = society._id;
    data.balance = await calculateBalance(society._id, society.budget);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/societies/:id/budget
 * @desc    Update society budget
 * @access  Admin only
 */
router.patch("/:id/budget", adminOnly, async (req, res, next) => {
  try {
    const { budget } = req.body;

    if (budget === undefined || budget < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid budget amount required",
      });
    }

    const society = await Society.findByIdAndUpdate(
      req.params.id,
      { budget },
      { new: true, runValidators: true },
    );

    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    res.json({
      success: true,
      data: society,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/societies/:id/logo
 * @desc    Update society logo URL
 * @access  Admin or Own Office Bearer
 */
router.patch("/:id/logo", societyAccess, async (req, res, next) => {
  try {
    const { logoUrl } = req.body;

    const society = await Society.findByIdAndUpdate(
      req.params.id,
      { logoUrl },
      { new: true },
    );

    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    res.json({
      success: true,
      data: society,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/societies/:id/signature
 * @desc    Update advisor signature URL
 * @access  Admin or Own Office Bearer
 */
router.patch("/:id/signature", societyAccess, async (req, res, next) => {
  try {
    const { advisorSignatureUrl } = req.body;

    const society = await Society.findByIdAndUpdate(
      req.params.id,
      { advisorSignatureUrl },
      { new: true },
    );

    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    res.json({
      success: true,
      data: society,
    });
  } catch (error) {
    next(error);
  }
});

// ============== OFFICE BEARERS ==============

/**
 * @route   GET /api/societies/:id/office-bearers
 * @desc    Get office bearers for a society
 * @access  All authenticated users
 */
router.get("/:id/office-bearers", async (req, res, next) => {
  try {
    const society = await Society.findById(req.params.id).select(
      "officeBearers name",
    );

    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    // Names, positions and emails are visible to all authenticated users;
    // phone numbers only to the society's own users and administrators.
    res.json({
      success: true,
      data: canSeeSocietyPii(req.user, society._id)
        ? society.officeBearers
        : withoutPhones(society.officeBearers || []),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/societies/:id/office-bearers
 * @desc    Add office bearer to society
 * @access  Admin or Own Office Bearer
 */
router.post("/:id/office-bearers", societyAccess, async (req, res, next) => {
  try {
    const { name, position, email, phone, termYear } = req.body;

    const society = await Society.findById(req.params.id);
    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    society.officeBearers.push({
      name,
      position,
      email,
      phone: phone || "",
      termYear: termYear || new Date().getFullYear(),
    });

    await society.save();

    res.status(201).json({
      success: true,
      data: society.officeBearers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/societies/:id/office-bearers/:obId
 * @desc    Update office bearer
 * @access  Admin or Own Office Bearer
 */
router.put(
  "/:id/office-bearers/:obId",
  societyAccess,
  async (req, res, next) => {
    try {
      const society = await Society.findById(req.params.id);
      if (!society) {
        return res.status(404).json({
          success: false,
          message: "Society not found",
        });
      }

      const ob = society.officeBearers.id(req.params.obId);
      if (!ob) {
        return res.status(404).json({
          success: false,
          message: "Office bearer not found",
        });
      }

      // Whitelist updatable fields so a caller can't inject unexpected
      // keys (e.g. _id) via the request body.
      const updatableFields = [
        "name",
        "position",
        "email",
        "phone",
        "termYear",
      ];
      updatableFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          ob[field] = req.body[field];
        }
      });
      await society.save();

      res.json({
        success: true,
        data: ob,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   DELETE /api/societies/:id/office-bearers/:obId
 * @desc    Delete office bearer
 * @access  Admin or Own Office Bearer
 */
router.delete(
  "/:id/office-bearers/:obId",
  societyAccess,
  async (req, res, next) => {
    try {
      const society = await Society.findById(req.params.id);
      if (!society) {
        return res.status(404).json({
          success: false,
          message: "Society not found",
        });
      }

      society.officeBearers.pull({ _id: req.params.obId });
      await society.save();

      res.json({
        success: true,
        message: "Office bearer removed",
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============== MEMBERS ==============

/**
 * @route   GET /api/societies/:id/members
 * @desc    Get members for a society
 * @access  All authenticated users
 */
router.get("/:id/members", async (req, res, next) => {
  try {
    const society = await Society.findById(req.params.id).select(
      "members name",
    );

    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    // Member rosters are restricted to the society's own users and
    // administrators.
    if (!canSeeSocietyPii(req.user, society._id)) {
      return res.status(403).json({
        success: false,
        message: "Access restricted to your own society",
      });
    }

    res.json({
      success: true,
      data: society.members,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/societies/:id/members
 * @desc    Add member to society
 * @access  Admin or Own Office Bearer
 */
router.post("/:id/members", societyAccess, async (req, res, next) => {
  try {
    const { ieeeId, name, email, contactNumber, grade } = req.body;

    const society = await Society.findById(req.params.id);
    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    // Check for duplicate IEEE ID
    const exists = society.members.some((m) => m.ieeeId === ieeeId);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Member with this IEEE ID already exists",
      });
    }

    society.members.push({
      ieeeId,
      name,
      email,
      contactNumber: contactNumber || "",
      grade,
    });

    await society.save();

    res.status(201).json({
      success: true,
      data: society.members,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/societies/:id/members/:memberId
 * @desc    Remove member from society
 * @access  Admin or Own Office Bearer
 */
router.delete(
  "/:id/members/:memberId",
  societyAccess,
  async (req, res, next) => {
    try {
      const society = await Society.findById(req.params.id);
      if (!society) {
        return res.status(404).json({
          success: false,
          message: "Society not found",
        });
      }

      society.members.pull({ _id: req.params.memberId });
      await society.save();

      res.json({
        success: true,
        message: "Member removed",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   PUT /api/societies/:id/office-bearers
 * @desc    Replace all office bearers (bulk update)
 * @access  Admin or Own Office Bearer
 */
router.put("/:id/office-bearers", societyAccess, async (req, res, next) => {
  try {
    const { officeBearers } = req.body;

    const society = await Society.findById(req.params.id);
    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    society.officeBearers = officeBearers || [];
    await society.save();

    res.json({
      success: true,
      data: society.officeBearers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/societies/:id/members
 * @desc    Replace all members (bulk update)
 * @access  Admin or Own Office Bearer
 */
router.put("/:id/members", societyAccess, async (req, res, next) => {
  try {
    const { members } = req.body;

    const society = await Society.findById(req.params.id);
    if (!society) {
      return res.status(404).json({
        success: false,
        message: "Society not found",
      });
    }

    society.members = members || [];
    await society.save();

    res.json({
      success: true,
      data: society.members,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/societies
 * @desc    Create a new society
 * @access  Admin Only
 */
router.post("/", adminOnly, async (req, res, next) => {
  try {
    const { name, description, type, budget } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    // Generate unique shortName from name
    let shortName =
      req.body.shortName ||
      name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase();

    shortName = shortName.replace(/[^A-Z0-9]/g, "");
    if (!shortName) {
      shortName = "SOC";
    }

    let exists = await Society.findOne({ shortName });
    let counter = 1;
    while (exists) {
      const nextShortName = `${shortName}${counter}`;
      const existsNext = await Society.findOne({ shortName: nextShortName });
      if (!existsNext) {
        shortName = nextShortName;
        break;
      }
      counter++;
    }

    const society = await Society.create({
      name,
      description: description || "",
      shortName,
      type: type || "SOCIETY",
      budget: budget || 0,
    });

    res.status(201).json({
      success: true,
      data: society,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/societies/:id
 * @desc    Update society name/description/type (budget: administrators only)
 * @access  Society scope (admin, or a user of this society) AND the existing
 *          RBAC permission settings:edit, which the permission matrix grants to
 *          sb_faculty_advisor, society_faculty_advisor, society_chair and
 *          sb_chair. Budget stays administrator-only (PATCH /:id/budget).
 */
router.patch(
  "/:id",
  societyAccess,
  requirePermission("settings", "edit"),
  async (req, res, next) => {
    try {
      const { name, description, type, budget } = req.body;

      const society = await Society.findById(req.params.id);
      if (!society) {
        return res.status(404).json({
          success: false,
          message: "Society not found",
        });
      }

      if (name !== undefined) society.name = name;
      if (description !== undefined) society.description = description;
      if (type !== undefined) society.type = type;
      // AUD-026: budget stays an administrator-only change, as on PATCH /:id/budget.
      // Everyone else's budget value is ignored here (as it always effectively was,
      // because nothing was ever saved); widening that is a separate decision.
      if (budget !== undefined && req.user.role === "ADMIN") society.budget = budget;

      // AUD-026: the handler assigned the fields but never saved them, so the
      // response looked successful while nothing was stored. The editable paths
      // are validated explicitly (including values that cannot be cast, which
      // would otherwise be dropped silently) and the rest of the document - for
      // example a legacy roster entry - is not re-validated, so it cannot block
      // an unrelated rename.
      await society.validate(["name", "description", "type", "budget"]);
      await society.save({ validateBeforeSave: false });

      res.json({
        success: true,
        data: society,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @route   GET /api/societies/:id/terms
 * @desc    Get all academic terms for a society
 * @access  All authenticated users
 */
router.get("/:id/terms", async (req, res, next) => {
  try {
    const SocietyTerm = require("../models/SocietyTerm");
    const terms = await SocietyTerm.find({ society: req.params.id })
      .populate("chair", "name email")
      .populate("treasurer", "name email")
      .sort({ academicYear: -1 });

    res.json({
      success: true,
      data: terms,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/societies/:id/terms
 * @desc    Create/Open a new academic term for a society
 * @access  Admin only
 */
router.post("/:id/terms", adminOnly, async (req, res, next) => {
  try {
    const SocietyTerm = require("../models/SocietyTerm");
    const AuditLog = require("../models/AuditLog");
    const { academicYear, allocatedBudget, openingBalance, chairId, treasurerId } = req.body;

    const term = await SocietyTerm.create({
      society: req.params.id,
      academicYear,
      allocatedBudget: allocatedBudget || 0,
      openingBalance: openingBalance || 0,
      chair: chairId || null,
      treasurer: treasurerId || null,
      status: "OPEN",
    });

    await AuditLog.create({
      userId: req.user._id,
      action: "CREATE_SOCIETY_TERM",
      module: "societies",
      details: { societyId: req.params.id, academicYear, termId: term._id },
    });

    res.status(201).json({
      success: true,
      data: term,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/societies/:id/terms/:termId/handover
 * @desc    Update term handover checklist and status
 * @access  Admin or Society Office Bearer
 */
router.patch("/:id/terms/:termId/handover", societyAccess, async (req, res, next) => {
  try {
    const SocietyTerm = require("../models/SocietyTerm");
    const AuditLog = require("../models/AuditLog");
    const { reportsSubmitted, balanceReconciled, assetsTransferred, notes, status } = req.body;

    const term = await SocietyTerm.findOne({ _id: req.params.termId, society: req.params.id });
    if (!term) {
      return res.status(404).json({ success: false, message: "Term not found" });
    }

    if (reportsSubmitted !== undefined) term.handoverChecklist.reportsSubmitted = reportsSubmitted;
    if (balanceReconciled !== undefined) term.handoverChecklist.balanceReconciled = balanceReconciled;
    if (assetsTransferred !== undefined) term.handoverChecklist.assetsTransferred = assetsTransferred;
    if (notes !== undefined) term.handoverChecklist.notes = notes;
    if (status !== undefined) term.status = status;

    await term.save();

    await AuditLog.create({
      userId: req.user._id,
      action: "UPDATE_TERM_HANDOVER",
      module: "societies",
      details: { societyId: req.params.id, termId: term._id, status: term.status },
    });

    res.json({
      success: true,
      data: term,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
