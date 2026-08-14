import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { eventService } from "@/services/events";
import { societyService } from "@/services/societies";
import { Button, LoadingSpinner } from "@/components/ui";
import type { Society } from "@/types/models";
import { slugify } from "@/utils/slug";
import toast from "react-hot-toast";

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  societyId: z.string().optional(),
  status: z.enum(["upcoming", "ongoing", "completed", "cancelled"]),
});

type EventForm = z.infer<typeof eventSchema>;

export default function EventFormPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const targetIdentifier = slug || id;
  const isEdit = !!targetIdentifier;

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const navigate = useNavigate();

  const { hasAccess } = usePermissions();
  const canCreate = hasAccess("events", "create");
  const canEdit = hasAccess("events", "write");
  const isAuthorized = isEdit ? canEdit : canCreate;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { status: "upcoming" },
  });

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
            date: e.date || "",
            location: e.location || "",
            societyId: e.societyId || "",
            status: e.status,
          });
        });
      })
      .catch(() => toast.error("Failed to load event"))
      .finally(() => setLoading(false));
  }, [targetIdentifier, canEdit, reset]);

  if (!isAuthorized) return <Navigate to="/events" replace />;

  const onSubmit = async (data: EventForm) => {
    setSubmitting(true);
    try {
      if (isEdit && eventId) {
        await eventService.updateEvent(eventId, data);
        toast.success("Event updated");
      } else {
        await eventService.createEvent(data);
        toast.success("Event created");
      }
      navigate("/events");
    } catch {
      toast.error("Failed to save event");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-xl">
      <h1 className="text-heading-1 font-bold text-ink mb-6">
        {isEdit ? "Edit Event" : "Create New Event"}
      </h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-surface rounded-xl border border-hairline p-6 space-y-4 shadow-sm"
      >
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Event Title *
          </label>
          <input
            {...register("title")}
            placeholder="e.g. Annual IEEE Tech Symposium 2025"
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {errors.title && (
            <p className="text-caption text-red-500 mt-1">
              {errors.title.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Organizing Society
          </label>
          <select
            {...register("societyId")}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">IEEE Student Branch (Main)</option>
            {societies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.shortName || s.name.substring(0, 4)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Description
          </label>
          <textarea
            {...register("description")}
            rows={4}
            placeholder="Detailed description of the event agenda, topics covered, and eligibility..."
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
              Event Date
            </label>
            <input
              type="date"
              {...register("date")}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
              Venue / Location
            </label>
            <input
              {...register("location")}
              placeholder="e.g. Main Auditorium / Lab 3"
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Event Lifecycle Status
          </label>
          <select
            {...register("status")}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>
            {isEdit ? "Update Event" : "Save Event"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/events")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
