import { useQuery } from "@tanstack/react-query";
import { myChangesApi, type MyChangeDTO } from "@/lib/api/myChanges";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 14 Plan 02 — SYS-02 my-changes read. Keyed ["my-changes", wsId],
// enabled only on a workspace (no request fires without one), retry:false so a
// transient error settles ONCE — no backoff retry-storm (T-14-06). wsId comes
// from useWorkspace().currentWorkspaceId (the D-12 SSOT). Unlike /approvals
// there is no 403 path: the endpoint returns ONLY the caller's own changes.

export interface UseMyChangesResult {
  rows: MyChangeDTO[];
  total: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * The authenticated user's own recent changes, keyed ["my-changes", wsId].
 * Disabled until a workspace is selected; `retry: false` so a transient error
 * settles immediately. Exposes `rows` (the changes array) + `total`.
 */
export function useMyChanges(): UseMyChangesResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["my-changes", wsId],
    queryFn: () => myChangesApi.list(wsId as string),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    rows: query.data?.changes ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
