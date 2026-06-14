import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { itemsApi, type ItemListParams } from "@/lib/api/items";
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
  category: string;
  archived: boolean;
  sort: string;
  sortDir: string;
  page: number;
}

/**
 * Decode the list state from the URL search params (?q&category&archived&sort
 * &sort_dir&page). This is the SSOT — every filter/sort/page lives here so the
 * list deep-links and the back button works (Pattern 1).
 */
export function readItemsUrlState(params: URLSearchParams): ItemsListUrlState {
  return {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    // The Archived facet is OFF by default; archived items stay hidden until the
    // facet sets ?archived=true.
    archived: params.get("archived") === "true",
    sort: params.get("sort") ?? DEFAULT_SORT,
    sortDir: params.get("sort_dir") ?? DEFAULT_SORT_DIR,
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

/** Map the decoded URL state to the itemsApi list params (archived omitted when off). */
export function toListParams(state: ItemsListUrlState): ItemListParams {
  return {
    search: state.q || undefined,
    category_id: state.category || undefined,
    // Only sent when the facet is on — the default query excludes archived
    // (buildQuery in items.ts drops `archived:false`, so this is belt-and-braces).
    archived: state.archived ? true : undefined,
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
 */
export function useItemsQuery(): UseQueryResult<ItemListResponse> &
  UseItemsQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [searchParams] = useSearchParams();

  const state = useMemo(
    () => readItemsUrlState(searchParams),
    [searchParams],
  );
  const params = useMemo(() => toListParams(state), [state]);

  const query = useQuery({
    // Phase 6 contract: ["items", wsId, ...rest] — prefix-match invalidation.
    queryKey: ["items", wsId, params],
    queryFn: () => itemsApi.list(wsId as string, params),
    enabled: !!wsId,
    retry: false,
  });

  return { ...query, query, state, params };
}
