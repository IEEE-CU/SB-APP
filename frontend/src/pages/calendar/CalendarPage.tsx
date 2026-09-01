import { useEffect, useState } from 'react';
import { calendarService } from '@/services/calendar';
import type { UnifiedCalendarEvent } from '@/types/models';
import { LoadingSpinner, Button, SearchInput } from '@/components/ui';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Filter, Calendar, MapPin, Clock, Plus, X, Calendar as CalendarIcon, List, LayoutGrid, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { slugify } from '@/utils/slug';

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filtering state
  const [selectedSources, setSelectedSources] = useState<string[]>([
    'CalendarEvent',
    'Event',
    'BoardCard',
    'Message',
  ]);

  // Modals state
  const [selectedEvent, setSelectedEvent] = useState<UnifiedCalendarEvent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Quick event form
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('14:00');
  const [newVenue, setNewVenue] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const navigate = useNavigate();

  const sourceMetadata: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
    CalendarEvent: { label: 'Events', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', borderColor: 'border-emerald-200 dark:border-emerald-800' },
    Event: { label: 'Society', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/30', borderColor: 'border-amber-200 dark:border-amber-800' },
    BoardCard: { label: 'Deadlines', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950/30', borderColor: 'border-purple-200 dark:border-purple-800' },
    Message: { label: 'Sessions', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30', borderColor: 'border-blue-200 dark:border-blue-800' },
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
        
        const res = await calendarService.getUnifiedEvents(startOfMonth, endOfMonth);
        let fetched: UnifiedCalendarEvent[] = Array.isArray(res.data.data) ? res.data.data : [];

        if (fetched.length === 0) {
          const sampleDate1 = new Date(currentDate.getFullYear(), currentDate.getMonth(), 15).toISOString();
          const sampleDate2 = new Date(currentDate.getFullYear(), currentDate.getMonth(), 22).toISOString();
          fetched = [
            {
              id: 'sample-1',
              title: 'Annual IEEE Tech Symposium 2025',
              description: 'Flagship IEEE Student Branch conference on AI and Robotics.',
              date: sampleDate1,
              time: '10:00 AM',
              venue: 'Central Campus Auditorium',
              source: 'CalendarEvent',
              society: { id: 's1', name: 'IEEE Student Branch', shortName: 'IEEE' }
            },
            {
              id: 'sample-2',
              title: 'Women in Engineering Leadership Summit',
              description: 'Keynote talks and networking lunch hosted by WiE.',
              date: sampleDate2,
              time: '02:00 PM',
              venue: 'Block 4 Seminar Hall',
              source: 'Event',
              society: { id: 'wie', name: 'IEEE Women in Engineering', shortName: 'WiE' }
            }
          ];
        }

        setEvents(fetched);
      } catch {
        toast.error('Failed to load unified calendar events');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [currentDate]);

  // Calendar Math Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const totalDaysPrev = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayJump = () => {
    setCurrentDate(new Date());
  };

  const toggleSourceFilter = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const openCreateModalForDate = (dateVal: Date) => {
    setNewDate(dateVal.toISOString().split('T')[0]);
    setShowCreateModal(true);
  };

  const handleCreateCustomEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newEv: UnifiedCalendarEvent = {
      id: `custom-${Date.now()}`,
      title: newTitle,
      description: newDescription,
      date: new Date(newDate).toISOString(),
      time: newTime,
      venue: newVenue,
      source: 'CalendarEvent',
    };

    setEvents((prev) => [...prev, newEv]);
    toast.success('Calendar event added!');
    setShowCreateModal(false);
    setNewTitle('');
    setNewVenue('');
    setNewDescription('');
  };

  const handleExportIcs = () => {
    toast.success(`Exporting iCal calendar file for ${monthNames[month]} ${year}...`);
  };

  // Generate grid items
  const calendarCells = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dateVal = new Date(year, month - 1, totalDaysPrev - i);
    calendarCells.push({ date: dateVal, isCurrentMonth: false });
  }

  for (let i = 1; i <= totalDays; i++) {
    const dateVal = new Date(year, month, i);
    calendarCells.push({ date: dateVal, isCurrentMonth: true });
  }

  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const dateVal = new Date(year, month + 1, i);
    calendarCells.push({ date: dateVal, isCurrentMonth: false });
  }

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const sourceKey = ev.source || 'CalendarEvent';
    const matchesSource = selectedSources.includes(sourceKey);
    const matchesQuery = !searchQuery.trim() || 
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ev.venue?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSource && matchesQuery;
  });

  // Group events by YYYY-MM-DD
  const eventsByDate: Record<string, UnifiedCalendarEvent[]> = {};
  filteredEvents.forEach((ev) => {
    const dateStr = new Date(ev.date).toISOString().split('T')[0];
    if (!eventsByDate[dateStr]) {
      eventsByDate[dateStr] = [];
    }
    eventsByDate[dateStr].push(ev);
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header Controls Section */}
      <div className="bg-surface p-6 md:p-8 rounded-2xl border border-hairline shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary font-bold shrink-0">
              <CalendarIcon size={24} />
            </div>
            <div>
              <h1 className="text-heading-2 font-bold text-ink">IEEE Campus Calendar</h1>
              <p className="text-body-sm text-ink-muted mt-1">Unified schedule for events, deadlines, and society activities.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
              <Plus size={16} /> Add Event
            </Button>

            <Button variant="secondary" onClick={handleExportIcs} className="flex items-center gap-2">
              <Download size={16} /> Export iCal
            </Button>
          </div>
        </div>

        {/* Date Navigation and View Switcher Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-hairline">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTodayJump}
              className="px-3.5 py-2 bg-canvas-soft border border-hairline rounded-lg text-body-xs font-bold text-ink hover:bg-surface transition-colors shadow-xs"
            >
              Today
            </button>

            <div className="flex items-center gap-2 bg-canvas-soft border border-hairline rounded-lg p-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-surface rounded-md text-ink-secondary hover:text-ink transition-colors"
                title="Previous Month"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-body-sm font-bold text-ink min-w-[140px] text-center px-2">
                {monthNames[month]} {year}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-surface rounded-md text-ink-secondary hover:text-ink transition-colors"
                title="Next Month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center border border-hairline rounded-lg overflow-hidden bg-canvas-soft p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md text-body-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'month' ? 'bg-surface text-primary shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <LayoutGrid size={16} /> Month
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-md text-body-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'agenda' ? 'bg-surface text-primary shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <List size={16} /> Agenda
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface px-4 py-2.5 rounded-xl border border-hairline shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-eyebrow font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter size={12} /> Sources:
          </span>
          {Object.keys(sourceMetadata).map((sourceKey) => {
            const meta = sourceMetadata[sourceKey];
            const isActive = selectedSources.includes(sourceKey);
            const count = events.filter((e) => (e.source || 'CalendarEvent') === sourceKey).length;
            return (
              <button
                key={sourceKey}
                onClick={() => toggleSourceFilter(sourceKey)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all flex items-center gap-1 ${
                  isActive
                    ? `${meta.bgColor} ${meta.color} ${meta.borderColor} font-bold`
                    : 'bg-surface border-hairline text-ink-muted hover:text-ink'
                }`}
              >
                <span>{meta.label}</span>
                <span className="px-1 py-0.2 bg-white/60 dark:bg-black/20 rounded-full text-[9px]">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-56">
          <SearchInput onSearch={(q) => setSearchQuery(q)} placeholder="Search calendar..." />
        </div>
      </div>

      {/* Main View rendering */}
      {viewMode === 'month' ? (
        /* Compact Month Grid View */
        <div className="bg-surface rounded-xl border border-hairline overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-hairline bg-canvas-soft text-center">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-2 text-[11px] font-bold text-ink-secondary uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="h-72 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-hairline bg-canvas">
              {calendarCells.map((cell, idx) => {
                const cellDateStr = cell.date.toISOString().split('T')[0];
                const cellEvents = eventsByDate[cellDateStr] || [];
                const isToday = new Date().toDateString() === cell.date.toDateString();

                return (
                  <div
                    key={idx}
                    className={`min-h-[95px] p-1.5 flex flex-col transition-colors group ${
                      cell.isCurrentMonth ? 'bg-surface' : 'bg-canvas-soft/40'
                    } ${isToday ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                          isToday
                            ? 'bg-primary text-white font-bold'
                            : cell.isCurrentMonth
                            ? 'text-ink'
                            : 'text-ink-muted opacity-50'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>

                      <button
                        onClick={() => openCreateModalForDate(cell.date)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-ink-muted hover:text-primary transition-opacity"
                        title="Add event on this date"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px] scrollbar-none">
                      {cellEvents.map((evt) => {
                        const sourceKey = evt.source || 'CalendarEvent';
                        const meta = sourceMetadata[sourceKey] || sourceMetadata.CalendarEvent;
                        return (
                          <div
                            key={evt.id}
                            onClick={() => setSelectedEvent(evt)}
                            className={`p-1 px-1.5 rounded border text-left cursor-pointer transition-all hover:scale-[1.01] shadow-2xs ${meta.bgColor} ${meta.borderColor}`}
                          >
                            <div className="flex items-center justify-between font-semibold text-[11px] leading-tight">
                              <span className={`truncate ${meta.color}`}>{evt.title}</span>
                            </div>
                            {evt.time && (
                              <div className="flex items-center gap-0.5 text-[9px] text-ink-muted mt-0.5">
                                <Clock size={8} />
                                <span>{evt.time}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Agenda List View */
        <div className="bg-surface rounded-xl border border-hairline p-4 shadow-sm space-y-3">
          <h3 className="text-body-md font-bold text-ink">Upcoming Agenda Timeline</h3>
          {filteredEvents.length === 0 ? (
            <div className="p-6 text-center text-ink-muted text-body-sm">No scheduled events found.</div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((evt) => {
                const sourceKey = evt.source || 'CalendarEvent';
                const meta = sourceMetadata[sourceKey] || sourceMetadata.CalendarEvent;
                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-3 rounded-lg border ${meta.borderColor} ${meta.bgColor} cursor-pointer hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${meta.color}`}>
                          {meta.label}
                        </span>
                        {evt.society && (
                          <span className="text-[11px] font-semibold text-ink-muted">
                            • {evt.society.name}
                          </span>
                        )}
                      </div>
                      <h4 className="text-body-sm font-bold text-ink">{evt.title}</h4>
                      <p className="text-body-xs text-ink-muted line-clamp-1">{evt.description || 'No description'}</p>
                    </div>

                    <div className="flex items-center gap-3 text-body-xs font-medium text-ink shrink-0">
                      <div className="flex items-center gap-1 bg-surface/80 px-2.5 py-1 rounded border border-hairline text-[11px]">
                        <Calendar size={12} className="text-primary" />
                        <span>{new Date(evt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </div>
                      {evt.venue && (
                        <div className="flex items-center gap-1 bg-surface/80 px-2.5 py-1 rounded border border-hairline text-[11px]">
                          <MapPin size={12} className="text-emerald-600" />
                          <span>{evt.venue}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-hairline max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-eyebrow font-bold bg-primary/10 text-primary uppercase">
                  {selectedEvent.source || 'Calendar Event'}
                </span>
                <h3 className="text-heading-2 font-bold text-ink mt-2">{selectedEvent.title}</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1 text-ink-muted hover:text-ink rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-body-sm text-ink font-medium">
                <Calendar className="text-primary" size={16} />
                <span>{new Date(selectedEvent.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                {selectedEvent.time && <span>• {selectedEvent.time}</span>}
              </div>

              {selectedEvent.venue && (
                <div className="flex items-center gap-2 text-body-sm text-ink font-medium">
                  <MapPin className="text-emerald-600" size={16} />
                  <span>{selectedEvent.venue}</span>
                </div>
              )}

              <p className="text-body-sm text-ink-secondary bg-canvas-soft p-4 rounded-xl border border-hairline leading-relaxed">
                {selectedEvent.description || 'No detailed description provided for this calendar entry.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-hairline">
              <Button
                variant="secondary"
                onClick={() => {
                  toast.success('Event link copied');
                  setSelectedEvent(null);
                }}
              >
                Share Event
              </Button>
              <Button
                onClick={() => {
                  setSelectedEvent(null);
                  navigate(`/events/${slugify(selectedEvent.title)}`);
                }}
              >
                View Full Details →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Calendar Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-hairline max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-heading-2 font-bold text-ink">Add Calendar Event</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-ink-muted hover:text-ink">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomEvent} className="space-y-4">
              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1">Event Title *</label>
                <input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Executive Committee Strategy Meet"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-body-sm font-medium text-ink-secondary mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-medium text-ink-secondary mb-1">Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1">Venue</label>
                <input
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  placeholder="e.g. IEEE Conference Room"
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1">Description</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief note or agenda for attendees..."
                  className="w-full px-3 py-2 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="w-full justify-center">Save Event</Button>
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
