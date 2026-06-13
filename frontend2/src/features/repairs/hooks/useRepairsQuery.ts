import { useQuery } from "@tanstack/react-query";
import { repairsApi } from "@/lib/api/repairs";
import type { Repair, RepairCostSummary } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10b Plan 02 — the per-inventory repair reads for the Repairs drawer
// (RPR-01 list + RPR-02 cost rollup). Two queries, both gated on a non-null
// invId so they only fire while the drawer is open:
//   by-inventory → ["repairs", wsId, "by-inventory", invId]
//   cost rollup  → ["repairs", wsId, "cost", invId]
// Both keys sit UNDER the ["repairs", wsId] prefix so useRepairMutations'
// prefix-invalidate covers them (mirrors useLoansQuery's prefix discipline). The
// list envelope is { items, total }; the cost envelope is a BARE { items }
// (one RepairCostSummary per currency — NEVER cross-currency summed).

export interface UseRepairsByInventoryResult {
  items: Repair[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Per-inventory repair list, keyed ["repairs", wsId, "by-inventory", invId].
 * `enabled` only when a workspace is selected AND invId is non-null (drawer open).
 */
export function useRepairsByInventoryQuery(
  invId: string | null,
): UseRepairsByInventoryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["repairs", wsId, "by-inventory", invId],
    queryFn: () => repairsApi.byInventory(wsId as string, invId as string),
    enabled: Boolean(wsId) && invId !== null,
    retry: false,
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export interface UseRepairCostResult {
  summaries: RepairCostSummary[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Per-inventory repair cost rollup, keyed ["repairs", wsId, "cost", invId].
 * Returns one summary per currency (grouped server-side) — the drawer header
 * renders one line per entry and NEVER sums across currencies (OQ5). `enabled`
 * only when a workspace is selected AND invId is non-null (drawer open).
 */
export function useRepairCostQuery(invId: string | null): UseRepairCostResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["repairs", wsId, "cost", invId],
    queryFn: () => repairsApi.cost(wsId as string, invId as string),
    enabled: Boolean(wsId) && invId !== null,
    retry: false,
  });

  return {
    summaries: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
