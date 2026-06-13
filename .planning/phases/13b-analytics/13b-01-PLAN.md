---
phase: 13b-analytics
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend2/src/lib/api/analytics.ts
  - frontend2/src/lib/api/analytics.test.ts
  - frontend2/src/features/analytics/types.ts
  - frontend2/src/features/analytics/hooks/useAnalyticsSummary.ts
  - frontend2/src/features/analytics/hooks/useMonthlyLoanActivity.ts
  - frontend2/src/features/analytics/hooks/useOutOfStock.ts
  - frontend2/src/features/analytics/hooks/useAnalyticsSummary.test.tsx
otmf_note: "Wave 1, DISJOINT from siblings 13b-02 (chart components + recharts theme under features/analytics/components/* and features/analytics/charts/*) and 13b-03 (features/analytics/components/OutOfStockTable.tsx). This plan owns ONLY the api module (lib/api/analytics.ts), the shared TS types (features/analytics/types.ts), and the two query hooks (features/analytics/hooks/*). It creates NO components and touches NO single-writer file (routes/index.tsx, vite.config.ts, Sidebar.tsx are owned by the Wave-2 wiring plan 13b-05). The AnalyticsPage (13b-04, W2) consumes the hooks exported here."
autonomous: true
requirements: [ANL-01, ANL-02, ANL-04]
must_haves:
  truths:
    - "A typed analytics api module exposes summary({ws, months}) → AnalyticsSummary and outOfStock(ws) → OutOfStockItem[] over the workspace-scoped bare-body endpoints"
    - "useAnalyticsSummary() returns the four summary chart datasets (category_stats, location_values, condition_breakdown, status_breakdown, top_borrowers) from a single /analytics/summary query, gated on a selected workspace. NOTE: the summary endpoint does NOT return monthly_loan_activity and ignores ?months — verified backend/internal/domain/analytics/{handler.go:96 AnalyticsSummaryRequest struct{}, service.go GetAnalyticsSummary never calls GetMonthlyLoanActivity}."
    - "useMonthlyLoanActivity(months=12) returns the monthly series from the SEPARATE /analytics/loans/monthly?months=N endpoint (the only source of monthly_loan_activity), gated on a selected workspace"
    - "useOutOfStock() returns the out-of-stock rows from /analytics/out-of-stock, gated on a selected workspace"
    - "Both hooks key under the [\"analytics\", wsId] prefix and never fire without a workspace"
  artifacts:
    - path: frontend2/src/features/analytics/types.ts
      provides: "TS shapes for the bare-body summary + its sub-arrays + OutOfStockItem (cents on *_value fields documented)"
      contains: "AnalyticsSummary"
    - path: frontend2/src/lib/api/analytics.ts
      provides: "analyticsApi.summary(wsId, months) + analyticsApi.outOfStock(wsId) over /api/workspaces/{ws}/analytics/*"
      contains: "outOfStock"
    - path: frontend2/src/features/analytics/hooks/useAnalyticsSummary.ts
      provides: "useAnalyticsSummary(months=12) keyed [\"analytics\", wsId, \"summary\", months], enabled on wsId"
      contains: "useAnalyticsSummary"
    - path: frontend2/src/features/analytics/hooks/useOutOfStock.ts
      provides: "useOutOfStock() keyed [\"analytics\", wsId, \"out-of-stock\"], enabled on wsId"
      contains: "useOutOfStock"
  key_links:
    - from: frontend2/src/features/analytics/hooks/useAnalyticsSummary.ts
      to: "GET /api/workspaces/{ws}/analytics/summary?months=12"
      via: "analyticsApi.summary via get<AnalyticsSummary> (bare-body — response IS the object, no wrapper key)"
      pattern: "analytics/summary"
    - from: frontend2/src/features/analytics/hooks/useOutOfStock.ts
      to: "GET /api/workspaces/{ws}/analytics/out-of-stock"
      via: "analyticsApi.outOfStock via get<OutOfStockItem[]> (bare-body — response IS the array)"
      pattern: "analytics/out-of-stock"
---

<objective>
The analytics data layer (ANL-01/02/04 backing): a typed api module + the shared TS types +
THREE query hooks. ONE `/analytics/summary` call feeds FOUR charts (category, location,
condition, status, top-borrowers); the monthly chart needs a SEPARATE
`/analytics/loans/monthly?months=12` call (the summary endpoint does NOT return monthly —
see CORRECTION below); `/analytics/out-of-stock` is a SEPARATE call backing the table. All
endpoints are Huma BARE-BODY (the response IS the array/object — NO `items`/`data` wrapper key),
workspace-scoped under `/api/workspaces/{ws}`.

Verified backend surface (CONTEXT, orchestrator-verified 2026-06-13):
- `GET /api/workspaces/{ws}/analytics/summary` → AnalyticsSummary =
  `{ dashboard, loan_stats, category_stats[], location_values[], recent_activity[],
  condition_breakdown[], status_breakdown[], top_borrowers[], monthly_loan_activity[] }`.
  **CORRECTION (plan-checker, verified):** `AnalyticsSummaryRequest struct{}` has NO `months`
  field (handler.go:96) and `GetAnalyticsSummary` NEVER calls `GetMonthlyLoanActivity`
  (service.go) — so `monthly_loan_activity` is ALWAYS null/absent from the summary response and
  `?months` is ignored. Do NOT read monthly from the summary. Summary excludes out-of-stock too.
- `GET /api/workspaces/{ws}/analytics/loans/monthly?months=N` → `MonthlyLoanActivity[]` — the
  ONLY source of the monthly series. `months` drives the window here. Bare-body.
- `GET /api/workspaces/{ws}/analytics/out-of-stock` → `OutOfStockItem[]`
  `{ id, name, sku, min_stock_level, category_id?, category_name? }`.
- Sub-array shapes (CONTEXT): CategoryStats `{id,name,item_count,inventory_count,total_value(CENTS)}`;
  LocationInventoryValue `{id,name,item_count,total_quantity,total_value(CENTS)}`;
  ConditionBreakdown `{condition,count}`; StatusBreakdown `{status,count}`;
  TopBorrower `{id,name,email?,total_loans,active_loans}`;
  MonthlyLoanActivity `{month(time),loans_created,loans_returned}`.

`total_value` fields are CENTS — the AnalyticsPage formats them via the existing null-safe
`formatCents` (`@/lib/utils/money`); this plan only types the field and documents the unit.

Purpose: ANL-01/02/04 — the typed read layer every chart + the table bind to.
Output: lib/api/analytics.ts + features/analytics/types.ts + the two hooks + their tests.

This plan is Wave 1 and DISJOINT from siblings 13b-02 (chart components/theme) and 13b-03
(OutOfStockTable component): it creates only `lib/api/analytics*`, `features/analytics/types.ts`,
and `features/analytics/hooks/*` — no component, no single-writer file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/13b-analytics/13b-CONTEXT.md
@.planning/phases/13b-analytics/13b-VALIDATION.md

# Templates to mirror EXACTLY (verified this session):
@frontend2/src/lib/api/loans.ts
@frontend2/src/features/maintenance/hooks/useMaintenanceQuery.ts
@frontend2/src/lib/utils/money.ts

<interfaces>
<!-- Verified from source this planning session. Use directly; no exploration needed. -->

api client (`@/lib/api`): `get<T>(endpoint)` — endpoints are `/api`-relative root paths beginning
with a leading `/` (e.g. `get("/workspaces/" + wsId + "/analytics/summary?months=12")`). It returns
the parsed JSON body as `T` directly (bare-body — do NOT expect a `{ items }` wrapper for these two
analytics endpoints; the dashboard already binds `get<DashboardStats>(.../analytics/dashboard)` and
`get<RecentActivity[]>(.../analytics/activity)` the same bare way).

workspace context (`@/features/workspace/useWorkspace`): `useWorkspace()` → `{ currentWorkspaceId, … }`.
Pattern: `const { currentWorkspaceId: wsId } = useWorkspace(); … enabled: Boolean(wsId)` and cast
`wsId as string` inside the queryFn (mirror useMaintenanceQuery EXACTLY). useWorkspace THROWS outside
its provider — tests mock it (see useAnalyticsSummary.test.tsx behavior).

react-query: `useQuery({ queryKey, queryFn, enabled, retry:false })`. Key prefix discipline:
EVERY analytics key sits under `["analytics", wsId]` so a future mutation could prefix-invalidate.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: analytics types + api module (summary + out-of-stock, bare-body)</name>
  <files>frontend2/src/features/analytics/types.ts, frontend2/src/lib/api/analytics.ts, frontend2/src/lib/api/analytics.test.ts</files>
  <behavior>
    analytics.test.ts (MSW handlers for /api/workspaces/:wsId/analytics/*):
    - summary(wsId, 12) requests `/workspaces/{ws}/analytics/summary?months=12` and resolves the
      bare object → assert the five sub-arrays are returned verbatim (category_stats, location_values,
      condition_breakdown, status_breakdown, top_borrowers present; monthly comes from the dedicated endpoint)
    - outOfStock(wsId) requests `/workspaces/{ws}/analytics/out-of-stock` and resolves a bare ARRAY
      (assert it is an array of OutOfStockItem, NOT wrapped in { items })
    - months is clamped to a sane positive integer (e.g. default 12; reject NaN/≤0 → 12)
  </behavior>
  <action>
    types.ts: export `CategoryStats`, `LocationInventoryValue`, `ConditionBreakdown`,
    `StatusBreakdown`, `TopBorrower`, `MonthlyLoanActivity`, `OutOfStockItem`, and the umbrella
    `AnalyticsSummary` ({ dashboard: unknown; loan_stats: unknown; category_stats: CategoryStats[];
    location_values: LocationInventoryValue[]; recent_activity?: unknown[]; condition_breakdown:
    ConditionBreakdown[]; status_breakdown: StatusBreakdown[]; top_borrowers: TopBorrower[];
    monthly_loan_activity: MonthlyLoanActivity[] }). Use the EXACT field tags from CONTEXT
    (snake_case wire names). DOC-COMMENT every `*_value` / `total_value` field as CENTS (T-10b-01)
    so consumers reach for formatCents. `dashboard`/`loan_stats` are typed `unknown` here (Phase 13
    owns DashboardStats; this page does not re-render those — keep the type honest, do not duplicate).
    analytics.ts: `import { get } from "@/lib/api"` + the types. Export `const analyticsApi = {`
    `summary(wsId: string): Promise<AnalyticsSummary>` →
    `get<AnalyticsSummary>(\`/workspaces/${wsId}/analytics/summary\`)` (NO ?months — summary ignores it);
    `monthlyActivity(wsId: string, months = 12): Promise<MonthlyLoanActivity[]>` →
    `get<MonthlyLoanActivity[]>(\`/workspaces/${wsId}/analytics/loans/monthly?months=${clampMonths(months)}\`)`;
    `outOfStock(wsId: string): Promise<OutOfStockItem[]>` →
    `get<OutOfStockItem[]>(\`/workspaces/${wsId}/analytics/out-of-stock\`)` `}`. Add a private
    `clampMonths(n)` → `Number.isFinite(n) && n > 0 ? Math.floor(n) : 12`. NO `{ items }` unwrapping —
    these endpoints are bare-body (Landmine: do NOT mirror loansApi's `.then(res => res.items)` here).
    Type `AnalyticsSummary.monthly_loan_activity` as optional (`monthly_loan_activity?:
    MonthlyLoanActivity[]`) since the live summary omits it — but the page reads monthly from the
    dedicated hook, not this field.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test src/lib/api/analytics.test.ts</automated>
  </verify>
  <done>api test green: summary returns the four sub-array families bare; monthlyActivity hits /analytics/loans/monthly?months= and returns a bare array; outOfStock returns a bare array; months clamps.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: useAnalyticsSummary + useMonthlyLoanActivity + useOutOfStock query hooks</name>
  <files>frontend2/src/features/analytics/hooks/useAnalyticsSummary.ts, frontend2/src/features/analytics/hooks/useMonthlyLoanActivity.ts, frontend2/src/features/analytics/hooks/useOutOfStock.ts, frontend2/src/features/analytics/hooks/useAnalyticsSummary.test.tsx</files>
  <behavior>
    useAnalyticsSummary.test.tsx (mock @/features/workspace/useWorkspace like DashboardPage.test;
    MSW handlers; render hooks under a QueryClientProvider):
    - with a workspace selected, useAnalyticsSummary() fetches /analytics/summary?months=12 and
      exposes the AnalyticsSummary data (assert one of the sub-arrays is populated from the fixture)
    - with NO workspace (currentWorkspaceId null), the query is disabled — no request fires
      (assert the MSW handler was not hit / isLoading stays idle via enabled:false)
    - useMonthlyLoanActivity() with a workspace fetches /analytics/loans/monthly?months=12 and exposes the series array
    - useOutOfStock() with a workspace fetches /analytics/out-of-stock and exposes the row array
    - the query keys are ["analytics", wsId, "summary", 12], ["analytics", wsId, "monthly", 12], and ["analytics", wsId, "out-of-stock"]
  </behavior>
  <action>
    useAnalyticsSummary.ts: `import { useQuery } from "@tanstack/react-query"`, `analyticsApi`,
    `useWorkspace`, and `AnalyticsSummary`. `export function useAnalyticsSummary(months = 12)` →
    `const { currentWorkspaceId: wsId } = useWorkspace();` `useQuery({ queryKey: ["analytics", wsId,
    "summary", months], queryFn: () => analyticsApi.summary(wsId as string, months), enabled:
    Boolean(wsId), retry: false })`. Return the raw query (or a `{ data, isLoading, isError }` slice —
    mirror useMaintenanceQuery's return shape) so the page can destructure. Default `months = 12`
    (the single window that drives the monthly series — OQ1 resolved).
    useMonthlyLoanActivity.ts: same skeleton; `export function useMonthlyLoanActivity(months = 12)`
    keyed `["analytics", wsId, "monthly", months]`, queryFn `analyticsApi.monthlyActivity(wsId as
    string, months)`, `enabled: Boolean(wsId)`, `retry: false`. Return `{ items: query.data ?? [],
    isLoading, isError }` so the monthly chart reads a guaranteed array (the page's ONLY monthly
    source — the summary's monthly_loan_activity is always empty and MUST NOT be used).
    useOutOfStock.ts: same skeleton; `export function useOutOfStock()` keyed `["analytics", wsId,
    "out-of-stock"]`, queryFn `analyticsApi.outOfStock(wsId as string)`, `enabled: Boolean(wsId)`,
    `retry: false`. Return `{ items: query.data ?? [], isLoading, isError }` (default to `[]` so the
    table renders RetroEmptyState on no-workspace / empty without a guard at the call site).
    Pitfall: do NOT put `t` or fresh objects in any dependency array (no effects here, but keep the
    queryKey primitives stable — wsId + months only).
  </action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/analytics/hooks/useAnalyticsSummary.test.tsx</automated>
  </verify>
  <done>Hook test green: summary fetches on wsId / disabled without one; out-of-stock fetches; keys under ["analytics", wsId].</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| frontend → /api/workspaces/{ws}/analytics/* | workspace-scoped reads cross here; the server scopes every aggregate to {ws} (the frontend passes wsId from the authed workspace context, never a user-supplied id) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13b-01 | Information Disclosure | cross-workspace analytics read | mitigate | wsId is sourced from useWorkspace() (the authed current workspace), never a route param; server re-scopes every aggregate to {ws}; `enabled: Boolean(wsId)` blocks any fire before a workspace exists |
| T-13b-02 | DoS | unbounded `months` / summary recompute | accept | clampMonths floors to a positive int (default 12); a single summary query per page load, no poll; server caps the window |
| T-13b-SC | Tampering | npm installs | mitigate | none — this plan installs NO packages (composes existing @tanstack/react-query + @/lib/api). recharts is installed by 13b-02 with its own legitimacy gate |
</threat_model>

<verification>
- `cd frontend2 && bun run lint:tsc` clean (NOT bare `tsc --noEmit` — VALIDATION landmine).
- `bun run test src/lib/api/analytics.test.ts` + `bun run test src/features/analytics/hooks` green.
- Both hooks key under `["analytics", wsId]` and are `enabled: Boolean(wsId)`.
- No `{ items }` unwrapping on the bare-body summary/out-of-stock calls.
</verification>

<success_criteria>
- ANL-01/02 backing: useAnalyticsSummary() returns the four summary chart datasets + useMonthlyLoanActivity() returns the monthly series from the dedicated endpoint.
- ANL-04 backing: useOutOfStock() returns the out-of-stock rows from the separate endpoint.
- Types document the CENTS unit on `*_value` fields (formatCents consumer-side).
</success_criteria>

<output>
Create `.planning/phases/13b-analytics/13b-01-SUMMARY.md` when done (record the final AnalyticsSummary
+ OutOfStockItem TS shapes and the exact query keys so 13b-02/03/04's mocks bind to verified selectors).
</output>
