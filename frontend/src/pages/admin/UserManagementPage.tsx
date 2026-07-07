import { useEffect, useState } from 'react';
import { userService } from '@/services/users';
import { DataTable, Pagination, SearchInput, LoadingSpinner } from '@/components/ui';
import { usePagination } from '@/hooks/usePagination';
import type { User } from '@/types/models';
import type { PaginationMeta } from '@/types/api';

export default function UserManagementPage() {
  const [data, setData] = useState<User[]>([]);
  const [allData, setAllData] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const { page, limit, goToPage } = usePagination();

  useEffect(() => {
    setLoading(true);
    userService.getUsers(page, limit).then((res) => { setData(res.data.data); setAllData(res.data.data); setMeta(res.data.meta); }).catch(() => {}).finally(() => setLoading(false));
  }, [page, limit]);

  const handleSearch = (query: string) => {
    if (!query.trim()) { setData(allData); return; }
    const q = query.toLowerCase();
    setData(allData.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'isActive', header: 'Status', render: (item: User) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-eyebrow ${item.isActive ? 'bg-accent-green/10 text-accent-green' : 'bg-red-100 text-red-600'}`}>
        {item.isActive ? 'Active' : 'Inactive'}
      </span>
    )},
    { key: 'createdAt', header: 'Joined', render: (item: User) => new Date(item.createdAt).toLocaleDateString() },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-ink mb-6">User Management</h1>
      <div className="mb-4 max-w-xs"><SearchInput onSearch={handleSearch} placeholder="Search users..." /></div>
      <DataTable columns={columns} data={data} />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
