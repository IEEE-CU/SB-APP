import { useState, useEffect, useRef } from "react";
import { Message } from "@/types/models";
import { getSocket } from "@/lib/socket";
import { channelsService } from "@/services/channels";
import { Send, CornerDownRight, MessageSquare } from "lucide-react";

interface ChannelChatFeedProps {
  channelId: string;
  channelName: string;
}

export default function ChannelChatFeed({ channelId, channelName }: ChannelChatFeedProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [activeThreadParent, setActiveThreadParent] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const res = await channelsService.getChannelMessages(channelId);
        setMessages(res.data?.data || []);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Socket Room Subscriptions
    const socket = getSocket();
    socket.emit("channel:join", { channelId });

    const handleNewMessage = (msg: Message) => {
      if (msg.channelId === channelId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.emit("channel:leave", { channelId });
      socket.off("message:new", handleNewMessage);
    };
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");

    try {
      const res = await channelsService.sendChannelMessage(
        channelId,
        text,
        activeThreadParent?.id
      );
      if (res.data?.data) {
        setMessages((prev) => [...prev, res.data.data]);
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const parentMessages = messages.filter((m) => !m.parentId);

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-hairline/60 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-hairline/60 flex items-center justify-between bg-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-primary" />
          <h2 className="text-title font-semibold text-ink"># {channelName}</h2>
        </div>
      </div>

      {/* Messages Scroll Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <p className="text-body-sm text-ink-muted text-center py-8">Loading channel messages...</p>
        ) : parentMessages.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-title font-semibold text-ink">Welcome to #{channelName}!</p>
            <p className="text-body-sm text-ink-muted">This is the start of the #{channelName} channel.</p>
          </div>
        ) : (
          parentMessages.map((msg) => {
            const replies = messages.filter((r) => r.parentId === msg.id);
            return (
              <div key={msg.id} className="flex gap-3 group hover:bg-canvas-soft/40 p-2 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-caption uppercase flex-shrink-0">
                  {msg.sender?.name?.[0] || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-body-sm font-semibold text-ink">
                      {msg.sender?.name || "Member"}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-body-sm text-ink mt-0.5 whitespace-pre-wrap">{msg.content}</p>

                  {/* Thread reply counter button */}
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      onClick={() => setActiveThreadParent(msg)}
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                    >
                      <CornerDownRight size={12} />
                      {replies.length > 0 ? `${replies.length} replies` : "Reply in thread"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Thread Drawer Overlay if replying */}
      {activeThreadParent && (
        <div className="px-6 py-2 bg-primary/5 border-t border-hairline/60 flex items-center justify-between text-caption text-ink-secondary">
          <span>Replying to thread...</span>
          <button onClick={() => setActiveThreadParent(null)} className="text-primary hover:underline font-semibold">
            Cancel Thread
          </button>
        </div>
      )}

      {/* Chat Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-hairline/60 bg-canvas-soft/40 flex items-center gap-3">
        <input
          type="text"
          placeholder={`Message #${channelName}...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-hairline/60 text-ink text-body-sm focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
