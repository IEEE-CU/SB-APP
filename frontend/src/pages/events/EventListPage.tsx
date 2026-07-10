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
import type { Event } from "@/types/models";
import type { PaginationMeta } from "@/types/api";

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
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-eyebrow ${
            item.status === "upcoming"
              ? "bg-primary/10 text-primary"
              : item.status === "completed"
                ? "bg-accent-green/10 text-accent-green"
                : item.status === "cancelled"
                  ? "bg-red-100 text-red-600"
                  : "bg-accent-orange/10 text-accent-orange"
          }`}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      render: (item: Event) =>
        item.date ? new Date(item.date).toLocaleDateString() : "—",
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Events</h1>
        <PermissionGate module="events" action="write">
          <Button onClick={() => navigate("/events/new")}>New Event</Button>
        </PermissionGate>
      </div>
      <div className="mb-4 max-w-xs">
        <SearchInput onSearch={handleSearch} placeholder="Search events..." />
      </div>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(item) => navigate(`/events/${item.id}`)}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
