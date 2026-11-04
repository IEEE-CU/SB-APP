import { useState, useEffect } from "react";
import { Reaction } from "@/types/models";
import { channelsService } from "@/services/channels";
import { groupReactions } from "@/lib/messageContract";
import toast from "react-hot-toast";
import { Smile } from "lucide-react";

interface EmojiReactionPickerProps {
  messageId: string;
  reactions?: Reaction[];
  onReactionUpdate?: (reactions: Reaction[]) => void;
}

const COMMON_EMOJIS = ["👍", "❤️", "🔥", "🎉", "🚀", "👀", "💡", "😂"];

export default function EmojiReactionPicker({ messageId, reactions = [], onReactionUpdate }: EmojiReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [localReactions, setLocalReactions] = useState<Reaction[]>(reactions);

  useEffect(() => {
    setLocalReactions(reactions);
  }, [reactions]);

  const handleToggleEmoji = async (emoji: string) => {
    try {
      const res = await channelsService.toggleReaction(messageId, emoji);
      // The server answers with the message's reaction records; keep what is shown if it did not.
      const updated = Array.isArray(res.data?.data) ? groupReactions(res.data.data) : localReactions;
      setLocalReactions(updated);
      onReactionUpdate?.(updated);
      setShowPicker(false);
    } catch {
      // Do not pretend the server accepted it: leave the reactions as they are.
      toast.error("Failed to update reaction");
      setShowPicker(false);
    }
  };

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap mt-1">
      {/* Existing Reaction Badges */}
      {localReactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleToggleEmoji(r.emoji)}
          className="px-2 py-0.5 rounded-full bg-canvas-soft border border-hairline/60 text-[11px] text-ink-secondary hover:border-primary/60 transition-colors flex items-center gap-1"
        >
          <span>{r.emoji}</span>
          <span className="font-semibold">{r.users?.length || 1}</span>
        </button>
      ))}

      {/* Emoji Trigger Button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-1 rounded-full text-ink-muted hover:text-ink hover:bg-canvas-soft transition-colors"
        title="Add reaction"
      >
        <Smile size={14} />
      </button>

      {/* Popover Picker */}
      {showPicker && (
        <div className="absolute left-0 bottom-full mb-1 bg-surface border border-hairline rounded-xl shadow-xl p-2 z-50 flex items-center gap-1">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleToggleEmoji(emoji)}
              className="p-1.5 hover:bg-canvas-soft rounded-lg text-body-md transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
