import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { itemsApi, type ItemListParams } from "@/lib/api/items";
import { settingsApi } from "@/lib/api/settings";
import type { ItemListResponse } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Per-page is fixed at 25 (CONTEXT-locked — sketch 008's "50 / page" was filler).
export const ITEMS_LIMIT = 25;

/** The default sort header when none is in the URL. */
export const DEFAULT_SORT = "name";
export const DEFAULT_SORT_DIR = "asc";

/** The decoded, URL-driven list params (the single source of truth). */
export interface ItemsListUrlState {
  q: string;
  /** Committed `SEARCH:` tokens (`?terms=a,b`); AND-combined with `q`. */
  terms: string[];
  category: string;
  insured: boolean;
  needsReview: boolean;
  sort: string;
  sortDir: string;
  page: number;
}

// The backend `search` runs through plainto_tsquery, which ANDs its lexemes, so
// the live query + every committed term join with spaces into one AND search.
function joinSearch(q: string, terms: string[]): string | undefined {
  const parts = [q.trim(), ...terms].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Decode the list state from the URL search params (?q&category&sort&sort_dir
 * &page). This is the SSOT for the URL-driven filters/sort/page so the list
 * deep-links and the back button works (Pattern 1). The archived toggle is NO
 * longer URL-driven — it is the global, backend-synced `show_archived` user
 * preference, read from the shared ["me"] query in the hook below.
 */
export function readItemsUrlState(params: URLSearchParams): ItemsListUrlState {
  const termsRaw = params.get("terms") ?? "";
  return {
    q: params.get("q") ?? "",
    terms: termsRaw
      ? termsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    category: params.get("category") ?? "",
    insured: params.get("insured") === "1",
    needsReview: params.get("needs_review") === "1",
    sort: params.get("sort") ?? DEFAULT_SORT,
    sortDir: params.get("sort_dir") ?? DEFAULT_SORT_DIR,
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

/** Map the decoded URL state to the itemsApi list params (archived set separately). */
export function toListParams(state: ItemsListUrlState): ItemListParams {
  return {
    search: joinSearch(state.q, state.terms),
    category_id: state.category || undefined,
    is_insured: state.insured || undefined,
    needs_review: state.needsReview || undefined,
    sort: state.sort,
    sort_dir: state.sortDir,
    page: state.page,
    limit: ITEMS_LIMIT,
  };
}

export interface UseItemsQueryResult {
  query: UseQueryResult<ItemListResponse>;
  state: ItemsListUrlState;
  params: ItemListParams;
}

/**
 * URL-param-driven items list query. Keyed `["items", wsId, params]` so the
 * Phase 6 SSE invalidation map (`["items", wsId]` prefix) covers it WITHOUT
 * `exact:true`. Returns both the query result and the decoded URL state the
 * page renders its FilterBar/sort/pager from.
 *
 * `archived` comes from the global `show_archived` user preference (shared
 * ["me"] query), NOT the URL — toggling it on Settings → Data & Storage flips
 * `params.archived`, which is part of the query key, so the list refetches.
 */
export function useItemsQuery(): UseQueryResult<ItemListResponse> &
  UseItemsQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [searchParams] = useSearchParams();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => settingsApi.getMe(),
  });
  const showArchived = me.data?.show_archived ?? false;

  const state = useMemo(() => readItemsUrlState(searchParams), [searchParams]);
  const params = useMemo(
    () => ({
      ...toListParams(state),
      // Only sent when the preference is on — the default query excludes
      // archived (buildQuery in items.ts drops `archived:false`).
      archived: showArchived ? true : undefined,
    }),
    [state, showArchived],
  );

  const query = useQuery({
    // Phase 6 contract: ["items", wsId, ...rest] — prefix-match invalidation.
    queryKey: ["items", wsId, params],
    queryFn: () => itemsApi.list(wsId as string, params),
    enabled: !!wsId,
    retry: false,
  });

  return { ...query, query, state, params };
}
