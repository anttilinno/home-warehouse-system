import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

export interface LoansListUi {
  page: number;
}

/**
 * URL-state hook for the loans list HISTORY tab pagination.
 *
 * v1 exposes only `page` — ACTIVE and OVERDUE tabs are unpaginated (the
 * backend endpoints return every row), and there are no filter controls on
 * the loans list in Phase 62. The hook mirrors the shape of
 * `useItemsListQueryParams` so future filter additions slot in cleanly.
 *
 * Page 1 is represented by an absent `?page=` key to keep URLs clean.
 * `Math.max(1, …)` guards against negative / NaN values from user-edited URLs.
 */
export function useLoansListQueryParams() {
  const [params, setParams] = useSearchParams();

  const ui: LoansListUi = useMemo(() => {
    const raw = params.get("page");
    const page = raw === null ? 1 : Math.max(1, parseInt(raw, 10) || 1);
    return { page };
  }, [params]);

  const updateUi = useCallback(
    (partial: Partial<LoansListUi>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (partial.page !== undefined) {
          if (partial.page <= 1) next.delete("page");
          else next.set("page", String(partial.page));
        }
        return next;
      });
    },
    [setParams],
  );

  return [ui, updateUi] as const;
}
