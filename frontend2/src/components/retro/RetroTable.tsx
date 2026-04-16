import type { ReactNode } from "react";

interface RetroTableColumn {
  key: string;
  // ReactNode so callers can pass a visually-hidden span (e.g. an
  // `<span className="sr-only">Thumbnail</span>`) for a column whose
  // visual header is intentionally empty. Strings remain valid.
  header: ReactNode;
  className?: string;
}

interface RetroTableProps {
  columns: RetroTableColumn[];
  data: Record<string, ReactNode>[];
  className?: string;
}

function RetroTable({ columns, data, className }: RetroTableProps) {
  return (
    <div className={`overflow-x-auto ${className || ""}`}>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="bg-retro-charcoal text-white text-[14px] font-bold uppercase font-sans py-sm px-md border-retro-thick border-retro-ink text-left"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={rowIndex % 2 === 0 ? "bg-retro-cream" : "bg-white"}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`font-mono text-[14px] text-retro-ink py-sm px-md border-retro-thick border-retro-ink ${col.className || ""}`}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { RetroTable };
export type { RetroTableProps, RetroTableColumn };
