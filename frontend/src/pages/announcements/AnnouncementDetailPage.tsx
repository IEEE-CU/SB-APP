import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { announcementService } from "@/services/announcements";
import { Button, LoadingSpinner } from "@/components/ui";
import PermissionGate from "@/components/PermissionGate";
import { ArrowLeft, Bell, CheckCircle2, Share2, Calendar, ShieldCheck } from "lucide-react";
import { slugify } from "@/utils/slug";
import type { Announcement } from "@/types/models";
import toast from "react-hot-toast";
import { PageTransition, AnimatedCard, AnimatedBadge } from "@/components/ui/WatermelonMotion";

export default function AnnouncementDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    announcementService
      .getAnnouncements(1, 100)
      .then((res) => {
        const found = res.data.data.find(
          (a) => a.id === slug || slugify(a.title) === slug,
        );
        const targetId = found ? found.id : slug;
        return announcementService.getAnnouncement(targetId).then((r) => setAnnouncement(r.data.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const handleAcknowledge = () => {
    setAcknowledged(!acknowledged);
    if (!acknowledged) {
      toast.success("Broadcast acknowledged!");
    } else {
      toast.success("Acknowledgment toggled");
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  const handleDelete = async () => {
    if (!announcement) return;
    try {
      await announcementService.deleteAnnouncement(announcement.id);
      toast.success("Announcement deleted");
      navigate("/announcements");
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!announcement)
    return (
      <div className="p-8 text-body-sm text-ink-muted">Announcement not found</div>
    );

  return (
    <PageTransition className="space-y-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate("/announcements")}
        className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors bg-surface/50 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 w-fit"
      >
        <ArrowLeft size={16} /> Back to Announcements
      </button>

      {/* Header Banner Card */}
      <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <AnimatedBadge
                variant={
                  announcement.priority === "high"
                    ? "danger"
                    : announcement.priority === "medium"
                      ? "warning"
                      : "default"
                }
              >
                {announcement.priority === "high" ? "Urgent Broadcast" : announcement.priority === "medium" ? "Important Notice" : "General"}
              </AnimatedBadge>
              <AnimatedBadge variant="success" className="flex items-center gap-1">
                <ShieldCheck size={14} /> Official IEEE Broadcast
              </AnimatedBadge>
            </div>
            <h1 className="text-heading-1 font-bold text-ink leading-tight">{announcement.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleShare} className="flex items-center gap-1.5 shadow-sm">
              <Share2 size={16} /> Share
            </Button>
            <PermissionGate module="announcements" action="write">
              <Button
                variant="secondary"
                onClick={() => navigate(`/announcements/${slugify(announcement.title)}/edit`)}
                className="shadow-sm"
              >
                Edit Notice
              </Button>
            </PermissionGate>
            <PermissionGate module="announcements" action="delete">
              <Button variant="danger" onClick={handleDelete} className="shadow-sm">
                Delete
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="flex flex-wrap items-center justify-between pt-6 border-t border-white/10 dark:border-white/5 gap-4">
          <div className="flex items-center gap-2 text-body-sm bg-surface/50 px-4 py-2 rounded-xl border border-white/10">
            <Calendar size={16} className="text-primary" />
            <span className="text-ink-muted">Published on <span className="font-semibold text-ink">{new Date(announcement.createdAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span></span>
          </div>

          <Button
            variant={acknowledged ? "secondary" : "primary"}
            onClick={handleAcknowledge}
            className="flex items-center gap-2 shadow-lg"
          >
            {acknowledged ? (
              <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle2 size={18} /> Acknowledged</span>
            ) : (
              <span className="flex items-center gap-2"><Bell size={18} /> Acknowledge Notice</span>
            )}
          </Button>
        </div>
      </AnimatedCard>

      {/* Main Content Body */}
      <AnimatedCard className="bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-10 shadow-xl space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10 dark:border-white/5">
          <h3 className="text-eyebrow text-primary uppercase font-bold tracking-wider">Notice Details</h3>
        </div>
        <div
          className="text-body-lg text-ink leading-relaxed prose prose-lg max-w-none dark:prose-invert prose-headings:text-ink prose-a:text-primary prose-strong:text-ink prose-p:opacity-90"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              announcement.content || (announcement as any).message || "<p>No notice content provided.</p>",
            ),
          }}
        />
      </AnimatedCard>
    </PageTransition>
  );
}
