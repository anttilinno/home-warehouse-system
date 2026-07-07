import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { get } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";

// Workspace stat totals, keyed ["dashboard", wsId] — the SAME key the
// DashboardPage reads, so the shell's nav-count badges and the dashboard tiles
// share one cache entry (no double fetch). `staleTime` keeps route changes from
// refetching on every navigation; `retry: false` settles a 403/empty ws once.
export function useDashboardStats() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard", wsId],
    queryFn: () =>
      get<DashboardStats>(`/workspaces/${wsId}/analytics/dashboard`),
    enabled: !!wsId,
    retry: false,
    staleTime: 60_000,
  });
}
