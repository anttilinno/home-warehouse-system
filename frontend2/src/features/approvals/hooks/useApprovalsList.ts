import { useQuery } from "@tanstack/react-query";
import {
  pendingChangesApi,
  type PendingChangeDTO,
} from "@/lib/api/pendingChanges";
import { HttpError } from "@/lib/api";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// SYS-01 (Phase 14 Plan 01) — the /approvals table read. Mirrors
// usePendingChangesQuery's owner/admin-only degrade discipline:
//   * retry: false → a 403 settles ONCE, no backoff retry-storm (T-14-02).
//   * isForbidden  → derived from the thrown HttpError.status === 403 so the
//     page renders a calm guard for non-admins (no count/existence leak).
// Keyed ["pending-changes", wsId, "pending"] — a PREFIX of the side-rail's
// ["pending-changes", wsId] key so a review-write invalidate refreshes both.

export interface UseApprovalsListResult {
  rows: PendingChangeDTO[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  /** True when the read was rejected 403 (non-owner/admin) — calm guard. */
  isForbidden: boolean;
}

/**
 * Pending approval rows for the active workspace, keyed
 * ["pending-changes", wsId, "pending"]. `enabled` only with a workspace;
 * `retry: false` so a forbidden response settles immediately. Exposes the
 * `changes` array as `rows` plus `total` and an `isForbidden` signal.
 */
export function useApprovalsList(): UseApprovalsListResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["pending-changes", wsId, "pending"],
    queryFn: () => pendingChangesApi.list(wsId as string, { status: "pending" }),
    enabled: Boolean(wsId),
    retry: false,
  });

  const isForbidden =
    query.error instanceof HttpError && query.error.status === 403;

  return {
    rows: query.data?.changes ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    isForbidden,
  };
}
