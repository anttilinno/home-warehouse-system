import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { containerApi, type Container } from "@/lib/api/container";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10 Plan 03 — the Containers list query. MIRRORS useCategoriesQuery (key
// PREFIX ["containers", wsId] + enabled !!wsId + retry false) adapted to the
// PAGINATED container envelope: containerApi.list returns { items, total, … } so
// we read .items (Pitfall 2 / Pitfall 3 — list is paginated, clamp limit=100).
//
// Containers are FLAT (a single location_id) — TAX-05's "grouped by location" is
// a CLIENT group-by in ContainersTab, NOT a tree. The group-header location
// NAMES are resolved by the tab from useLocationsQuery rows (no per-row fan-out).
//
// The query key is the PLAIN ["containers", wsId] PREFIX so the mutation-layer
// invalidate (useContainerMutations) covers it WITHOUT exact:true (T-10-03).

export interface UseContainersQueryResult {
  rows: Container[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useContainersQuery(): UseContainersQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["containers", wsId],
    // PAGINATED envelope — read .items (limit clamped to 100 in containerApi).
    queryFn: () =>
      containerApi.list(wsId as string, 1, 100).then((r) => r.items),
    enabled: !!wsId,
    retry: false,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
