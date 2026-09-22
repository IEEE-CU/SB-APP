import { useEffect, useState } from "react";
import { Award, ExternalLink, RefreshCw } from "lucide-react";
import { opportunityService, type Opportunity, type OpportunitySociety } from "@/services/opportunities";
import { LoadingSpinner } from "@/components/ui";
import { PageTransition, AnimatedCard } from "@/components/ui/WatermelonMotion";

export default function OpportunitiesPage() {
  const [societies, setSocieties] = useState<OpportunitySociety[]>([]);
  const [societiesError, setSocietiesError] = useState(false);
  const [societiesLoading, setSocietiesLoading] = useState(true);
  const [selected, setSelected] = useState<string>("GENERAL");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

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

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Award className="text-primary" size={28} />
          <h1 className="text-heading-1 font-bold text-ink">Awards & Scholarships</h1>
        </div>

        <div className="mb-6">
          <label className="block text-body-sm font-medium text-ink-secondary mb-1.5">
            Society
          </label>
          {societiesError ? (
            <div className="flex items-center gap-3">
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
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={societiesLoading}
              className="w-full sm:w-80 px-4 py-2.5 bg-surface/50 border border-white/10 dark:border-white/5 rounded-xl text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50"
            >
              {societiesLoading ? (
                <option>Loading societies...</option>
              ) : (
                societies.map((s) => (
                  <option key={s.society} value={s.society}>
                    {s.label}
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : items.length === 0 ? (
          <AnimatedCard className="p-8 bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl text-center">
            <RefreshCw className="mx-auto mb-3 text-ink-muted" size={28} />
            <p className="text-body-sm text-ink-secondary mb-4">
              No listings could be parsed automatically for {current?.label || selected} right now.
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
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <AnimatedCard
                key={item.id}
                className="p-4 bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl"
              >
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-3 group"
                >
                  <span className="text-body-sm font-medium text-ink group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                  <ExternalLink
                    size={16}
                    className="shrink-0 mt-0.5 text-ink-faint group-hover:text-primary transition-colors"
                  />
                </a>
              </AnimatedCard>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
