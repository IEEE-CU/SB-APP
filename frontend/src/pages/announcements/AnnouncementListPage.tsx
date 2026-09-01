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
    <div className="space-y-6">
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
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-900 shadow-xs">
          <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div className="flex-1 text-body-sm">
            <span className="font-bold">Attention: {highPriorityCount} Urgent Broadcast(s)</span>
            <p className="text-red-700 text-body-xs mt-0.5">
              Please review high-priority notices regarding upcoming deadlines and mandatory branch activities.
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-xl border border-hairline p-3 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-body-xs text-ink-muted uppercase font-bold px-2 flex items-center gap-1">
            <Filter size={12} /> Priority:
          </span>
          <button
            onClick={() => setSelectedPriority("all")}
            className={`px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-colors ${
              selectedPriority === "all" ? "bg-primary text-white" : "bg-canvas-soft text-ink-muted hover:text-ink"
            }`}
          >
            All ({allData.length})
          </button>
          <button
            onClick={() => setSelectedPriority("high")}
            className={`px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-colors ${
              selectedPriority === "high" ? "bg-red-600 text-white" : "bg-canvas-soft text-ink-muted hover:text-ink"
            }`}
          >
            Urgent ({allData.filter(a => a.priority === 'high').length})
          </button>
          <button
            onClick={() => setSelectedPriority("medium")}
            className={`px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-colors ${
              selectedPriority === "medium" ? "bg-amber-600 text-white" : "bg-canvas-soft text-ink-muted hover:text-ink"
            }`}
          >
            Important ({allData.filter(a => a.priority === 'medium').length})
          </button>
          <button
            onClick={() => setSelectedPriority("low")}
            className={`px-3 py-1.5 rounded-lg text-body-xs font-semibold transition-colors ${
              selectedPriority === "low" ? "bg-indigo-600 text-white" : "bg-canvas-soft text-ink-muted hover:text-ink"
            }`}
          >
            General ({allData.filter(a => a.priority === 'low').length})
          </button>
        </div>

        <div className="w-full sm:w-72">
          <SearchInput onSearch={handleSearch} placeholder="Search announcements..." />
        </div>
      </div>

      {/* List of Announcement Cards */}
      <div className="space-y-4">
        {data.length === 0 ? (
          <div className="p-12 text-center bg-surface rounded-xl border border-hairline text-ink-muted space-y-2">
            <Info size={32} className="mx-auto text-ink-muted opacity-50" />
            <p className="font-semibold text-ink">No announcements found matching filter criteria.</p>
          </div>
        ) : (
          data.map((a) => (
            <div
              key={a.id}
              onClick={() => navigate(`/announcements/${slugify(a.title)}`)}
              className="bg-surface rounded-xl border border-hairline p-6 hover:border-primary cursor-pointer transition-all shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  {a.priority === "high" && <Pin className="text-red-500 fill-red-500" size={16} />}
                  <h3 className="text-heading-3 font-bold text-ink hover:text-primary transition-colors">
                    {a.title}
                  </h3>
                </div>

                <span
                  className={`inline-flex px-3 py-0.5 rounded-full text-eyebrow font-bold uppercase shrink-0 ${
                    a.priority === "high"
                      ? "bg-red-100 text-red-700 border border-red-200"
                      : a.priority === "medium"
                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : "bg-canvas-soft text-ink-muted border border-hairline"
                  }`}
                >
                  {a.priority === "high" ? "Urgent Broadcast" : a.priority === "medium" ? "Important Notice" : "General"}
                </span>
              </div>

              <div
                className="text-body-sm text-ink-secondary leading-relaxed line-clamp-2"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    (a.content || (a as any).message || "")
                  ),
                }}
              />

              <div className="pt-3 border-t border-hairline flex items-center justify-between text-body-xs text-ink-muted">
                <div className="flex items-center gap-2">
                  <Calendar size={14} />
                  <span>Posted {new Date(a.createdAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <span className="font-semibold text-primary hover:underline">Read Full Notice →</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
