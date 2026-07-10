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
import type { Report } from "@/types/models";
import type { PaginationMeta } from "@/types/api";

export default function ReportListPage() {
  const [data, setData] = useState<Report[]>([]);
  const [allData, setAllData] = useState<Report[]>([]);
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
    setData((prev) => sortData(prev, sortKey, sortDirection));
  }, [sortKey, sortDirection]);

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setData(sortData(allData, sortKey, sortDirection));
      return;
    }
    const q = query.toLowerCase();
    const filtered = allData.filter(
      (r) =>
        r.title.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q),
    );
    setData(sortData(filtered, sortKey, sortDirection));
  };

  const columns = [
    { key: "title", header: "Title", sortable: true },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (item: Report) =>
        item.type ? <span className="capitalize">{item.type}</span> : "—",
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (item: Report) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Reports</h1>
        <PermissionGate module="reports" action="write">
          <Button onClick={() => navigate("/reports/new")}>New Report</Button>
        </PermissionGate>
      </div>
      <div className="mb-4 max-w-xs">
        <SearchInput onSearch={handleSearch} placeholder="Search reports..." />
      </div>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(item) => navigate(`/reports/${item.id}`)}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
