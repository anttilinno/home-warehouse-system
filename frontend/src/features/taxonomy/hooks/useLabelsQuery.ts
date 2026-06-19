import { labelsApi } from "@/lib/api/labels";
import type { Label } from "@/lib/types";
import { useTaxonomyListQuery } from "./useTaxonomyListQuery";

// Phase 10 Plan 04 (TAX-07) — the Labels list query. Built on the shared
// useTaxonomyListQuery skeleton (PLAIN ["labels", wsId] PREFIX so the
// useLabelMutations invalidate covers it WITHOUT exact:true). The BARE { items }
// label envelope is unwrapped by labelsApi.listWorkspaceLabels itself (Pitfall 2
// — no total; NEVER read .total), so the fetch arg returns the array directly.

export interface UseLabelsQueryResult {
  rows: Label[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useLabelsQuery(): UseLabelsQueryResult {
  return useTaxonomyListQuery<Label>("labels", (wsId) =>
    labelsApi.listWorkspaceLabels(wsId),
  );
}
