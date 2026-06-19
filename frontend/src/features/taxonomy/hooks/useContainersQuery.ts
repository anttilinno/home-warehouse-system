import { containerApi, type Container } from "@/lib/api/container";
import { useTaxonomyListQuery } from "./useTaxonomyListQuery";

// Phase 10 Plan 03 — the Containers list query. Built on the shared
// useTaxonomyListQuery skeleton (PLAIN ["containers", wsId] PREFIX so the
// useContainerMutations invalidate covers it WITHOUT exact:true). The PAGINATED
// envelope is unwrapped to .items in the fetch arg (Pitfall 2 / Pitfall 3 — list
// is paginated, clamp limit=100).
//
// Containers are FLAT (a single location_id) — TAX-05's "grouped by location" is
// a CLIENT group-by in ContainersTab, NOT a tree (so no buildTree here). The
// group-header location NAMES are resolved by the tab from useLocationsQuery rows
// (no per-row fan-out).

export interface UseContainersQueryResult {
  rows: Container[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useContainersQuery(): UseContainersQueryResult {
  // PAGINATED envelope — read .items (limit clamped to 100 in containerApi).
  return useTaxonomyListQuery<Container>("containers", (wsId) =>
    containerApi.list(wsId, 1, 100).then((r) => r.items),
  );
}
