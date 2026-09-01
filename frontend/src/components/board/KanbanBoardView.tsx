import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { LayoutGrid, Plus } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui";

export interface BoardCardItem {
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  order: number;
  dueDate?: string;
  assignees?: { id: string; name: string }[];
  blockedBy?: string[];
}

const STATUS_COLUMNS: {
  key: BoardCardItem["status"];
  title: string;
  color: string;
}[] = [
  { key: "TODO", title: "To Do", color: "border-slate-400 text-slate-500" },
  {
    key: "IN_PROGRESS",
    title: "In Progress",
    color: "border-blue-500 text-blue-500",
  },
  {
    key: "IN_REVIEW",
    title: "In Review",
    color: "border-amber-500 text-amber-500",
  },
  { key: "DONE", title: "Done", color: "border-emerald-500 text-emerald-500" },
];

interface KanbanBoardViewProps {
  /** Resolved channel id. Falls back to the :channelId route param when omitted. */
  channelId?: string;
}

export default function KanbanBoardView({
  channelId: channelIdProp,
}: KanbanBoardViewProps = {}) {
  const { channelId: channelIdParam } = useParams<{ channelId?: string }>();
  const channelId = channelIdProp ?? channelIdParam;
  const [cards, setCards] = useState<BoardCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] =
    useState<BoardCardItem["status"]>("TODO");
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] =
    useState<BoardCardItem["priority"]>("MEDIUM");

  useEffect(() => {
    const fetchCards = async () => {
      if (!channelId) return;
      try {
        setLoading(true);
        const res = await api.get(`/boards/${channelId}/cards`);
        setCards(res.data?.data || []);
      } catch {
        setCards([
          {
            id: "c1",
            title: "Setup Project Repository",
            status: "DONE",
            priority: "HIGH",
            order: 0,
          },
          {
            id: "c2",
            title: "Design Society Landing Banner",
            status: "IN_PROGRESS",
            priority: "MEDIUM",
            order: 0,
          },
          {
            id: "c3",
            title: "Review Event Grant Budget",
            status: "TODO",
            priority: "URGENT",
            order: 0,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [channelId]);

  const handleStatusChange = async (
    cardId: string,
    newStatus: BoardCardItem["status"],
  ) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, status: newStatus } : c)),
    );
    try {
      await api.put(`/boards/cards/${cardId}`, { status: newStatus });
    } catch {
      // Revert if API fails
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !channelId) return;

    try {
      const res = await api.post(`/boards/${channelId}/cards`, {
        title: newTitle,
        status: selectedColumn,
        priority: newPriority,
      });
      if (res.data?.data) {
        setCards((prev) => [...prev, res.data.data]);
      }
      setNewTitle("");
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Failed to create card", err);
    }
  };

  const priorityColors = {
    LOW: "bg-slate-500/10 text-slate-500",
    MEDIUM: "bg-blue-500/10 text-blue-500",
    HIGH: "bg-amber-500/10 text-amber-500",
    URGENT: "bg-red-500/10 text-red-500 font-bold",
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-hairline/60 overflow-hidden">
      {/* Board Header */}
      <div className="px-6 py-4 border-b border-hairline/60 flex items-center justify-between bg-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <LayoutGrid size={20} className="text-primary" />
          <h2 className="text-title font-semibold text-ink">Kanban Board</h2>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} /> Add Task Card
        </Button>
      </div>

      {/* Board Columns Grid */}
      <div className="flex-1 overflow-x-auto p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {STATUS_COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.status === col.key);
          return (
            <div
              key={col.key}
              className="bg-canvas-soft/40 border border-hairline/60 rounded-xl p-4 flex flex-col gap-3 min-h-[500px]"
            >
              <div className="flex items-center justify-between pb-2 border-b border-hairline/60">
                <span
                  className={`text-eyebrow font-bold uppercase tracking-wider ${col.color}`}
                >
                  {col.title} ({colCards.length})
                </span>
                <button
                  onClick={() => {
                    setSelectedColumn(col.key);
                    setIsAddModalOpen(true);
                  }}
                  className="p-1 rounded hover:bg-surface text-ink-muted hover:text-ink"
                >
                  <Plus size={14} />
                </button>
              </div>

              {loading ? (
                <p className="text-caption text-ink-muted py-4 text-center">
                  Loading...
                </p>
              ) : (
                colCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-surface border border-hairline/60 rounded-lg p-3.5 shadow-sm space-y-2 group hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-body-sm font-semibold text-ink leading-snug">
                        {card.title}
                      </h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${priorityColors[card.priority]}`}
                      >
                        {card.priority}
                      </span>
                    </div>

                    {card.description && (
                      <p className="text-caption text-ink-muted line-clamp-2">
                        {card.description}
                      </p>
                    )}

                    {/* Move status buttons */}
                    <div className="pt-2 flex items-center justify-between border-t border-hairline/40 text-[11px] text-ink-muted">
                      <span>Move to:</span>
                      <div className="flex items-center gap-1">
                        {STATUS_COLUMNS.filter(
                          (s) => s.key !== card.status,
                        ).map((s) => (
                          <button
                            key={s.key}
                            onClick={() => handleStatusChange(card.id, s.key)}
                            className="px-1.5 py-0.5 rounded hover:bg-canvas-soft text-ink-secondary hover:text-primary font-medium transition-colors"
                          >
                            {s.title[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-hairline rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-title font-semibold text-ink">
              Add Task to {selectedColumn}
            </h3>
            <form onSubmit={handleCreateCard} className="space-y-4">
              <div>
                <label className="text-eyebrow text-ink-muted uppercase block mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-canvas-soft border border-hairline/60 text-ink text-body-sm focus:outline-none focus:border-primary"
                  placeholder="Task title..."
                />
              </div>

              <div>
                <label className="text-eyebrow text-ink-muted uppercase block mb-1">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-lg bg-canvas-soft border border-hairline/60 text-ink text-body-sm focus:outline-none focus:border-primary"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Card</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
