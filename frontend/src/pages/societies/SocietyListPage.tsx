import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { societyService } from "@/services/societies";
import {
  DataTable,
  Pagination,
  SearchInput,
  Button,
  LoadingSpinner,
} from "@/components/ui";
import PermissionGate from "@/components/PermissionGate";
import { usePagination } from "@/hooks/usePagination";
import type { Society } from "@/types/models";
import type { PaginationMeta } from "@/types/api";

export default function SocietyListPage() {
  const [data, setData] = useState<Society[]>([]);
  const [allData, setAllData] = useState<Society[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  // Helper to extract acronyms (e.g. "Aerospace and Electronic Systems Society" -> "AESS")
  const getShortName = (name: string) => {
    // Exact overrides for known names
    const lower = name.toLowerCase();
    if (lower.includes("power electronics")) return "PELS";
    if (lower.includes("women")) return "WiE";
    if (lower.includes("sight")) return "SIGHT";

    // Remove "IEEE" from the start to prevent "I" prefix
    const strippedName = name.replace(/^IEEE\s+/i, "");

    // Basic heuristic: take first letter of capitalized words, ignoring 'and', 'of', etc.
    const words = strippedName.replace(/[^a-zA-Z ]/g, "").split(" ");
    const acronym = words
      .filter(
        (w) =>
          w.length > 0 &&
          w[0] === w[0].toUpperCase() &&
          !["And", "Of", "The"].includes(w),
      )
      .map((w) => w[0])
      .join("");
    return acronym || strippedName.substring(0, 3).toUpperCase();
  };

  const sortData = (list: Society[], key: string, dir: "asc" | "desc") => {
    return [...list].sort((a: any, b: any) => {
      let valA = a[key];
      let valB = b[key];

      if (key === "members") {
        valA = a.memberIds?.length || 0;
        valB = b.memberIds?.length || 0;
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
    societyService
      .getSocieties(page, limit)
      .then((res) => {
        const sorted = sortData(res.data.data, sortKey, sortDirection);
        setData(sorted);
        setAllData(res.data.data);
        setMeta(res.data.meta);
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to load societies"),
      )
      .finally(() => setLoading(false));
  }, [page, limit, sortKey, sortDirection]);

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
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
    );
    setData(sortData(filtered, sortKey, sortDirection));
  };

  const columns = [
    {
      key: "shortName",
      header: "",
      sortable: false,
      render: (item: Society) => (
        <div className="w-10 h-10 rounded-md bg-canvas-soft border border-hairline flex items-center justify-center font-bold text-body-sm text-ink-secondary tracking-tight">
          {getShortName(item.name)}
        </div>
      ),
    },
    { key: "name", header: "Name", sortable: true },
    {
      key: "description",
      header: "Description",
      sortable: true,
      render: (item: Society) => item.description || "—",
    },
    {
      key: "members",
      header: "Members",
      sortable: true,
      render: (item: Society) => String(item.memberIds?.length || 0),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (item: Society) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Societies</h1>
        <PermissionGate module="societies" action="write">
          <Button onClick={() => navigate("/societies/new")}>
            New Society
          </Button>
        </PermissionGate>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <div className="w-full sm:w-80">
          <SearchInput
            onSearch={handleSearch}
            placeholder="Search societies..."
          />
        </div>
        {/* Dropdown removed per user request; sorting is now in table headers */}
      </div>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(item) => navigate(`/societies/${item.id}`)}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
