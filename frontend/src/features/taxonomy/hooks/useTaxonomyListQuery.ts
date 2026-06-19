import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10 TAX refactor — the shared list-query skeleton behind every taxonomy
// entity hook (categories/locations/containers/labels). All four resolved the
// workspace, ran a useQuery on the PLAIN [key, wsId] PREFIX (enabled !!wsId,
// retry false — so the mutation-layer invalidate covers it WITHOUT exact:true),
// and memoized `rows = data ?? []`. The ONLY per-entity differences are the key
// string and how the API envelope is unwrapped to a flat array — both passed in
// via `fetch`. The tree-backed hooks (categories/locations) layer buildTree on
// top of `rows`. Behavior is identical to the hand-rolled hooks.

export interface TaxonomyListQueryResult<T> {
  rows: T[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Runs the standard taxonomy list query for `key` in the current workspace,
 * unwrapping the API envelope via `fetch`. Returns the memoized flat `rows`
 * plus the query status flags.
 */
export function useTaxonomyListQuery<T>(
  key: string,
  fetch: (wsId: string) => Promise<T[]>,
): TaxonomyListQueryResult<T> {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: [key, wsId],
    queryFn: () => fetch(wsId as string),
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
