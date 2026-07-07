import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '@/services/projects';
import { DataTable, Pagination, SearchInput, Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { usePagination } from '@/hooks/usePagination';
import type { Project } from '@/types/models';
import type { PaginationMeta } from '@/types/api';

export default function ProjectListPage() {
  const [data, setData] = useState<Project[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    projectService.getProjects(page, limit).then((res) => {
      setData(res.data.data);
      setMeta(res.data.meta);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, limit]);

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'status', header: 'Status', render: (item: Project) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-eyebrow ${
        item.status === 'active' ? 'bg-accent-green/10 text-accent-green' :
        item.status === 'completed' ? 'bg-primary/10 text-primary' :
        item.status === 'on_hold' ? 'bg-accent-orange/10 text-accent-orange' :
        'bg-canvas-soft text-ink-muted'
      }`}>{item.status.replace('_', ' ')}</span>
    )},
    { key: 'memberIds', header: 'Members', render: (item: Project) => String(item.memberIds?.length || 0) },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Projects</h1>
        <PermissionGate module="projects" action="write">
          <Button onClick={() => navigate('/projects/new')}>New Project</Button>
        </PermissionGate>
      </div>
      <div className="mb-4 max-w-xs"><SearchInput onSearch={() => {}} placeholder="Search projects..." /></div>
      <DataTable columns={columns} data={data} onRowClick={(item) => navigate(`/projects/${item.id}`)} />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
