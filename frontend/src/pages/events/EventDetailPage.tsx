import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventService } from '@/services/events';
import { Button, LoadingSpinner } from '@/components/ui';
import PermissionGate from '@/components/PermissionGate';
import { ArrowLeft } from 'lucide-react';
import type { Event } from '@/types/models';
import toast from 'react-hot-toast';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    eventService.getEvent(id).then((res) => {
      setEvent(res.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await eventService.deleteEvent(id);
      toast.success('Event deleted');
      navigate('/events');
    } catch {
      toast.error('Failed to delete event');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!event) return <div className="text-body-sm text-ink-muted">Event not found</div>;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-heading-1 font-bold text-ink">{event.title}</h1>
        <div className="flex gap-2">
          <PermissionGate module="events" action="write">
            <Button variant="secondary" onClick={() => navigate(`/events/${id}/edit`)}>Edit</Button>
          </PermissionGate>
          <PermissionGate module="events" action="delete">
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </PermissionGate>
        </div>
      </div>
      <div className="bg-surface rounded-lg border border-hairline p-6 max-w-2xl space-y-4">
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Status</label>
          <p className="text-body-md text-ink mt-1 capitalize">{event.status}</p>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Description</label>
          <p className="text-body-md text-ink mt-1">{event.description || 'No description'}</p>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Date</label>
          <p className="text-body-md text-ink mt-1">{event.date ? new Date(event.date).toLocaleDateString() : 'TBD'}</p>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">Location</label>
          <p className="text-body-md text-ink mt-1">{event.location || 'TBD'}</p>
        </div>
      </div>
    </div>
  );
}
