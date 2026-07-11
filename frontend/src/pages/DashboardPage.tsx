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

import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
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
import type { Event, Society } from "@/types/models";

// ═══════════════════════════════════════════════════════════════════════════
// LOGO UTILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps lowercase logoSlug → file extension.
 * Constructs the logo src path: /logos/{slug}_logo.{ext}
 *
 * Files live in frontend/public/logos/ (gitignored binary assets).
 * Vite serves public/ at /, so /logos/cs_logo.png resolves correctly in dev.
 *
 * TODO(Team 4 integration): When backend returns a full `logoUrl` per society
 * (Cloudinary/S3), delete this map and return society.logoUrl directly.
 */
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

// ═══════════════════════════════════════════════════════════════════════════
// SECTION A — STAT CARDS
// ═══════════════════════════════════════════════════════════════════════════

const STAT_CARDS = [
  {
    module: "societies",
    label: "Societies",
    icon: Building2,
    path: "/societies",
    accentRgb: "42,157,153",
    accentHex: "#2a9d99",
  },
  {
    module: "events",
    label: "Events",
    icon: Calendar,
    path: "/events",
    accentRgb: "37,99,235",
    accentHex: "#2563eb",
  },
  {
    module: "projects",
    label: "Projects",
    icon: FolderKanban,
    path: "/projects",
    accentRgb: "221,91,0",
    accentHex: "#dd5b00",
  },
  {
    module: "reports",
    label: "Reports",
    icon: FileText,
    path: "/reports",
    accentRgb: "33,49,131",
    accentHex: "#213183",
  },
] as const;

function StatCards() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {STAT_CARDS.map((card, i) => (
        <PermissionGate key={card.module} module={card.module} action="read">
          <button
            onClick={() => navigate(card.path)}
            aria-label={`Go to ${card.label}`}
            className="dash-fade-up group relative overflow-hidden rounded-xl text-left w-full
                       border border-hairline bg-surface
                       transition-all duration-300
                       hover:scale-[1.03] hover:shadow-elevated
                       focus:outline-none focus:ring-2 focus:ring-primary/40"
            style={{
              animationDelay: `${i * 90}ms`,
            }}
          >
            {/* Accent colour blob — purely decorative, behind content */}
            <div
              className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl
                         opacity-30 group-hover:opacity-50 transition-opacity duration-300
                         pointer-events-none"
              style={{ background: card.accentHex }}
            />

            <div className="relative p-4 sm:p-5">
              {/* Icon badge */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4
                           transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{
                  background: `rgba(${card.accentRgb}, 0.12)`,
                }}
              >
                <card.icon size={20} style={{ color: card.accentHex }} />
              </div>

              {/* Module label — clear, legible */}
              <p
                className="text-body-sm font-semibold text-ink-secondary
                           group-hover:text-ink transition-colors duration-200"
              >
                {card.label}
              </p>

              {/* Hover arrow indicator */}
              <span
                className="absolute bottom-4 right-4 text-caption font-bold
                           opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ color: card.accentHex }}
                aria-hidden="true"
              >
                →
              </span>
            </div>
          </button>
        </PermissionGate>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION B — EVENTS HERO CAROUSEL  (GPU-accelerated sliding)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EventsCarousel
 *
 * Sliding hero carousel — uses CSS `transform: translateX()` on a flex
 * track of full-width slides. GPU-accelerated via `will-change: transform`.
 * Each slide is `flex-shrink-0 w-full` so it always fills the container exactly.
 * Auto-advances every 4.5 s. Manual arrows cancel + reset the timer.
 *
 * Slide technique (from research):
 *   - Outer:  overflow-hidden, reference width
 *   - Track:  display flex, transition transform 0.55 s ease-in-out
 *   - Slides: flex-shrink-0, width 100% of outer → translateX(-N*100%) per step
 *
 * ── Backend integration ─────────────────────────────────────────────────────
 *  Data: eventService.getEvents(1, 10) → GET /api/v1/events?page=1&limit=10
 *  No changes needed here when real backend goes live.
 *  To filter by status/society: coordinate query params with Team 2.
 *
 * ── Gradient placeholder ────────────────────────────────────────────────────
 *  TODO: Replace EVENT_GRADIENT_PLACEHOLDER with per-status gradient map.
 *  See /ideas.md (gitignored) for 3 proposed palette options.
 *  Usage once agreed: GRADIENT_BY_STATUS[event.status] ?? EVENT_GRADIENT_PLACEHOLDER
 */

/** TODO(gradient): Swap with final palette from /ideas.md */
const EVENT_GRADIENT_PLACEHOLDER =
  "linear-gradient(135deg, #1e40af 0%, #1e3a8a 55%, #0f2460 100%)";

function EventsCarousel() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Refs for managing the native scrolling and auto-advance timer
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // TODO(backend): Swap env var when Team 2 deploys to staging.
  useEffect(() => {
    eventService
      .getEvents(1, 10)
      .then((res) => setEvents(res.data.data))
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to load events"),
      )
      .finally(() => setLoading(false));
  }, []);

  // ── Native Scrolling & Bi-directional Infinite Loop ───────────────────────
  // We sandwich real slides between a cloned last slide at position 0 and a
  // cloned first slide at the end. This makes scrolling left from the first
  // real slide wrap seamlessly to the last real slide, and vice versa.
  //
  //  displayEvents = [clone_of_last, ...events, clone_of_first]
  //  Initial scroll position = index 1 (the first real slide)
  //
  const displayEvents =
    events.length > 1
      ? [events[events.length - 1], ...events, events[0]]
      : events;

  // Real slide activeIndex (0-based, refers to events[]), not display index
  // Display index of the first real slide = 1 (because we prepend a clone)
  const displayOffset = events.length > 1 ? 1 : 0;

  const scrollTo = useCallback(
    (displayIndex: number, behavior: ScrollBehavior = "smooth") => {
      if (!scrollRef.current) return;
      const container = scrollRef.current;
      const slideWidth = container.clientWidth;
      container.style.scrollBehavior = behavior;
      container.scrollLeft = displayIndex * slideWidth;
      if (behavior === "auto") {
        requestAnimationFrame(() => {
          if (container) container.style.scrollBehavior = "smooth";
        });
      }
    },
    [],
  );

  // Jump to index 1 (first real slide) on mount once events load
  useEffect(() => {
    if (events.length > 1) {
      scrollTo(displayOffset, "auto");
    }
  }, [events.length, displayOffset, scrollTo]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || events.length <= 1) return;
    const container = scrollRef.current;
    const slideWidth = container.clientWidth;
    const scrollPos = container.scrollLeft;
    const currentDisplayIndex = Math.round(scrollPos / slideWidth);

    if (currentDisplayIndex === 0) {
      // Scrolled to the cloned-last prepended slide → jump to real last
      setActiveIndex(events.length - 1);
      scrollTo(events.length, "auto");
    } else if (currentDisplayIndex === events.length + 1) {
      // Scrolled to the cloned-first appended slide → jump to real first
      setActiveIndex(0);
      scrollTo(displayOffset, "auto");
    } else {
      setActiveIndex(currentDisplayIndex - displayOffset);
    }
  }, [events.length, displayOffset, scrollTo]);

  const handleManual = useCallback(
    (nextRealIndex: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Wrap around
      const clamped =
        nextRealIndex < 0
          ? events.length - 1
          : nextRealIndex >= events.length
            ? 0
            : nextRealIndex;
      scrollTo(clamped + displayOffset, "smooth");
      setActiveIndex(clamped);
    },
    [events.length, displayOffset, scrollTo],
  );

  // ── Auto-advance ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (events.length <= 1) return;
    timerRef.current = setTimeout(() => {
      handleManual(activeIndex + 1);
    }, 4500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex, events.length, scrollTo, handleManual]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="w-full rounded-2xl animate-pulse"
        style={{
          minHeight: "clamp(200px, 38vh, 400px)",
          background: EVENT_GRADIENT_PLACEHOLDER,
          opacity: 0.3,
        }}
      />
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <div
        className="w-full rounded-2xl border border-hairline bg-surface
                   flex flex-col items-center justify-center gap-3 text-center px-6"
        style={{ minHeight: "clamp(160px, 28vh, 280px)" }}
      >
        <Calendar size={36} className="text-ink-faint" />
        <p className="text-body-sm font-semibold text-ink-secondary">
          No events yet
        </p>
        <p className="text-caption text-ink-faint max-w-xs">
          Events will appear here once added via the Events module.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl group"
      style={{ minHeight: "clamp(220px, 40vh, 420px)" }}
      role="region"
      aria-label="Events carousel"
      aria-roledescription="carousel"
    >
      {/* ── Sliding track (Native Scroll Snapping) ──────────────────────────
       *   - `overflow-x-auto` + `snap-x` allows flawless native trackpad/touch swipes.
       *   - `no-scrollbar` hides the UI scrollbar.
       */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex h-full w-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
        style={{ scrollBehavior: "smooth" }}
      >
        {displayEvents.map((event, i) => (
          <div
            key={`${event.id}-${i}`}
            className="relative flex-shrink-0 w-full snap-center"
            style={{ minHeight: "clamp(220px, 40vh, 420px)" }}
            role="group"
            aria-roledescription="slide"
            aria-label={event.title}
          >
            {/* Slide gradient background */}
            <div
              className="absolute inset-0"
              style={{ background: EVENT_GRADIENT_PLACEHOLDER }}
            >
              {/* Dot-grid texture overlay */}
              <div
                className="absolute inset-0 opacity-[0.08] pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
            </div>

            {/* Slide content */}
            <div
              className="relative flex flex-col justify-end h-full p-5 sm:p-8 lg:p-10"
              style={{ minHeight: "clamp(220px, 40vh, 420px)" }}
            >
              <span className="self-start inline-flex items-center px-3 py-1 mb-3 rounded-full capitalize bg-black/25 backdrop-blur-sm border border-white/20 text-white text-eyebrow font-semibold">
                {event.status}
              </span>

              <h2
                className="text-white font-bold leading-tight mb-2"
                style={{
                  fontSize: "clamp(1.2rem, 3vw + 0.5rem, 2rem)",
                  textShadow: "0 2px 8px rgba(0,0,0,0.45)",
                }}
              >
                {event.title}
              </h2>

              {event.description && (
                <p
                  className="text-white/90 text-body-sm mb-3 line-clamp-2 max-w-xl"
                  style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
                >
                  {event.description}
                </p>
              )}

              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-1 text-white/85 text-caption font-medium mb-5"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
              >
                {event.date && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} aria-hidden="true" />
                    {new Date(event.date).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} aria-hidden="true" />
                    {event.location}
                  </span>
                )}
              </div>

              <button
                onClick={() => navigate(`/events/${event.id}`)}
                className="self-start px-5 py-2.5 rounded-lg font-medium text-body-sm bg-white text-primary hover:bg-white/90 active:bg-white/80 transition-all duration-200 shadow-soft-1"
              >
                View Details →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Left arrow ────────────────────────────────────────────────────── */}
      <button
        onClick={() => handleManual(activeIndex - 1)}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/25 flex items-center justify-center text-white transition-all duration-200 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Previous event"
      >
        <ChevronLeft size={18} />
      </button>

      {/* ── Right arrow ───────────────────────────────────────────────────── */}
      <button
        onClick={() => handleManual(activeIndex + 1)}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/25 flex items-center justify-center text-white transition-all duration-200 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Next event"
      >
        <ChevronRight size={18} />
      </button>

      {/* ── Dot indicators ────────────────────────────────────────────────── */}
      {events.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10"
          role="tablist"
          aria-label="Event slides"
        >
          {events.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => handleManual(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === activeIndex ? 22 : 7,
                height: 7,
                background:
                  i === activeIndex
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.40)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION C — SOCIETY LOGO MARQUEE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SocietyMarquee
 *
 * Fetches all societies and renders them as an infinite left-scrolling
 * logo ticker. Pauses on hover. Rendered twice (doubled) so the CSS
 * animation can loop seamlessly: translateX(-50%) = exactly one set width.
 *
 * ── Backend integration ─────────────────────────────────────────────────────
 *  Data: societyService.getSocieties(1, 50) → GET /api/v1/societies
 *  Each society needs: { id, name, shortName, logoSlug }
 *  No changes needed when real backend goes live.
 *
 *  ⚠️  If all logos show as letters: the mock server has old cached data.
 *  Restart it: cd frontend && npm run mock
 *
 * ── Logo path ──────────────────────────────────────────────────────────────
 *  Logos in public/logos/ (gitignored). Vite serves public/ at / in dev.
 *  Logo URL: /logos/{logoSlug}_logo.{ext} via getLogoSrc().
 *  TODO(Team 4): Remove getLogoSrc() once backend returns full logoUrl.
 */
function SocietyMarquee() {
  const navigate = useNavigate();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // TODO(backend): societyService already targets VITE_API_BASE_URL/societies.
  useEffect(() => {
    societyService
      .getSocieties(1, 50)
      .then((res) => setSocieties(res.data.data))
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to load societies"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-28 rounded-xl animate-pulse bg-hairline/50" />;
  }
  if (societies.length === 0) return null;

  // Sort societies alphabetically
  const sortedSocieties = [...societies].sort((a, b) => {
    return sortOrder === "asc"
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name);
  });

  // Duplicate list → seamless infinite loop
  const doubled = [...sortedSocieties, ...sortedSocieties];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-heading-3 font-bold text-ink">Our Societies</h2>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          className="text-caption font-medium bg-surface border border-hairline rounded-md px-2 py-1 text-ink-secondary outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="asc">Sort A-Z</option>
          <option value="desc">Sort Z-A</option>
        </select>
      </div>

      {/* marquee-container class in index.css pauses .marquee-track on hover */}
      <div
        className="marquee-container overflow-hidden rounded-xl
                   border border-hairline bg-surface py-3"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
        }}
      >
        {/* marquee-track: CSS animation defined in index.css (marqueeScroll, 28s linear infinite) */}
        <div
          className="marquee-track flex gap-4"
          style={{ width: "max-content" }}
          aria-hidden="true"
        >
          {doubled.map((society, i) => (
            <SocietyLogoCard
              key={`${society.id}-${i}`}
              society={society}
              onClick={() => navigate(`/societies/${society.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Society Logo Card ─────────────────────────────────────────────────────

interface SocietyLogoCardProps {
  society: Society;
  onClick: () => void;
}

function SocietyLogoCard({ society, onClick }: SocietyLogoCardProps) {
  const [imgError, setImgError] = useState(false);

  // logoSlug from mock/real API — lowercase slug e.g. "cs", "wie", "ras"
  const slug = society.logoSlug ?? "";

  // shortName from API or auto-derived from initials
  const shortName =
    society.shortName ??
    society.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 5)
      .toUpperCase();

  // Can we attempt to load an image?
  const canShowImage = !imgError && slug.length > 0;

  return (
    <button
      onClick={onClick}
      title={society.name}
      className="group flex flex-col items-center justify-center gap-2
                 rounded-xl border border-hairline bg-surface flex-shrink-0
                 transition-all duration-200
                 hover:scale-105 hover:border-primary/40 hover:shadow-soft-1
                 focus:outline-none focus:ring-2 focus:ring-primary/30"
      style={{
        width: "clamp(80px, 9vw, 96px)",
        paddingBlock: "12px",
      }}
    >
      {/* Logo image — with letter-avatar fallback */}
      <div
        className="flex items-center justify-center"
        style={{ height: 44, width: 60 }}
      >
        {canShowImage ? (
          <img
            src={getLogoSrc(slug)}
            alt={`${shortName} logo`}
            loading="lazy"
            className="max-h-full max-w-full object-contain
                       transition-transform duration-200 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          /* Fallback: shown when logoSlug is missing or image fails to load */
          <div className="w-full h-full rounded-lg flex items-center justify-center img-placeholder">
            {shortName.slice(0, 3)}
          </div>
        )}
      </div>

      {/* Short name — clearly legible */}
      <span
        className="text-caption font-semibold text-ink-secondary
                   group-hover:text-primary transition-colors duration-200
                   text-center leading-tight px-1"
      >
        {shortName}
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  return (
    <div className="relative flex flex-col gap-6 sm:gap-8">
      {/* Decorative soft gradient blobs — only on wider screens */}
      <div
        className="hidden lg:block absolute -top-10 -right-10 w-72 h-72 rounded-full
                   pointer-events-none opacity-[0.08] blur-3xl -z-10"
        style={{
          background: "radial-gradient(circle, #2563eb, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div
        className="hidden lg:block absolute top-72 -left-16 w-56 h-56 rounded-full
                   pointer-events-none opacity-[0.06] blur-3xl -z-10"
        style={{
          background: "radial-gradient(circle, #213183, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Page heading */}
      <div className="relative">
        <h1 className="dash-fade-up text-heading-1 font-bold text-ink">
          IEEE Student Branch, ____
        </h1>
        <p
          className="dash-fade-up text-body-sm text-ink-muted mt-1"
          style={{ animationDelay: "60ms" }}
        >
          IEEE Student Branch, ____ — your unified workspace
        </p>
      </div>

      {/* ── Section A: Module stat cards ─────────────────────────────────── */}
      <section aria-label="Module overview">
        <StatCards />
      </section>

      {/* ── Section B: Events hero carousel ──────────────────────────────── */}
      <section aria-label="Upcoming events">
        <div
          className="dash-fade-up flex items-center justify-between mb-3"
          style={{ animationDelay: "120ms" }}
        >
          <h2 className="text-heading-3 font-bold text-ink">Events</h2>
          {/*
           * TODO: Add "View all →" link to /events once post-backend UX is agreed.
           */}
        </div>
        <div className="dash-fade-up" style={{ animationDelay: "170ms" }}>
          <EventsCarousel />
        </div>
      </section>

      {/* ── Section C: Society logo marquee ──────────────────────────────── */}
      <section
        aria-label="Our societies"
        className="dash-fade-up pb-2"
        style={{ animationDelay: "230ms" }}
      >
        <SocietyMarquee />
      </section>
    </div>
  );
}
