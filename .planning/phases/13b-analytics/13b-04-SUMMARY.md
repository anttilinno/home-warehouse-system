---
phase: 13b-analytics
plan: 04
subsystem: frontend2/analytics
tags: [analytics, charts, composition, react, retro-os]
requires:
  - "13b-01: useAnalyticsSummary / useMonthlyLoanActivity / useOutOfStock hooks + analyticsApi + types"
  - "13b-02: the six chart components (Category/Location/Condition/Status/TopBorrowers/Monthly) + RetroChartFrame"
  - "13b-03: OutOfStockTable (presentational, prop-fed)"
provides:
  - "AnalyticsPage: the composed /analytics route body (six charts + out-of-stock table)"
affects:
  - "13b-05: binds React.lazy(() => import('…/AnalyticsPage')).AnalyticsPage and routes /analytics"
tech-stack:
  added: []
  patterns:
    - "Route-body-only page (AppShell owns chrome), mirrors DashboardPage workspace empty-state guard"
    - "Thin composition: charts/table own their own retro Windows + empty states; page only routes data slices"
    - "Monthly series sourced from useMonthlyLoanActivity (NOT summary.monthly_loan_activity, always empty)"
key-files:
  created:
    - frontend2/src/features/analytics/AnalyticsPage.tsx
    - frontend2/src/features/analytics/AnalyticsPage.test.tsx
  modified: []
decisions:
  - "Export name is AnalyticsPage (named export) so 13b-05's React.lazy can bind m.AnalyticsPage"
  - "Each chart fed `summary?.<field> ?? []`; monthly fed `monthly` (hook items); table fed `outOfStock` + isLoading"
  - "No page-level spinner: per-chart empty states keep the grid visible during load"
metrics:
  duration: ~6m
  completed: 2026-06-13
---

# Phase 13b Plan 04: AnalyticsPage Composition Summary

Composed the `/analytics` route body — six Wave-1 chart components fed from one
`useAnalyticsSummary(12)` query (first five) plus the separate
`useMonthlyLoanActivity(12)` query (monthly), with `OutOfStockTable` below fed by
`useOutOfStock()` — as a thin, route-body-only page that mirrors DashboardPage's
workspace empty-state guard and lets each child own its retro Window + empty state.

## What was built

- **`AnalyticsPage.tsx`** — `export function AnalyticsPage()`. Renders the route
  body only (AppShell owns TopBar/Navigator/Bottombar/PageHeader). Reads
  `useWorkspace()` for the empty-state guard; calls `useAnalyticsSummary(12)`,
  `useMonthlyLoanActivity(12)`, `useOutOfStock()`.
  - **Workspace empty-state:** when `workspaces.length === 0`, returns the
    centered `<Window title="No workspace" titlebarVariant="butter">` main (copied
    verbatim from DashboardPage). The analytics hooks are `enabled: Boolean(wsId)`
    so nothing fires before a workspace exists (T-13b-08).
  - **Chart grid (mount order):** `<section className="grid grid-cols-1 gap-sp-5 xl:grid-cols-2 [&>*]:min-w-0">`
    1. `CategoryValueChart` — `summary?.category_stats ?? []` (Window: "Category breakdown")
    2. `LocationValueChart` — `summary?.location_values ?? []` (Window: "Location value")
    3. `ConditionDonutChart` — `summary?.condition_breakdown ?? []` (Window: "Condition + Status")
    4. `StatusStackChart` — `summary?.status_breakdown ?? []` (Window: "Status mix")
    5. `TopBorrowersChart` — `summary?.top_borrowers ?? []` (Window: "Top borrowers")
    6. `MonthlyLoanActivityChart` — `monthly` (from useMonthlyLoanActivity), wrapped
       in a `<div className="xl:col-span-2">` (Window: "Monthly loan activity")
  - **Below the grid:** `<div className="mt-sp-5"><OutOfStockTable items={outOfStock} isLoading={…} /></div>`
    (Window: "Out of stock", pink; rows link `/items/{id}`).
  - Container: `<main className="mx-auto min-w-0 max-w-[1280px]">`.

- **`AnalyticsPage.test.tsx`** — 4 tests, all green:
  1. Six chart Window titles render over mocked summary + monthly queries.
  2. Out-of-stock table row link `M8 hex bolts` → `href="/items/it-99"`.
  3. No-workspace (`workspaces: []`) → "No workspace" empty-state; category chart
     absent; `requestCount === 0` (no analytics request fired).
  4. Empty summary + empty out-of-stock degrades without white-screen — monthly
     Window + "Nothing out of stock" heading + ≥1 chart "No data" empty state
     (guards the 10b null-currency / empty-value-series landmine).
  - Harness: mocks `@/features/workspace/useWorkspace`; `QueryClient` (retry:false)
    + `I18nProvider` + `MemoryRouter`; MSW for `/analytics/summary`,
    `/analytics/loans/monthly`, `/analytics/out-of-stock`; recharts
    `ResponsiveContainer` mocked to a fixed 800×400 box (the charts.test pattern).

## Deviations from Plan

None — plan executed exactly as written.

The plan permitted dropping the unused `wsId`/`currentWorkspaceId` destructure
(the action note: "keep the destructure if the hooks read it internally"). The
analytics hooks read wsId internally via their own `useWorkspace()` call, so the
page destructures only `workspaces`. This is the plan-sanctioned simplification,
not a deviation.

## Verification

- `bun run lint:tsc` → clean (`tsc -b --noEmit`, no output).
- `bun run test src/features/analytics/AnalyticsPage.test.tsx` → 1 file, 4 tests passed.

## TDD Gate Compliance

- RED: `AnalyticsPage.test.tsx` written first; failed (module `./AnalyticsPage`
  did not resolve).
- GREEN: `AnalyticsPage.tsx` added; 4/4 tests pass. Committed together as the
  atomic feature commit (`feat(13b-04)`) since the page and its first test form
  one feature unit.

## Notes for 13b-05 (lazy route wiring)

- Import shape: `const m = await import("@/features/analytics/AnalyticsPage"); m.AnalyticsPage`.
- The page is self-contained — it needs only to be mounted inside the AppShell
  layout route (RequireAuth). It registers NO shortcuts and adds no chrome.
- Live E2E selectors (stable): chart headings "Category breakdown", "Location
  value", "Condition + Status", "Status mix", "Top borrowers", "Monthly loan
  activity"; out-of-stock window title "Out of stock"; out-of-stock rows link to
  `/items/{id}`.

## Self-Check: PASSED

- FOUND: frontend2/src/features/analytics/AnalyticsPage.tsx
- FOUND: frontend2/src/features/analytics/AnalyticsPage.test.tsx
- FOUND commit: 5fc23fab
