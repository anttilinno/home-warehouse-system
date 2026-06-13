import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/analytics";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { MonthlyLoanActivity } from "@/features/analytics/types";

// Phase 13b Plan 01 Task 2 — the monthly loan-activity series (ANL-02 backing).
// This is the page's ONLY source of the monthly chart: the /analytics/summary
// response's monthly_loan_activity is ALWAYS empty and MUST NOT be used. Reads
// the dedicated /analytics/loans/monthly?months=N endpoint, where `months`
// drives the window. Keyed under ["analytics", wsId] (T-13b-01 gate).

export interface UseMonthlyLoanActivityResult {
  items: MonthlyLoanActivity[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Monthly loan-activity series, keyed ["analytics", wsId, "monthly", months].
 * Defaults `items` to [] so the chart reads a guaranteed array on no-workspace /
 * empty without a call-site guard.
 */
export function useMonthlyLoanActivity(
  months = 12,
): UseMonthlyLoanActivityResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["analytics", wsId, "monthly", months],
    queryFn: () => analyticsApi.monthlyActivity(wsId as string, months),
    enabled: Boolean(wsId),
    retry: false,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
