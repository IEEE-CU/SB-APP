import { useEffect, useState } from 'react';
import { calendarService } from '@/services/calendar';
import type { UnifiedCalendarEvent } from '@/types/models';
import { LoadingSpinner } from '@/components/ui';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Filter, Calendar, MapPin } from 'lucide-react';

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Filtering state
  const [selectedSources, setSelectedSources] = useState<string[]>([
    'event',
    'deadline',
    'society',
    'message_schedule',
  ]);

  const sourceMetadata: Record<string, { label: string; color: string; bgColor: string }> = {
    event: { label: 'Event', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40' },
    deadline: { label: 'Deadline', color: 'text-rose-700 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40' },
    society: { label: 'Society', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40' },
    message_schedule: { label: 'Scheduled', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40' },
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();
        
        const res = await calendarService.getUnifiedEvents(startOfMonth, endOfMonth, selectedSources);
        setEvents(res.data.data || []);
      } catch (err) {
        toast.error('Failed to load unified calendar events');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [currentDate, selectedSources]);

  // Calendar Math Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // Day index of the first of the month
  const totalDays = new Date(year, month + 1, 0).getDate(); // Days in the current month
  const totalDaysPrev = new Date(year, month, 0).getDate(); // Days in the previous month

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const toggleSourceFilter = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  // Generate grid items
  const calendarCells = [];

  // Previous month padding cells
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dateVal = new Date(year, month - 1, totalDaysPrev - i);
    calendarCells.push({ date: dateVal, isCurrentMonth: false });
  }

  // Current month cells
  for (let i = 1; i <= totalDays; i++) {
    const dateVal = new Date(year, month, i);
    calendarCells.push({ date: dateVal, isCurrentMonth: true });
  }

  // Next month padding cells to complete a 6-row grid (42 cells)
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const dateVal = new Date(year, month + 1, i);
    calendarCells.push({ date: dateVal, isCurrentMonth: false });
  }

  // Group events by YYYY-MM-DD
  const eventsByDate: Record<string, UnifiedCalendarEvent[]> = {};
  events.forEach((ev) => {
    const dateStr = ev.date.split('T')[0];
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
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface p-6 rounded-2xl border border-hairline shadow-soft-1">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Calendar size={24} />
          </div>
          <div>
            <h1 className="text-heading-2 font-bold text-ink">Unified Calendar</h1>
            <p className="text-body-sm text-ink-muted mt-0.5">Track events, deadlines, and schedules all in one place</p>
          </div>
        </div>

        {/* Date navigations */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 border border-hairline hover:bg-canvas-soft rounded-lg text-ink-secondary hover:text-ink transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-body-md font-semibold text-ink min-w-[120px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 border border-hairline hover:bg-canvas-soft rounded-lg text-ink-secondary hover:text-ink transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Filters and Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-surface px-6 py-4 rounded-xl border border-hairline shadow-soft-1">
        <span className="text-caption font-bold text-ink-muted uppercase tracking-wider flex items-center gap-1.5 mr-2">
          <Filter size={14} /> Filter Sources
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.keys(sourceMetadata).map((source) => {
            const meta = sourceMetadata[source];
            const isActive = selectedSources.includes(source);
            return (
              <button
                key={source}
                onClick={() => toggleSourceFilter(source)}
                className={`text-caption font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  isActive
                    ? `${meta.bgColor} ${meta.color} font-bold`
                    : 'bg-surface border-hairline text-ink-muted hover:border-ink-secondary'
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-surface rounded-2xl border border-hairline overflow-hidden shadow-soft-3">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-hairline bg-canvas-soft/50 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-caption font-bold text-ink-secondary uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid cells */}
        {loading ? (
          <div className="h-96 flex items-center justify-center">
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
                  className={`min-h-[120px] p-2 flex flex-col transition-all duration-200 ${
                    cell.isCurrentMonth ? 'bg-surface' : 'bg-canvas-soft/30'
                  } ${isToday ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}
                >
                  {/* Cell number */}
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`text-caption font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-primary text-on-primary font-bold'
                          : cell.isCurrentMonth
                          ? 'text-ink-secondary'
                          : 'text-ink-faint'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>

                  {/* Cell Events list */}
                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {cellEvents.map((ev) => {
                      const meta = sourceMetadata[ev.sourceType] || { label: 'Event', color: 'text-ink', bgColor: 'bg-canvas' };
                      return (
                        <div
                          key={ev.id}
                          className={`text-[10px] p-1.5 rounded border leading-tight ${meta.bgColor} ${meta.color} font-medium flex flex-col gap-0.5 cursor-pointer hover:shadow-soft-1 transition-shadow`}
                          title={ev.description}
                        >
                          <span className="font-bold truncate">{ev.title}</span>
                          {ev.location && (
                            <span className="text-[9px] opacity-80 flex items-center gap-0.5">
                              <MapPin size={8} /> {ev.location}
                            </span>
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
    </div>
  );
}
