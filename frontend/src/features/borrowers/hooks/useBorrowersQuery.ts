import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { borrowersApi, type Borrower } from "@/lib/api/borrowers";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 9 Plan 01 — the borrower list query. Source pattern: useInventoryQuery
// (URL ?page round-trip) + the loans list-page client-search convention (OQ2 /
// binding override #2: the list page does NOT call /borrowers/search; it does a
// single ≤100 fetch and filters client-side).
//
// GET /borrowers caps limit at 100 (Pitfall 2: 422 over cap), so we fetch ONE
// page of up to 100 and paginate + search entirely in the client. NOTE: this
// means workspaces with >100 borrowers see only the first 100 — that is OUT of
// v3.0 parity scope (mirrors inventory's single-page client-filter note).
export const BORROWERS_PER_PAGE = 25; // mirrors INVENTORY_LIMIT
export const FETCH_LIMIT = 100; // 422-cap clamp (Pitfall 2)

export interface UseBorrowersQueryResult {
  all: Borrower[]; // the full fetched set (post-filter is `rows` paged)
  isLoading: boolean;
  isError: boolean;
  page: number; // clamped to [1, pageCount]
  pageCount: number;
  rows: Borrower[]; // the current page slice (post client-search)
}

/**
 * Borrower list hook. Fetches up to `FETCH_LIMIT` once, keyed under the
 * `["borrowers", wsId, …]` PREFIX (Pitfall 4 — so the mutation-layer prefix
 * invalidation covers it WITHOUT `exact:true`). `enabled` only when a workspace
 * is selected; `retry: false` so a load error surfaces immediately.
 *
 * Client-search filters name + email (lowercased substring, no debounce, no
 * /search call — OQ2 binding override #2). The current `?page` slice is the
 * deep-link + back-button surface.
 */
export function useBorrowersQuery(search: string): UseBorrowersQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const query = useQuery({
    queryKey: ["borrowers", wsId, { limit: FETCH_LIMIT, page: 1 }],
    queryFn: () => borrowersApi.list(wsId as string, 1, FETCH_LIMIT),
    enabled: !!wsId,
    retry: false,
  });

  const all = useMemo(() => query.data?.items ?? [], [query.data]);

  // Client search (name + email substring, lowercased trim) — matches the
  // loans list-page convention (OQ2). No debounce, no /search call.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.email ?? "").toLowerCase().includes(q),
    );
  }, [all, search]);

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / BORROWERS_PER_PAGE),
  );
  const clampedPage = Math.min(page, pageCount);
  const start = (clampedPage - 1) * BORROWERS_PER_PAGE;
  const rows = filtered.slice(start, start + BORROWERS_PER_PAGE);

  return {
    all,
    isLoading: query.isLoading,
    isError: query.isError,
    page: clampedPage,
    pageCount,
    rows,
  };
}
