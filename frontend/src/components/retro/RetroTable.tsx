import {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
} from "react";
import { isEditableTarget } from "@/components/shortcuts";

export type RetroTableProps = ComponentPropsWithRef<"table">;

const NEXT_KEYS = new Set(["j", "ArrowDown"]);
const PREV_KEYS = new Set(["k", "ArrowUp"]);

function rowsOf(root: HTMLElement | null): HTMLTableRowElement[] {
  return Array.from(root?.querySelectorAll("tbody tr") ?? []);
}

/** Moves the data-active-row marker to `index`; returns the clamped index. */
function activateRow(rows: HTMLTableRowElement[], index: number): number {
  const next = Math.max(0, Math.min(index, rows.length - 1));
  for (const row of rows) delete row.dataset.activeRow;
  const row = rows[next];
  if (row) {
    row.dataset.activeRow = "true";
    row.scrollIntoView?.({ block: "nearest" });
  }
  return next;
}

// Plain composable table chrome: bg-panel-2 header strip, sand row rules,
// even-row striping, hover, and aria-selected row treatment. The descendant
// rules live in globals.css under `.rtable` (@layer components) because
// nth-child striping and hover can't compose from per-cell utilities.
//
// Usage: <RetroTable><thead>…</thead><tbody>…</tbody></RetroTable>
// Mark selected rows with aria-selected="true"; mono data cells with
// className="mono" (tabular-nums applied).
//
// Keyboard: the scroller is focusable; j/ArrowDown and k/ArrowUp move the
// data-active-row cursor through tbody rows, Enter clicks the current row.
export function RetroTable({
  className = "",
  "aria-label": ariaLabel,
  ...props
}: RetroTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(-1);

  // Right-edge overflow cue (C6): touch users get no scrollbar, so a wide table
  // silently hides columns off the right. Flag the OUTER (non-scrolling) wrapper
  // when the inner scroller has more content to the right; globals.css paints a
  // hard-edged shade overlay pinned to the visible right edge.
  const update = useCallback(() => {
    const el = scrollRef.current;
    const wrap = el?.parentElement;
    if (!el || !wrap) return;
    const more = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    wrap.dataset.overflowRight = more ? "true" : "false";
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isEditableTarget(e.target)) return;
    const step = NEXT_KEYS.has(e.key) ? 1 : PREV_KEYS.has(e.key) ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      activeRef.current = activateRow(
        rowsOf(scrollRef.current),
        activeRef.current + step,
      );
      return;
    }
    if (e.key === "Enter")
      rowsOf(scrollRef.current)[activeRef.current]?.click();
  };

  // Scroll the table horizontally WITHIN the inner container. A wide multi-column
  // table's min-content width otherwise propagates up through ancestors that
  // lack `min-width:0` (e.g. the retro Window), forcing the whole card wider
  // than the viewport — which AppShell then CLIPS (no page scroll, content cut
  // off). The overflow-x container caps that: the table scrolls in place and
  // the card stays viewport-width. min-w-0 lets the wrapper shrink in flex/grid
  // parents too. The outer wrapper is the fixed anchor for the overflow overlay.
  return (
    <div className="rtable-wrap relative min-w-0">
      {/* biome-ignore lint/a11y/useSemanticElements: a scroll container, not a form fieldset */}
      <div
        ref={scrollRef}
        role="group"
        aria-label={ariaLabel ?? "Table"}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable scroller hosts the j/k row cursor
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="min-w-0 overflow-x-auto outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
      >
        <table
          className={`rtable ${className}`}
          aria-label={ariaLabel}
          {...props}
        />
      </div>
    </div>
  );
}
