const geminiService = require("../services/ai/GeminiService");
const { loadFinancialState, buildPrompt } = require("../services/ai/financialSummary");
const { isSocietyInScope } = require("../middleware/rbac");
const Society = require("../models/Society");

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const aiController = {
  /**
   * Payload, scope and existence checks. They run BEFORE the AI rate limiter, so only a request
   * that would really call Gemini uses up a caller's AI quota.
   * Body: { societyId? } - the request carries no prompt text and no financial data.
   */
  async validateRequest(req, res, next) {
    try {
      const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
      if (Object.keys(body).some((key) => key !== "societyId")) {
        return fail(res, 400, "Only societyId may be sent.");
      }
      const { societyId } = body;
      if (societyId !== undefined && (typeof societyId !== "string" || !OBJECT_ID_PATTERN.test(societyId))) {
        return fail(res, 400, "Invalid societyId.");
      }

      // Scope before existence, so a caller cannot probe for societies outside their scope.
      if (societyId && !isSocietyInScope(req, societyId)) {
        return fail(res, 403, "Access denied. You do not have access to this society.");
      }
      if (societyId && !(await Society.exists({ _id: societyId }))) {
        return fail(res, 404, "Society not found");
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
      const state = await loadFinancialState(req.scopeFilter || {}, societyId);
      if (state.societies.length === 0) return fail(res, 404, "No societies in scope.");

      let insights;
      try {
        insights = await geminiService.generate(buildPrompt(state, Boolean(societyId)));
      } catch (error) {
        if (error instanceof geminiService.GeminiNotConfiguredError) {
          return fail(res, 503, "The AI audit is not available right now.");
        }
        if (error instanceof geminiService.GeminiProviderError) {
          // Status number only: the provider's body, URL and our key are never logged or returned.
          console.error(`Gemini request failed (status ${error.status ?? "none"})`);
          return fail(res, 502, "The AI audit could not be generated. Please try again later.");
        }
        throw error;
      }
      return res.json({ success: true, data: { insights } });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = aiController;
