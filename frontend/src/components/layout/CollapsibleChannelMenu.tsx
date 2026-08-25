import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown, LayoutGrid, MessageSquare, Plus } from "lucide-react";
import { useSocietyStore } from "@/store/societyStore";
import api from "@/lib/api";
import CreateChannelModal from "@/components/channels/CreateChannelModal";

export interface ChannelItem {
  id: string;
  name: string;
  icon?: string;
  type: "chat" | "board";
  categoryName?: string;
}

export default function CollapsibleChannelMenu() {
  const { activeSocietyId } = useSocietyStore();
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isBoardOpen, setIsBoardOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchChannels = async () => {
      if (!activeSocietyId) return;
      try {
        setLoading(true);
        const res = await api.get(`/societies/${activeSocietyId}/channels`);
        const list = res.data?.data || res.data || [];
        setChannels(list);
      } catch {
        // Fallback default channels for initial development
        setChannels([
          {
            id: "general",
            name: "general",
            icon: "💬",
            type: "chat",
            categoryName: "text channels",
          },
          {
            id: "announcements",
            name: "announcements",
            icon: "📢",
            type: "chat",
            categoryName: "text channels",
          },
          {
            id: "events-planning",
            name: "events-planning",
            icon: "📌",
            type: "chat",
            categoryName: "text channels",
          },
          {
            id: "kanban-board",
            name: "kanban-board",
            icon: "📋",
            type: "board",
            categoryName: "boards",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [activeSocietyId]);

  const chatChannels = channels.filter((c) => c.type === "chat");
  const boardChannels = channels.filter((c) => c.type === "board");

  const channelLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between px-3 py-1.5 rounded-md text-body-sm transition-all duration-200 ${
      isActive
        ? "bg-primary/10 text-primary font-semibold"
        : "text-ink-secondary hover:bg-canvas-soft hover:text-ink"
    }`;

  return (
    <div className="flex flex-col gap-3 py-2">
      {/* Chat Channels Group */}
      <div>
        <div className="flex items-center justify-between px-3 py-1">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-ink-faint uppercase hover:text-ink-secondary transition-colors"
          >
            <MessageSquare size={13} />
            <span>Chat Channels</span>
            <ChevronDown
              size={12}
              className={`transition-transform ${isChatOpen ? "" : "-rotate-90"}`}
            />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="p-1 rounded hover:bg-canvas-soft text-ink-muted hover:text-ink transition-colors"
            title="Create Channel"
          >
            <Plus size={14} />
          </button>
        </div>

        {isChatOpen && (
          <div className="mt-1 flex flex-col gap-0.5 pl-2">
            {loading ? (
              <p className="px-3 py-1 text-caption text-ink-muted">
                Loading channels...
              </p>
            ) : chatChannels.length === 0 ? (
              <p className="px-3 py-1 text-caption text-ink-muted">
                No chat channels
              </p>
            ) : (
              chatChannels.map((c) => (
                <NavLink
                  key={c.id}
                  to={`/channels/${c.name}`}
                  className={channelLinkClass}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-caption">{c.icon || "💬"}</span>
                    <span className="truncate"># {c.name}</span>
                  </div>
                </NavLink>
              ))
            )}
          </div>
        )}
      </div>

      {/* Board Channels Group */}
      <div>
        <button
          onClick={() => setIsBoardOpen(!isBoardOpen)}
          className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-bold tracking-wider text-ink-faint uppercase hover:text-ink-secondary transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <LayoutGrid size={13} />
            <span>Kanban Boards</span>
          </div>
          <ChevronDown
            size={12}
            className={`transition-transform ${isBoardOpen ? "" : "-rotate-90"}`}
          />
        </button>

        {isBoardOpen && (
          <div className="mt-1 flex flex-col gap-0.5 pl-2">
            {boardChannels.length === 0 ? (
              <p className="px-3 py-1 text-caption text-ink-muted">
                No board channels
              </p>
            ) : (
              boardChannels.map((c) => (
                <NavLink
                  key={c.id}
                  to={`/boards/${c.name}`}
                  className={channelLinkClass}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-caption">{c.icon || "📋"}</span>
                    <span className="truncate">{c.name}</span>
                  </div>
                </NavLink>
              ))
            )}
          </div>
        )}
      </div>

      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          // Re-trigger channel list fetch by toggling society state or refetching
          window.dispatchEvent(new Event("channel-created"));
        }}
      />
    </div>
  );
}
