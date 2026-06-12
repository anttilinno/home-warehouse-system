import { useLingui } from "@lingui/react/macro";
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
  "cursor-pointer border border-border-ink bg-bg-panel px-[9px] py-[2px] font-mono text-[12px] text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
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
}: RetroPaginationProps) {
  const { t } = useLingui();
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <nav
      aria-label={t`Pagination`}
      className="flex items-center gap-sp-2 border-t-2 border-border-ink bg-bg-panel-2 p-sp-3"
    >
      <BevelButton
        aria-label={t`Previous page`}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ◂ {t`PREV`}
      </BevelButton>

      <div className="flex items-center gap-sp-1">
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
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        {t`NEXT`} ▸
      </BevelButton>

      <span className="ml-auto font-mono text-[12px] tabular-nums text-fg-muted">
        {t`page ${page} of ${pageCount} · ${perPage} / page`}
      </span>
    </nav>
  );
}
