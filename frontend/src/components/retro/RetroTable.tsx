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
  // Scroll the table horizontally WITHIN its container. A wide multi-column
  // table's min-content width otherwise propagates up through ancestors that
  // lack `min-width:0` (e.g. the retro Window), forcing the whole card wider
  // than the viewport — which AppShell then CLIPS (no page scroll, content cut
  // off). The overflow-x container caps that: the table scrolls in place and
  // the card stays viewport-width. min-w-0 lets the wrapper shrink in flex/grid
  // parents too.
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className={`rtable ${className}`} {...props} />
    </div>
  );
}
