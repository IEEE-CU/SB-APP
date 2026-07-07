import { ReactNode } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Column<T = any> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
}

interface DataTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Column<any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRowClick?: (item: any) => void;
}

export default function DataTable({ columns, data, onRowClick }: DataTableProps) {
  return (
    <div className="bg-surface rounded-lg border border-hairline overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-hairline bg-canvas-soft">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-eyebrow text-ink-muted uppercase tracking-wider"
              >
                {col.header}
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
                key={i}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-hairline last:border-0 ${
                  onRowClick ? 'cursor-pointer hover:bg-canvas-soft' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-body-sm text-ink"
                  >
                    {col.render
                      ? col.render(item)
                      : String(item[col.key] ?? '')}
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
