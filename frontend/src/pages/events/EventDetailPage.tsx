import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventService } from '@/services/events';
import { Button, LoadingSpinner } from '@/components/ui';
import { PageTransition, AnimatedCard, AnimatedBadge } from '@/components/ui/WatermelonMotion';
import PermissionGate from '@/components/PermissionGate';
import { ArrowLeft, Calendar, MapPin, Users, CheckCircle } from 'lucide-react';
import { slugify } from '@/utils/slug';
import type { Event } from '@/types/models';
import toast from 'react-hot-toast';

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    eventService
      .getEvents(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (e) => e.id === slug || slugify(e.title) === slug || e.slug === slug,
        );
        if (found) {
          return eventService.getEvent(found.id).then((r) => {
            const ev = r.data.data;
            setEvent(ev);
            setRsvpCount(ev.rsvpCount ?? 0);
          });
        } else {
          return eventService.getEvent(slug).then((r) => {
            const ev = r.data.data;
            setEvent(ev);
            setRsvpCount(ev.rsvpCount ?? 0);
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const toggleRsvp = () => {
    if (isRegistered) {
      setIsRegistered(false);
      setRsvpCount((prev) => Math.max(0, prev - 1));
      toast.success('Registration cancelled');
    } else {
      setIsRegistered(true);
      setRsvpCount((prev) => prev + 1);
      toast.success('Registered for event successfully!');
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      await eventService.deleteEvent(event.id);
      toast.success('Event deleted');
      navigate('/events');
    } catch {
      toast.error('Failed to delete event');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!event) return <div className="p-8 text-body-sm text-ink-muted">Event not found</div>;

  return (
    <PageTransition>
      <div className="space-y-6 max-w-4xl">
        <button onClick={() => navigate('/events')} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft size={16} /> Back to Events
        </button>

        {/* Header card */}
        <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AnimatedBadge className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${
                  event.status === 'upcoming' ? 'bg-primary/10 text-primary border-primary/10' :
                  event.status === 'ongoing' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20' :
                  event.status === 'completed' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' : 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/20'
                }`}>
                  {event.status}
                </AnimatedBadge>
                {event.societyName && (
                  <span className="text-body-xs font-semibold text-ink-muted bg-canvas-soft px-2.5 py-0.5 rounded-full border border-white/20 dark:border-white/5">
                    {event.societyName}
                  </span>
                )}
              </div>
              <h1 className="text-heading-1 font-bold text-ink">{event.title}</h1>
            </div>

            <div className="flex items-center gap-3">
              <PermissionGate module="events" action="write">
                <Button variant="secondary" onClick={() => navigate(`/events/${event.slug || slugify(event.title)}/edit`)}>
                  Edit Event
                </Button>
              </PermissionGate>
              <PermissionGate module="events" action="delete">
                <Button variant="danger" onClick={handleDelete}>
                  Delete
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Quick Details Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/20 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <Calendar size={18} />
              </div>
              <div>
                <div className="text-eyebrow text-ink-muted uppercase">Date & Time</div>
                <div className="text-body-sm font-semibold text-ink">
                  {event.date ? new Date(event.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                <MapPin size={18} />
              </div>
              <div>
                <div className="text-eyebrow text-ink-muted uppercase">Venue</div>
                <div className="text-body-sm font-semibold text-ink">{event.location || 'Central Campus Auditorium'}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-700 dark:text-indigo-400">
                <Users size={18} />
              </div>
              <div>
                <div className="text-eyebrow text-ink-muted uppercase">RSVP Count</div>
                <div className="text-body-sm font-semibold text-ink">{rsvpCount} / {event.capacity || 100} Registered</div>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Main content grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-6">
              <h3 className="text-heading-3 font-bold text-ink mb-3">About This Event</h3>
              <p className="text-body-md text-ink leading-relaxed whitespace-pre-line">
                {event.description || 'Join us for this IEEE flagship event featuring expert domain sessions, hands-on activities, and interactive discussions.'}
              </p>
            </AnimatedCard>

            {/* Speakers section */}
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-6">
              <h3 className="text-heading-3 font-bold text-ink mb-4">Event Speakers & Mentors</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(event.speakers && event.speakers.length > 0 ? event.speakers : [
                  { name: 'Dr. A. Sharma', role: 'IEEE Senior Member', organization: 'Christ University' },
                  { name: 'Er. Rajesh V.', role: 'Industry Specialist', organization: 'Tech Innovation Lab' }
                ]).map((sp, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-white/20 dark:border-white/5 bg-canvas-soft/50 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                      {sp.name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-ink text-body-md">{sp.name}</div>
                      <div className="text-body-sm text-primary font-medium">{sp.role}</div>
                      <div className="text-body-xs text-ink-muted mt-0.5">{sp.organization}</div>
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedCard>
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-heading-3 font-bold text-ink">Registration</h3>
              <p className="text-body-sm text-ink-muted">Reserve your seat for this session. Entry is open to all Christ University students.</p>

              <Button
                variant={isRegistered ? 'secondary' : 'primary'}
                className="w-full justify-center py-2.5"
                onClick={toggleRsvp}
              >
                {isRegistered ? (
                  <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle size={18} /> Registered</span>
                ) : (
                  'Register Now'
                )}
              </Button>

              <div className="pt-3 border-t border-white/20 dark:border-white/5 text-body-xs text-ink-muted space-y-1.5">
                <div className="flex justify-between">
                  <span>Pass Type:</span>
                  <span className="font-semibold text-ink">Free Student Pass</span>
                </div>
                <div className="flex justify-between">
                  <span>Certificate:</span>
                  <span className="font-semibold text-ink">IEEE E-Certificate</span>
                </div>
              </div>
            </AnimatedCard>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
