import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { channelsService } from "@/services/channels";
import { useSocietyStore } from "@/store/societyStore";
import { LoadingSpinner } from "@/components/ui";
import { PageTransition } from "@/components/ui/WatermelonMotion";
import ChannelChatFeed from "@/components/channels/ChannelChatFeed";
import type { Channel } from "@/types/models";

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
    <PageTransition className="h-[calc(100vh-8rem)] flex flex-col bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-3xl p-6 shadow-2xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-body-sm text-ink-muted hover:text-ink mb-4 w-fit transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex-1 min-h-0 bg-canvas/30 rounded-2xl overflow-hidden border border-white/10 dark:border-white/5">
        <ChannelChatFeed channelId={channel.id} channelName={channel.name} />
      </div>
    </PageTransition>
  );
}
