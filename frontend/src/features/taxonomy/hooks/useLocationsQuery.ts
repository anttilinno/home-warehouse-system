import { useMemo } from "react";
import { locationApi, type Location } from "@/lib/api/location";
import { buildTree, type TreeNode } from "@/features/taxonomy/lib/buildTree";
import { useTaxonomyListQuery } from "./useTaxonomyListQuery";

// Phase 10 Plan 03 — the Locations list query. Built on the shared
// useTaxonomyListQuery skeleton (PLAIN ["locations", wsId] PREFIX so the
// useLocationMutations invalidate covers it WITHOUT exact:true). The PAGINATED
// envelope is unwrapped to .items in the fetch arg (Pitfall 2 / Pitfall 3 — list
// is paginated, clamp limit=100). The tree is built CLIENT-SIDE from the flat
// rows via buildTree(l => l.parent_location) — NOT parent_location_id (Pitfall 6;
// the Location type makes a typo a compile error).

export interface UseLocationsQueryResult {
  rows: Location[];
  tree: TreeNode<Location>[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useLocationsQuery(): UseLocationsQueryResult {
  const base = useTaxonomyListQuery<Location>("locations", (wsId) =>
    // PAGINATED envelope — read .items (limit clamped to 100 in locationApi).
    locationApi.list(wsId, 1, 100).then((r) => r.items),
  );

  // Client-build the tree from the flat rows. parent_location (NOT
  // parent_location_id — Pitfall 6); buildTree surfaces orphans at root.
  const tree = useMemo(
    () => buildTree(base.rows, (l) => l.parent_location),
    [base.rows],
  );

  return { ...base, tree };
}
