import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { announcementService } from '@/services/announcements';
import { Pagination, Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { usePagination } from '@/hooks/usePagination';
import type { Announcement } from '@/types/models';
import type { PaginationMeta } from '@/types/api';

export default function AnnouncementListPage() {
  const [data, setData] = useState<Announcement[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    announcementService.getAnnouncements(page, limit).then((res) => { setData(res.data.data); setMeta(res.data.meta); }).catch(() => {}).finally(() => setLoading(false));
  }, [page, limit]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Announcements</h1>
        <PermissionGate module="announcements" action="write"><Button onClick={() => navigate('/announcements/new')}>New Announcement</Button></PermissionGate>
      </div>
      <div className="space-y-4">
        {data.length === 0 && <p className="text-body-sm text-ink-muted text-center py-8">No announcements yet</p>}
        {data.map((a) => (
          <div key={a.id} className="bg-surface rounded-lg border border-hairline p-5 hover:shadow-soft-1 transition-shadow cursor-pointer" onClick={() => navigate(`/announcements/${a.id}`)}>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-title font-semibold text-ink">{a.title}</h3>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-eyebrow ${
                a.priority === 'high' ? 'bg-red-100 text-red-600' : a.priority === 'medium' ? 'bg-accent-orange/10 text-accent-orange' : 'bg-canvas-soft text-ink-muted'
              }`}>{a.priority}</span>
            </div>
            <div className="text-body-sm text-ink-secondary" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(a.content.slice(0, 200) + (a.content.length > 200 ? '...' : '')) }} />
            <p className="text-caption text-ink-faint mt-2">{new Date(a.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
