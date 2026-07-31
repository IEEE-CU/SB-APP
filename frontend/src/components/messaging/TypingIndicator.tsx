import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";

interface TypingIndicatorProps {
  channelId: string;
}

export default function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    const socket = getSocket();

    const handleTypingUpdate = (data: { activeTypingUsers: string[] }) => {
      setTypingUsers(data.activeTypingUsers || []);
    };

    socket.on("typing:update", handleTypingUpdate);

    return () => {
      socket.off("typing:update", handleTypingUpdate);
    };
  }, [channelId]);

  if (typingUsers.length === 0) return null;

  return (
    <div className="px-6 py-1 flex items-center gap-2 text-[11px] text-ink-muted animate-pulse">
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
      </div>
      <span>
        {typingUsers.length === 1
          ? `${typingUsers[0]} is typing...`
          : `${typingUsers.join(", ")} are typing...`}
      </span>
    </div>
  );
}

export function UserPresenceBadge({ status }: { status: "online" | "idle" | "dnd" | "offline" }) {
  const statusColors = {
    online: "bg-emerald-500",
    idle: "bg-amber-500",
    dnd: "bg-red-500",
    offline: "bg-slate-400",
  };

  return (
    <span
      className={`w-2.5 h-2.5 rounded-full border-2 border-surface ${statusColors[status] || statusColors.offline}`}
      title={`Status: ${status}`}
    />
  );
}
