import { get } from "@/lib/api";
import type {
  AnalyticsSummary,
  MonthlyLoanActivity,
  OutOfStockItem,
} from "@/features/analytics/types";

// Phase 13b Plan 01 — the typed analytics read layer (ANL-01/02/04 backing).
// ALL endpoints are Huma BARE-BODY: the parsed JSON IS the object/array — there
// is NO { items }/{ data } wrapper. Do NOT mirror loansApi's `.then(r => r.items)`
// here (Landmine).
//
// Endpoint map (workspace-scoped under /workspaces/{ws}):
//   GET /analytics/summary            → AnalyticsSummary (no ?months — summary
//                                        ignores it AND never emits monthly_loan_activity)
//   GET /analytics/loans/monthly?months=N → MonthlyLoanActivity[] (the ONLY
//                                        source of the monthly series; `months`
//                                        drives the window)
//   GET /analytics/out-of-stock       → OutOfStockItem[]

// clampMonths floors `months` to a sane positive integer; NaN/≤0 → 12 (the
// default window). Guards the unbounded-window DoS surface (T-13b-02).
function clampMonths(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 12;
}

export const analyticsApi = {
  /** Bare-body summary — the four chart datasets. Does NOT carry monthly. */
  summary(wsId: string): Promise<AnalyticsSummary> {
    return get<AnalyticsSummary>(`/workspaces/${wsId}/analytics/summary`);
  },

  /** Bare-body monthly series — the ONLY source of monthly_loan_activity. */
  monthlyActivity(wsId: string, months = 12): Promise<MonthlyLoanActivity[]> {
    return get<MonthlyLoanActivity[]>(
      `/workspaces/${wsId}/analytics/loans/monthly?months=${clampMonths(months)}`,
    );
  },

  /** Bare-body out-of-stock rows backing the table. */
  outOfStock(wsId: string): Promise<OutOfStockItem[]> {
    return get<OutOfStockItem[]>(`/workspaces/${wsId}/analytics/out-of-stock`);
  },
};
