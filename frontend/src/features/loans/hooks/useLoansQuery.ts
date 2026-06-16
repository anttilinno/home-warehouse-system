import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { loansApi } from "@/lib/api/loans";
import type { Loan } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 8 Plan 02 — the /loans tab→endpoint selector (Pattern 1 in 08-RESEARCH).
// Three tabs map to three reads:
//   active  → GET /loans/active   (server-filtered open loans)
//   overdue → GET /loans/overdue  (server-filtered past-due loans)
//   history → GET /loans          then client-filter !is_active (override 4 —
//             there is NO /loans/returned endpoint; the bare list is the only
//             source of returned rows).
// The default tab is "active". The query key is the ["loans", wsId, tab] family
// so it sits UNDER the ["loans", wsId] prefix the Phase 6 SSE invalidation rule
// already covers — do NOT use exact:true, do NOT append to invalidationMap.
// The list envelope is a BARE { items } (Pitfall 3 / Pitfall 4): no
// total/page/total_pages metadata is read here.

export type LoansTab = "active" | "overdue" | "history";

const VALID_TABS: ReadonlySet<LoansTab> = new Set([
  "active",
  "overdue",
  "history",
]);

/** Decode the active tab from `?tab=` (default "active", unknown → "active"). */
export function readLoansTab(params: URLSearchParams): LoansTab {
  const raw = params.get("tab");
  return VALID_TABS.has(raw as LoansTab) ? (raw as LoansTab) : "active";
}

export interface UseLoansQueryResult {
  items: Loan[];
  isLoading: boolean;
  isError: boolean;
  tab: LoansTab;
}

/**
 * URL-param-driven loans list query. Reads `?tab=`, picks the matching endpoint,
 * and (for the history tab only) filters the bare list down to `!is_active`
 * client-side. Keyed `["loans", wsId, tab]` so prefix invalidation covers it.
 * `enabled` only when a workspace is selected.
 */
export function useLoansQuery(): UseLoansQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [searchParams] = useSearchParams();

  const tab = useMemo(() => readLoansTab(searchParams), [searchParams]);

  const query = useQuery({
    queryKey: ["loans", wsId, tab],
    queryFn: () => {
      const ws = wsId as string;
      if (tab === "overdue") return loansApi.overdue(ws);
      if (tab === "history") return loansApi.list(ws);
      return loansApi.active(ws);
    },
    enabled: Boolean(wsId),
    retry: false,
  });

  const items = useMemo(() => {
    const rows = query.data?.items ?? [];
    // History has no dedicated returned endpoint — the bare list mixes active +
    // returned rows, so filter to the terminal (!is_active) ones client-side.
    return tab === "history" ? rows.filter((l) => !l.is_active) : rows;
  }, [query.data, tab]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    tab,
  };
}
