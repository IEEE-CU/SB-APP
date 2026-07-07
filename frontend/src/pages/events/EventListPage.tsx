import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventService } from '@/services/events';
import { DataTable, Pagination, SearchInput, Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { usePagination } from '@/hooks/usePagination';
import type { Event } from '@/types/models';
import type { PaginationMeta } from '@/types/api';

export default function EventListPage() {
  const [data, setData] = useState<Event[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const { page, limit, goToPage } = usePagination();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    eventService.getEvents(page, limit).then((res) => {
      setData(res.data.data);
      setMeta(res.data.meta);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, limit]);

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'status', header: 'Status', render: (item: Event) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-eyebrow ${
        item.status === 'upcoming' ? 'bg-primary/10 text-primary' :
        item.status === 'completed' ? 'bg-accent-green/10 text-accent-green' :
        item.status === 'cancelled' ? 'bg-red-100 text-red-600' :
        'bg-accent-orange/10 text-accent-orange'
      }`}>{item.status}</span>
    )},
    { key: 'date', header: 'Date', render: (item: Event) => item.date ? new Date(item.date).toLocaleDateString() : '—' },
    { key: 'location', header: 'Location', render: (item: Event) => item.location || '—' },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">Events</h1>
        <PermissionGate module="events" action="write">
          <Button onClick={() => navigate('/events/new')}>New Event</Button>
        </PermissionGate>
      </div>
      <div className="mb-4 max-w-xs">
        <SearchInput onSearch={() => {}} placeholder="Search events..." />
      </div>
      <DataTable columns={columns} data={data} onRowClick={(item) => navigate(`/events/${item.id}`)} />
      <Pagination meta={meta} onPageChange={goToPage} />
    </div>
  );
}
