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
    <div className="space-y-6 max-w-4xl">
      <button
        onClick={() => navigate("/announcements")}
        className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft size={16} /> Back to Announcements
      </button>

      {/* Header Banner Card */}
      <div className="bg-surface rounded-2xl border border-hairline p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex px-3 py-0.5 rounded-full text-eyebrow font-bold uppercase ${
                  announcement.priority === "high"
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : announcement.priority === "medium"
                      ? "bg-amber-100 text-amber-700 border border-amber-200"
                      : "bg-canvas-soft text-ink-muted border border-hairline"
                }`}
              >
                {announcement.priority === "high" ? "Urgent Broadcast" : announcement.priority === "medium" ? "Important Notice" : "General"}
              </span>
              <span className="flex items-center gap-1 text-body-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck size={14} /> Official IEEE Broadcast
              </span>
            </div>
            <h1 className="text-heading-1 font-bold text-ink">{announcement.title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleShare} className="flex items-center gap-1.5">
              <Share2 size={16} /> Share
            </Button>
            <PermissionGate module="announcements" action="write">
              <Button
                variant="secondary"
                onClick={() => navigate(`/announcements/${announcement.id}/edit`)}
              >
                Edit Notice
              </Button>
            </PermissionGate>
            <PermissionGate module="announcements" action="delete">
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-hairline text-body-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <Calendar size={14} />
            <span>Published on <span className="font-semibold text-ink">{new Date(announcement.createdAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span></span>
          </div>

          <Button
            variant={acknowledged ? "secondary" : "primary"}
            onClick={handleAcknowledge}
            className="flex items-center gap-1.5"
          >
            {acknowledged ? (
              <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 size={16} /> Acknowledged</span>
            ) : (
              <span className="flex items-center gap-1"><Bell size={16} /> Acknowledge Notice</span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="bg-surface rounded-xl border border-hairline p-8 shadow-sm space-y-4">
        <h3 className="text-eyebrow text-ink-muted uppercase font-semibold">Notice Details</h3>
        <div
          className="text-body-md text-ink leading-relaxed prose max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              announcement.content || (announcement as any).message || "<p>No notice content provided.</p>",
            ),
          }}
        />
      </div>
    </div>
  );
}
