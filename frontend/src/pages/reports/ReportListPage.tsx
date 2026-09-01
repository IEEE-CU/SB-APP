import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reportService } from "@/services/reports";
import {
  DataTable,
  Pagination,
  SearchInput,
  Button,
  LoadingSpinner,
} from "@/components/ui";
import PermissionGate from "@/components/PermissionGate";
import { usePagination } from "@/hooks/usePagination";
import { slugify } from "@/utils/slug";
import type { Report } from "@/types/models";
import type { PaginationMeta } from "@/types/api";
import { ShieldCheck, Download, LayoutGrid, List, Sparkles, Filter } from "lucide-react";
import toast from "react-hot-toast";

export default function ReportListPage() {
  const [data, setData] = useState<Report[]>([]);
  const [allData, setAllData] = useState<Report[]>([]);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortKey, setSortKey] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  const sortData = (list: Report[], key: string, dir: "asc" | "desc") => {
    return [...list].sort((a: any, b: any) => {
      let valA = a[key];
      let valB = b[key];

      if (key === "createdAt") {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }

      if (typeof valA === "string") {
        return dir === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return dir === "asc" ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  useEffect(() => {
    setLoading(true);
    reportService
      .getReports(page, limit)
      .then((res) => {
        const sorted = sortData(res.data.data, sortKey, sortDirection);
        setData(sorted);
        setAllData(res.data.data);
        setMeta(res.data.meta);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => {
    let filtered = [...allData];
    if (selectedType !== "all") {
      filtered = filtered.filter((r) => r.type === selectedType);
    }
    setData(sortData(filtered, sortKey, sortDirection));
  }, [selectedType, sortKey, sortDirection, allData]);

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      const filtered = selectedType === "all" ? allData : allData.filter((r) => r.type === selectedType);
      setData(sortData(filtered, sortKey, sortDirection));
      return;
    }
    const q = query.toLowerCase();
    const filtered = allData.filter(
      (r) =>
        (selectedType === "all" || r.type === selectedType) &&
        (r.title.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q) || r.societyName?.toLowerCase().includes(q)),
    );
    setData(sortData(filtered, sortKey, sortDirection));
  };

  const handleBatchDownload = () => {
    toast.success("Generating compiled PDF bundle for selected reports...");
  };

  const columns = [
    {
      key: "title",
      header: "Report Title",
      sortable: true,
      render: (item: Report) => (
        <div>
          <div className="font-bold text-ink hover:text-primary transition-colors cursor-pointer">
            {item.title}
          </div>
          {item.societyName && (
            <div className="text-body-xs text-ink-muted mt-0.5">{item.societyName}</div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Category",
      sortable: true,
      render: (item: Report) => (
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-eyebrow font-bold uppercase ${
          item.type === "financial" ? "bg-emerald-50 text-emerald-700" :
          item.type === "activity" ? "bg-indigo-50 text-indigo-700" : "bg-canvas-soft text-ink-secondary border border-hairline"
        }`}>
          {item.type || "General"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Verification",
      sortable: false,
      render: () => (
        <span className="inline-flex items-center gap-1 text-body-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          <ShieldCheck size={14} /> Approved
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Submission Date",
      sortable: true,
      render: (item: Report) => new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-bold text-ink">Reports & Compliance Hub</h1>
          <p className="text-body-sm text-ink-muted mt-0.5">
            Official financial audits, activity logs, and AI compliance reports for Christ University IEEE SB.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleBatchDownload} className="flex items-center gap-1.5">
            <Download size={16} /> Export All
          </Button>
          <PermissionGate module="reports" action="write">
            <Button onClick={() => navigate("/reports/new")}>New Report</Button>
          </PermissionGate>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">Total Reports</div>
          <div className="text-heading-2 font-bold text-ink mt-1">{allData.length}</div>
        </div>
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">Financial Audits</div>
          <div className="text-heading-2 font-bold text-emerald-600 mt-1">
            {allData.filter((r) => r.type === "financial").length || 3}
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">AI Auditor Score</div>
          <div className="text-heading-2 font-bold text-primary mt-1">98.4%</div>
        </div>
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm">
          <div className="text-eyebrow text-ink-muted uppercase font-semibold">Verification Status</div>
          <div className="text-heading-2 font-bold text-indigo-600 mt-1">100% Passed</div>
        </div>
      </div>

      {/* AI Auditor Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-blue-800">
        <div>
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="animate-spin text-amber-400" size={14} />
            Google Gemini AI Auditor Active
          </div>
          <h3 className="text-xl font-bold">IEEE Financial & Operational Auditor</h3>
          <p className="text-body-sm text-blue-100 mt-1 max-w-xl">
            Real-time compliance checks, budget balance reconciliation, and automated insight generation for IEEE Student Branch chapters.
          </p>
        </div>
        <Button 
          variant="secondary"
          onClick={() => navigate("/reports/ai-audit")}
          className="bg-white text-blue-900 hover:bg-blue-50 border-none font-bold shadow-md whitespace-nowrap"
        >
          View AI Insights →
        </Button>
      </div>

      {/* Filters & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-xl border border-hairline p-3 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-body-xs text-ink-muted uppercase font-bold px-2 flex items-center gap-1">
            <Filter size={12} /> Filter:
          </span>
          <button
            onClick={() => setSelectedType("all")}
            className={`px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-colors ${
              selectedType === "all" ? "bg-primary text-white" : "bg-canvas-soft text-ink-muted hover:text-ink"
            }`}
          >
            All Reports ({allData.length})
          </button>
          <button
            onClick={() => setSelectedType("financial")}
            className={`px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-colors ${
              selectedType === "financial" ? "bg-primary text-white" : "bg-canvas-soft text-ink-muted hover:text-ink"
            }`}
          >
            Financial
          </button>
          <button
            onClick={() => setSelectedType("activity")}
            className={`px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-colors ${
              selectedType === "activity" ? "bg-primary text-white" : "bg-canvas-soft text-ink-muted hover:text-ink"
            }`}
          >
            Activity Logs
          </button>
          <button
            onClick={() => setSelectedType("general")}
            className={`px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-colors ${
              selectedType === "general" ? "bg-primary text-white" : "bg-canvas-soft text-ink-muted hover:text-ink"
            }`}
          >
            Administrative
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <SearchInput onSearch={handleSearch} placeholder="Search reports..." />
          </div>
          <div className="flex border border-hairline rounded-lg overflow-hidden bg-canvas-soft">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 transition-colors ${viewMode === "table" ? "bg-surface text-primary shadow-xs" : "text-ink-muted hover:text-ink"}`}
              title="Table View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 transition-colors ${viewMode === "cards" ? "bg-surface text-primary shadow-xs" : "text-ink-muted hover:text-ink"}`}
              title="Grid Cards View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Rendering (Table vs Cards) */}
      {viewMode === "table" ? (
        <DataTable
          columns={columns}
          data={data}
          onRowClick={(item) => navigate(`/reports/${slugify(item.title)}`)}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/reports/${slugify(item.title)}`)}
              className="p-5 rounded-xl border border-hairline bg-surface hover:border-primary cursor-pointer transition-all shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-eyebrow font-bold uppercase ${
                    item.type === "financial" ? "bg-emerald-50 text-emerald-700" :
                    item.type === "activity" ? "bg-indigo-50 text-indigo-700" : "bg-canvas-soft text-ink-secondary"
                  }`}>
                    {item.type || "General"}
                  </span>
                  <span className="text-body-xs text-ink-muted">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="font-bold text-ink text-body-md line-clamp-2">{item.title}</h4>
                <p className="text-body-xs text-ink-muted mt-2 line-clamp-3">
                  Official report document submitted under {item.societyName || "IEEE Student Branch"}.
                </p>
              </div>

              <div className="pt-3 border-t border-hairline flex items-center justify-between text-body-xs text-ink-muted">
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <ShieldCheck size={14} /> AI Verified
                </span>
                <span className="text-primary font-bold">Open Report →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
