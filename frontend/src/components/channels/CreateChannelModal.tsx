import { useState } from "react";
import { Plus, X, MessageSquare, LayoutGrid } from "lucide-react";
import { channelsService } from "@/services/channels";
import { useSocietyStore } from "@/store/societyStore";
import { Button } from "@/components/ui";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateChannelModal({ isOpen, onClose, onSuccess }: CreateChannelModalProps) {
  const { activeSocietyId } = useSocietyStore();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💬");
  const [type, setType] = useState<"chat" | "board">("chat");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Channel name is required");
      return;
    }
    const kebabName = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    try {
      setLoading(true);
      setError("");
      await channelsService.createChannel({
        name: kebabName,
        icon,
        type,
        societyId: activeSocietyId || undefined,
      } as any);

      setName("");
      setIcon("💬");
      setType("chat");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-hairline rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <h3 className="text-title font-semibold text-ink flex items-center gap-2">
            <Plus size={18} className="text-primary" /> Create Channel
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-canvas-soft text-ink-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-body-sm">{error}</div>}

          <div>
            <label className="text-eyebrow text-ink-muted uppercase block mb-1.5">Channel Name</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-ink-muted font-mono text-body-sm">#</span>
              <input
                type="text"
                placeholder="new-channel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-lg bg-canvas-soft border border-hairline/60 text-ink text-body-sm focus:outline-none focus:border-primary"
              />
            </div>
            <p className="text-[11px] text-ink-muted mt-1">Must be kebab-case (a-z, 0-9, -)</p>
          </div>

          <div>
            <label className="text-eyebrow text-ink-muted uppercase block mb-1.5">Channel Icon / Emoji</label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-20 px-3 py-2 rounded-lg bg-canvas-soft border border-hairline/60 text-ink text-body-sm text-center focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-eyebrow text-ink-muted uppercase block mb-1.5">Channel Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("chat")}
                className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  type === "chat"
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-canvas-soft border-hairline/60 text-ink-secondary hover:text-ink"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-body-sm">
                  <MessageSquare size={16} /> Chat
                </div>
                <span className="text-[11px] text-ink-muted">Text messaging feed</span>
              </button>

              <button
                type="button"
                onClick={() => setType("board")}
                className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  type === "board"
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-canvas-soft border-hairline/60 text-ink-secondary hover:text-ink"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-body-sm">
                  <LayoutGrid size={16} /> Kanban Board
                </div>
                <span className="text-[11px] text-ink-muted">Project cards & lists</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Channel"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
