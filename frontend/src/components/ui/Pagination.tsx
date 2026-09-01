import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/types/api";
import { motion } from "framer-motion";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export default function Pagination({ meta, onPageChange }: PaginationProps) {
  if (!meta) return null;
  const { page, totalPages } = meta;
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-6">
      <p className="text-xs font-semibold text-ink-muted">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.92, transition: { type: "spring", stiffness: 400, damping: 25 } }}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-2.5 rounded-full bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
        >
          <ChevronLeft size={16} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92, transition: { type: "spring", stiffness: 400, damping: 25 } }}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2.5 rounded-full bg-surface/60 backdrop-blur-xl border border-white/20 dark:border-white/5 text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
        >
          <ChevronRight size={16} />
        </motion.button>
      </div>
    </div>
  );
}
