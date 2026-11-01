const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requirePermission, attachScope } = require("../middleware/rbac");
const { aiLimiter } = require("../middleware/rateLimiter");
const aiController = require("../controllers/aiController");

const router = express.Router();

router.use(authenticate);

// D-B11: administrators (legacy User.role ADMIN, the mechanism adminOnly and the other routes
// use) are authorized without an RBAC role and see every society; everyone else needs the
// existing finance:view permission and is limited to the societies in their RBAC scope.
const isAdmin = (req) => Boolean(req.user) && req.user.role === "ADMIN";
const financeView = requirePermission("finance", "view");
const scopeToSocieties = attachScope("_id");

const adminOrFinanceView = (req, res, next) => (isAdmin(req) ? next() : financeView(req, res, next));
const adminOrScoped = (req, res, next) => {
  if (isAdmin(req)) {
    req.scopeFilter = {};
    return next();
  }
  return scopeToSocieties(req, res, next);
};

/**
 * @route   POST /api/v1/ai/financial-insights
 * @desc    AI financial audit (AUD-013: the Gemini key stays on the server)
 * @access  Administrators, or finance:view limited to the societies in the caller's scope
 */
router.post(
  "/financial-insights",
  adminOrFinanceView,
  adminOrScoped,
  aiController.validateRequest,
  aiLimiter,
  aiController.financialInsights,
);

module.exports = router;
