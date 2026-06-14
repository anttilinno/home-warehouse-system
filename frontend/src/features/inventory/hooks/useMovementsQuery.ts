import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { movementsApi } from "@/lib/api/movements";
import type { Movement } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 7b Plan 02 — per-entry movement history for the row drawer (INV-07).
// Keyed `["movements", wsId, "inventory", invId]` so the move mutation's prefix
// invalidation (`["movements", wsId]`) covers it (movements emit no SSE — the
// move flow invalidates manually). Enabled only when both ids are present so
// the drawer can mount closed without a wasted fetch.
export function useMovementsQuery(
  invId: string | null,
): UseQueryResult<Movement[]> {
  const { currentWorkspaceId: wsId } = useWorkspace();

  return useQuery({
    queryKey: ["movements", wsId, "inventory", invId],
    queryFn: () => movementsApi.byInventory(wsId as string, invId as string),
    enabled: !!wsId && !!invId,
    retry: false,
  });
}
