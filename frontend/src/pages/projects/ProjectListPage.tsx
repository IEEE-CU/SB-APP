import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { slugify } from "@/utils/slug";
import type { Project } from "@/types/models";
import type { PaginationMeta } from "@/types/api";
import { PageTransition, AnimatedBadge } from "@/components/ui/WatermelonMotion";
import toast from "react-hot-toast";

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
      .catch(() => toast.error("Failed to load projects"))
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
        <AnimatedBadge
          className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
            item.status === "active"
              ? "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20"
              : item.status === "completed"
                ? "bg-primary/20 text-primary dark:text-blue-400 border border-primary/20"
                : item.status === "on_hold"
                  ? "bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/20"
                  : "bg-white/20 text-ink-muted border border-white/10"
          }`}
        >
          {item.status.replace("_", " ")}
        </AnimatedBadge>
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
    <PageTransition className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink mb-1">Projects</h1>
          <p className="text-ink-muted text-sm font-medium">Track and manage collaborative initiatives</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-full sm:w-72">
            <SearchInput onSearch={handleSearch} placeholder="Search projects..." />
          </div>
          <PermissionGate module="projects" action="write">
            <Button onClick={() => navigate("/projects/new")} className="shadow-soft-1">New Project</Button>
          </PermissionGate>
        </div>
      </div>
      
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(item) => navigate(`/projects/${slugify(item.title)}`)}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      <Pagination meta={meta} onPageChange={goToPage} />
    </PageTransition>
  );
}
