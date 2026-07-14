import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { announcementService } from "@/services/announcements";
import { Button, LoadingSpinner } from "@/components/ui";
import toast from "react-hot-toast";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  priority: z.enum(["low", "medium", "high"]),
});

type Form = z.infer<typeof schema>;

export default function AnnouncementFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const { hasAccess } = usePermissions();
  const canCreate = hasAccess("announcements", "create");
  const canEdit = hasAccess("announcements", "write");
  const isAuthorized = isEdit ? canEdit : canCreate;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium" },
  });

  useEffect(() => {
    if (!id || !canEdit) {
      setLoading(false);
      return;
    }
    announcementService
      .getAnnouncement(id)
      .then((res) => {
        const a = res.data.data;
        reset({
          title: a.title,
          content: a.content || (a as any).message || "",
          priority: a.priority,
        });
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id, canEdit, reset]);

  if (!isAuthorized) return <Navigate to="/announcements" replace />;

  const onSubmit = async (data: Form) => {
    setSubmitting(true);
    try {
      if (isEdit && id) {
        await announcementService.updateAnnouncement(id, data);
        toast.success("Updated");
      } else {
        await announcementService.createAnnouncement(data);
        toast.success("Created");
      }
      navigate("/announcements");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-lg">
      <h1 className="text-heading-1 font-bold text-ink mb-6">
        {isEdit ? "Edit Announcement" : "New Announcement"}
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
            Content
          </label>
          <textarea
            {...register("content")}
            rows={6}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {errors.content && (
            <p className="text-caption text-red-500 mt-1">
              {errors.content.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Priority
          </label>
          <select
            {...register("priority")}
            className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>
            {isEdit ? "Update" : "Create"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/announcements")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
