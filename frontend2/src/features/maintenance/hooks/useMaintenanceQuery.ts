import { useQuery } from "@tanstack/react-query";
import { maintenanceApi } from "@/lib/api/maintenance";
import type { DueSchedule, MaintenanceSchedule } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 10b Plan 04 — the maintenance reads (MNT-01 drawer list + MNT-02/03 due
// feed). Mirrors useRepairsQuery's prefix discipline: every key sits UNDER the
// ["maintenance", wsId] prefix so useMaintenanceMutations' prefix-invalidate
// covers them. The per-inventory list returns a BARE { items }; the due
// projection returns { items: DueSchedule[] } where `is_overdue` is a SERVER
// flag (NEVER computed client-side — override #3).

export interface UseSchedulesByInventoryResult {
  items: MaintenanceSchedule[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Per-inventory schedule list, keyed ["maintenance", wsId, "by-inventory", invId].
 * `enabled` only when a workspace is selected AND invId is non-null (drawer open).
 * The per-inventory endpoint returns plain schedules — NO is_overdue flag (the
 * overdue cue lives only on /maintenance/due — §4).
 */
export function useSchedulesByInventoryQuery(
  invId: string | null,
): UseSchedulesByInventoryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["maintenance", wsId, "by-inventory", invId],
    queryFn: () => maintenanceApi.byInventory(wsId as string, invId as string),
    enabled: Boolean(wsId) && invId !== null,
    retry: false,
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export interface UseMaintenanceDueResult {
  items: DueSchedule[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Due/overdue schedule projection, keyed ["maintenance", wsId, "due", days].
 * THIS is the Phase-13 dashboard feed hook (MNT-03) — Phase 13 mounts the
 * due-soon card on the SAME query key. Each row carries item_name + the server
 * is_overdue flag; the page renders that flag, never client date math.
 */
export function useMaintenanceDueQuery(days?: number): UseMaintenanceDueResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["maintenance", wsId, "due", days],
    queryFn: () => maintenanceApi.due(wsId as string, days),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export interface UseMaintenanceListResult {
  items: MaintenanceSchedule[];
  total: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Top-level paginated schedule list, keyed ["maintenance", wsId, { page, limit }].
 * Provided for completeness; the limit is capped at 100 server-side (Pitfall 4).
 */
export function useMaintenanceListQuery(opts?: {
  page?: number;
  limit?: number;
}): UseMaintenanceListResult {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const page = opts?.page ?? 1;
  const limit = Math.min(opts?.limit ?? 50, 100);

  const query = useQuery({
    queryKey: ["maintenance", wsId, { page, limit }],
    queryFn: () => maintenanceApi.list(wsId as string, { page, limit }),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
