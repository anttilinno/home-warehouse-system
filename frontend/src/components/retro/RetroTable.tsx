import type { ComponentPropsWithRef } from "react";

export type RetroTableProps = ComponentPropsWithRef<"table">;

// Plain composable table chrome: bg-panel-2 header strip, sand row rules,
// even-row striping, hover, and aria-selected row treatment. The descendant
// rules live in globals.css under `.rtable` (@layer components) because
// nth-child striping and hover can't compose from per-cell utilities.
//
// Usage: <RetroTable><thead>…</thead><tbody>…</tbody></RetroTable>
// Mark selected rows with aria-selected="true"; mono data cells with
// className="mono" (tabular-nums applied).
export function RetroTable({ className = "", ...props }: RetroTableProps) {
  return <table className={`rtable ${className}`} {...props} />;
}
