/**
 * DashboardPage.tsx — IEEE Finance Pro
 *
 * The main post-login dashboard. Contains three sections:
 *
 *   A) StatCards       — compact animated module cards (glassmorphism + stagger)
 *   B) EventsCarousel  — GPU-accelerated sliding hero carousel (backend-ready)
 *   C) SocietyMarquee  — infinite CSS-animated logo ticker (backend-ready)
 *
 * ── Backend Integration Notes ──────────────────────────────────────────────
 *  All data is fetched via the shared Axios instance (src/lib/api.ts).
 *  When Team 2's real endpoints are deployed, no changes are needed here —
 *  simply update VITE_API_BASE_URL in .env.
 *
 *  Events    → eventService.getEvents()     → GET /api/v1/events
 *  Societies → societyService.getSocieties() → GET /api/v1/societies
 *
 * ── Logo Integration Notes ─────────────────────────────────────────────────
 *  Logos live in frontend/public/logos/ (gitignored).
 *  Each society has a `logoSlug` (lowercase) that maps to:
 *    /logos/{slug}_logo.{ext}
 *  See LOGO_EXT_MAP below. When Team 4 returns full `logoUrl` via
 *  Cloudinary/S3, remove LOGO_EXT_MAP + getLogoSrc() and use society.logoUrl.
 *
 *  ⚠️  If logos show as letter-avatars: restart the mock server so it picks
 *  up the updated db.json (npm run mock in /frontend).
 *
 * ── Gradient Notes ─────────────────────────────────────────────────────────
 *  Event carousel background: brand-blue placeholder.
 *  Final per-status gradients proposed in /ideas.md (gitignored, local only).
 *  TODO: implement GRADIENT_BY_STATUS[event.status] once palette is agreed.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Calendar,
  FolderKanban,
  FileText,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import PermissionGate from "@/components/PermissionGate";
import { eventService } from "@/services/events";
import { societyService } from "@/services/societies";
import { projectService } from "@/services/projects";
import { reportService } from "@/services/reports";
import type { Event, Society } from "@/types/models";
import { AnimatedCard } from "@/components/ui/WatermelonMotion";
import { motion, AnimatePresence } from "framer-motion";

const LOGO_EXT_MAP: Record<string, string> = {
  cs: "png",
  pes: "webp",
  pels: "png",
  ras: "png",
  aess: "png",
  aps: "png",
  cis: "png",
  grss: "png",
  mtts: "webp",
  sight: "webp",
  wie: "webp",
};

function getLogoSrc(slug: string): string {
  const ext = LOGO_EXT_MAP[slug.toLowerCase()] ?? "png";
  return `/logos/${slug.toLowerCase()}_logo.${ext}`;
}

const STAT_CARDS = [
  { module: "societies", label: "Societies", icon: Building2, path: "/societies", color: "from-blue-500/20 to-cyan-500/5", border: "border-blue-500/20" },
  { module: "events", label: "Events", icon: Calendar, path: "/events", color: "from-indigo-500/20 to-purple-500/5", border: "border-indigo-500/20" },
  { module: "projects", label: "Projects", icon: FolderKanban, path: "/projects", color: "from-orange-500/20 to-red-500/5", border: "border-orange-500/20" },
  { module: "reports", label: "Reports", icon: FileText, path: "/reports", color: "from-emerald-500/20 to-teal-500/5", border: "border-emerald-500/20" },
] as const;

function StatCards() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({ societies: 0, events: 0, projects: 0, reports: 0 });

  useEffect(() => {
    Promise.all([
      societyService.getSocieties(1, 1).catch(() => ({ data: { meta: { totalItems: 0 } } })),
      eventService.getEvents(1, 1).catch(() => ({ data: { meta: { totalItems: 0 } } })),
      projectService.getProjects(1, 1).catch(() => ({ data: { meta: { totalItems: 0 } } })),
      reportService.getReports(1, 1).catch(() => ({ data: { meta: { totalItems: 0 } } })),
    ]).then(([socRes, evtRes, projRes, repRes]) => {
      const getCount = (res: any) => res.data?.meta?.totalItems ?? (Array.isArray(res.data) ? res.data.length : res.data?.data?.length || 0);
      setCounts({
        societies: getCount(socRes),
        events: getCount(evtRes),
        projects: getCount(projRes),
        reports: getCount(repRes),
      });
    });
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {STAT_CARDS.map((card, i) => (
        <PermissionGate key={card.module} module={card.module} action="read">
          <AnimatedCard
            delay={i * 0.1}
            onClick={() => navigate(card.path)}
            className={`group relative overflow-hidden rounded-3xl p-6 text-left w-full bg-surface/60 backdrop-blur-xl border ${card.border} shadow-[0_8px_30px_rgb(0,0,0,0.04)] cursor-pointer`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-start justify-between mb-8">
                <div className="p-3 bg-white/50 dark:bg-black/20 rounded-2xl backdrop-blur-md shadow-sm">
                  <card.icon size={24} className="text-primary" />
                </div>
                <span className="text-3xl font-bold tracking-tight text-ink">{counts[card.module] || 0}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-secondary tracking-wide uppercase">{card.label}</p>
              </div>
            </div>
          </AnimatedCard>
        </PermissionGate>
      ))}
    </div>
  );
}

const EVENT_GRADIENT_PLACEHOLDER = "linear-gradient(135deg, rgba(0,122,255,0.8) 0%, rgba(90,200,250,0.8) 100%)";

function EventsCarousel() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventService.getEvents(1, 10).then((res) => setEvents(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="w-full rounded-3xl h-[400px] animate-pulse bg-surface/60" />;
  if (events.length === 0) return null;

  return (
    <AnimatedCard delay={0.3} className="relative overflow-hidden rounded-3xl h-[400px] sm:h-[450px] shadow-[0_20px_40px_-15px_rgba(0,122,255,0.3)] border border-primary/20">
      <div className="absolute inset-0" style={{ background: EVENT_GRADIENT_PLACEHOLDER }} />
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative flex flex-col justify-end h-full p-8 sm:p-12 text-white"
        >
          <span className="self-start px-4 py-1.5 mb-4 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/30 shadow-sm">
            {events[activeIndex].status}
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 max-w-3xl leading-tight">
            {events[activeIndex].title}
          </h2>
          {events[activeIndex].description && (
            <p className="text-white/90 text-lg mb-6 line-clamp-2 max-w-2xl font-medium">
              {events[activeIndex].description}
            </p>
          )}
          <div className="flex items-center gap-6 text-white/80 text-sm font-semibold mb-8">
            {events[activeIndex].date && (
              <span className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-md">
                <Calendar size={16} /> {new Date(events[activeIndex].date).toLocaleDateString()}
              </span>
            )}
            {events[activeIndex].location && (
              <span className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-md">
                <MapPin size={16} /> {events[activeIndex].location}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate(`/events/${events[activeIndex].id}`)}
            className="self-start px-6 py-3 rounded-2xl font-bold text-sm bg-white text-primary hover:scale-105 active:scale-95 transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)]"
          >
            View Details
          </button>
        </motion.div>
      </AnimatePresence>

      {events.length > 1 && (
        <div className="absolute bottom-6 right-8 flex items-center gap-3">
          <button
            onClick={() => setActiveIndex(activeIndex > 0 ? activeIndex - 1 : events.length - 1)}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setActiveIndex(activeIndex < events.length - 1 ? activeIndex + 1 : 0)}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </AnimatedCard>
  );
}

function SocietyMarquee() {
  const navigate = useNavigate();
  const [societies, setSocieties] = useState<Society[]>([]);

  useEffect(() => {
    societyService.getSocieties(1, 50).then((res) => setSocieties(res.data.data)).catch(() => {});
  }, []);

  if (societies.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold tracking-tight text-ink mb-6 px-2">Our Societies</h2>
      <div className="flex flex-wrap gap-4">
        {societies.map((society, i) => (
          <AnimatedCard
            key={society.id}
            delay={0.4 + i * 0.05}
            onClick={() => navigate(`/societies/${society.id}`)}
            className="flex items-center gap-4 p-4 pr-6 rounded-2xl bg-surface/60 backdrop-blur-xl border border-white/40 shadow-sm cursor-pointer hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-2 shadow-sm">
              {society.logoSlug ? (
                <img src={getLogoSrc(society.logoSlug)} alt={society.name} className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="font-bold text-primary">{society.name.substring(0,2)}</span>
              )}
            </div>
            <span className="font-semibold text-ink">{society.shortName || society.name.substring(0,8)}</span>
          </AnimatedCard>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="relative flex flex-col gap-8 pb-12 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 mt-4 px-2">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink mb-2">
          IEEE Campus Hub
        </h1>
        <p className="text-lg text-ink-muted font-medium">
          Your unified workspace for student branches and chapters.
        </p>
      </motion.div>

      <StatCards />
      <EventsCarousel />
      <SocietyMarquee />
    </div>
  );
}
