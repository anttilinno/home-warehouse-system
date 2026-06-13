import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { labelsApi } from "@/lib/api/labels";
import type { Label } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10 Plan 04 (TAX-07) — the Labels list query. Mirrors useCategoriesQuery
// (key ["…", wsId] PREFIX + enabled !!wsId + retry false) adapted to the BARE
// { items } label envelope (Pitfall 2 — labelsApi.listWorkspaceLabels returns
// no total; NEVER read .total). The PLAIN ["labels", wsId] key is the PREFIX so
// the mutation-layer invalidate (useLabelMutations) covers it WITHOUT exact:true.

export interface UseLabelsQueryResult {
  rows: Label[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useLabelsQuery(): UseLabelsQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["labels", wsId],
    queryFn: () => labelsApi.listWorkspaceLabels(wsId as string),
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
