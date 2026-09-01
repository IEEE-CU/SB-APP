import { ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

interface Column {
  key: string;
  header: string;
  render?: (item: any) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (item: any) => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 350, damping: 30 }
  },
};

export default function DataTable({
  columns,
  data,
  onRowClick,
  sortKey,
  sortDirection,
  onSort,
}: DataTableProps) {
  return (
    <div className="bg-surface/50 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/5 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/20 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-4 text-xs font-bold text-ink-muted uppercase tracking-widest whitespace-nowrap select-none ${
                    col.sortable
                      ? "cursor-pointer hover:text-ink transition-colors"
                      : ""
                  }`}
                  onClick={() => {
                    if (col.sortable && onSort) onSort(col.key);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {col.header}
                    {col.sortable && (
                      <div className="flex flex-col opacity-50">
                        {sortKey === col.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp
                              size={14}
                              className="opacity-100 text-primary"
                            />
                          ) : (
                            <ChevronDown
                              size={14}
                              className="opacity-100 text-primary"
                            />
                          )
                        ) : (
                          <div className="flex flex-col -gap-1 opacity-40">
                            <ChevronUp size={10} className="translate-y-[2px]" />
                            <ChevronDown
                              size={10}
                              className="-translate-y-[2px]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-12 text-center text-sm font-medium text-ink-muted"
                >
                  No data available
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {data.map((item, i) => (
                  <motion.tr
                    variants={rowVariants}
                    key={item.id || i}
                    onClick={() => onRowClick?.(item)}
                    className={`border-b border-white/10 dark:border-white/5 last:border-0 transition-all duration-200 ${
                      onRowClick ? "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" : ""
                    }`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-5 py-4 text-sm font-medium text-ink whitespace-nowrap">
                        {col.render
                          ? col.render(item)
                          : String(item[col.key] ?? "")}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
