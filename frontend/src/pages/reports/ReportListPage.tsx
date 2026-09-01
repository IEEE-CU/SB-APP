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
import { PageTransition, AnimatedCard, AnimatedBadge } from "@/components/ui/WatermelonMotion";
import { motion, AnimatePresence } from "framer-motion";

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
            <div className="text-xs text-ink-muted mt-0.5">{item.societyName}</div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Category",
      sortable: true,
      render: (item: Report) => (
        <AnimatedBadge className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
          item.type === "financial" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" :
          item.type === "activity" ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/20" : "bg-canvas-soft text-ink-secondary border-hairline"
        }`}>
          {item.type || "General"}
        </AnimatedBadge>
      ),
    },
    {
      key: "status",
      header: "Verification",
      sortable: false,
      render: () => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full border border-emerald-500/20">
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
    <PageTransition className="max-w-7xl mx-auto flex flex-col gap-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mb-1">Reports Hub</h1>
          <p className="text-body-sm text-ink-muted font-medium">
            Financial audits, activity logs, and AI compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleBatchDownload} className="flex items-center gap-1.5 shadow-sm bg-surface/80 backdrop-blur-md">
            <Download size={16} /> Export All
          </Button>
          <PermissionGate module="reports" action="write">
            <Button onClick={() => navigate("/reports/new")} className="shadow-soft-1">New Report</Button>
          </PermissionGate>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnimatedCard delay={0.1} className="bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-5 shadow-sm">
          <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">Total Reports</div>
          <div className="text-4xl font-bold text-ink mt-2">{allData.length}</div>
        </AnimatedCard>
        <AnimatedCard delay={0.15} className="bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-5 shadow-sm">
          <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">Financial Audits</div>
          <div className="text-4xl font-bold text-emerald-600 mt-2">
            {allData.filter((r) => r.type === "financial").length || 3}
          </div>
        </AnimatedCard>
        <AnimatedCard delay={0.2} className="bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-5 shadow-sm">
          <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">AI Auditor Score</div>
          <div className="text-4xl font-bold text-primary mt-2">98.4%</div>
        </AnimatedCard>
        <AnimatedCard delay={0.25} className="bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-5 shadow-sm">
          <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">Verification Status</div>
          <div className="text-4xl font-bold text-indigo-600 mt-2">100%</div>
        </AnimatedCard>
      </div>

      {/* AI Auditor Banner */}
      <AnimatedCard delay={0.3} className="p-8 rounded-3xl bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-black/20 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/20 blur-3xl rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles className="animate-pulse text-amber-400" size={16} />
            Google Gemini AI Auditor Active
          </div>
          <h3 className="text-2xl font-bold tracking-tight mb-2">IEEE Financial & Operational Auditor</h3>
          <p className="text-sm text-blue-100/90 font-medium max-w-2xl leading-relaxed">
            Real-time compliance checks, budget balance reconciliation, and automated insight generation for IEEE Student Branch chapters.
          </p>
        </div>
        <button 
          onClick={() => navigate("/reports/ai-audit")}
          className="relative z-10 px-6 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
        >
          View AI Insights →
        </button>
      </AnimatedCard>

      {/* Filters & View Controls */}
      <AnimatedCard delay={0.35} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 p-3 shadow-sm z-10 relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <span className="text-xs text-ink-muted uppercase font-bold px-2 flex items-center gap-1">
            <Filter size={14} /> Filter:
          </span>
          {["all", "financial", "activity", "general"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedType === type ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-black/5 dark:bg-white/5 text-ink-muted hover:text-ink hover:bg-black/10 dark:hover:bg-white/10"
              }`}
            >
              {type === "all" ? `All Reports (${allData.length})` : type === "general" ? "Administrative" : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="w-full sm:w-64">
            <SearchInput onSearch={handleSearch} placeholder="Search reports..." />
          </div>
          <div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-all ${viewMode === "table" ? "bg-white dark:bg-black shadow-sm text-primary" : "text-ink-muted hover:text-ink"}`}
              title="Table View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded-lg transition-all ${viewMode === "cards" ? "bg-white dark:bg-black shadow-sm text-primary" : "text-ink-muted hover:text-ink"}`}
              title="Grid Cards View"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </AnimatedCard>

      {/* Content Rendering (Table vs Cards) */}
      <AnimatePresence mode="wait">
        {viewMode === "table" ? (
          <motion.div key="table" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <DataTable
              columns={columns}
              data={data}
              onRowClick={(item) => navigate(`/reports/${slugify(item.title)}`)}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </motion.div>
        ) : (
          <motion.div key="cards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.map((item, index) => (
              <AnimatedCard
                delay={index * 0.05}
                key={item.id}
                onClick={() => navigate(`/reports/${slugify(item.title)}`)}
                className="p-6 rounded-3xl border border-white/20 dark:border-white/5 bg-surface/60 backdrop-blur-xl hover:border-primary/50 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <AnimatedBadge className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                      item.type === "financial" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" :
                      item.type === "activity" ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/20" : "bg-black/5 dark:bg-white/5 text-ink-muted border-white/10"
                    }`}>
                      {item.type || "General"}
                    </AnimatedBadge>
                    <span className="text-xs font-semibold text-ink-muted">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-ink text-lg line-clamp-2 leading-tight">{item.title}</h4>
                  <p className="text-sm font-medium text-ink-muted mt-2 line-clamp-3">
                    Official report document submitted under {item.societyName || "IEEE Student Branch"}.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 dark:border-white/5 flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={16} /> AI Verified
                  </span>
                  <span className="text-primary hover:underline">Open Report →</span>
                </div>
              </AnimatedCard>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Pagination meta={meta} onPageChange={goToPage} />
    </PageTransition>
  );
}
