import { useState, useEffect } from "react";
import { ChevronDown, Building2, Check } from "lucide-react";
import { useSocietyStore, Society } from "@/store/societyStore";
import api from "@/lib/api";

export default function SocietySwitcher() {
  const { activeSociety, societies, setActiveSociety, setSocieties } = useSocietyStore();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSocieties = async () => {
      try {
        setLoading(true);
        const res = await api.get("/societies");
        const list = res.data?.data || res.data || [];
        setSocieties(list);
      } catch (err) {
        // Fallback default list if API not connected yet
        setSocieties([
          { id: "cs", name: "Computer Society", shortName: "CS", type: "SOCIETY" },
          { id: "ras", name: "Robotics & Automation Society", shortName: "RAS", type: "SOCIETY" },
          { id: "wie", name: "Women in Engineering", shortName: "WIE", type: "AFFINITY_GROUP" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSocieties();
  }, [setSocieties]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-canvas-soft hover:bg-canvas-soft/80 border border-hairline/60 text-ink transition-colors"
      >
        <Building2 size={16} className="text-primary" />
        <span className="text-body-sm font-medium max-w-[140px] truncate">
          {activeSociety ? activeSociety.shortName || activeSociety.name : "Select Society"}
        </span>
        <ChevronDown size={14} className={`text-ink-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-56 bg-surface border border-hairline/60 rounded-xl shadow-xl z-50 py-1"
          onClick={() => setIsOpen(false)}
        >
          <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-ink-faint uppercase">
            Switch Society / Workspace
          </div>
          {loading ? (
            <div className="px-3 py-2 text-caption text-ink-muted">Loading...</div>
          ) : (
            societies.map((society: Society) => (
              <button
                key={society.id}
                onClick={() => setActiveSociety(society)}
                className={`w-full flex items-center justify-between px-3 py-2 text-body-sm text-left hover:bg-canvas-soft transition-colors ${
                  activeSociety?.id === society.id ? "text-primary font-semibold" : "text-ink-secondary"
                }`}
              >
                <div className="flex flex-col truncate">
                  <span className="truncate">{society.name}</span>
                  <span className="text-[10px] text-ink-muted capitalize">{society.type.toLowerCase().replace(/_/g, " ")}</span>
                </div>
                {activeSociety?.id === society.id && <Check size={14} className="text-primary flex-shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
