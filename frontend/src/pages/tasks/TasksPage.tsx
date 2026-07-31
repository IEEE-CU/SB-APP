import { useState, useEffect } from "react";
import { CheckSquare, Plus, Trash2, Clock } from "lucide-react";
import api from "@/lib/api";
import { useSocietyStore } from "@/store/societyStore";
import { Button } from "@/components/ui";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
  dueDate?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  categoryName: string;
  categoryColor: string;
}

export default function TasksPage() {
  const { activeSocietyId } = useSocietyStore();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [categoryName, setCategoryName] = useState("General");

  useEffect(() => {
    fetchTasks();
  }, [activeSocietyId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tasks", { params: { societyId: activeSocietyId } });
      setTasks(res.data?.data || []);
    } catch {
      // Fallback demo tasks
      setTasks([
        { id: "t1", title: "Submit Monthly Financial Audit", completed: false, status: "IN_PROGRESS", priority: "HIGH", categoryName: "Finance", categoryColor: "#ef4444" },
        { id: "t2", title: "Prepare Agenda for AGM", completed: true, status: "COMPLETED", priority: "MEDIUM", categoryName: "General", categoryColor: "#3b82f6" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskCompleted = async (task: TaskItem) => {
    const newStatus = task.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, completed: newStatus === "COMPLETED" } : t))
    );
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
    } catch {
      // Revert if API fails
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.delete(`/tasks/${id}`);
    } catch {
      fetchTasks();
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const res = await api.post("/tasks", {
        title,
        description,
        dueDate: dueDate || null,
        categoryName,
        societyId: activeSocietyId,
      });
      if (res.data?.data) {
        setTasks((prev) => [res.data.data, ...prev]);
      }
      setTitle("");
      setDescription("");
      setDueDate("");
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Failed to create task", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-hairline/60 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={22} className="text-primary" />
          <h1 className="text-heading-2 font-bold text-ink">Personal & Team Tasks</h1>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} /> New Task
        </Button>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-body-sm text-ink-muted text-center py-8">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="text-body-sm text-ink-muted text-center py-12">No tasks created yet.</p>
        ) : (
          tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between p-4 bg-canvas-soft/40 border border-hairline/60 rounded-xl group hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={t.status === "COMPLETED" || t.completed}
                  onChange={() => toggleTaskCompleted(t)}
                  className="w-5 h-5 rounded border-hairline text-primary focus:ring-primary cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className={`text-body-sm font-semibold ${t.status === "COMPLETED" ? "line-through text-ink-muted" : "text-ink"}`}>
                    {t.title}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-ink-muted mt-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-surface border border-hairline text-primary font-medium">
                      {t.categoryName}
                    </span>
                    {t.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {new Date(t.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDeleteTask(t.id)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-red-500 hover:bg-surface transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-hairline rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-title font-semibold text-ink">Create New Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-eyebrow text-ink-muted uppercase block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-canvas-soft border border-hairline/60 text-ink text-body-sm focus:outline-none focus:border-primary"
                  placeholder="Task title..."
                />
              </div>

              <div>
                <label className="text-eyebrow text-ink-muted uppercase block mb-1">Category</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-canvas-soft border border-hairline/60 text-ink text-body-sm focus:outline-none focus:border-primary"
                  placeholder="Finance, General, Event..."
                />
              </div>

              <div>
                <label className="text-eyebrow text-ink-muted uppercase block mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-canvas-soft border border-hairline/60 text-ink text-body-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-hairline">
                <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Task</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
