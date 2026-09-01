import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { userService } from "@/services/users";
import {
  DataTable,
  Pagination,
  SearchInput,
  LoadingSpinner,
} from "@/components/ui";
import { PageTransition, AnimatedCard, AnimatedBadge } from "@/components/ui/WatermelonMotion";
import { usePagination } from "@/hooks/usePagination";
import type { User } from "@/types/models";
import type { PaginationMeta } from "@/types/api";

export default function UserManagementPage() {
  const [data, setData] = useState<User[]>([]);
  const [allData, setAllData] = useState<User[]>([]);
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
    userService
      .getUsers(page, limit)
      .then((res) => {
        setData(res.data.data);
        setAllData(res.data.data);
        setMeta(res.data.meta);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, limit]);

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setData(allData);
      return;
    }
    const q = query.toLowerCase();
    setData(
      allData.filter(
        (u) =>
          u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      ),
    );
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (item: User) => (
        <Link
          to={`/admin/users/${item.id}`}
          className="text-primary hover:underline font-medium"
        >
          {item.name}
        </Link>
      ),
    },
    { key: "email", header: "Email" },
    {
      key: "isActive",
      header: "Status",
      render: (item: User) => (
        <AnimatedBadge variant={item.isActive ? "success" : "danger"}>
          {item.isActive ? "Active" : "Inactive"}
        </AnimatedBadge>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (item: User) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <PageTransition>
      <h1 className="text-heading-1 font-bold text-ink mb-6">
        User Management
      </h1>
      <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-3xl p-6 shadow-2xl">
        <div className="mb-6 max-w-sm">
          <SearchInput onSearch={handleSearch} placeholder="Search users..." />
        </div>
        <div className="rounded-2xl overflow-hidden border border-white/10 dark:border-white/5">
          <DataTable
            columns={columns}
            data={data}
            onRowClick={(item: User) => navigate(`/admin/users/${item.id}`)}
          />
        </div>
        <div className="mt-6">
          <Pagination meta={meta} onPageChange={goToPage} />
        </div>
      </AnimatedCard>
    </PageTransition>
  );
}
