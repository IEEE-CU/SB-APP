import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { projectService } from "@/services/projects";
import {
  DataTable,
  Pagination,
  SearchInput,
  Button,
  LoadingSpinner,
} from "@/components/ui";
import PermissionGate from "@/components/PermissionGate";
import { usePagination } from "@/hooks/usePagination";
import type { Project } from "@/types/models";
import type { PaginationMeta } from "@/types/api";

export default function ProjectListPage() {
  const [data, setData] = useState<Project[]>([]);
  const [allData, setAllData] = useState<Project[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortKey, setSortKey] = useState<string>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  const sortData = (list: Project[], key: string, dir: "asc" | "desc") => {
    return [...list].sort((a: any, b: any) => {
      let valA = a[key];
      let valB = b[key];

      if (key === "memberIds") {
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
    projectService
      .getProjects(page, limit)
      .then((res) => {
        const sorted = sortData(res.data.data, sortKey, sortDirection);
        setData(sorted);
        setAllData(res.data.data);
        setMeta(res.data.meta);
      })
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to load projects"),
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
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
    setData(sortData(filtered, sortKey, sortDirection));
  };

  const columns = [
    { key: "title", header: "Title", sortable: true },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (item: Project) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-eyebrow ${
            item.status === "active"
              ? "bg-accent-green/10 text-accent-green"
              : item.status === "completed"
                ? "bg-primary/10 text-primary"
                : item.status === "on_hold"
                  ? "bg-accent-orange/10 text-accent-orange"
                  : "bg-canvas-soft text-ink-muted"
          }`}
        >
          {item.status.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "memberIds",
      header: "Members",
      sortable: true,
      render: (item: Project) => String(item.memberIds?.length || 0),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Projects</h1>
        <PermissionGate module="projects" action="write">
          <Button onClick={() => navigate("/projects/new")}>New Project</Button>
        </PermissionGate>
      </div>
      <div className="mb-4 max-w-xs">
        <SearchInput onSearch={handleSearch} placeholder="Search projects..." />
      </div>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(item) => navigate(`/projects/${item.id}`)}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
