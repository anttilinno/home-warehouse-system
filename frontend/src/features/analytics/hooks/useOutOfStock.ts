import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { OutOfStockItem } from "@/features/analytics/types";

// Phase 13b Plan 01 Task 2 — the out-of-stock rows (ANL-04 backing). Reads the
// separate /analytics/out-of-stock endpoint (NOT part of the summary). Keyed
// under ["analytics", wsId] (T-13b-01 gate); `retry: false`.

export interface UseOutOfStockResult {
  items: OutOfStockItem[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Out-of-stock table rows, keyed ["analytics", wsId, "out-of-stock"].
 * Defaults `items` to [] so the table renders its empty state on no-workspace /
 * empty without a call-site guard.
 */
export function useOutOfStock(): UseOutOfStockResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["analytics", wsId, "out-of-stock"],
    queryFn: () => analyticsApi.outOfStock(wsId as string),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
