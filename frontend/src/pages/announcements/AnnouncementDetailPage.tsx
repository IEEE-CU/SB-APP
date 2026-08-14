import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { announcementService } from "@/services/announcements";
import { Button, LoadingSpinner } from "@/components/ui";
import PermissionGate from "@/components/PermissionGate";
import { ArrowLeft } from "lucide-react";
import { slugify } from "@/utils/slug";
import type { Announcement } from "@/types/models";
import toast from "react-hot-toast";

export default function AnnouncementDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
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
        if (found) {
          return announcementService.getAnnouncement(found.id).then((r) => setAnnouncement(r.data.data));
        } else {
          return announcementService.getAnnouncement(slug).then((r) => setAnnouncement(r.data.data));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

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
      <div className="text-body-sm text-ink-muted">Announcement not found</div>
    );

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-heading-1 font-bold text-ink">
            {announcement.title}
          </h1>
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-eyebrow ${
              announcement.priority === "high"
                ? "bg-red-100 text-red-600"
                : announcement.priority === "medium"
                  ? "bg-accent-orange/10 text-accent-orange"
                  : "bg-canvas-soft text-ink-muted"
            }`}
          >
            {announcement.priority}
          </span>
        </div>
        <div className="flex gap-2">
          <PermissionGate module="announcements" action="write">
            <Button
              variant="secondary"
              onClick={() => navigate(`/announcements/${announcement.id}/edit`)}
            >
              Edit
            </Button>
          </PermissionGate>
          <PermissionGate module="announcements" action="delete">
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </PermissionGate>
        </div>
      </div>
      <div className="bg-surface rounded-lg border border-hairline p-6 max-w-2xl space-y-4">
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">
            Published
          </label>
          <p className="text-body-md text-ink mt-1">
            {new Date(announcement.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div>
          <label className="text-eyebrow text-ink-muted uppercase">
            Content
          </label>
          <div
            className="text-body-md text-ink mt-1 prose max-w-none"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                announcement.content || (announcement as any).message || "",
              ),
            }}
          />
        </div>
      </div>
    </div>
  );
}
