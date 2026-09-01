import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { eventService } from "@/services/events";
import { societyService } from "@/services/societies";
import { Button, LoadingSpinner } from "@/components/ui";
import { PageTransition, AnimatedCard } from "@/components/ui/WatermelonMotion";
import type { Society } from "@/types/models";
import { slugify } from "@/utils/slug";
import { ArrowLeft, Calendar, MapPin, Users, Sparkles, Link, Plus, Trash2, Tag } from "lucide-react";
import toast from "react-hot-toast";

const eventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  capacity: z.coerce.number().optional(),
  societyId: z.string().optional(),
  status: z.enum(["upcoming", "ongoing", "completed", "cancelled"]),
});

type EventForm = z.infer<typeof eventSchema>;

interface SpeakerField {
  name: string;
  role: string;
  organization: string;
}

export default function EventFormPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const targetIdentifier = slug || id;
  const isEdit = !!targetIdentifier;

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerField[]>([
    { name: "", role: "", organization: "" }
  ]);

  const navigate = useNavigate();

  const { hasAccess } = usePermissions();
  const canCreate = hasAccess("events", "create");
  const canEdit = hasAccess("events", "write");
  const isAuthorized = isEdit ? canEdit : canCreate;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      status: "upcoming",
      category: "Workshop",
      capacity: 100,
    },
  });

  const watchTitle = watch("title");
  const generatedSlug = slugify(watchTitle || "new-ieee-event");

  useEffect(() => {
    societyService.getSocieties(1, 100).then((res) => setSocieties(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!targetIdentifier || !canEdit) {
      setLoading(false);
      return;
    }
    setLoading(true);
    eventService
      .getEvents(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (e) => e.id === targetIdentifier || slugify(e.title) === targetIdentifier || e.slug === targetIdentifier,
        );
        const resolvedId = found ? found.id : targetIdentifier;
        setEventId(resolvedId);

        return eventService.getEvent(resolvedId).then((r) => {
          const e = r.data.data;
          reset({
            title: e.title,
            description: e.description || "",
            category: e.category || "Workshop",
            date: e.date || "",
            time: e.time || "10:00",
            location: e.location || "",
            capacity: e.capacity || 100,
            societyId: e.societyId || "",
            status: e.status,
          });
          if (e.speakers && e.speakers.length > 0) {
            setSpeakers(e.speakers.map(s => ({ name: s.name, role: s.role, organization: s.organization || "" })));
          }
        });
      })
      .catch(() => toast.error("Failed to load event"))
      .finally(() => setLoading(false));
  }, [targetIdentifier, canEdit, reset]);

  if (!isAuthorized) return <Navigate to="/events" replace />;

  const handleAddSpeaker = () => {
    setSpeakers((prev) => [...prev, { name: "", role: "", organization: "" }]);
  };

  const handleRemoveSpeaker = (index: number) => {
    setSpeakers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSpeakerChange = (index: number, field: keyof SpeakerField, value: string) => {
    setSpeakers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const onSubmit = async (data: EventForm) => {
    setSubmitting(true);
    const validSpeakers = speakers.filter(s => s.name.trim() !== "");
    const formattedData = {
      ...data,
      slug: generatedSlug,
      speakers: validSpeakers,
    };

    try {
      if (isEdit) {
        if (!eventId) {
          throw new Error("Cannot update event: Event ID is missing");
        }
        await eventService.updateEvent(eventId, formattedData as any);
        toast.success("Event updated successfully");
      } else {
        await eventService.createEvent(formattedData as any);
        toast.success("Event created successfully");
      }
      navigate(`/events/${generatedSlug}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to save event");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <PageTransition>
      <div className="space-y-6 max-w-4xl">
        <button onClick={() => navigate("/events")} className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft size={16} /> Back to Events
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-heading-1 font-bold text-ink">
              {isEdit ? "Edit Event Configuration" : "Create IEEE Event Studio"}
            </h1>
            <p className="text-body-sm text-ink-muted mt-1">
              Configure event schedules, venue, target society, speaker line-ups, and custom URL slugs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/events")}>
              Cancel
            </Button>
            <Button type="submit" form="event-form" loading={submitting}>
              {isEdit ? "Save Changes" : "Publish Event"}
            </Button>
          </div>
        </div>

        <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main 2-column form */}
          <div className="md:col-span-2 space-y-6">
            {/* General Information */}
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-6 space-y-4 shadow-sm">
              <h3 className="text-heading-3 font-bold text-ink flex items-center gap-2">
                <Sparkles className="text-primary" size={18} /> General Information
              </h3>

              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
                  Event Title *
                </label>
                <input
                  {...register("title")}
                  placeholder="e.g. Annual IEEE Quantum Computing & AI Summit"
                  className="w-full px-3.5 py-2.5 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-medium"
                />
                {errors.title && (
                  <p className="text-caption text-red-500 mt-1">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
                    Organizing Society
                  </label>
                  <select
                    {...register("societyId")}
                    className="w-full px-3.5 py-2.5 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">IEEE Student Branch (Central)</option>
                    {societies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.shortName || s.name.substring(0, 4)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
                    Event Category
                  </label>
                  <select
                    {...register("category")}
                    className="w-full px-3.5 py-2.5 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="Workshop">Technical Workshop</option>
                    <option value="Hackathon">Hackathon / Coding Sprint</option>
                    <option value="Seminar">Guest Seminar / Webinar</option>
                    <option value="Conference">Flagship Conference</option>
                    <option value="Competition">Project Competition</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
                  Event Description & Agenda
                </label>
                <textarea
                  {...register("description")}
                  rows={5}
                  placeholder="Comprehensive description of session goals, prerequisites, timeline, and takeaways..."
                  className="w-full px-3.5 py-2.5 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary leading-relaxed"
                />
              </div>
            </AnimatedCard>

            {/* Logistics & Venue */}
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-6 space-y-4 shadow-sm">
              <h3 className="text-heading-3 font-bold text-ink flex items-center gap-2">
                <MapPin className="text-emerald-600 dark:text-emerald-400" size={18} /> Date, Time & Venue
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-body-sm font-medium text-ink-secondary mb-1.5 flex items-center gap-1">
                    <Calendar size={14} /> Date
                  </label>
                  <input
                    type="date"
                    {...register("date")}
                    className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    {...register("time")}
                    className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-body-sm font-medium text-ink-secondary mb-1.5 flex items-center gap-1">
                    <Users size={14} /> Capacity Limit
                  </label>
                  <input
                    type="number"
                    {...register("capacity")}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
                  Venue Location
                </label>
                <input
                  {...register("location")}
                  placeholder="e.g. Central Campus Auditorium / Block 4 Lab 302"
                  className="w-full px-3.5 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </AnimatedCard>

            {/* Speakers Setup */}
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-heading-3 font-bold text-ink flex items-center gap-2">
                  <Users className="text-indigo-600 dark:text-indigo-400" size={18} /> Key Speakers & Mentors
                </h3>
                <button
                  type="button"
                  onClick={handleAddSpeaker}
                  className="text-body-xs font-semibold text-primary flex items-center gap-1 hover:underline"
                >
                  <Plus size={14} /> Add Speaker
                </button>
              </div>

              <div className="space-y-3">
                {speakers.map((sp, i) => (
                  <div key={i} className="p-3.5 bg-canvas-soft/50 rounded-lg border border-white/20 dark:border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <input
                      placeholder="Speaker Name"
                      value={sp.name}
                      onChange={(e) => handleSpeakerChange(i, "name", e.target.value)}
                      className="px-3 py-1.5 bg-surface/50 border border-white/20 dark:border-white/5 rounded text-body-sm text-ink focus:outline-none"
                    />
                    <input
                      placeholder="Designation / Role"
                      value={sp.role}
                      onChange={(e) => handleSpeakerChange(i, "role", e.target.value)}
                      className="px-3 py-1.5 bg-surface/50 border border-white/20 dark:border-white/5 rounded text-body-sm text-ink focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Organization"
                        value={sp.organization}
                        onChange={(e) => handleSpeakerChange(i, "organization", e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface/50 border border-white/20 dark:border-white/5 rounded text-body-sm text-ink focus:outline-none"
                      />
                      {speakers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSpeaker(i)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedCard>
          </div>

          {/* Sidebar Settings & Preview */}
          <div className="space-y-6">
            {/* Live URL Slug Preview Card */}
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-eyebrow text-ink-muted uppercase font-semibold flex items-center gap-1.5">
                <Link size={14} /> Custom Route & Slug Preview
              </h3>
              <div className="p-3 rounded-lg bg-canvas-soft/50 border border-white/20 dark:border-white/5 text-body-xs font-mono text-ink overflow-hidden break-all">
                <span className="text-ink-muted">/events/</span>
                <span className="text-primary font-bold">{generatedSlug}</span>
              </div>
              <p className="text-body-xs text-ink-muted">
                Auto-generated clean URL endpoint for sharing, calendars, and SEO indexing.
              </p>
            </AnimatedCard>

            {/* Event Status Selector */}
            <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-eyebrow text-ink-muted uppercase font-semibold flex items-center gap-1.5">
                <Tag size={14} /> Lifecycle Status
              </h3>
              <select
                {...register("status")}
                className="w-full px-3 py-2 bg-surface/50 border border-white/20 dark:border-white/5 rounded-lg text-body-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="upcoming">Upcoming (Registration Open)</option>
                <option value="ongoing">Ongoing (Live Now)</option>
                <option value="completed">Completed (Archived)</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </AnimatedCard>
          </div>
        </form>
      </div>
    </PageTransition>
  );
}
