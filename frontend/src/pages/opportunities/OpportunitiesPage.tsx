import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Check,
  ChevronDown,
  ExternalLink,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  opportunityService,
  type Opportunity,
  type OpportunitySociety,
} from "@/services/opportunities";
import { LoadingSpinner, SearchInput } from "@/components/ui";
import {
  PageTransition,
  AnimatedCard,
  AnimatedBadge,
} from "@/components/ui/WatermelonMotion";

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function OpportunitiesPage() {
  const [societies, setSocieties] = useState<OpportunitySociety[]>([]);
  const [societiesError, setSocietiesError] = useState(false);
  const [societiesLoading, setSocietiesLoading] = useState(true);
  const [selected, setSelected] = useState<string>("GENERAL");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setSocietiesLoading(true);
    setSocietiesError(false);
    opportunityService
      .getSocieties()
      .then((res) => setSocieties(res.data.data))
      .catch(() => setSocietiesError(true))
      .finally(() => setSocietiesLoading(false));
  }, [retryCount]);

  useEffect(() => {
    setLoading(true);
    setQuery("");
    opportunityService
      .getOpportunities(selected)
      .then((res) => {
        setItems(res.data.data);
        setFallbackUrl(res.data.fallbackUrl);
      })
      .catch(() => {
        setItems([]);
        setFallbackUrl(null);
      })
      .finally(() => setLoading(false));
  }, [selected]);

  const current = societies.find((s) => s.society === selected);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.title.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Award className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-heading-1 font-bold text-ink">
              Awards & Scholarships
            </h1>
            <p className="text-body-sm text-ink-muted mt-0.5">
              Grants, fellowships, and scholarships sourced from official IEEE
              society pages.
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-30 bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-4 shadow-lg space-y-3">
        <span className="text-body-xs text-ink-muted uppercase font-bold px-1">
          Society
        </span>
        {societiesError ? (
          <div className="flex items-center gap-3 px-1">
            <p className="text-body-sm text-red-500">
              Couldn't load the society list.
            </p>
            <button
              type="button"
              onClick={() => setRetryCount((n) => n + 1)}
              className="text-body-sm text-primary font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        ) : societiesLoading ? (
          <div className="h-11 w-full sm:w-80 rounded-xl bg-canvas-soft animate-pulse" />
        ) : (
          <div className="relative w-full sm:w-80" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-surface/50 border border-white/10 dark:border-white/5 rounded-xl text-body-sm font-semibold text-ink hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer"
            >
              <span className="truncate">
                {current?.label || "Select a society"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-ink-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 mt-2 max-h-80 overflow-y-auto bg-canvas-soft border border-white/10 dark:border-white/5 rounded-2xl shadow-2xl z-50 py-1.5"
                >
                  {societies.map((s) => (
                    <button
                      key={s.society}
                      type="button"
                      onClick={() => {
                        setSelected(s.society);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-body-sm text-left transition-colors ${
                        selected === s.society
                          ? "text-primary font-semibold bg-primary/5"
                          : "text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                      }`}
                    >
                      <span className="truncate">{s.label}</span>
                      {selected === s.society && (
                        <Check size={14} className="shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {items.length > 0 && (
          <div className="pt-1">
            <SearchInput
              onSearch={setQuery}
              placeholder="Search within results..."
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <AnimatedCard className="p-12 text-center bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl text-ink-muted space-y-3">
          <RefreshCw className="mx-auto text-ink-muted opacity-50" size={36} />
          <p className="font-semibold text-ink text-body-md">
            No listings could be parsed automatically for{" "}
            {current?.label || selected} right now.
          </p>
          {(fallbackUrl || current?.url) && (
            <a
              href={fallbackUrl || current?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
            >
              Visit the official page <ExternalLink size={14} />
            </a>
          )}
        </AnimatedCard>
      ) : filteredItems.length === 0 ? (
        <AnimatedCard className="p-12 text-center bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl text-ink-muted space-y-3">
          <Info size={36} className="mx-auto text-ink-muted opacity-50" />
          <p className="font-semibold text-ink text-body-md">
            No results match "{query}".
          </p>
        </AnimatedCard>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, index) => (
            <AnimatedCard
              key={item.id}
              className="group bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-5 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-xl"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 bg-primary/10 rounded-xl shrink-0">
                    <Sparkles className="text-primary" size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-md font-semibold text-ink group-hover:text-primary transition-colors line-clamp-2">
                      {item.title}
                    </p>
                    <AnimatedBadge className="mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-primary/10 text-primary uppercase border border-primary/10">
                      {hostnameOf(item.link)}
                    </AnimatedBadge>
                  </div>
                </div>
                <ExternalLink
                  size={18}
                  className="shrink-0 mt-1 text-ink-faint group-hover:text-primary transition-colors"
                />
              </a>
            </AnimatedCard>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
