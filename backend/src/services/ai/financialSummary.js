const Society = require("../../models/Society");
const Transaction = require("../../models/Transaction");

// AUD-013: the figures for the AI financial audit are read here, on the server, within the
// caller's scope. The client never supplies financial data or prompt text.
//
// D-B10 (data boundary): what leaves for Google is limited to society-level figures - name, short
// name, allocated budget and current balance - which is what the page sent before the audit moved
// to the server. Individual transactions (descriptions, categories, amounts, types) are never read
// into the prompt: this module does not query them, only sums the APPROVED ones into a balance.

const MAX_SOCIETIES = 100;
const MAX_TEXT = 100;

const clip = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);

/**
 * @param {object} scopeFilter  {} for every society, or { _id } for one (from attachScope("_id"))
 * @param {string} [societyId]  a single society to audit (already authorized by the caller)
 * @returns {{ societies: Array<{name:string, shortName:string, budget:number, balance:number}> }}
 */
async function loadFinancialState(scopeFilter, societyId) {
  const filter = societyId ? { _id: societyId } : { ...scopeFilter };
  const societies = await Society.find(filter).sort({ name: 1 }).limit(MAX_SOCIETIES).lean();
  if (societies.length === 0) return { societies: [] };

  // Only APPROVED transactions count towards a balance (AUD-005). Only the per-society sum is kept.
  const totals = await Transaction.aggregate([
    { $match: { societyId: { $in: societies.map((s) => s._id) }, approvalStatus: "APPROVED" } },
    { $group: { _id: { society: "$societyId", type: "$type" }, total: { $sum: "$amount" } } },
  ]);
  const net = new Map();
  for (const row of totals) {
    const key = String(row._id.society);
    const sign = row._id.type === "INCOME" ? 1 : row._id.type === "EXPENSE" ? -1 : 0;
    net.set(key, (net.get(key) || 0) + sign * row.total);
  }

  return {
    societies: societies.map((s) => ({
      name: clip(s.name),
      shortName: clip(s.shortName || s.name.slice(0, 4)),
      budget: s.budget || 0,
      balance: (s.budget || 0) + (net.get(String(s._id)) || 0),
    })),
  };
}

function buildPrompt({ societies }, single) {
  if (single) {
    const soc = societies[0];
    return `
      As a professional financial auditor for IEEE, analyze the financial health of the "${soc.name}" (${soc.shortName}) society:
      Allocated Budget: ₹${soc.budget}
      Current Balance: ₹${soc.balance}

      Provide a concise report (max 200 words) for the Society Chair on:
      1. Their specific financial standing and budget utilization.
      2. Suggestions for improving their technical activity outreach within their remaining budget.
      3. One specific area where they could optimize costs, based on how much of the budget is already used.
    `;
  }
  const totalBalance = societies.reduce((acc, s) => acc + s.balance, 0);
  const totalBudget = societies.reduce((acc, s) => acc + s.budget, 0);
  const lines = societies.map((s) => `${s.shortName}: Budget ₹${s.budget}, Spent ₹${s.budget - s.balance}`).join(", ");
  return `
      As a professional financial auditor for IEEE, analyze this IEEE Student Branch financial data:
      Total Budget: ₹${totalBudget}
      Total Current Balance: ₹${totalBalance}
      Society Details: ${lines}

      Provide a concise report (max 200 words) on:
      1. Overall financial health of the entire Student Branch.
      2. Any society that is overspending or underutilizing budget significantly.
      3. Three actionable recommendations to optimize the remaining budget for upcoming technical events.
    `;
}

module.exports = { loadFinancialState, buildPrompt };
