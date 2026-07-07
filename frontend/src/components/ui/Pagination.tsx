import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/types/api';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export default function Pagination({ meta, onPageChange }: PaginationProps) {
  const { page, totalPages } = meta;
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-caption text-ink-muted">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-2 rounded-md border border-hairline text-ink-secondary hover:bg-canvas-soft disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2 rounded-md border border-hairline text-ink-secondary hover:bg-canvas-soft disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
