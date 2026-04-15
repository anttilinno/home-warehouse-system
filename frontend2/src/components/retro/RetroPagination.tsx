import { forwardRef } from "react";
import { useLingui } from "@lingui/react/macro";

interface RetroPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onChange: (nextPage: number) => void;
  className?: string;
}

function buildPages(page: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | "…"> = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
  if (left > 2) pages.push("…");
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
}

const buttonBase =
  "min-h-[44px] md:min-h-[36px] px-sm border-retro-thick border-retro-ink font-mono text-[14px] outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber disabled:opacity-50 disabled:cursor-not-allowed";

const RetroPagination = forwardRef<HTMLDivElement, RetroPaginationProps>(
  ({ page, pageSize, totalCount, onChange, className }, ref) => {
    const { t } = useLingui();
    if (totalCount <= pageSize) return null;
    const totalPages = Math.ceil(totalCount / pageSize);
    const pages = buildPages(page, totalPages);

    return (
      <div
        ref={ref}
        className={`flex items-center gap-sm flex-wrap ${className || ""}`}
      >
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className={`${buttonBase} bg-retro-cream`}
        >
          {t`← PREV`}
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`e-${i}`}
              className="font-mono text-[14px] text-retro-cream px-xs"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${buttonBase} ${p === page ? "bg-retro-amber" : "bg-retro-cream"}`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className={`${buttonBase} bg-retro-cream`}
        >
          {t`NEXT →`}
        </button>
        <span className="font-mono text-[14px] text-retro-cream ml-sm">
          {t`Page ${page} of ${totalPages}`}
        </span>
      </div>
    );
  }
);

RetroPagination.displayName = "RetroPagination";

export { RetroPagination };
export type { RetroPaginationProps };
