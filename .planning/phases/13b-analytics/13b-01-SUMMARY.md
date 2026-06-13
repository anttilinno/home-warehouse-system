---
phase: 13b-analytics
plan: 01
subsystem: frontend2-analytics
tags: [analytics, react-query, api-module, types, bare-body]
requires:
  - "@/lib/api get<T> (bare-body fetch client)"
  - "@/features/workspace/useWorkspace currentWorkspaceId"
provides:
  - "analyticsApi.summary / monthlyActivity / outOfStock (lib/api/analytics.ts)"
  - "AnalyticsSummary + sub-array types + OutOfStockItem (features/analytics/types.ts)"
  - "useAnalyticsSummary / useMonthlyLoanActivity / useOutOfStock hooks"
affects:
  - "13b-02 chart components (consume the summary sub-arrays + monthly series)"
  - "13b-03 OutOfStockTable (consumes useOutOfStock rows)"
  - "13b-04 AnalyticsPage (mounts all three hooks)"
tech-stack:
  added: []
  patterns:
    - "bare-body reads (no { items } unwrap) — distinct from loansApi"
    - "['analytics', wsId, ...] query-key prefix; enabled: Boolean(wsId); retry:false"
key-files:
  created:
    - frontend2/src/features/analytics/types.ts
    - frontend2/src/lib/api/analytics.ts
    - frontend2/src/lib/api/analytics.test.ts
    - frontend2/src/features/analytics/hooks/useAnalyticsSummary.ts
    - frontend2/src/features/analytics/hooks/useMonthlyLoanActivity.ts
    - frontend2/src/features/analytics/hooks/useOutOfStock.ts
    - frontend2/src/features/analytics/hooks/useAnalyticsSummary.test.tsx
  modified: []
decisions:
  - "monthly_loan_activity typed OPTIONAL on AnalyticsSummary — live /summary never emits it; page reads useMonthlyLoanActivity instead"
  - "summary() takes NO months arg in the api call (summary ignores ?months); the hook keeps months only as a key segment"
  - "clampMonths(n) → NaN/≤0 → 12, fractional floored — guards T-13b-02 window DoS"
metrics:
  duration: ~6m
  completed: 2026-06-13
---

# Phase 13b Plan 01: Analytics API Module + 3 Query Hooks Summary

The typed analytics read layer (ANL-01/02/04 backing): a bare-body api module, the
shared TS types, and THREE react-query hooks — one `/analytics/summary` query feeding
four charts, a SEPARATE `/analytics/loans/monthly?months=N` query for the monthly
series, and `/analytics/out-of-stock` for the table — all gated on the selected workspace.

## What Was Built

- **`features/analytics/types.ts`** — `AnalyticsSummary` umbrella plus `CategoryStats`,
  `LocationInventoryValue`, `ConditionBreakdown`, `StatusBreakdown`, `TopBorrower`,
  `MonthlyLoanActivity`, `OutOfStockItem`. Every `total_value` field doc-commented as
  CENTS (T-10b-01 → consumers use `formatCents`). `monthly_loan_activity` is OPTIONAL
  (the live summary never emits it); `dashboard`/`loan_stats` typed `unknown` (Phase 13 owns them).
- **`lib/api/analytics.ts`** — `analyticsApi.summary(wsId)`, `.monthlyActivity(wsId, months=12)`,
  `.outOfStock(wsId)`. All BARE-BODY via `get<T>` (no `.then(r => r.items)`). Private
  `clampMonths` floors months to a positive int (default 12). `summary` appends NO `?months`.
- **Hooks** — `useAnalyticsSummary(months=12)` → `{ data, isLoading, isError }`;
  `useMonthlyLoanActivity(months=12)` and `useOutOfStock()` → `{ items, isLoading, isError }`
  (items default `[]`). All `enabled: Boolean(wsId)`, `retry: false`, keyed under `["analytics", wsId]`.

## Verified Selectors (for 13b-02/03/04 mocks)

Exact query keys (asserted in `useAnalyticsSummary.test.tsx`):

| Hook | Query key |
|------|-----------|
| `useAnalyticsSummary(months)` | `["analytics", wsId, "summary", months]` |
| `useMonthlyLoanActivity(months)` | `["analytics", wsId, "monthly", months]` |
| `useOutOfStock()` | `["analytics", wsId, "out-of-stock"]` |

Endpoints (all bare-body, workspace-scoped):
- `GET /api/workspaces/{ws}/analytics/summary` → `AnalyticsSummary` (NO `?months`, NO monthly)
- `GET /api/workspaces/{ws}/analytics/loans/monthly?months=N` → `MonthlyLoanActivity[]`
- `GET /api/workspaces/{ws}/analytics/out-of-stock` → `OutOfStockItem[]`

Final TS shapes:
- `AnalyticsSummary { dashboard: unknown; loan_stats: unknown; category_stats: CategoryStats[];
  location_values: LocationInventoryValue[]; recent_activity?: unknown[]; condition_breakdown:
  ConditionBreakdown[]; status_breakdown: StatusBreakdown[]; top_borrowers: TopBorrower[];
  monthly_loan_activity?: MonthlyLoanActivity[] }`
- `OutOfStockItem { id; name; sku; min_stock_level; category_id?; category_name? }`
- `MonthlyLoanActivity { month: string; loans_created; loans_returned }`
- `CategoryStats { id; name; item_count; inventory_count; total_value /*CENTS*/ }`
- `LocationInventoryValue { id; name; item_count; total_quantity; total_value /*CENTS*/ }`
- `ConditionBreakdown { condition; count }`, `StatusBreakdown { status; count }`
- `TopBorrower { id; name; email?; total_loans; active_loans }`

## Deviations from Plan

**1. [Rule 1 - Bug] Clamp test reused a single Response body**
- **Found during:** Task 1
- **Issue:** the clamp subtest used `mockResolvedValue(jsonResponse([]))` (one shared
  `Response`); a fetch `Response` body can only be read once → "Body is unusable" on the
  2nd call.
- **Fix:** switched to `mockImplementation(() => Promise.resolve(jsonResponse([])))` so each
  call gets a fresh Response. Test-only.
- **Files modified:** `frontend2/src/lib/api/analytics.test.ts`
- **Commit:** 40bda4dc

## Verification

- `bun run lint:tsc` → exit 0 (clean).
- `bun run test src/lib/api/analytics.test.ts` → 7 passed.
- `bun run test src/features/analytics/hooks` → 7 passed (14 total across both suites).
- No `{ items }` unwrap on the bare-body calls; both hooks key under `["analytics", wsId]`,
  `enabled: Boolean(wsId)`.

## Self-Check: PASSED

All 7 created files exist on disk; both task commits (40bda4dc, 80edf35a) present in git log.
