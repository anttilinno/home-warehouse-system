import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { inventoryApi, type InventoryListParams } from "@/lib/api/inventory";
import type { InventoryListResponse } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Per-page is fixed at 25 (CONTEXT-locked, mirrors ITEMS_LIMIT). GET /inventory
// accepts ONLY page + limit — there is NO server-side facet filter (R1). Every
// other facet (search / status / condition / location) lives in COMPONENT state
// and is applied client-side to the loaded page (07b-RESEARCH endpoint table).
export const INVENTORY_LIMIT = 25;

/** The decoded, URL-driven list state. Only `page` round-trips to the URL. */
export interface InventoryListUrlState {
  page: number;
}

/**
 * Decode the list state from the URL search params. Inventory has NO server
 * filter params (R1), so the ONLY URL-driven key is `?page` — the deep-link +
 * back-button surface. Filters/sort live in component state.
 */
export function readInventoryUrlState(
  params: URLSearchParams,
): InventoryListUrlState {
  return {
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

/** Map the decoded URL state to the inventoryApi list params. */
export function toListParams(
  state: InventoryListUrlState,
): InventoryListParams {
  return {
    page: state.page,
    limit: INVENTORY_LIMIT,
  };
}

export interface UseInventoryQueryResult {
  query: UseQueryResult<InventoryListResponse>;
  state: InventoryListUrlState;
  params: InventoryListParams;
}

/**
 * URL-param-driven inventory list query. Keyed `["inventory", wsId, params]` so
 * the mutation-layer prefix invalidation (`["inventory", wsId]`) covers it
 * WITHOUT `exact:true`. Returns the query result plus the decoded URL state the
 * page renders its pager from. `enabled` only when a workspace is selected.
 */
export function useInventoryQuery(): UseQueryResult<InventoryListResponse> &
  UseInventoryQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const [searchParams] = useSearchParams();

  const state = useMemo(
    () => readInventoryUrlState(searchParams),
    [searchParams],
  );
  const params = useMemo(() => toListParams(state), [state]);

  const query = useQuery({
    queryKey: ["inventory", wsId, params],
    queryFn: () => inventoryApi.list(wsId as string, params),
    enabled: !!wsId,
    retry: false,
  });

  return { ...query, query, state, params };
}
