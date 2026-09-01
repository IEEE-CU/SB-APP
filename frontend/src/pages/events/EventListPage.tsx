import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { eventService } from "@/services/events";
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
import type { Event } from "@/types/models";
import type { PaginationMeta } from "@/types/api";
import { PageTransition, AnimatedBadge } from "@/components/ui/WatermelonMotion";

export default function EventListPage() {
  const [data, setData] = useState<Event[]>([]);
  const [allData, setAllData] = useState<Event[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  const sortData = (list: Event[], key: string, dir: "asc" | "desc") => {
    return [...list].sort((a: any, b: any) => {
      let valA = a[key];
      let valB = b[key];

      if (key === "date") {
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
    eventService
      .getEvents(page, limit)
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
    setData((prev) => sortData(prev, sortKey, sortDirection));
  }, [sortKey, sortDirection]);

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setData(sortData(allData, sortKey, sortDirection));
      return;
    }
    const q = query.toLowerCase();
    const filtered = allData.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q),
    );
    setData(sortData(filtered, sortKey, sortDirection));
  };

  const columns = [
    { key: "title", header: "Title", sortable: true },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (item: Event) => (
        <AnimatedBadge
          className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
            item.status === "upcoming"
              ? "bg-primary/20 text-primary dark:text-blue-400 border border-primary/20"
              : item.status === "completed"
                ? "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20"
                : item.status === "cancelled"
                  ? "bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/20"
                  : "bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/20"
          }`}
        >
          {item.status}
        </AnimatedBadge>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (item: Event) =>
        item.date ? new Date(item.date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "—",
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      render: (item: Event) => item.location || "—",
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <PageTransition className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mb-1">Events</h1>
          <p className="text-ink-muted text-sm font-medium">Manage and discover branch activities</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-full sm:w-72">
            <SearchInput onSearch={handleSearch} placeholder="Search events..." />
          </div>
          <PermissionGate module="events" action="write">
            <Button onClick={() => navigate("/events/new")} className="shadow-soft-1">New Event</Button>
          </PermissionGate>
        </div>
      </div>
      
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(item) => navigate(`/events/${slugify(item.title)}`)}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      <Pagination meta={meta} onPageChange={goToPage} />
    </PageTransition>
  );
}
