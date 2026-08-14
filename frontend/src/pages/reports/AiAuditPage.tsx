import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getFinancialInsights, FinancialStateSummary } from "@/services/geminiService";
import { societyService } from "@/services/societies";
import { Button, LoadingSpinner } from "@/components/ui";
import { ArrowLeft, Sparkles, RefreshCw } from "lucide-react";

export default function AiAuditPage() {
  const [insights, setInsights] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [societies, setSocieties] = useState<any[]>([]);
  const [selectedSociety, setSelectedSociety] = useState<string>("");
  const navigate = useNavigate();

  const fetchAuditData = async (societyId?: string) => {
    setLoading(true);
    try {
      const res = await societyService.getSocieties(1, 100);
      const socData = res.data.data;
      setSocieties(socData);

      const summaryState: FinancialStateSummary = {
        societies: socData.map((s: any) => ({
          id: s.id || s._id,
          name: s.name,
          shortName: s.shortName || s.name.substring(0, 4),
          budget: s.budget || 0,
          balance: s.balance ?? s.budget ?? 0,
        })),
        transactions: [], // backend balances are dynamically aggregated
      };

      const result = await getFinancialInsights(summaryState, societyId);
      setInsights(result);
    } catch (err) {
      console.error(err);
      setInsights("Failed to execute AI Audit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleSocietyChange = (socId: string) => {
    setSelectedSociety(socId);
    fetchAuditData(socId || undefined);
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Back to Reports
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-bold text-ink flex items-center gap-3">
            <Sparkles className="text-blue-600" size={28} />
            AI Financial Auditor
          </h1>
          <p className="text-body-sm text-ink-muted mt-1">
            Real-time automated auditing using Google Gemini AI for Christ University IEEE Student Branch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSociety}
            onChange={(e) => handleSocietyChange(e.target.value)}
            className="px-4 py-2 border border-hairline rounded-lg bg-surface text-ink text-body-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Societies (Student Branch Overview)</option>
            {societies.map((s) => (
              <option key={s.id || s._id} value={s.id || s._id}>
                {s.name} ({s.shortName || s.name.substring(0, 4)})
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={() => fetchAuditData(selectedSociety || undefined)}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Re-Audit
          </Button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-hairline p-8 shadow-sm">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <LoadingSpinner />
            <p className="text-body-sm text-ink-muted font-medium animate-pulse">
              Analyzing IEEE financial data via Google Gemini...
            </p>
          </div>
        ) : (
          <div className="prose max-w-none text-ink text-body-md leading-relaxed whitespace-pre-line">
            {insights}
          </div>
        )}
      </div>
    </div>
  );
}
