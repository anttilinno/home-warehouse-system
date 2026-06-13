---
phase: 13b-analytics
plan: 04
type: execute
wave: 2
depends_on: [13b-01, 13b-02, 13b-03]
files_modified:
  - frontend2/src/features/analytics/AnalyticsPage.tsx
  - frontend2/src/features/analytics/AnalyticsPage.test.tsx
otmf_note: "Wave 2. SINGLE WRITER of AnalyticsPage.tsx; it is the SOLE Wave-2 sibling alongside the wiring plan 13b-05, and the two are DISJOINT: 13b-04 owns ONLY features/analytics/AnalyticsPage.tsx (+ its test), while 13b-05 owns the single-writer trio routes/index.tsx + vite.config.ts + components/layout/Sidebar.tsx. No file overlap. This page CONSUMES the Wave-1 outputs: useAnalyticsSummary()/useOutOfStock() (13b-01), the six *Chart.tsx components + RetroChartFrame (13b-02), and OutOfStockTable (13b-03). It imports them by their stable export paths — none of those files are touched here."
autonomous: true
requirements: [ANL-01, ANL-02, ANL-04]
must_haves:
  truths:
    - "The Analytics page renders the six charts (category, location, condition donut, status stack, top-borrowers, monthly area+line) — the first five from useAnalyticsSummary(), the monthly chart from the SEPARATE useMonthlyLoanActivity() query (summary does NOT return monthly — corrected per plan-checker)"
    - "The page renders the out-of-stock table from useOutOfStock(), each row linking to /items/{id}"
    - "Charts lay out in a responsive grid of retro Windows that collapses to one column on narrow"
    - "The page renders the route body only (AppShell owns the chrome), mirroring DashboardPage"
    - "A no-workspace / empty-summary state degrades gracefully (the charts' own empty states + the table empty state), no white-screen"
  artifacts:
    - path: frontend2/src/features/analytics/AnalyticsPage.tsx
      provides: "the composed Analytics route body: six charts (from summary slices) + the out-of-stock table"
      contains: "AnalyticsPage"
  key_links:
    - from: frontend2/src/features/analytics/AnalyticsPage.tsx
      to: frontend2/src/features/analytics/hooks/useAnalyticsSummary.ts
      via: "useAnalyticsSummary(12) → feeds the six charts each its sub-array slice"
      pattern: "useAnalyticsSummary"
    - from: frontend2/src/features/analytics/AnalyticsPage.tsx
      to: frontend2/src/features/analytics/components/OutOfStockTable.tsx
      via: "<OutOfStockTable items={useOutOfStock().items} />"
      pattern: "OutOfStockTable"
    - from: frontend2/src/features/analytics/AnalyticsPage.tsx
      to: frontend2/src/features/analytics/hooks/useMonthlyLoanActivity.ts
      via: "useMonthlyLoanActivity(12) → feeds <MonthlyLoanActivityChart data={monthly.items} /> (NOT summary.monthly_loan_activity, which is always empty)"
      pattern: "useMonthlyLoanActivity"
---

<objective>
The Analytics page (ANL-01/02/04 composition): a route-body component that fires ONE
`useAnalyticsSummary(12)` query and feeds each of the six Wave-1 chart components its slice of the
summary, plus a `useOutOfStock()` query feeding the Wave-1 OutOfStockTable. The page renders the
ROUTE BODY ONLY — AppShell owns the chrome (TopBar, Navigator, Bottombar, PageHeader), exactly like
DashboardPage. This file is what makes `/analytics` lazy in 13b-05 auto-pull recharts into the charts
chunk (it transitively imports the chart components).

Layout (CONTEXT): desktop-first. Charts in retro Windows in a responsive grid that collapses to one
column on narrow; the out-of-stock table below (pink attention surface). Each chart already owns its
retro Window + empty state (13b-02's RetroChartFrame), and the table owns its own Window + empty state
(13b-03), so this page is THIN composition — it must NOT re-wrap them or duplicate empty-state logic.

Purpose: ANL-01 + ANL-02 (the six charts on one page) + ANL-04 (the out-of-stock table on the same page).
Output: AnalyticsPage.tsx + its test.

This plan is Wave 2, depends on 13b-01/02/03, and is DISJOINT from its Wave-2 sibling 13b-05 (the
single-writer route/vite/sidebar trio): it owns only AnalyticsPage.tsx + its test.
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
@.planning/phases/13b-analytics/13b-01-SUMMARY.md
@.planning/phases/13b-analytics/13b-02-SUMMARY.md
@.planning/phases/13b-analytics/13b-03-SUMMARY.md

# The page idiom to mirror (route body only, AppShell owns chrome, workspace empty-state):
@frontend2/src/features/dashboard/DashboardPage.tsx

<interfaces>
<!-- Verified from source this planning session + the Wave-1 SUMMARYs. Use directly. -->

Page idiom (DashboardPage.tsx, mirror EXACTLY): the component renders ONLY the route body (no chrome).
It reads `const { currentWorkspaceId: wsId, workspaces } = useWorkspace();` and renders a centered
empty-state main when `workspaces && workspaces.length === 0`. All strings via `@lingui/react/macro`
`<Trans>`/`useLingui` `t`. NO shortcuts are required for this page (the dashboard registers them; the
analytics page need not — keep it simple; do NOT add a useShortcuts render-loop surface unless asked).

Wave-1 hooks (13b-01 — confirm exact return shape from 13b-01-SUMMARY):
- `useAnalyticsSummary(months = 12)` → the summary query; destructure `{ data: summary, isLoading,
  isError }` (or the SUMMARY-documented slice). `summary` is `AnalyticsSummary | undefined`. Feeds the
  FIRST FIVE charts only.
- `useMonthlyLoanActivity(months = 12)` → `{ items, isLoading }` (default `items: []`). The ONLY source
  of the monthly chart's data — the summary's `monthly_loan_activity` is always empty (backend never
  populates it), so the monthly chart MUST read `monthly.items`, NOT `summary.monthly_loan_activity`.
- `useOutOfStock()` → `{ items, isLoading }` (default `items: []`).

Wave-1 chart components (13b-02 — each is `(props: { data: SubArray[] })`, confirm names + prop types
from 13b-02-SUMMARY): `CategoryValueChart` (data: category_stats), `LocationValueChart` (location_values),
`ConditionDonutChart` (condition_breakdown), `StatusStackChart` (status_breakdown), `TopBorrowersChart`
(top_borrowers), `MonthlyLoanActivityChart` (monthly series). Each owns its retro Window + empty
state — pass the first five `data={summary?.<field> ?? []}` and the monthly one `data={monthly}` (from
useMonthlyLoanActivity, NOT the summary), letting each chart render its own empty state when its slice
is empty (do NOT gate them behind a page-level spinner that hides the layout).

Wave-1 table (13b-03): `OutOfStockTable({ items, isLoading })` — owns its own Window + empty state.

Layout tokens: a responsive grid `grid grid-cols-1 xl:grid-cols-2 gap-sp-5` (charts collapse to 1 col
on narrow — CONTEXT desktop-first), inside a `max-w-[1280px]` container (mirror DashboardPage's
container). The monthly chart may span both columns (`xl:col-span-2`) since it is a wide time series.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: AnalyticsPage — compose the six charts + the out-of-stock table (route body)</name>
  <files>frontend2/src/features/analytics/AnalyticsPage.tsx, frontend2/src/features/analytics/AnalyticsPage.test.tsx</files>
  <behavior>
    AnalyticsPage.test.tsx (mock @/features/workspace/useWorkspace like DashboardPage.test; render
    under QueryClient + MemoryRouter + lingui providers; MSW handlers for /analytics/summary and
    /analytics/loans/monthly and /analytics/out-of-stock; recharts ResponsiveContainer needs a fixed
    box — reuse the charts.test ResponsiveContainer mock pattern):
    - with a workspace + a populated summary fixture, the six charts render (assert a title from each:
      category, location, condition, status, top-borrowers, monthly — match the Window titles)
    - the out-of-stock table renders its rows from the out-of-stock fixture; an item-name link points
      to /items/{id} (assert one getByRole("link") href ends with /items/<id>)
    - with `workspaces: []` (no workspace), the page renders its workspace empty-state main and fires
      NO analytics request (mirror DashboardPage's empty-state guard)
    - with an EMPTY summary (all sub-arrays []) + empty out-of-stock, the page still renders (each
      chart's own empty state + the table empty state) — NO white-screen / thrown error (the 10b
      null-currency landmine guard: empty value series must not crash formatCents)
  </behavior>
  <action>
    AnalyticsPage.tsx: `export function AnalyticsPage()`. Header comment mirroring DashboardPage:
    "Retro-os analytics (sketch 009): the six charts + out-of-stock table over the analytics summary.
    Lives INSIDE AppShell — renders the route body only; auth guard is RequireAuth." Read
    `const { currentWorkspaceId: wsId, workspaces } = useWorkspace();` (wsId used implicitly by the
    hooks — keep the destructure if the hooks read it internally; the page only needs `workspaces` for
    the empty-state). Call `useAnalyticsSummary(12)` → `summary` + loading/error;
    `useMonthlyLoanActivity(12)` → `{ items: monthly }`; `useOutOfStock()` →
    `{ items: outOfStock }`. Workspace empty-state: when `workspaces && workspaces.length === 0`,
    return the centered empty-state main (copy DashboardPage's pattern + copy verbatim, adjusted text).
    Otherwise render a `<main className="mx-auto max-w-[1280px] …">` with:
      (1) a responsive chart grid `grid grid-cols-1 xl:grid-cols-2 gap-sp-5`:
          `<CategoryValueChart data={summary?.category_stats ?? []} />`,
          `<LocationValueChart data={summary?.location_values ?? []} />`,
          `<ConditionDonutChart data={summary?.condition_breakdown ?? []} />`,
          `<StatusStackChart data={summary?.status_breakdown ?? []} />`,
          `<TopBorrowersChart data={summary?.top_borrowers ?? []} />`,
          `<MonthlyLoanActivityChart data={monthly} />` (from useMonthlyLoanActivity — NOT the summary;
          give the monthly chart `xl:col-span-2` — it is a wide time series). Each `?? []` lets the chart render its own
          empty state on no-workspace / loading (no page-level spinner that hides the grid).
      (2) below the grid: `<OutOfStockTable items={outOfStock} isLoading={…} />`.
    All NEW strings (any page-level heading/section labels) via <Trans>/t. Compose retro atoms only
    through `@/components/retro`. Do NOT re-wrap the charts/table in extra Windows (they own theirs).
    Export name MUST be `AnalyticsPage` (13b-05's React.lazy import binds `m.AnalyticsPage`).
  </action>
  <verify>
    <automated>cd frontend2 && bun run lint:tsc && bun run test src/features/analytics/AnalyticsPage.test.tsx</automated>
  </verify>
  <done>Page test green: six charts + out-of-stock table render from mocked summary/out-of-stock; workspace empty-state guards; empty summary degrades without a white-screen; export is `AnalyticsPage`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| summary/out-of-stock payloads → composed page | already-trusted Wave-1 components render the server data; this page only routes sub-arrays to them and supplies no new untrusted sink |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13b-07 | DoS | empty/undefined summary white-screen (10b null-currency landmine) | mitigate | every chart prop defaults `?? []` and each chart owns its empty state; formatCents is null-safe; the page test asserts an empty summary renders without throwing |
| T-13b-08 | Information Disclosure | rendering analytics before a workspace is chosen | mitigate | the page renders its workspace empty-state when `workspaces.length === 0`; the hooks are `enabled: Boolean(wsId)` so no aggregate fires without a workspace (13b-01) |
| T-13b-SC | Tampering | npm installs | mitigate | none — this plan installs NO packages (composes Wave-1 outputs + existing retro atoms) |
</threat_model>

<verification>
- `cd frontend2 && bun run lint:tsc` clean (tsc -b — VALIDATION landmine).
- `bun run test src/features/analytics/AnalyticsPage.test.tsx` green.
- The six charts + the out-of-stock table render from one summary query + one out-of-stock query;
  workspace empty-state guards; empty summary degrades; export name is `AnalyticsPage`.
</verification>

<success_criteria>
- ANL-01: category, location, condition, status charts render on the page from summary data.
- ANL-02: top-borrowers + monthly charts render on the same page.
- ANL-04: the out-of-stock table renders below the charts, rows linking to /items/{id}.
- Route body only (AppShell chrome), responsive grid, graceful empty/no-workspace states.
</success_criteria>

<output>
Create `.planning/phases/13b-analytics/13b-04-SUMMARY.md` when done (record the page export name
`AnalyticsPage`, the grid shape, and the chart/table mount order so 13b-05's lazy route + the live
E2E spec bind to verified selectors).
</output>
