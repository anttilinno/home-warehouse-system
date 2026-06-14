import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  declutterApi,
  type DeclutterGroupBy,
  type DeclutterItem,
} from "@/lib/api/declutter";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 14 Plan 04 (DECL-01/02) — the declutter list query + mark-used mutation.
// The query key is the ["declutter", wsId, groupBy, thresholdDays] family so the
// mutation's invalidate({ queryKey: ["declutter", wsId] }) PREFIX-covers every
// param variant. enabled only when a workspace is selected.

const DEFAULT_THRESHOLD = 90;

export interface UseDeclutterOpts {
  groupBy?: DeclutterGroupBy;
  thresholdDays?: number;
}

export interface UseDeclutterResult {
  rows: DeclutterItem[];
  total: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Workspace-scoped declutter analysis query. Re-queries whenever groupBy or
 * thresholdDays change (both sit in the query key as stable primitives).
 */
export function useDeclutter(opts: UseDeclutterOpts = {}): UseDeclutterResult {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const groupBy = opts.groupBy ?? "none";
  const thresholdDays = opts.thresholdDays ?? DEFAULT_THRESHOLD;

  const query = useQuery({
    queryKey: ["declutter", wsId, groupBy, thresholdDays],
    queryFn: () =>
      declutterApi.list(wsId as string, { groupBy, thresholdDays }),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    rows: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/**
 * Marks one inventory row used (POST /inventory/{id}/mark-used) and invalidates
 * the whole ["declutter", wsId] family so the list refetches without the row.
 * The mutate arg is the INVENTORY row id (DeclutterItem.id), NEVER item_id.
 */
export function useMarkUsed() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inventoryId: string) =>
      declutterApi.markUsed(wsId as string, inventoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["declutter", wsId] });
    },
  });
}
