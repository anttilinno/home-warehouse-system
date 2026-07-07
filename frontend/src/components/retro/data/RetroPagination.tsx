import { useLingui } from "@lingui/react/macro";
import { PixelIcon } from "@/components/retro";
import { BevelButton } from "../BevelButton";

export interface RetroPaginationProps {
  /** Current 1-based page. */
  page: number;
  /** Total number of pages (≥ 1). */
  pageCount: number;
  /** Rows shown per page (rendered in the meta sentence). */
  perPage: number;
  /** Fired with the target 1-based page on prev/next/page-button activation. */
  onPageChange: (page: number) => void;
}

// Verbatim sketch-008 `.pager .pg` page button; current page takes the accent
// fill + hard ink shadow (the accent-current rule).
const PAGE_BTN =
  "cursor-pointer border border-border-ink bg-bg-panel px-[9px] py-[2px] font-mono text-12 text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const PAGE_BTN_CURRENT = "bg-titlebar-blue font-bold shadow-hard-ink";

/**
 * Beveled pager strip (sketch 008 `.pager`, TUI list pages).
 *
 * Recessed `bg-bg-panel-2` strip with `◂ PREV` / `NEXT ▸` BevelButtons,
 * numbered page buttons (current = accent fill), and a right-aligned mono
 * `tabular-nums` meta sentence.
 */
export function RetroPagination({
  page,
  pageCount,
  perPage,
  onPageChange,
}: Readonly<RetroPaginationProps>) {
  const { t } = useLingui();
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <nav
      aria-label={t`Pagination`}
      // flex-wrap so the controls + meta sentence drop to the next line instead
      // of overflowing the card on narrow viewports (the row can't fit PREV +
      // page buttons + NEXT + "page X of Y" at mobile width).
      className="flex flex-wrap items-center gap-sp-2 border-t-2 border-border-ink bg-bg-panel-2 p-sp-3"
    >
      <BevelButton
        aria-label={t`Previous page`}
        title={t`Previous page`}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {/* Icon-only below sm so the whole pager fits one row on mobile;
            the PREV/NEXT labels return from sm up. aria-label carries the name. */}
        <PixelIcon name="chevron-left" size={16} />
        <span className="hidden sm:inline"> {t`PREV`}</span>
      </BevelButton>

      <div className="flex flex-wrap items-center gap-sp-1">
        {pages.map((p) => {
          const isCurrent = p === page;
          return (
            <button
              key={p}
              type="button"
              aria-current={isCurrent ? "page" : undefined}
              className={`${PAGE_BTN} ${isCurrent ? PAGE_BTN_CURRENT : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          );
        })}
      </div>

      <BevelButton
        aria-label={t`Next page`}
        title={t`Next page`}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <span className="hidden sm:inline">{t`NEXT`} </span>
        <PixelIcon name="chevron-right" size={16} />
      </BevelButton>

      <span className="ml-auto font-mono text-12 tabular-nums text-fg-muted">
        {/* Compact "X / Y" on mobile; the full sentence (with rows/page) from
            sm up — keeps the strip on one row at narrow widths. */}
        <span className="sm:hidden">
          {page} / {pageCount}
        </span>
        <span className="hidden sm:inline">
          {t`page ${page} of ${pageCount} · ${perPage} / page`}
        </span>
      </span>
    </nav>
  );
}
