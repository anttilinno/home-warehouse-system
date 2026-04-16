import { useQuery } from "@tanstack/react-query";
import { itemsApi, itemKeys, type ItemListParams } from "@/lib/api/items";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Paginated items list query.
 *
 * Returns the FULL query result (not a flattened items array) so callers can
 * read `data.items`, `data.total`, `data.total_pages` for pagination rendering.
 *
 * Uses placeholderData: (prev) => prev (TanStack Query v5 idiom) to keep the
 * previous page visible during refetch — smooth pagination without flicker.
 * Replaces the v4 `keepPreviousData: true` flag.
 *
 * workspaceId comes from useAuth() (v2.0/v2.1 rule: never pass as prop).
 */
export function useItemsList(params: ItemListParams) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => itemsApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    placeholderData: (prev) => prev,
  });
}
