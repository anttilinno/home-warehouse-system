import { useMutation } from "@tanstack/react-query";
import { pendingChangesApi } from "@/lib/api/pendingChanges";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// SYS-01 (Phase 14 Plan 01) — the per-id review write mutations. There is NO
// bulk endpoint, so the ApprovalsPage iterates the selected ids and `await`s
// each `mutateAsync` inside a Promise.allSettled loop (partial-failure
// tolerant). These mutations therefore do NOT invalidate on their own — the
// page invalidates the ["pending-changes", wsId] PREFIX ONCE after the batch
// settles (one refetch, not N). Keep wsId the only primitive read so callers
// stay render-loop-safe.

/** approve(id) → POST /pending-changes/{id}/approve for the active workspace. */
export function useApproveChange() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  return useMutation({
    mutationFn: (id: string) => pendingChangesApi.approve(wsId as string, id),
  });
}

/**
 * reject({id, reason}) → POST /pending-changes/{id}/reject with the reason
 * body (required server-side, minLength 1).
 */
export function useRejectChange() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      pendingChangesApi.reject(wsId as string, id, reason),
  });
}
