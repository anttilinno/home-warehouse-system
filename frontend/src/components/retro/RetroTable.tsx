import {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithRef,
} from "react";

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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Scroll the table horizontally WITHIN the inner container. A wide multi-column
  // table's min-content width otherwise propagates up through ancestors that
  // lack `min-width:0` (e.g. the retro Window), forcing the whole card wider
  // than the viewport — which AppShell then CLIPS (no page scroll, content cut
  // off). The overflow-x container caps that: the table scrolls in place and
  // the card stays viewport-width. min-w-0 lets the wrapper shrink in flex/grid
  // parents too. The outer wrapper is the fixed anchor for the overflow overlay.
  return (
    <div className="rtable-wrap relative min-w-0">
      <div ref={scrollRef} className="min-w-0 overflow-x-auto">
        <table className={`rtable ${className}`} {...props} />
      </div>
    </div>
  );
}
