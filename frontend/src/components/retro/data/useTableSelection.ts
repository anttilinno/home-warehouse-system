import { useCallback, useRef, useState } from "react";

/** The modifier flags `onRowClick` reads off the originating mouse event. */
export type RowClickModifiers = Pick<
  React.MouseEvent,
  "shiftKey" | "metaKey" | "ctrlKey"
>;

export interface TableSelection {
  /** The set of currently-selected row ids. */
  selected: Set<string>;
  /**
   * Handle a click on the row with `id`. `e` supplies the modifier flags:
   * - plain → clear + select single + set the anchor,
   * - Shift → range-select between the anchor and `id` (by current order),
   * - Ctrl/Cmd → toggle `id` and move the anchor to it.
   */
  onRowClick: (id: string, e: RowClickModifiers) => void;
  /** Clear the whole selection and the anchor. */
  clear: () => void;
}

/**
 * Id-keyed anchor+range selection for tables (TUI-06).
 *
 * The selection is stored as a `Set<string>` of row ids plus an anchor id — it
 * is NEVER index-based. Shift+Click computes the contiguous range from the
 * CURRENT rendered order (`rows.map(r => r.id)`) at click time and persists
 * only the ids, so a subsequent re-sort or re-filter of `rows` cannot remap the
 * selection to different rows (Pitfall 1).
 */
export function useTableSelection<T extends { id: string }>(
  rows: T[],
): TableSelection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<string | null>(null);

  const onRowClick = useCallback(
    (id: string, e: RowClickModifiers) => {
      const anchor = anchorRef.current;

      if (e.shiftKey && anchor) {
        // Map the current rendered order to ids AT CLICK TIME and select the
        // contiguous span between the anchor and the target. Persist only ids.
        const ids = rows.map((r) => r.id);
        const from = ids.indexOf(anchor);
        const to = ids.indexOf(id);
        if (from === -1 || to === -1) {
          // Anchor or target no longer present (filtered out) — fall back to a
          // single select so the click never crashes or selects nothing.
          setSelected(new Set([id]));
          anchorRef.current = id;
          return;
        }
        const [lo, hi] = from <= to ? [from, to] : [to, from];
        const range = ids.slice(lo, hi + 1);
        setSelected((prev) => {
          const next = new Set(prev);
          for (const rid of range) next.add(rid);
          return next;
        });
        // Anchor stays put so the user can re-extend the range from the same end.
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        // Toggle this id in/out and move the anchor to it.
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        anchorRef.current = id;
        return;
      }

      // Plain click (or Shift with no anchor): clear + select single + anchor.
      setSelected(new Set([id]));
      anchorRef.current = id;
    },
    [rows],
  );

  const clear = useCallback(() => {
    setSelected(new Set());
    anchorRef.current = null;
  }, []);

  return { selected, onRowClick, clear };
}
