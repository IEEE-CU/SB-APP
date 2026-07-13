import { ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

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

export default function DataTable({
  columns,
  data,
  onRowClick,
  sortKey,
  sortDirection,
  onSort,
}: DataTableProps) {
  return (
    <div className="bg-surface rounded-lg border border-hairline overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-hairline bg-canvas-soft">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-eyebrow text-ink-muted tracking-wider select-none ${
                  col.sortable
                    ? "cursor-pointer hover:text-ink transition-colors"
                    : ""
                }`}
                onClick={() => {
                  if (col.sortable && onSort) onSort(col.key);
                }}
              >
                <div className="flex items-center gap-1.5 uppercase">
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
                        <div className="flex flex-col -gap-1 opacity-30">
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
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-body-sm text-ink-muted"
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((item, i) => (
              <tr
                key={item.id || i}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-hairline last:border-0 transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-canvas-soft" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-body-sm text-ink">
                    {col.render
                      ? col.render(item)
                      : String(item[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
