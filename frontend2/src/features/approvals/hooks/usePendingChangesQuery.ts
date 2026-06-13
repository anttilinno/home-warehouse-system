import { useQuery } from "@tanstack/react-query";
import { pendingChangesApi } from "@/lib/api/pendingChanges";
import { HttpError } from "@/lib/api";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 13 Plan 02 — the pending-changes side-rail read (DASH-03). The endpoint
// is owner/admin-only and returns 403 for everyone else, so:
//   * retry: false  → a 403 settles ONCE, no backoff retry-storm (T-13-05).
//   * isForbidden   → derived from the thrown HttpError.status === 403 so the
//     panel can render NOTHING for non-admins (no leak of count/existence —
//     T-13-04 / ORCHESTRATOR OQ2 "degrade silently").
// wsId comes from useWorkspace().currentWorkspaceId (the D-12 SSOT), mirroring
// useMaintenanceDueQuery.

export interface UsePendingChangesResult {
  total: number;
  isLoading: boolean;
  isError: boolean;
  /** True when the read was rejected 403 (non-owner/admin) — degrade silently. */
  isForbidden: boolean;
}

/**
 * Workspace pending-changes count, keyed ["pending-changes", wsId, status].
 * `enabled` only when a workspace is selected. `retry: false` so a forbidden
 * response settles immediately (non-admins must not retry-spam). Exposes
 * `total` (0 until loaded) plus an isForbidden signal for silent 403 degrade.
 */
export function usePendingChangesQuery(opts?: {
  status?: string;
}): UsePendingChangesResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["pending-changes", wsId, opts?.status ?? "all"],
    queryFn: () => pendingChangesApi.list(wsId as string, opts),
    enabled: Boolean(wsId),
    retry: false,
  });

  const isForbidden =
    query.error instanceof HttpError && query.error.status === 403;

  return {
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    isForbidden,
  };
}
