import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '@/services/reports';
import { DataTable, Pagination, SearchInput, Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { usePagination } from '@/hooks/usePagination';
import type { Report } from '@/types/models';
import type { PaginationMeta } from '@/types/api';

export default function ReportListPage() {
  const [data, setData] = useState<Report[]>([]);
  const [allData, setAllData] = useState<Report[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    reportService.getReports(page, limit).then((res) => { setData(res.data.data); setAllData(res.data.data); setMeta(res.data.meta); }).catch(() => {}).finally(() => setLoading(false));
  }, [page, limit]);

  const handleSearch = (query: string) => {
    if (!query.trim()) { setData(allData); return; }
    const q = query.toLowerCase();
    setData(allData.filter((r) => r.title.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q)));
  };

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Type', render: (item: Report) => item.type ? <span className="capitalize">{item.type}</span> : '—' },
    { key: 'createdAt', header: 'Created', render: (item: Report) => new Date(item.createdAt).toLocaleDateString() },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Reports</h1>
        <PermissionGate module="reports" action="write"><Button onClick={() => navigate('/reports/new')}>New Report</Button></PermissionGate>
      </div>
      <div className="mb-4 max-w-xs">        <SearchInput onSearch={handleSearch} placeholder="Search reports..." /></div>
      <DataTable columns={columns} data={data} onRowClick={(item) => navigate(`/reports/${item.id}`)} />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
