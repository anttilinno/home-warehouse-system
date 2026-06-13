// Analytics summary sub-array shapes.
//
// NOTE (13b-02 deviation, Rule 3): this file is OWNED by sibling Wave-1 plan
// 13b-01 (api/hooks/types). It is not yet present on this execution branch, so
// the chart components that import `@/features/analytics/types` cannot compile
// without it. The shapes below are transcribed verbatim from the 13b-02 PLAN
// `<interfaces>` block (verified from source that planning session). When 13b-01
// merges, its canonical `types.ts` supersedes this file — the shapes are
// identical, so the merge is a no-op for the chart layer. Do NOT add fields
// here; treat 13b-01 as the source of truth.

/** Per-category rollup. `total_value` is in integer CENTS. */
export interface CategoryStats {
  id: string;
  name: string;
  item_count: number;
  inventory_count: number;
  total_value: number; // CENTS
}

/** Per-location inventory value rollup. `total_value` is in integer CENTS. */
export interface LocationInventoryValue {
  id: string;
  name: string;
  item_count: number;
  total_quantity: number;
  total_value: number; // CENTS
}

/** Distribution of items by condition grade. */
export interface ConditionBreakdown {
  condition: string;
  count: number;
}

/** Distribution of items by lifecycle status. */
export interface StatusBreakdown {
  status: string;
  count: number;
}

/** A borrower ranked by loan volume. */
export interface TopBorrower {
  id: string;
  name: string;
  email?: string;
  total_loans: number;
  active_loans: number;
}

/** One month of loan throughput. `month` is an ISO-ish time string. */
export interface MonthlyLoanActivity {
  month: string;
  loans_created: number;
  loans_returned: number;
}
