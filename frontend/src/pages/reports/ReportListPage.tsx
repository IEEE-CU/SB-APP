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
        <h1 className="text-heading-1 font-bold text-ink">Reports & Audit Log</h1>
        <PermissionGate module="reports" action="write">
          <Button onClick={() => navigate("/reports/new")}>New Report</Button>
        </PermissionGate>
      </div>

      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            Google Gemini AI Auditor Integrated
          </div>
          <h3 className="text-xl font-bold">IEEE Financial & Operational Auditor</h3>
          <p className="text-body-sm text-blue-100 mt-1 max-w-xl">
            Automated compliance checks, budget balance audits, and operational insights for Christ University IEEE Student Branch.
          </p>
        </div>
        <Button 
          variant="secondary"
          onClick={() => navigate("/reports/ai-audit")}
          className="bg-white text-blue-900 hover:bg-blue-50 border-none font-bold shadow-md whitespace-nowrap"
        >
          View AI Insights
        </Button>
      </div>

      <div className="mb-4 max-w-xs">
        <SearchInput onSearch={handleSearch} placeholder="Search reports..." />
      </div>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(item) => navigate(`/reports/${slugify(item.title)}`)}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
