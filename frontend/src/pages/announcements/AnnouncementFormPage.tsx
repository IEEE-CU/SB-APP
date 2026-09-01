import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DOMPurify from "dompurify";
import { announcementService } from "@/services/announcements";
import { societyService } from "@/services/societies";
import { Button, LoadingSpinner } from "@/components/ui";
import type { Society } from "@/types/models";
import { slugify } from "@/utils/slug";
import toast from "react-hot-toast";

const schema = z.object({
  title: z.string().min(1, "Announcement title is required"),
  content: z.string().min(1, "Broadcast content is required"),
  priority: z.enum(["low", "medium", "high"]),
  societyId: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function AnnouncementFormPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const targetIdentifier = slug || id;
  const isEdit = !!targetIdentifier;

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const navigate = useNavigate();

  const { hasAccess } = usePermissions();
  const canCreate = hasAccess("announcements", "create");
  const canEdit = hasAccess("announcements", "write");
  const isAuthorized = isEdit ? canEdit : canCreate;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium" },
  });

  const contentValue = watch("content");

  useEffect(() => {
    societyService.getSocieties(1, 100).then((res) => setSocieties(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!targetIdentifier || !canEdit) {
      setLoading(false);
      return;
    }
    setLoading(true);
    announcementService
      .getAnnouncements(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (a) => a.id === targetIdentifier || slugify(a.title) === targetIdentifier,
        );
        const resolvedId = found ? found.id : targetIdentifier;
        setAnnouncementId(resolvedId);

        return announcementService.getAnnouncement(resolvedId).then((r) => {
          const a = r.data.data;
          reset({
            title: a.title,
            content: a.content || (a as any).message || "",
            priority: a.priority,
            societyId: a.societyId || "",
          });
        });
      })
      .catch(() => toast.error("Failed to load announcement"))
      .finally(() => setLoading(false));
  }, [targetIdentifier, canEdit, reset]);

  if (!isAuthorized) return <Navigate to="/announcements" replace />;

  const onSubmit = async (data: Form) => {
    setSubmitting(true);
    try {
      if (isEdit && announcementId) {
        await announcementService.updateAnnouncement(announcementId, data);
        toast.success("Announcement updated successfully");
      } else {
        await announcementService.createAnnouncement(data);
        toast.success("Announcement broadcast published");
      }
      navigate("/announcements");
    } catch {
      toast.error("Failed to save announcement");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-heading-1 font-bold text-ink mb-6">
        {isEdit ? "Edit Announcement" : "Create New Campus Broadcast"}
      </h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-surface rounded-xl border border-hairline p-6 space-y-4 shadow-sm"
      >
        <div>
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Announcement Title *
          </label>
          <input
            {...register("title")}
            placeholder="e.g. Call for Papers - IEEE Student Research Symposium 2025"
            className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-medium"
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
              Priority & Alert Level
            </label>
            <select
              {...register("priority")}
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="low">Low Priority (Routine Info)</option>
              <option value="medium">Medium Priority (Important Notice)</option>
              <option value="high">High Priority (Urgent Broadcast)</option>
            </select>
          </div>

          <div>
            <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
              Target Society / Channel
            </label>
            <select
              {...register("societyId")}
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">IEEE Student Branch (All Members)</option>
              {societies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.shortName || s.name.substring(0, 4)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-body-sm font-medium text-ink-secondary">
              Notice Content & Message *
            </label>
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className="text-body-xs font-semibold text-primary hover:underline"
            >
              {previewMode ? "Edit Mode" : "Preview Notice"}
            </button>
          </div>

          {previewMode ? (
            <div
              className="p-4 bg-canvas-soft border border-hairline rounded-lg text-body-sm text-ink min-h-[160px] prose max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  contentValue || "<i>No content to preview</i>"
                ),
              }}
            />
          ) : (
            <textarea
              {...register("content")}
              rows={8}
              placeholder="Write broadcast message, venue details, submission links, or deadlines..."
              className="w-full px-3.5 py-2.5 bg-surface border border-hairline rounded-lg text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary leading-relaxed"
            />
          )}
          {errors.content && (
            <p className="text-caption text-red-500 mt-1">
              {errors.content.message}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={submitting}>
            {isEdit ? "Update Notice" : "Publish Broadcast"}
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
