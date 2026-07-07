import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { societyService } from '@/services/societies';
import { DataTable, Pagination, SearchInput, Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { usePagination } from '@/hooks/usePagination';
import type { Society } from '@/types/models';
import type { PaginationMeta } from '@/types/api';

export default function SocietyListPage() {
  const [data, setData] = useState<Society[]>([]);
  const [allData, setAllData] = useState<Society[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    societyService.getSocieties(page, limit).then((res) => {
      setData(res.data.data);
      setAllData(res.data.data);
      setMeta(res.data.meta);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, limit]);

  const handleSearch = (query: string) => {
    if (!query.trim()) { setData(allData); return; }
    const q = query.toLowerCase();
    setData(allData.filter((s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)));
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description', render: (item: Society) => item.description || '—' },
    { key: 'memberIds', header: 'Members', render: (item: Society) => String(item.memberIds?.length || 0) },
    { key: 'createdAt', header: 'Created', render: (item: Society) => new Date(item.createdAt).toLocaleDateString() },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Societies</h1>
        <PermissionGate module="societies" action="write">
          <Button onClick={() => navigate('/societies/new')}>New Society</Button>
        </PermissionGate>
      </div>
      <div className="mb-4 max-w-xs">
        <SearchInput onSearch={handleSearch} placeholder="Search societies..." />
      </div>
      <DataTable columns={columns} data={data} onRowClick={(item) => navigate(`/societies/${item.id}`)} />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
