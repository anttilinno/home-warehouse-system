# Phase 13b — Analytics + Out-of-stock — CONTEXT

**Synthesised:** 2026-06-13 (orchestrator, surface verified inline). Sketch 009 (retro-os-charts) DONE — Gap G-6 closed.
**Goal:** Analytics page with 5 charts (category breakdown, location value, condition/status distribution, top borrowers, monthly loan activity) + an out-of-stock table linking to items. Chart lib **lazy-loaded** (POL-04).
**Depends on:** Phase 13 (DONE).
**Requirements:** ANL-01, ANL-02, ANL-03, ANL-04.

## Backend surface (VERIFIED — all GET, workspace-scoped, Huma BARE-BODY envelopes → response IS the array/object, no wrapper key)
Base: `/api/workspaces/{wsId}`
- `/analytics/summary?months=N` → `AnalyticsSummary` = `{ dashboard, loan_stats, category_stats[], location_values[], recent_activity[], condition_breakdown[], status_breakdown[], top_borrowers[], monthly_loan_activity[] }`. **One call feeds all 5 charts.** `months` drives the monthly series window. NOTE: summary does NOT include out-of-stock.
- `/analytics/categories?limit` (default 10, max 50) → `CategoryStats[]` `{id,name,item_count,inventory_count,total_value(cents)}`
- `/analytics/locations?limit` (max 50) → `LocationInventoryValue[]` `{id,name,item_count,total_quantity,total_value(cents)}`
- `/analytics/conditions` → `ConditionBreakdown[]` `{condition,count}`
- `/analytics/statuses` → `StatusBreakdown[]` `{status,count}`
- `/analytics/borrowers?limit` (max 50) → `TopBorrower[]` `{id,name,email?,total_loans,active_loans}`
- `/analytics/loans/monthly?months=N` → `MonthlyLoanActivity[]` `{month(time),loans_created,loans_returned}`
- `/analytics/out-of-stock` → `OutOfStockItem[]` `{id,name,sku,min_stock_level,category_id?,category_name?}` (ANL-04; link each row → `/items/{id}`)
- (`/analytics/dashboard` + `/analytics/activity` already consumed by Phase 13 dashboard — do not touch.)

DECISION (recommend to planner): fetch `/analytics/summary?months=12` for the 5 charts (single query, all series) + `/analytics/out-of-stock` separately. `total_value` is **cents** → format with the existing money util (Phase 10b `money.ts` — null-safe; mind the null-currency white-screen landmine fixed in 10b).

## Frontend surface (greenfield — clean)
- **No chart lib installed** (`grep recharts|chart.js|d3` → none). **No `/analytics` route.** No `features/analytics/`.
- **Sidebar**: `components/layout/Sidebar.tsx:136` has a DISABLED "Analytics" NavItem (Overview group, glyph ▤, no `to`) → Phase 13b wires `to="/analytics"`. SINGLE-WRITER (Sidebar.tsx) — one plan owns this one-line edit.
- **Routes**: `routes/index.tsx` — SINGLE-WRITER. Add a `React.lazy` route for `/analytics` (mirror the `/scan` lazy idiom at lines 30-37: `const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage").then(m => ({default: m.AnalyticsPage})))` + `<Suspense>`). The page being lazy means recharts (imported by it) auto-lands in the analytics chunk.
- **Vite** (`vite.config.ts:57` manualChunks FUNCTION — Vite 8/rolldown): add a `recharts`/`d3` branch returning `"charts"` so the chart vendor is isolated like `scanner`. ANL-03 explicitly scopes this vite edit. SINGLE-WRITER.
- **money.ts** util exists (cents→string, null-safe). **api client**: `get<T>(path)` from `@/lib/api`. Build `lib/api/analytics.ts`.

## Chart lib decision
**recharts** (locked in sketch 009 MANIFEST + roadmap). Lazy-loaded via the React.lazy route + the `charts` manualChunk. Verify it isn't already pulled by another route (it isn't). Bundle gate (POL-04): after build, assert the main/vendor chunks gzip do NOT grow with charting weight — the charts chunk must be SEPARATE and only load on `/analytics`. Grep the build output: main chunk must NOT contain recharts.

## Sketch 009 chart-marks contract (the visual spec — from MANIFEST Locked Decisions)
Ordered categorical **series palette** (pastel fill + 2px ink stroke, NO mark shadows, square caps):
1. `--series-1` blue `#b8d8e8` (deep `#19526f`)
2. `--series-2` pink `#f4b8c4` (deep `#a8334f`)
3. `--series-3` mint `#b8e0c8` (deep `#1e6b43`)
4. `--series-4` butter `#f6e3a8` (deep `#7a5a12`)
5. `--series-5` sand `#e7ddca` (deep `#5b5b66`) — overflow only
Rules: each chart inside the locked retro `Window` (2px ink border, bevel, pinstriped pastel title bar, **Silkscreen title only**). Axis/value labels = **IBM Plex Mono tabular-nums**, NEVER Silkscreen (too small). Bars = pastel fill + ink stroke, flat (no recharts gradients/rounded caps). Monthly = area (blue fill + ink top stroke) + line (mint stroke, square ink markers). Donut for condition; 100% stacked bar for status. Reference mockup: `.planning/sketches/009-retro-os-charts/index.html`. Recharts must be THEMED to this (custom colors, `stroke="#26262e" strokeWidth={2}`, `isAnimationActive` per taste, no default tooltips styling — skin to retro).

## Layout
Desktop-first (analytics not mobile-critical). Charts in retro Windows, responsive stack (grid that collapses to 1 col on narrow). Out-of-stock table = sketch-008 density (RetroTable), pink "attention" title bar, item-name links `accent-blue-deep`, mono danger-red zeros, OUT badge. AppShell owns chrome; page renders route body only (like DashboardPage).

## Open Questions (RESOLVED inline)
1. **Summary vs per-endpoint?** → `/analytics/summary?months=12` for the 5 charts (one query) + `/analytics/out-of-stock` separate. Simpler, fewer requests, matches one-page-load. (Per-endpoint is the fallback if summary proves too coarse — it isn't.)
2. **Lazy mechanism?** → React.lazy route (auto-chunks recharts via the page import) + an explicit `charts` manualChunk for the recharts vendor. Both, mirroring scanner. ANL-03 done-criterion = main chunk carries zero charting bytes (grep build output).
3. **Out-of-stock empty/zero?** → table with RetroEmptyState when `[]`; each row `<Link to={`/items/${id}`}>`. min_stock_level shown; current stock is implicitly 0 (that's why it's out-of-stock) — render "0" mono danger, not fabricated.
4. **money/cents** → reuse `money.ts` (null-safe). total_value is cents.
5. **i18n** → all strings via @lingui `<Trans>`/t. New EN/ET msgids extracted at phase end (Phase 15 does the full gap-fill, but keep catalogs honest — run i18n:extract).

## Likely plan split (for planner)
- **A. analytics api module + hooks** (`lib/api/analytics.ts` + `features/analytics/hooks/*` — useAnalyticsSummary, useOutOfStock). Standalone, Wave 1.
- **B. recharts install + retro chart theme + the 5 chart components** (`features/analytics/components/*Chart.tsx` + a shared retro recharts theme/wrapper). Standalone, Wave 1. (recharts is a NEW dep — install, lockfile.)
- **C. OutOfStockTable component** (`features/analytics/components/OutOfStockTable.tsx`). Standalone, Wave 1.
- **D. AnalyticsPage** composing charts + table (consumes A/B/C) — Wave 2.
- **E. wiring**: routes/index.tsx lazy route + Sidebar `to="/analytics"` + vite manualChunk `charts`. These are 3 DIFFERENT single-writer files — can be ONE plan (wiring) in Wave 2, or folded into D. Keep routes/index.tsx + vite.config.ts + Sidebar.tsx coordinated in a single wiring plan to avoid cross-wave single-writer conflicts.
SINGLE-WRITERS: routes/index.tsx, vite.config.ts, Sidebar.tsx (one plan each, or one wiring plan owns all three). Wave-1 plans must touch disjoint files.
