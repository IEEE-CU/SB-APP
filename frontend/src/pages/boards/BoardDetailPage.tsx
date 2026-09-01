import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { channelsService } from "@/services/channels";
import { useSocietyStore } from "@/store/societyStore";
import { LoadingSpinner } from "@/components/ui";
import KanbanBoardView from "@/components/board/KanbanBoardView";
import type { Channel } from "@/types/models";

/**
 * Resolves a board channel by its slug (the channel's kebab-case `name`) and
 * hands the resolved id to the existing Kanban view. Resolves against the
 * active society, the same list the sidebar builds its links from.
 */
export default function BoardDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { activeSocietyId } = useSocietyStore();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    channelsService
      .getChannels(activeSocietyId || undefined)
      .then((res) => {
        // Only a channel explicitly typed as "board" may render the Kanban
        // view; chat channels fall through to the not-found state.
        const match = (res.data.data || []).find(
          (c) => c.name === slug && c.type === "board",
        );
        setChannel(match || null);
      })
      .catch(() => setChannel(null))
      .finally(() => setLoading(false));
  }, [slug, activeSocietyId]);

  if (loading) return <LoadingSpinner />;
  if (!channel)
    return <div className="text-body-sm text-ink-muted">Board not found</div>;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex-1 min-h-0">
        <KanbanBoardView channelId={channel.id} />
      </div>
    </div>
  );
}
