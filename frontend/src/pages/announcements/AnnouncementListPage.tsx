import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { announcementService } from "@/services/announcements";
import { Pagination, Button, LoadingSpinner, SearchInput } from "@/components/ui";
import PermissionGate from "@/components/PermissionGate";
import { usePagination } from "@/hooks/usePagination";
import { slugify } from "@/utils/slug";
import type { Announcement } from "@/types/models";
import type { PaginationMeta } from "@/types/api";
import { Bell, AlertTriangle, Info, Pin, Filter, Calendar } from "lucide-react";
import { PageTransition, AnimatedCard, AnimatedBadge } from "@/components/ui/WatermelonMotion";

export default function AnnouncementListPage() {
  const [data, setData] = useState<Announcement[]>([]);
  const [allData, setAllData] = useState<Announcement[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    announcementService
      .getAnnouncements(page, limit)
      .then((res) => {
        setData(res.data.data);
        setAllData(res.data.data);
        setMeta(res.data.meta);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, limit]);

  useEffect(() => {
    if (selectedPriority === "all") {
      setData(allData);
    } else {
      setData(allData.filter((a) => a.priority === selectedPriority));
    }
  }, [selectedPriority, allData]);

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setData(selectedPriority === "all" ? allData : allData.filter((a) => a.priority === selectedPriority));
      return;
    }
    const q = query.toLowerCase();
    const filtered = allData.filter(
      (a) =>
        (selectedPriority === "all" || a.priority === selectedPriority) &&
        (a.title.toLowerCase().includes(q) || (a.content || "").toLowerCase().includes(q)),
    );
    setData(filtered);
  };

  if (loading) return <LoadingSpinner />;

  const highPriorityCount = allData.filter(a => a.priority === 'high').length;

  return (
    <PageTransition className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-bold text-ink">Campus & IEEE Announcements</h1>
          <p className="text-body-sm text-ink-muted mt-0.5">
            Official broadcasts, event updates, deadlines, and IEEE Student Branch bulletins.
          </p>
        </div>
        <PermissionGate module="announcements" action="write">
          <Button onClick={() => navigate("/announcements/new")} className="flex items-center gap-1.5">
            <Bell size={16} /> New Announcement
          </Button>
        </PermissionGate>
      </div>

      {/* High priority alert banner if any */}
      {highPriorityCount > 0 && (
        <AnimatedCard className="p-4 rounded-2xl bg-red-500/10 backdrop-blur-xl border border-red-500/20 flex items-start gap-3 text-red-600 shadow-lg shadow-red-500/5">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div className="flex-1 text-body-sm text-red-700 dark:text-red-400">
            <span className="font-bold">Attention: {highPriorityCount} Urgent Broadcast(s)</span>
            <p className="opacity-90 text-body-xs mt-0.5">
              Please review high-priority notices regarding upcoming deadlines and mandatory branch activities.
            </p>
          </div>
        </AnimatedCard>
      )}

      {/* Filter Tabs & Search Bar */}
      <AnimatedCard className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-3 shadow-lg">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-body-xs text-ink-muted uppercase font-bold px-2 flex items-center gap-1">
            <Filter size={12} /> Priority:
          </span>
          <button
            onClick={() => setSelectedPriority("all")}
            className={`px-4 py-2 rounded-xl text-body-xs font-semibold transition-all duration-300 ${
              selectedPriority === "all" ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-surface/50 text-ink-muted hover:text-ink hover:bg-surface border border-transparent hover:border-white/10"
            }`}
          >
            All ({allData.length})
          </button>
          <button
            onClick={() => setSelectedPriority("high")}
            className={`px-4 py-2 rounded-xl text-body-xs font-semibold transition-all duration-300 ${
              selectedPriority === "high" ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "bg-surface/50 text-ink-muted hover:text-ink hover:bg-surface border border-transparent hover:border-white/10"
            }`}
          >
            Urgent ({allData.filter(a => a.priority === 'high').length})
          </button>
          <button
            onClick={() => setSelectedPriority("medium")}
            className={`px-4 py-2 rounded-xl text-body-xs font-semibold transition-all duration-300 ${
              selectedPriority === "medium" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "bg-surface/50 text-ink-muted hover:text-ink hover:bg-surface border border-transparent hover:border-white/10"
            }`}
          >
            Important ({allData.filter(a => a.priority === 'medium').length})
          </button>
          <button
            onClick={() => setSelectedPriority("low")}
            className={`px-4 py-2 rounded-xl text-body-xs font-semibold transition-all duration-300 ${
              selectedPriority === "low" ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" : "bg-surface/50 text-ink-muted hover:text-ink hover:bg-surface border border-transparent hover:border-white/10"
            }`}
          >
            General ({allData.filter(a => a.priority === 'low').length})
          </button>
        </div>

        <div className="w-full sm:w-72">
          <SearchInput onSearch={handleSearch} placeholder="Search announcements..." />
        </div>
      </AnimatedCard>

      {/* List of Announcement Cards */}
      <div className="space-y-4">
        {data.length === 0 ? (
          <AnimatedCard className="p-12 text-center bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl text-ink-muted space-y-3">
            <Info size={36} className="mx-auto text-ink-muted opacity-50" />
            <p className="font-semibold text-ink text-body-md">No announcements found matching filter criteria.</p>
          </AnimatedCard>
        ) : (
          data.map((a, index) => (
            <AnimatedCard
              key={a.id}
              onClick={() => navigate(`/announcements/${slugify(a.title)}`)}
              className="group bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-6 hover:border-primary/50 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl space-y-4"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {a.priority === "high" && <div className="p-2 bg-red-500/10 rounded-xl"><Pin className="text-red-500 fill-red-500" size={18} /></div>}
                  <h3 className="text-heading-3 font-bold text-ink group-hover:text-primary transition-colors">
                    {a.title}
                  </h3>
                </div>

                <AnimatedBadge
                  variant={
                    a.priority === "high"
                      ? "danger"
                      : a.priority === "medium"
                        ? "warning"
                        : "default"
                  }
                  className="shrink-0"
                >
                  {a.priority === "high" ? "Urgent Broadcast" : a.priority === "medium" ? "Important Notice" : "General"}
                </AnimatedBadge>
              </div>

              <div
                className="text-body-sm text-ink-secondary leading-relaxed line-clamp-2 opacity-90"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    (a.content || (a as any).message || "")
                  ),
                }}
              />

              <div className="pt-4 border-t border-white/10 dark:border-white/5 flex items-center justify-between text-body-xs text-ink-muted">
                <div className="flex items-center gap-2 bg-surface/50 px-3 py-1.5 rounded-lg border border-white/5">
                  <Calendar size={14} className="text-primary" />
                  <span className="font-medium">Posted {new Date(a.createdAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <span className="font-semibold text-primary group-hover:translate-x-1 transition-transform inline-block">Read Full Notice →</span>
              </div>
            </AnimatedCard>
          ))
        )}
      </div>

      <Pagination meta={meta} onPageChange={goToPage} />
    </PageTransition>
  );
}
