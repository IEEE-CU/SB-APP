const fs = require("fs");
const root = "D:/SB-APP-worktrees/batch2-gemini/backend/src/";
function patch(rel, edits) {
  let s = fs.readFileSync(root + rel, "utf8");
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  for (const [a, b] of edits) {
    if (s.split(a).length !== 2) throw new Error(rel + ": anchor: " + a.slice(0, 50));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(root + rel, crlf ? s.replace(/\n/g, "\r\n") : s);
}

patch("controllers/aiController.js", [
  [
    `  /**
   * POST /api/v1/ai/financial-insights   body: { societyId? }
   * The server reads the figures itself, within the caller's scope (req.scopeFilter from
   * attachScope("_id")); the request carries no prompt text and no financial data.
   */
  async financialInsights(req, res, next) {
    try {
      const body`,
    `  /**
   * Payload, scope and existence checks. They run BEFORE the AI rate limiter, so only a request
   * that would really call Gemini uses up a caller's AI quota.
   * Body: { societyId? } - the request carries no prompt text and no financial data.
   */
  async validateRequest(req, res, next) {
    try {
      const body`,
  ],
  [
    `        return fail(res, 404, "Society not found");
      }

      const state = await loadFinancialState(req.scopeFilter || {}, societyId);`,
    `        return fail(res, 404, "Society not found");
      }
      next();
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/ai/financial-insights
   * The server reads the figures itself, within the caller's scope (req.scopeFilter from
   * attachScope("_id")).
   */
  async financialInsights(req, res, next) {
    try {
      const societyId = req.body && req.body.societyId;
      const state = await loadFinancialState(req.scopeFilter || {}, societyId);`,
  ],
]);
patch("routes/ai.js", [
  [`  attachScope("_id"),\n  aiLimiter,`, `  attachScope("_id"),\n  aiController.validateRequest,\n  aiLimiter,`],
]);
console.log("ok");
