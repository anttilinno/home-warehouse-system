import { useQuery } from "@tanstack/react-query";
import {
  wishlistApi,
  type WishlistItem,
  type WishlistStatus,
} from "@/lib/api/wishlist";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 14 Plan 03 — the /wishlist status-filtered list query (WISH-01). The
// status tab drives `?status=`; the query is keyed ["wishlist", wsId, status]
// (status ?? "all") so it sits UNDER the ["wishlist", wsId] prefix that the
// mutations invalidate. `enabled` only when a workspace is selected. The list
// envelope is `{ items, total }` — rows come from `.items` (NOT a bare list).

export interface UseWishlistResult {
  rows: WishlistItem[];
  total: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Status-param-driven wishlist query. `status` undefined → all statuses. Keyed
 * ["wishlist", wsId, status ?? "all"] so prefix invalidation covers it.
 */
export function useWishlist(status?: WishlistStatus): UseWishlistResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["wishlist", wsId, status ?? "all"],
    queryFn: () => wishlistApi.list(wsId as string, status),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    rows: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
