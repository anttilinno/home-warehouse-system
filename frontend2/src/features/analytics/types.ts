// Phase 13b Plan 01 — analytics read-layer types. These mirror the BARE-BODY
// wire shapes returned by the workspace-scoped /analytics/* endpoints (the
// response IS the object/array — there is NO { items }/{ data } envelope).
// Snake_case field names match the JSON wire verbatim.
//
// MONEY UNIT: every `total_value` field below is integer CENTS (T-10b-01).
// Consumers MUST render them via formatCents (@/lib/utils/money) — never divide
// or format them inline.

/** One row of the per-category rollup. `total_value` is CENTS. */
export interface CategoryStats {
  id: string;
  name: string;
  item_count: number;
  inventory_count: number;
  total_value: number; // CENTS — render via formatCents
}

/** One row of the per-location inventory value rollup. `total_value` is CENTS. */
export interface LocationInventoryValue {
  id: string;
  name: string;
  item_count: number;
  total_quantity: number;
  total_value: number; // CENTS — render via formatCents
}

/** Condition histogram bucket. */
export interface ConditionBreakdown {
  condition: string;
  count: number;
}

/** Status histogram bucket. */
export interface StatusBreakdown {
  status: string;
  count: number;
}

/** Top-borrower leaderboard row. */
export interface TopBorrower {
  id: string;
  name: string;
  email?: string;
  total_loans: number;
  active_loans: number;
}

/**
 * Monthly loan-activity point. `month` is an RFC3339/time string from the
 * SEPARATE /analytics/loans/monthly endpoint — the ONLY source of this series
 * (the summary endpoint never emits monthly_loan_activity; see AnalyticsSummary).
 */
export interface MonthlyLoanActivity {
  month: string; // time bucket (server-formatted)
  loans_created: number;
  loans_returned: number;
}

/** Out-of-stock table row (from /analytics/out-of-stock). */
export interface OutOfStockItem {
  id: string;
  name: string;
  sku: string;
  min_stock_level: number;
  category_id?: string;
  category_name?: string;
}

/**
 * Umbrella shape returned bare by GET /analytics/summary.
 *
 * IMPORTANT: the live summary handler (AnalyticsSummaryRequest struct{}, no
 * `months` field) NEVER calls GetMonthlyLoanActivity, so `monthly_loan_activity`
 * is ALWAYS null/absent here — hence it is OPTIONAL. The monthly series MUST be
 * read from useMonthlyLoanActivity (the dedicated endpoint), never from this
 * field. The summary also excludes out-of-stock (its own endpoint).
 *
 * `dashboard` / `loan_stats` are typed `unknown` on purpose: Phase 13 owns the
 * DashboardStats type and the analytics page does not re-render those blocks —
 * keeping them honest here avoids duplicating a type this plan does not consume.
 */
export interface AnalyticsSummary {
  dashboard: unknown;
  loan_stats: unknown;
  category_stats: CategoryStats[];
  location_values: LocationInventoryValue[];
  recent_activity?: unknown[];
  condition_breakdown: ConditionBreakdown[];
  status_breakdown: StatusBreakdown[];
  top_borrowers: TopBorrower[];
  monthly_loan_activity?: MonthlyLoanActivity[]; // always absent from /summary — read via useMonthlyLoanActivity
}
