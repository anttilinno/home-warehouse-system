---
phase: 13b-analytics
verified: 2026-06-13T16:46:07Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Navigate to /analytics in a live browser (backend + Postgres + Vite dev server running per CLAUDE.md runbook) and confirm all six chart Windows render with chart marks (bars, donut slices, area+line) — not just headings — when the workspace has real item/loan data."
    expected: "Six retro Windows visible: 'Category breakdown' (palette bars), 'Location value' (mint bars), 'Condition + Status' (donut + swatch legend), 'Status mix' (stacked bar + swatch legend), 'Top borrowers' (butter bars), 'Monthly loan activity' (area + line with square dot markers). Each chart displays actual data marks from the backend. 'Out of stock' window appears below (rows or calm empty state)."
    why_human: "The unit tests mock recharts ResponsiveContainer to a fixed box and mock all three API calls via MSW. Only a browser render against the live backend proves recharts renders actual SVG marks (bars/slices/area) — not just heading text — with real data flowing through."
  - test: "Open browser DevTools > Network tab, navigate to /analytics, and confirm the charts chunk (charts-*.js) is fetched on first visit and no recharts/d3 identifiers appear in the pre-loaded index-*.js chunk."
    expected: "charts-*.js request appears when /analytics is visited for the first time in that session. Network tab shows recharts NOT in the preloaded entry bundle."
    why_human: "The bundle-gate grep of dist/ assets is already verified (recharts present only in charts-I9uK7Kg5.js, zero in index-BXSrinop.js). This human step validates the browser loads the chunk lazily at runtime rather than eagerly — the static grep cannot prove the dynamic import actually defers loading."
  - test: "Seed the warehouse_dev database with at least one item whose inventory quantity is 0 and min_stock_level >= 1 (out-of-stock row). Navigate to /analytics and verify the out-of-stock table shows that item with its name as a clickable link to /items/{id}."
    expected: "A row in the 'Out of stock' window with the item name as an underlined accent-blue link. Clicking the link navigates to /items/{id}. The 'Stock' column shows '0' in danger-red mono. 'Min stock' column shows the configured minimum."
    why_human: "The E2E spec (analytics.spec.ts) asserts the 'Out of stock' heading is visible but is data-agnostic (the seeder workspace may have no out-of-stock items). Verifying the link actually navigates requires a seeded row and a browser click."
---

# Phase 13b: Analytics + Out-of-stock Verification Report

**Phase Goal:** User can view an analytics charts page (category breakdown, location values, condition/status distribution, top borrowers, monthly loan activity) and a dedicated out-of-stock table with links back to items — chart library lazy-loaded to protect the POL-04 bundle budget.
**Verified:** 2026-06-13T16:46:07Z
**Status:** human_needed (all 4 automated truths VERIFIED; 3 human-UAT items remain)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Analytics page renders category-breakdown, location-value, and condition/status-distribution charts driven by backend analytics endpoints | VERIFIED | `AnalyticsPage.tsx:61-64` feeds `CategoryValueChart`, `LocationValueChart`, `ConditionDonutChart`, `StatusStackChart` from `useAnalyticsSummary(12)` → `analyticsApi.summary()` → `GET /workspaces/{ws}/analytics/summary`. All four are substantive components with recharts marks (not stubs). AnalyticsPage.test.tsx:161-186 asserts all four Window headings render from mocked summary data. |
| 2 | Top-borrowers and monthly-loan-activity charts render on the same page; monthly chart reads from the SEPARATE /analytics/loans/monthly endpoint (NOT summary.monthly_loan_activity) | VERIFIED | `AnalyticsPage.tsx:37` — `const { items: monthly } = useMonthlyLoanActivity(12)` (SEPARATE hook). `AnalyticsPage.tsx:67` — `<MonthlyLoanActivityChart data={monthly} />`. The summary object is never referenced for monthly data. `useMonthlyLoanActivity.ts:8` comments explicitly state "MUST NOT be used" for the summary field. Backend `service.go:310-319` confirms `GetAnalyticsSummary` never calls `GetMonthlyLoanActivity` — `monthly_loan_activity` is always absent from the summary response. |
| 3 | Chart library is lazy-loaded: /analytics is a React.lazy route and recharts is isolated in a `charts` manualChunk — non-analytics routes carry zero charting weight | VERIFIED | `routes/index.tsx:41-44` — `const AnalyticsPage = lazy(() => import(...).then(m => ({ default: m.AnalyticsPage })))`. `vite.config.ts:74-90` — `chartModules` array (recharts + victory-vendor + 11 d3-* packages) mapped to `"charts"`. Hard gate: `grep -l recharts dist/assets/*.js` → only `charts-I9uK7Kg5.js`. `grep -c "recharts\|ResponsiveContainer\|victory-vendor" dist/assets/index-BXSrinop.js` → 0. recharts appears in exactly one chunk. |
| 4 | Out-of-stock table from /analytics/out-of-stock with each row linking to /items/{id} | VERIFIED | `OutOfStockTable.tsx:66-71` — `<Link to={/items/${item.id}}>` with accent styling. `useOutOfStock.ts` calls `analyticsApi.outOfStock()` → `GET /workspaces/{ws}/analytics/out-of-stock`. Backend `handler.go:218` — path `/analytics/out-of-stock`. `OutOfStockTable.test.tsx` 6 passing tests assert link, SKU, min_stock_level, danger-0 stock, OUT badge, empty state. `AnalyticsPage.test.tsx:188-196` asserts link `href="/items/it-99"`. |

**Score:** 4/4 truths VERIFIED

### Retro Theming (ANL-01/02 sub-check)

The sketch-009 mark spec (pastel fill + 2px ink stroke, no gradients, mono labels) is implemented:

- `retroChartTheme.ts` is the single source — `SERIES` (5 pastel fill+deep pairs), `INK = "#26262e"`, `STROKE_WIDTH = 2`, `markProps = { stroke: INK, strokeWidth: 2 }` (no radius, no gradient defs).
- All six chart components import from `retroChartTheme.ts`; none define inline colors.
- Gradient check: `grep linearGradient` across all analytics component `.tsx` files → 0 matches. The `gradient` strings in `charts-I9uK7Kg5.js` are clipPath references (`url(#clipPath-...)`) used by recharts for animation masking — not fill gradients. No `linearGradient` element strings present.
- `MonthlyLoanActivityChart.tsx:108` uses `fillOpacity={0.85}` on the `<Area>` — this is a flat alpha on the pastel fill (SERIES_BLUE.fill = "#b8d8e8"), not a gradient. No `<defs>` or `linearGradient` in the component.
- Silkscreen titles live in the `Window` titlebar (via `RetroChartFrame`); axis labels and value labels use IBM Plex Mono (`AXIS_TICK_STYLE`/`VALUE_LABEL_STYLE`). No Silkscreen in-chart.

**Status: CLEAN** — no default-recharts-gradient leakage detected.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend2/src/features/analytics/types.ts` | Type definitions for all analytics shapes | VERIFIED | 94 lines; all 7 interfaces present; `monthly_loan_activity` correctly optional with inline doc warning |
| `frontend2/src/lib/api/analytics.ts` | API module with 3 bare-body endpoints | VERIFIED | `summary()`, `monthlyActivity()`, `outOfStock()`; no `{ items }` unwrap; `clampMonths()` guard |
| `frontend2/src/features/analytics/hooks/useAnalyticsSummary.ts` | React Query hook for summary | VERIFIED | Query key `["analytics", wsId, "summary", months]`; `enabled: Boolean(wsId)` |
| `frontend2/src/features/analytics/hooks/useMonthlyLoanActivity.ts` | Separate hook for monthly series | VERIFIED | Query key `["analytics", wsId, "monthly", months]`; calls `analyticsApi.monthlyActivity()` (NOT summary field) |
| `frontend2/src/features/analytics/hooks/useOutOfStock.ts` | Hook for out-of-stock rows | VERIFIED | Query key `["analytics", wsId, "out-of-stock"]`; defaults to `[]` |
| `frontend2/src/features/analytics/charts/retroChartTheme.ts` | Sketch-009 mark token source | VERIFIED | SERIES, INK, STROKE_WIDTH, markProps, axis/label styles — single source of truth |
| `frontend2/src/features/analytics/charts/RetroChartFrame.tsx` | Shared retro Window + ResponsiveContainer host | VERIFIED | Composes `Window` + `ResponsiveContainer`/`RetroEmptyState`; no inline colors |
| `frontend2/src/features/analytics/components/CategoryValueChart.tsx` | ANL-01 category bar chart | VERIFIED | Vertical BarChart; palette via `<Cell>`; `formatCents` value labels; reads from `retroChartTheme` |
| `frontend2/src/features/analytics/components/LocationValueChart.tsx` | ANL-01 location value bar chart | VERIFIED | Single-series mint; `formatCents` labels |
| `frontend2/src/features/analytics/components/ConditionDonutChart.tsx` | ANL-01 condition donut | VERIFIED | PieChart with `innerRadius`; swatch legend with `data-testid="condition-legend"` |
| `frontend2/src/features/analytics/components/StatusStackChart.tsx` | ANL-01 status stack bar | VERIFIED | `stackOffset="expand"`; swatch legend with `data-testid="status-legend"` |
| `frontend2/src/features/analytics/components/TopBorrowersChart.tsx` | ANL-02 top borrowers chart | VERIFIED | Single-series butter; total_loans labels in right gutter |
| `frontend2/src/features/analytics/components/MonthlyLoanActivityChart.tsx` | ANL-02 monthly chart | VERIFIED | `ComposedChart` with `<Area>` (loans_created, blue) + `<Line>` (loans_returned, mint + `SquareDot`); custom swatch legend |
| `frontend2/src/features/analytics/components/OutOfStockTable.tsx` | ANL-04 out-of-stock table | VERIFIED | Link per row to `/items/{id}`; danger-mono `0` for stock; OUT badge; empty state |
| `frontend2/src/features/analytics/AnalyticsPage.tsx` | ANL-01/02/04 page composition | VERIFIED | 6 charts + OutOfStockTable; monthly from `useMonthlyLoanActivity`, NOT summary; no-workspace guard |
| `frontend2/src/routes/index.tsx` | React.lazy /analytics route | VERIFIED | `lazy(() => import(...).then(m => ({ default: m.AnalyticsPage })))` under RequireAuth/AppShell/Suspense |
| `frontend2/vite.config.ts` | manualChunks `charts` isolation | VERIFIED | `chartModules` array (13 packages) returned as `"charts"` before `return undefined` |
| `frontend2/src/components/layout/Sidebar.tsx` | Analytics NavItem wired | VERIFIED | `line 136` — `<NavItem glyph="▤" label={<Trans>Analytics</Trans>} to="/analytics" />` (no longer disabled) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `AnalyticsPage.tsx` | `/analytics/summary` | `useAnalyticsSummary` → `analyticsApi.summary()` → `GET /workspaces/{ws}/analytics/summary` | VERIFIED | Direct import chain confirmed; summary feeds 5 of 6 charts |
| `AnalyticsPage.tsx` | `/analytics/loans/monthly` | `useMonthlyLoanActivity` → `analyticsApi.monthlyActivity()` → `GET /workspaces/{ws}/analytics/loans/monthly?months=N` | VERIFIED | Critical ANL-02 wiring: `AnalyticsPage.tsx:37` imports from dedicated hook; backend handler at `handler.go:209` confirmed |
| `AnalyticsPage.tsx` | `/analytics/out-of-stock` | `useOutOfStock` → `analyticsApi.outOfStock()` → `GET /workspaces/{ws}/analytics/out-of-stock` | VERIFIED | `handler.go:218` confirms backend path |
| `OutOfStockTable.tsx` | `/items/{id}` | `react-router Link to={/items/${item.id}}` | VERIFIED | `OutOfStockTable.tsx:66-71`; asserted in `AnalyticsPage.test.tsx:194-195` |
| `routes/index.tsx` | `AnalyticsPage` module | `React.lazy(() => import("@/features/analytics/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })))` | VERIFIED | Named export `AnalyticsPage` from `AnalyticsPage.tsx:30` matched by lazy import |
| `vite.config.ts` manualChunks | recharts isolation | `chartModules.some(mod => id.includes(mod)) → return "charts"` | VERIFIED | Bundle gate: recharts ONLY in `charts-I9uK7Kg5.js`; zero in `index-BXSrinop.js` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `AnalyticsPage.tsx` | `summary` (CategoryStats[], etc.) | `useAnalyticsSummary(12)` → `analyticsApi.summary(wsId)` → backend `GetAnalyticsSummary` service → real DB queries (category/location/condition/status/borrowers rollups) | Yes — `service.go:261-319` executes 7 DB calls via `s.repo.*` | FLOWING |
| `AnalyticsPage.tsx` | `monthly` (MonthlyLoanActivity[]) | `useMonthlyLoanActivity(12)` → `analyticsApi.monthlyActivity(wsId, 12)` → backend `GetMonthlyLoanActivity` → `repo.GetMonthlyLoanActivity` SQL query | Yes — `service.go:238-257` confirmed; NOT summary field | FLOWING |
| `AnalyticsPage.tsx` | `outOfStock` (OutOfStockItem[]) | `useOutOfStock()` → `analyticsApi.outOfStock(wsId)` → backend `GetOutOfStockItems` → `repo.GetOutOfStockItems` SQL query | Yes — `handler.go:357-369` confirmed | FLOWING |

### Behavioral Spot-Checks

Step 7b skipped: requires running server (Vite + backend + Postgres). The analytics route is runtime-only — no CLI/static check applicable. Live verification routed to Human-UAT section above.

### Probe Execution

No `scripts/*/tests/probe-*.sh` declared or found for this phase. Step 7c skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ANL-01 | 13b-01/02/04 | Category-breakdown, location-value, condition/status-distribution charts on Analytics page | SATISFIED | All four charts in `AnalyticsPage.tsx:61-64`; each substantive component wired to summary sub-array |
| ANL-02 | 13b-01/02/04 | Top-borrowers and monthly-loan-activity charts on same page; monthly from dedicated endpoint | SATISFIED | `AnalyticsPage.tsx:65-68`; monthly from `useMonthlyLoanActivity` (not summary); backend `/analytics/loans/monthly` confirmed |
| ANL-03 | 13b-05 | Chart library lazy-loaded; non-analytics routes carry zero charting weight; POL-04 budget holds | SATISFIED | React.lazy in `routes/index.tsx:41-44`; `chartModules` in `vite.config.ts:74-90`; bundle gate: 0 recharts bytes in entry chunk |
| ANL-04 | 13b-03/04 | Out-of-stock table from /analytics/out-of-stock; each row links to /items/{id} | SATISFIED | `OutOfStockTable.tsx` with `Link to={/items/${item.id}}`; `useOutOfStock` hook; backend endpoint confirmed |

### Anti-Patterns Found

No blockers detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

Checks run:
- `TBD/FIXME/XXX` in analytics feature: 0 matches
- `TODO/HACK/PLACEHOLDER` in analytics feature: 0 matches
- `return null / return {} / return []` stub returns: 0 matches
- Hardcoded empty arrays passed as props: 0 matches (all `?? []` defaults on live hook results, not stub props)
- `console.log` only implementations: 0 matches
- recharts default gradient leakage: 0 `linearGradient` matches; 2 `gradient` matches are clipPath refs (animation masking), not fill gradients

### Human Verification Required

#### 1. Live chart mark rendering against real backend data

**Test:** With backend + Postgres + Vite dev server running (CLAUDE.md §E2E runbook), log in and navigate to `/analytics` via the Sidebar Analytics NavItem. Confirm the six chart Windows show actual SVG marks — bars filling each Window, a donut slice ring, a stacked bar segment, and the area+line overlay on the monthly chart.
**Expected:** All six retro Windows display data marks in the sketch-009 palette (pastel fills, 2px ink strokes). The page does not white-screen or show "No data" in every chart when the workspace has items, inventory, and loans.
**Why human:** Unit tests mock recharts `ResponsiveContainer` to a fixed box and all three API calls via MSW; only a browser render against live data proves SVG marks actually paint with the recharts library loaded from the `charts` chunk.

#### 2. Charts chunk lazy-load observed at runtime

**Test:** Open browser DevTools > Network > JS filter. Hard-reload `/` (dashboard). Confirm `charts-*.js` is NOT in the preloaded requests. Then navigate to `/analytics`. Confirm `charts-*.js` appears in the Network tab at that point.
**Expected:** `charts-*.js` (≈369 kB raw, ≈106 kB gzip per 13b-05 build gate) downloads only on `/analytics` visit — not eagerly on `/` or any other route.
**Why human:** The static bundle-gate grep already proves recharts bytes are absent from the entry chunk. This step validates the dynamic import actually defers network fetch to the first `/analytics` visit at runtime.

#### 3. Out-of-stock row link navigation

**Test:** Seed at least one item whose inventory quantity = 0 and `min_stock_level` >= 1 in the `warehouse_dev` database. Navigate to `/analytics`. Verify the 'Out of stock' Window shows that item's name as a clickable link. Click the link and confirm navigation to `/items/{id}`.
**Expected:** Row visible with item name as accent-blue underlined link, danger-red `0` in the Stock column, `RetroBadge "OUT"`. Clicking the link navigates to the item detail page at `/items/{id}`.
**Why human:** The analytics E2E spec (`analytics.spec.ts`) is data-agnostic — it only asserts the 'Out of stock' heading is visible, not that rows are present or that links navigate correctly. The unit test mocks a row with `href="/items/it-99"` but cannot exercise React Router navigation in jsdom.

---

### Gaps Summary

No gaps. All four ANL-0{1..4} requirements are fully implemented and wired. The three human-UAT items are browser-runtime validations that cannot be resolved by static code inspection or unit tests — they do not indicate missing implementation.

**Critical ANL-02 wiring (the plan-check blocker risk) is confirmed CORRECT:**
- `AnalyticsPage.tsx:37` — `const { items: monthly } = useMonthlyLoanActivity(12)` (dedicated hook)
- `AnalyticsPage.tsx:67` — `<MonthlyLoanActivityChart data={monthly} />` (uses the hook result, not `summary?.monthly_loan_activity`)
- Backend `service.go:310-319` — `GetAnalyticsSummary` never calls `GetMonthlyLoanActivity`; the `monthly_loan_activity` field is absent from every real summary response
- The fix landed correctly — this is not a stub or dead wiring

---

_Verified: 2026-06-13T16:46:07Z_
_Verifier: Claude (gsd-verifier)_
