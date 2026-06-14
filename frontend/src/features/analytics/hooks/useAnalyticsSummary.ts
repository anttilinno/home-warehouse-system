import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { AnalyticsSummary } from "@/features/analytics/types";

// Phase 13b Plan 01 Task 2 — the summary read (ANL-01/02 backing). ONE
// /analytics/summary query feeds FOUR charts (category, location, condition,
// status) plus the top-borrowers list. Keyed under the ["analytics", wsId]
// prefix so a future mutation can prefix-invalidate; gated on a selected
// workspace (T-13b-01: never fires before a workspace exists). `retry: false`
// matches the maintenance/repairs read discipline.
//
// NOTE: the summary endpoint does NOT return monthly_loan_activity (always
// null/absent) — the monthly chart reads from useMonthlyLoanActivity instead.
// `months` is kept as the key/window knob for symmetry but the summary call
// ignores it server-side.

export interface UseAnalyticsSummaryResult {
  data: AnalyticsSummary | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * The four summary chart datasets, keyed ["analytics", wsId, "summary", months].
 * `enabled` only when a workspace is selected.
 */
export function useAnalyticsSummary(months = 12): UseAnalyticsSummaryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["analytics", wsId, "summary", months],
    queryFn: () => analyticsApi.summary(wsId as string),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
