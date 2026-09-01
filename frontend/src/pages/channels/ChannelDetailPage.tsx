import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { channelsService } from "@/services/channels";
import { useSocietyStore } from "@/store/societyStore";
import { LoadingSpinner } from "@/components/ui";
import ChannelChatFeed from "@/components/channels/ChannelChatFeed";
import type { Channel } from "@/types/models";

/**
 * Resolves a chat channel by its slug (the channel's kebab-case `name`, which
 * the backend enforces as unique per society) so channel URLs stay readable
 * instead of exposing raw ObjectIds. Resolves against the active society, the
 * same list the sidebar builds its links from.
 */
export default function ChannelDetailPage() {
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
        // Backend defaults Channel.type to "chat"; a board channel must not
        // render the chat feed, so it falls through to the not-found state.
        const match = (res.data.data || []).find(
          (c) => c.name === slug && (c.type ?? "chat") === "chat",
        );
        setChannel(match || null);
      })
      .catch(() => setChannel(null))
      .finally(() => setLoading(false));
  }, [slug, activeSocietyId]);

  if (loading) return <LoadingSpinner />;
  if (!channel)
    return <div className="text-body-sm text-ink-muted">Channel not found</div>;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex-1 min-h-0">
        <ChannelChatFeed channelId={channel.id} channelName={channel.name} />
      </div>
    </div>
  );
}
