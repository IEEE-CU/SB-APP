import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { eventService } from "@/services/events";
import { Button, LoadingSpinner } from "@/components/ui";
import toast from "react-hot-toast";

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(["upcoming", "ongoing", "completed", "cancelled"]),
});

type EventForm = z.infer<typeof eventSchema>;

export default function EventFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
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
    if (!id || !canEdit) {
      setLoading(false);
      return;
    }
    eventService
      .getEvent(id)
      .then((res) => {
        const e = res.data.data;
        reset({
          title: e.title,
          description: e.description || "",
          date: e.date || "",
          location: e.location || "",
          status: e.status,
        });
      })
      .catch(() => toast.error("Failed to load event"))
      .finally(() => setLoading(false));
  }, [id, canEdit, reset]);

  if (!isAuthorized) return <Navigate to="/events" replace />;

  const onSubmit = async (data: EventForm) => {
    setSubmitting(true);
    try {
      if (isEdit && id) {
        await eventService.updateEvent(id, data);
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
    <div className="max-w-lg">
      <h1 className="text-heading-1 font-bold text-ink mb-6">
        {isEdit ? "Edit Event" : "New Event"}
      </h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-surface rounded-lg border border-hairline p-6 space-y-4"
      >
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Title
          </label>
          <input
            {...register("title")}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {errors.title && (
            <p className="text-caption text-red-500 mt-1">
              {errors.title.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Description
          </label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
              Date
            </label>
            <input
              type="date"
              {...register("date")}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
              Location
            </label>
            <input
              {...register("location")}
              className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Status
          </label>
          <select
            {...register("status")}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>
            {isEdit ? "Update" : "Create"}
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
