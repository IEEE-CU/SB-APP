// Coordinator patch (batch2-gemini worktree only): mount the AI route, add the limiter, rewire the frontend.
const fs = require("fs");
const root = "D:/SB-APP-worktrees/batch2-gemini/";

function patch(rel, edits) {
  const file = root + rel;
  let s = fs.readFileSync(file, "utf8");
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  for (const [a, b] of edits) {
    if (s.split(a).length !== 2) throw new Error(rel + ": anchor not unique/found: " + a.slice(0, 60));
    s = s.replace(a, () => b);
  }
  if (crlf) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(file, s);
}
function write(rel, text) {
  fs.writeFileSync(root + rel, text.replace(/\n/g, "\r\n"));
}

patch("backend/src/routes/index.js", [
  [`const channelRoutes = require("./channels");\n`, `const channelRoutes = require("./channels");\nconst aiRoutes = require("./ai");\n`],
  [`router.use("/channels", channelRoutes);\n`, `router.use("/channels", channelRoutes);\nrouter.use("/ai", aiRoutes);\n`],
]);

patch("backend/src/middleware/rateLimiter.js", [
  [
    `module.exports = { generalLimiter, authLimiter, registrationLimiter };`,
    `/**
 * AI audit limiter (AUD-013). Each request is a paid call to Gemini, so it is limited per
 * signed-in user (not per address) on top of the general limiter. Mounted after the
 * permission check, so refused requests do not use it up.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user && req.user._id),
  message: {
    success: false,
    message: "Too many AI audit requests. Please try again later.",
  },
});

module.exports = { generalLimiter, authLimiter, registrationLimiter, aiLimiter };`,
  ],
]);

write(
  "frontend/src/services/geminiService.ts",
  `import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";

// AUD-013: the Gemini key lives on the server. This only asks the backend for the audit; the
// backend reads the figures itself, within the caller's scope, and returns the generated text.
export const getFinancialInsights = async (targetSocietyId?: string): Promise<string> => {
  try {
    const res = await api.post<ApiResponse<{ insights: string }>>(
      "/ai/financial-insights",
      targetSocietyId ? { societyId: targetSocietyId } : {},
    );
    return res.data.data.insights || "Unable to generate insights at this time.";
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 403) return "You do not have permission to run the AI audit.";
    if (status === 429) return "Too many AI audit requests. Please try again later.";
    if (status === 503) return "The AI audit is not available right now.";
    return "Error connecting to AI service.";
  }
};
`,
);

patch("frontend/src/pages/reports/AiAuditPage.tsx", [
  [`import { getFinancialInsights, FinancialStateSummary } from "@/services/geminiService";`, `import { getFinancialInsights } from "@/services/geminiService";`],
  [
    `      const summaryState: FinancialStateSummary = {
        societies: socData.map((s: any) => ({
          id: s.id || s._id,
          name: s.name,
          shortName: s.shortName || s.name.substring(0, 4),
          budget: s.budget || 0,
          balance: s.balance ?? s.budget ?? 0,
        })),
        transactions: [], // backend balances are dynamically aggregated
      };

      const result = await getFinancialInsights(summaryState, societyId);`,
    `      const result = await getFinancialInsights(societyId);`,
  ],
]);
console.log("gemini patch applied");
