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
import { PageTransition, AnimatedCard } from "@/components/ui/WatermelonMotion";

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
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-heading-1 font-bold text-ink mb-2">
          {isEdit ? "Edit Announcement" : "Create New Campus Broadcast"}
        </h1>
        <p className="text-body-md text-ink-muted mb-6">
          {isEdit ? "Update the details of your existing broadcast." : "Draft and publish a new official announcement for the campus."}
        </p>

        <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-body-sm font-semibold text-ink-secondary mb-2">
                Announcement Title <span className="text-red-500">*</span>
              </label>
              <input
                {...register("title")}
                placeholder="e.g. Call for Papers - IEEE Student Research Symposium 2025"
                className="w-full px-4 py-3 bg-surface/50 border border-white/10 dark:border-white/5 rounded-xl text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-medium transition-all shadow-sm"
              />
              {errors.title && (
                <p className="text-caption text-red-500 mt-1.5">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-body-sm font-semibold text-ink-secondary mb-2">
                  Priority & Alert Level
                </label>
                <select
                  {...register("priority")}
                  className="w-full px-4 py-3 bg-surface/50 border border-white/10 dark:border-white/5 rounded-xl text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm"
                >
                  <option value="low">Low Priority (Routine Info)</option>
                  <option value="medium">Medium Priority (Important Notice)</option>
                  <option value="high">High Priority (Urgent Broadcast)</option>
                </select>
              </div>

              <div>
                <label className="block text-body-sm font-semibold text-ink-secondary mb-2">
                  Target Society / Channel
                </label>
                <select
                  {...register("societyId")}
                  className="w-full px-4 py-3 bg-surface/50 border border-white/10 dark:border-white/5 rounded-xl text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm"
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-body-sm font-semibold text-ink-secondary">
                  Notice Content & Message <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className="text-body-xs font-bold text-primary hover:text-primary-active px-3 py-1.5 bg-primary/10 rounded-lg transition-colors"
                >
                  {previewMode ? "Edit Mode" : "Preview Notice"}
                </button>
              </div>

              {previewMode ? (
                <div
                  className="p-6 bg-surface/40 backdrop-blur-md border border-white/10 dark:border-white/5 rounded-xl text-body-sm text-ink min-h-[200px] prose prose-sm max-w-none dark:prose-invert shadow-inner"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      contentValue || "<i>No content to preview</i>"
                    ),
                  }}
                />
              ) : (
                <textarea
                  {...register("content")}
                  rows={10}
                  placeholder="Write broadcast message, venue details, submission links, or deadlines..."
                  className="w-full px-4 py-3 bg-surface/50 border border-white/10 dark:border-white/5 rounded-xl text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary leading-relaxed transition-all shadow-sm resize-y"
                />
              )}
              {errors.content && (
                <p className="text-caption text-red-500 mt-1.5">
                  {errors.content.message}
                </p>
              )}
            </div>

            <div className="flex gap-4 pt-6 border-t border-white/10 dark:border-white/5">
              <Button type="submit" loading={submitting} className="flex-1 sm:flex-none shadow-lg">
                {isEdit ? "Update Notice" : "Publish Broadcast"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/announcements")}
                className="flex-1 sm:flex-none shadow-sm"
              >
                Cancel
              </Button>
            </div>
          </form>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}
