import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { locationApi, type Location } from "@/lib/api/location";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { buildTree, type TreeNode } from "@/features/taxonomy/lib/buildTree";

// Phase 10 Plan 03 — the Locations list query. MIRRORS useCategoriesQuery (key
// PREFIX ["locations", wsId] + enabled !!wsId + retry false) but adapted to the
// PAGINATED location envelope: locationApi.list returns { items, total, … } so
// we read .items (Pitfall 2 / Pitfall 3 — list is paginated, clamp limit=100).
//
// The query key is the PLAIN ["locations", wsId] PREFIX so the mutation-layer
// invalidate (useLocationMutations) covers it WITHOUT exact:true (T-10-03 — no
// stale tree after a mutation). The tree is built CLIENT-SIDE from the flat rows
// via buildTree(l => l.parent_location) — NOT parent_location_id (Pitfall 6; the
// Location type makes a typo a compile error).

export interface UseLocationsQueryResult {
  rows: Location[];
  tree: TreeNode<Location>[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useLocationsQuery(): UseLocationsQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["locations", wsId],
    // PAGINATED envelope — read .items (limit clamped to 100 in locationApi).
    queryFn: () => locationApi.list(wsId as string, 1, 100).then((r) => r.items),
    enabled: !!wsId,
    retry: false,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);

  // Client-build the tree from the flat rows. parent_location (NOT
  // parent_location_id — Pitfall 6); buildTree surfaces orphans at root.
  const tree = useMemo(
    () => buildTree(rows, (l) => l.parent_location),
    [rows],
  );

  return {
    rows,
    tree,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
