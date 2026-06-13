---
phase: 13b-analytics
plan: 02
subsystem: frontend2-analytics-charts
tags: [charts, analytics, recharts, retro-os, pastel, frontend2, ANL-01, ANL-02]
requires:
  - "frontend2/src/components/retro (Window, RetroEmptyState, barrel)"
  - "frontend2/src/lib/utils/money.ts (formatCents — 10b null-safe)"
  - "features/analytics/types.ts (owned by 13b-01 — see deviation D1)"
provides:
  - "recharts@3.8.1 dependency + committed bun.lock"
  - "features/analytics/charts/retroChartTheme.ts (single source of sketch-009 marks)"
  - "features/analytics/charts/RetroChartFrame.tsx (shared retro Window + ResponsiveContainer + empty-state wrapper)"
  - "six prop-driven chart components (category/location bars, condition donut, status stack, top-borrowers bar, monthly area+line)"
affects:
  - "13b-04 AnalyticsPage (composes these six components against the prop contracts below)"
  - "13b-05 vite manualChunk `charts` (these imports are what land recharts in the lazy /analytics chunk)"
tech-stack:
  added: ["recharts@3.8.1 (MIT charting lib)"]
  patterns:
    - "shared theme module as the single source of chart-mark styling (palette/stroke/label tokens)"
    - "ResponsiveContainer-host frame component so every chart is DRY-wrapped in a retro Window"
    - "recharts ResponsiveContainer mocked to a fixed box for jsdom unit tests"
key-files:
  created:
    - frontend2/src/features/analytics/charts/retroChartTheme.ts
    - frontend2/src/features/analytics/charts/RetroChartFrame.tsx
    - frontend2/src/features/analytics/components/CategoryValueChart.tsx
    - frontend2/src/features/analytics/components/LocationValueChart.tsx
    - frontend2/src/features/analytics/components/ConditionDonutChart.tsx
    - frontend2/src/features/analytics/components/StatusStackChart.tsx
    - frontend2/src/features/analytics/components/TopBorrowersChart.tsx
    - frontend2/src/features/analytics/components/MonthlyLoanActivityChart.tsx
    - frontend2/src/features/analytics/components/charts.test.tsx
    - frontend2/src/features/analytics/types.ts (transitional — see D1)
  modified:
    - frontend2/package.json
    - frontend2/bun.lock
decisions:
  - "recharts 3.8.1 (current stable) installed instead of the plan's '2.x' guidance — 3.x is the live stable line and exports every named primitive the plan requires; not a typosquat (npmjs.com/package/recharts, MIT)"
  - "Per-bar/per-slice fill via <Cell> walking SERIES; value labels via <LabelList position=\"right\"> so they sit in the right gutter clear of the bars (sketch-009 rule)"
  - "donut/stack/monthly use custom swatch legends (data-testid'd) rather than recharts <Legend> for full retro-chrome control"
metrics:
  duration: "~25m"
  completed: "2026-06-13"
  tasks: 2
  files: 11
---

# Phase 13b Plan 02: Recharts Install + Retro Chart Theme + Six Chart Components Summary

recharts@3.8.1 wired into frontend2 with a single shared sketch-009 chart-mark
theme + frame and the six prop-driven, pure-presentational analytics charts
(ANL-01 category/location/condition/status + ANL-02 top-borrowers/monthly), each
in a locked retro Window with pastel-fill/2px-ink-stroke marks and a retro empty
state.

## What was built

**Task 1 — install + shared theme/frame** (commit `25f499e0`)
- `bun add recharts` → **recharts@3.8.1**; `package.json` + `bun.lock` committed.
- `retroChartTheme.ts` — the ONLY place sketch-009 marks are defined:
  - `SERIES` (5 `{ fill, deep }` pairs: blue/pink/mint/butter/sand), `seriesAt(i)`
    overflow helper (6th+ reuses sand), named `SERIES_BLUE/PINK/MINT/BUTTER`.
  - `INK = "#26262e"`, `STROKE_WIDTH = 2`, `GRID = "#e7ddca"`, `MUTED`.
  - `markProps` (`{ stroke: INK, strokeWidth: 2 }` — NO radius, NO gradients).
  - `AXIS_TICK_STYLE` / `VALUE_LABEL_STYLE` / `CATEGORY_LABEL_STYLE` (mono
    tabular-nums for values+ticks; Plex Sans for categories), `GRID_PROPS`.
- `RetroChartFrame.tsx` — `{ title, accent, isEmpty, emptyLabel, actions, height, children }`;
  renders a retro `Window` (Silkscreen title, semantic accent) hosting a
  `ResponsiveContainer` OR a `RetroEmptyState` when `isEmpty`.

**Task 2 — six charts (TDD)** (RED `d2a2ff5f`, GREEN `24d3d18e`)
- `CategoryValueChart({ data: CategoryStats[] })` — vertical BarChart, bars walk
  the palette via `<Cell>`, `total_value` (CENTS) labels via `formatCents`.
- `LocationValueChart({ data: LocationInventoryValue[] })` — single-series mint
  bar, `formatCents` labels, mint title-bar accent.
- `ConditionDonutChart({ data: ConditionBreakdown[] })` — PieChart donut
  (`innerRadius`) walking the palette + a `data-testid="condition-legend"` swatch
  legend + total readout.
- `StatusStackChart({ data: StatusBreakdown[] })` — single 100%-stacked bar
  (`stackOffset="expand"`, one `<Bar stackId>` per status) + `status-legend`.
- `TopBorrowersChart({ data: TopBorrower[] })` — single-series butter bar by
  `total_loans`, value labels in the right gutter.
- `MonthlyLoanActivityChart({ data: MonthlyLoanActivity[] })` — ComposedChart:
  `<Area>` (loans_created, blue fill + 2px ink top stroke) + `<Line>`
  (loans_returned, mint stroke, square ink-stroked markers) + `monthly-legend`.
- `charts.test.tsx` — mocks recharts `ResponsiveContainer` to a fixed 800×400 box
  (jsdom pattern); each chart asserts title + marks from a fixture and degrades
  to the empty state. **12/12 green.**

## Chart prop contracts (for 13b-04 AnalyticsPage)

| Component | Prop |
|-----------|------|
| `CategoryValueChart` | `{ data: CategoryStats[] }` |
| `LocationValueChart` | `{ data: LocationInventoryValue[] }` |
| `ConditionDonutChart` | `{ data: ConditionBreakdown[] }` |
| `StatusStackChart` | `{ data: StatusBreakdown[] }` |
| `TopBorrowersChart` | `{ data: TopBorrower[] }` |
| `MonthlyLoanActivityChart` | `{ data: MonthlyLoanActivity[] }` |

`RetroChartFrame` props: `{ title, accent?, isEmpty?, emptyLabel?, actions?, height?, children }`.

## Verification

- `bun run lint:tsc` — clean (tsc -b --noEmit).
- `bun run test src/features/analytics/components/charts.test.tsx` — 12/12 pass.
- `bun run test` (full) — 980/980 pass, 146 files (no regressions).
- `bun run lint:imports` — OK.
- `grep '"recharts"' package.json` + `grep recharts bun.lock` — both present.

## Deviations from Plan

**D1. [Rule 3 — blocking missing file] Created `features/analytics/types.ts`**
- **Found during:** Task 1 (charts import `@/features/analytics/types`).
- **Issue:** That file is owned by sibling Wave-1 plan **13b-01**, which has not
  merged into this execution branch (`exec/13b-02`). Without it, no chart compiles
  and the test cannot run.
- **Fix:** Transcribed the six type shapes **verbatim** from the plan's verified
  `<interfaces>` block into `types.ts`, with a header noting 13b-01 is the source
  of truth and supersedes on merge (shapes are identical → no-op merge).
- **Files:** `frontend2/src/features/analytics/types.ts`. **Commit:** `25f499e0`.

**D2. [Version] recharts 3.8.1, not "2.x"**
- The plan said "latest stable 2.x"; the actual current stable line is **3.x**.
  recharts 3.8.1 is the genuine package (npmjs.com/package/recharts, MIT, millions
  weekly) and exports every named primitive the plan lists (verified at runtime).
  Installed 3.8.1; lockfile committed. The package-legitimacy gate is satisfied.

**D3. [recharts v3 API] `LabelList` formatter signature**
- recharts v3 `LabelList.formatter` receives `RenderableText` (not `number`), so
  the CENTS formatters were typed `(v: unknown) => formatCents(Number(v))` to
  satisfy `tsc -b`. Behavior unchanged.

**D4. [test robustness] `getAllByText` for axis ticks**
- recharts v3 renders each YAxis category tick label twice (visible + an a11y
  layer), so the category/borrower-name assertions use `getAllByText(...).length`
  instead of `getByText`. Same intent, v3-correct.

## Known Stubs

None. All six charts are fully wired to their prop data (the page-level data
fetching lives in sibling 13b-01/13b-04 by design — these components are pure
presentational per the plan's contract).

## Self-Check: PASSED
- All 11 created/modified files present on disk (verified).
- Commits `25f499e0`, `d2a2ff5f`, `24d3d18e` present in `git log`.
