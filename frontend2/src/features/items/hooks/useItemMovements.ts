import { useQuery, useQueries } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api/inventory";
import { movementsApi } from "@/lib/api/movements";
import type { Movement } from "@/lib/types";

// Phase 7b Plan 05 — per-ITEM movement history (INV-07, item scope) for the
// item-detail HISTORY tab. The backend has no by-item movements endpoint, so we
// aggregate: fetch the item's inventory entries (shared cache key with the
// InventoryPanel — no double network fetch), then fan out one byInventory read
// per entry via useQueries. The merged list is sorted created_at desc.
//
// Movements emit no SSE; a move mutation invalidates the `["movements", wsId]`
// prefix, which covers every per-entry key here.
export interface ItemMovementsResult {
  movements: Movement[];
  isLoading: boolean;
}

export function useItemMovements(
  wsId: string,
  itemId: string,
): ItemMovementsResult {
  const enabled = Boolean(wsId) && Boolean(itemId);

  // Shared key with InventoryPanel — the cache is reused, not re-fetched.
  const entriesQuery = useQuery({
    queryKey: ["inventory", wsId, "by-item", itemId],
    queryFn: () => inventoryApi.byItem(wsId, itemId),
    enabled,
  });

  const entryIds = (entriesQuery.data ?? []).map((e) => e.id);

  const movementQueries = useQueries({
    queries: entryIds.map((invId) => ({
      // Same key shape as useMovementsQuery (Plan 02) so the move-mutation
      // prefix invalidation (`["movements", wsId]`) covers it.
      queryKey: ["movements", wsId, "inventory", invId],
      queryFn: () => movementsApi.byInventory(wsId, invId),
      enabled,
    })),
  });

  const movements = movementQueries
    .flatMap((q) => q.data ?? [])
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const isLoading =
    entriesQuery.isLoading || movementQueries.some((q) => q.isLoading);

  return { movements, isLoading };
}
