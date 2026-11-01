// Coordinator patch for the integration worktree only (D-23 and D-21). Anchors must match exactly once.
const fs = require("fs");
const file = "D:/SB-APP-worktrees/batch1-integration/backend/src/routes/societies.js";
let s = fs.readFileSync(file, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
const rep = (a, b) => {
  if (s.split(a).length !== 2) throw new Error("anchor not unique/found: " + a.slice(0, 80));
  s = s.replace(a, () => b);
};

// ---- D-21: existence check before any term is created
rep(
  `    const { academicYear, allocatedBudget, openingBalance, chairId, treasurerId } = req.body;

    // The unique (society, academicYear) index`,
  `    const { academicYear, allocatedBudget, openingBalance, chairId, treasurerId } = req.body;

    // D-21: a term belongs to an existing society. Checked before the index wait so a request
    // for a malformed or nonexistent society neither waits for nor depends on the index.
    if (!OBJECT_ID_PATTERN.test(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format." });
    }
    if (!(await Society.exists({ _id: req.params.id }))) {
      return res.status(404).json({ success: false, message: "Society not found" });
    }

    // The unique (society, academicYear) index`,
);

// ---- D-23: handover writes need the society scope AND the existing settings:edit permission
rep(
  `/**
 * @route   PATCH /api/societies/:id/terms/:termId/handover
 * @desc    Update term handover checklist and status
 * @access  Admin or Society Office Bearer
 */
router.patch("/:id/terms/:termId/handover", societyAccess, async (req, res, next) => {`,
  `/**
 * D-23: administrators (legacy User.role ADMIN) pass; everyone else needs the existing RBAC
 * permission. Used after the society-scope guard, which has already limited a non-administrator
 * to their own society.
 */
const adminOrPermission = (module, action) => {
  const permission = requirePermission(module, action);
  return (req, res, next) => (req.user && req.user.role === "ADMIN" ? next() : permission(req, res, next));
};

/**
 * @route   PATCH /api/societies/:id/terms/:termId/handover
 * @desc    Update term handover checklist and status
 * @access  Society scope (admin, or a user of this society) AND, for non-administrators, the
 *          existing RBAC permission settings:edit - the same rule as PATCH /societies/:id,
 *          granted by the matrix to sb_faculty_advisor, society_faculty_advisor, society_chair
 *          and sb_chair. Ordinary members and other societies' users are refused. The term is
 *          looked up within the society in the URL, so a term id cannot cross societies.
 */
router.patch("/:id/terms/:termId/handover", societyAccess, adminOrPermission("settings", "edit"), async (req, res, next) => {`,
);

if (crlf) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(file, s);
console.log("patched");
