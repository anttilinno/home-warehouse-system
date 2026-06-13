---
phase: 13b-analytics
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend2/package.json
  - frontend2/bun.lock
  - frontend2/src/features/analytics/charts/retroChartTheme.ts
  - frontend2/src/features/analytics/charts/RetroChartFrame.tsx
  - frontend2/src/features/analytics/components/CategoryValueChart.tsx
  - frontend2/src/features/analytics/components/LocationValueChart.tsx
  - frontend2/src/features/analytics/components/ConditionDonutChart.tsx
  - frontend2/src/features/analytics/components/StatusStackChart.tsx
  - frontend2/src/features/analytics/components/TopBorrowersChart.tsx
  - frontend2/src/features/analytics/components/MonthlyLoanActivityChart.tsx
  - frontend2/src/features/analytics/components/charts.test.tsx
otmf_note: "Wave 1, DISJOINT from siblings 13b-01 (lib/api/analytics.ts + features/analytics/hooks/* + features/analytics/types.ts) and 13b-03 (features/analytics/components/OutOfStockTable.tsx — a DIFFERENT file in the same dir; no overlap). This plan owns package.json + bun.lock (the recharts install — sole package writer in Phase 13b), the shared recharts theme/frame (features/analytics/charts/*), the six chart components (features/analytics/components/*Chart.tsx), and their shared test. It does NOT touch vite.config.ts (the `charts` manualChunk is owned by the Wave-2 wiring plan 13b-05) — recharts can be installed independently of the chunk rule; the chunk only affects build OUTPUT, and 13b-02 imports recharts the moment its components compile, which is harmless until the lazy route lands in 13b-05. Consumes the TS types from 13b-01 (features/analytics/types.ts)."
autonomous: false
requirements: [ANL-01, ANL-02]
user_setup: []
must_haves:
  truths:
    - "recharts is installed as a dependency and the bun.lock is committed"
    - "A shared retro recharts theme reproduces sketch 009: pastel-fill series palette + 2px ink stroke (#26262e), flat marks (no gradients, no rounded caps), IBM Plex Mono tabular-nums axis/value labels, no default tooltip skin"
    - "Six chart components render from the summary sub-arrays: category-value bar, location-value bar, condition donut, status 100%-stacked bar, top-borrowers bar, monthly area+line — each inside a retro Window themed per sketch 009"
    - "Every chart degrades to a retro empty state when its dataset is empty"
  artifacts:
    - path: frontend2/src/features/analytics/charts/retroChartTheme.ts
      provides: "locked series palette (series-1..5 pastel+deep pairs) + ink stroke constants + axis/grid/label style tokens reproducing sketch 009"
      contains: "strokeWidth"
    - path: frontend2/src/features/analytics/charts/RetroChartFrame.tsx
      provides: "shared retro Window wrapper (Silkscreen title, semantic title-bar accent, ResponsiveContainer host, empty-state slot) every chart composes"
      contains: "ResponsiveContainer"
    - path: frontend2/src/features/analytics/components/MonthlyLoanActivityChart.tsx
      provides: "ANL-02 monthly area (blue fill + ink top stroke) + line (mint stroke, square ink markers) over months"
      contains: "MonthlyLoanActivityChart"
    - path: frontend2/src/features/analytics/components/ConditionDonutChart.tsx
      provides: "ANL-01 condition distribution donut walking the ordered palette + swatch legend"
      contains: "ConditionDonutChart"
  key_links:
    - from: frontend2/src/features/analytics/components/CategoryValueChart.tsx
      to: frontend2/src/features/analytics/charts/retroChartTheme.ts
      via: "every <Bar>/<Area>/<Line>/<Pie> reads fill+stroke from the shared theme (single source of the sketch-009 marks)"
      pattern: "retroChartTheme"
    - from: frontend2/src/features/analytics/components/*Chart.tsx
      to: "recharts"
      via: "named imports (BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, ResponsiveContainer) — this import is what lands recharts in the lazy /analytics chunk (13b-05 + 13b-04)"
      pattern: "from \"recharts\""
---

<objective>
The chart layer (ANL-01/02): install recharts (a NEW dependency — locked in sketch 009 + roadmap),
build ONE shared retro recharts theme + frame that reproduces the sketch-009 chart-marks contract
1:1, and the SIX chart components that render the summary sub-arrays. All five "charts" the roadmap
names plus the donut/stack split = six components (category bar, location bar, condition donut,
status 100%-stacked bar, top-borrowers bar, monthly area+line).

Sketch 009 chart-marks contract (the visual spec — MANIFEST Locked Decisions; reproduce EXACTLY):
- Ordered categorical SERIES PALETTE (pastel fill paired with its deep companion for colored value text):
  1. series-1 blue `#b8d8e8` (deep `#19526f`)  2. series-2 pink `#f4b8c4` (deep `#a8334f`)
  3. series-3 mint `#b8e0c8` (deep `#1e6b43`)  4. series-4 butter `#f6e3a8` (deep `#7a5a12`)
  5. series-5 sand `#e7ddca` (deep `#5b5b66`) — overflow only (6th+ category).
- Every mark = flat pastel FILL + 2px INK STROKE (`#26262e` / `--border-ink`), NO mark shadows,
  square caps, NO rounded bar caps, NO recharts gradients. Lines = thick pastel stroke + thin ink
  overstroke; data points = square ink-stroked markers.
- Axes/labels: gridlines = 1px sand rule `#e7ddca`; baseline axis = 2px ink rule. Value labels +
  ticks = IBM Plex Mono `tabular-nums` (ink for values, muted for ticks). Category labels = Plex Sans
  12px. SILKSCREEN is panel TITLES ONLY (≥16px) — NEVER axis labels/ticks/in-chart text.
- Single-series charts take the title-bar's semantic accent (location value = mint; top borrowers =
  butter/loan). Multi-category + donut walk the ordered palette with a swatch legend.
- Monthly = AREA (blue fill + ink top stroke) + LINE (mint stroke, square ink markers).
- Each chart lives inside the locked retro `Window` (2px ink border, bevel, pinstriped pastel title bar).
- NO default recharts tooltip skin — if a tooltip is used at all it is custom-retro (or omit it).
- Reference mockup: `.planning/sketches/009-retro-os-charts/index.html` — match it.

Purpose: ANL-01 (category/location/condition/status charts) + ANL-02 (top-borrowers + monthly charts).
Output: recharts dep + lockfile + shared theme/frame + six chart components + a shared test.

This plan is Wave 1 and DISJOINT from siblings 13b-01 (api/hooks/types) and 13b-03 (OutOfStockTable —
a different file in the same components dir). It is the SOLE Phase 13b writer of package.json/bun.lock.
This plan is NON-AUTONOMOUS: the recharts install is gated by a blocking package-legitimacy checkpoint.
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
@.planning/sketches/MANIFEST.md
@.planning/sketches/009-retro-os-charts/index.html

# The retro atoms to compose + the types these charts read:
@frontend2/src/components/retro/Window.tsx
@frontend2/src/features/analytics/types.ts

<interfaces>
<!-- Verified from source this planning session. Use directly; no exploration needed. -->

Window (`@/components/retro` barrel → `{ Window }`): props `title` (ReactNode — render the Silkscreen
panel title here), `titlebarVariant` (e.g. "plain"/semantic accent — pick the title-bar accent per the
single-series rule), `bodyClassName`, `actions?`. Charts render their ResponsiveContainer inside the
Window body. Compose ONLY through `@/components/retro` (locked v2.0 barrel convention).

Summary sub-array shapes (from 13b-01 `features/analytics/types.ts` — import the types, do NOT redeclare):
CategoryStats {id,name,item_count,inventory_count,total_value(CENTS)}; LocationInventoryValue
{id,name,item_count,total_quantity,total_value(CENTS)}; ConditionBreakdown {condition,count};
StatusBreakdown {status,count}; TopBorrower {id,name,email?,total_loans,active_loans};
MonthlyLoanActivity {month(time),loans_created,loans_returned}.

recharts named imports: BarChart, Bar, AreaChart, Area, LineChart, Line, ComposedChart (for the
area+line monthly), PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend.
Ink stroke = `#26262e` (`--border-ink`), `strokeWidth={2}`, `isAnimationActive` per taste. Per-slice /
per-bar fill via `<Cell fill={…} stroke="#26262e" strokeWidth={2} />` walking the series palette.
Square caps: set `strokeLinecap`/`strokeLinejoin` to non-round where recharts exposes it; bars are
flat rectangles already — just NO `radius` prop (which would round the caps). NO `<defs><linearGradient>`.

money: `formatCents(cents, currency?)` from `@/lib/utils/money` for value-axis tick/label formatting on
the *_value series (CENTS → display). Null-safe (10b landmine guarded inside the util).

i18n: all chart titles + legend labels + axis captions via @lingui `<Trans>`/`t`.
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <what-built>Nothing yet — this is the package-legitimacy gate that MUST clear before `bun add recharts`.</what-built>
  <how-to-verify>
    recharts is a NEW dependency (not currently in package.json). Per the Phase 13b threat model
    (T-13b-SC) and the GSD package-legitimacy gate, confirm the package is legitimate BEFORE install:
    1. Open https://www.npmjs.com/package/recharts — confirm it is the real, widely-used charting lib
       (millions of weekly downloads, repo github.com/recharts/recharts, MIT, active maintenance).
    2. Confirm the exact name `recharts` (no typosquat — not `react-charts`, `recharts-2`, etc.).
    3. Approve the install of `recharts` (latest stable 2.x) into frontend2 via `bun add recharts`.
    This checkpoint is NOT auto-approvable (workflow.auto_advance is ignored for legitimacy gates).
  </how-to-verify>
  <resume-signal>Type "approved" to authorize `bun add recharts`, or name an alternative.</resume-signal>
</task>

<task type="auto">
  <name>Task 1: install recharts + build the shared retro chart theme + frame</name>
  <files>frontend2/package.json, frontend2/bun.lock, frontend2/src/features/analytics/charts/retroChartTheme.ts, frontend2/src/features/analytics/charts/RetroChartFrame.tsx</files>
  <action>
    Install: `cd frontend2 && bun add recharts` (latest stable 2.x). Commit BOTH package.json and the
    updated bun.lock (VALIDATION: a new dep must commit its lockfile). Do NOT add @types/recharts —
    recharts ships its own types.
    retroChartTheme.ts: export the locked sketch-009 constants as a single source of truth —
    `SERIES` = an ordered array of `{ fill, deep }` pairs (series-1 blue `#b8d8e8`/`#19526f`,
    series-2 pink `#f4b8c4`/`#a8334f`, series-3 mint `#b8e0c8`/`#1e6b43`, series-4 butter
    `#f6e3a8`/`#7a5a12`, series-5 sand `#e7ddca`/`#5b5b66`); `INK = "#26262e"`; `STROKE_WIDTH = 2`;
    `GRID = "#e7ddca"` (1px sand rule); `AXIS_TICK_STYLE` ({ fontFamily mono, fontVariantNumeric:
    "tabular-nums", fill: muted }); `VALUE_LABEL_STYLE` (same mono tabular-nums, ink fill); a
    `seriesAt(i)` helper that walks the palette and reuses series-5 for overflow. Export a
    `markProps` object `{ stroke: INK, strokeWidth: STROKE_WIDTH }` (NO radius → square caps; NO
    gradient defs). These constants are the ONLY place the sketch-009 marks are defined — every chart
    reads them so the look stays 1:1.
    RetroChartFrame.tsx: a small wrapper `RetroChartFrame({ title, accent, isEmpty, emptyLabel,
    children })` that renders a retro `Window` (Silkscreen `title`, `titlebarVariant` = the semantic
    `accent`), and inside the body either a `ResponsiveContainer` hosting `children` (the chart) OR,
    when `isEmpty`, a RetroEmptyState with `emptyLabel`. This frame is what makes "each chart in a
    locked retro Window" DRY — all six charts compose it. Height via a fixed aspect (e.g. min-h on the
    container) so the responsive stack stays stable.
  </action>
  <verify>
    <automated>cd frontend2 && grep -q '"recharts"' package.json && grep -q 'recharts' bun.lock && bun run lint:tsc</automated>
  </verify>
  <done>recharts in package.json + bun.lock; theme constants + RetroChartFrame compile (tsc -b clean).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: the six chart components (bars, donut, stack, monthly area+line)</name>
  <files>frontend2/src/features/analytics/components/CategoryValueChart.tsx, frontend2/src/features/analytics/components/LocationValueChart.tsx, frontend2/src/features/analytics/components/ConditionDonutChart.tsx, frontend2/src/features/analytics/components/StatusStackChart.tsx, frontend2/src/features/analytics/components/TopBorrowersChart.tsx, frontend2/src/features/analytics/components/MonthlyLoanActivityChart.tsx, frontend2/src/features/analytics/components/charts.test.tsx</files>
  <behavior>
    charts.test.tsx (render each chart under lingui providers; recharts ResponsiveContainer needs a
    mocked width/height — set a fixed container size or mock ResponsiveContainer to render children at
    a fixed box, the standard recharts-in-jsdom pattern):
    - CategoryValueChart given mocked CategoryStats[] renders its Window title + a bar per category
      (assert category names/labels present; the SVG renders without throwing)
    - LocationValueChart given LocationInventoryValue[] renders bars; value labels format via formatCents
      (assert a CENTS value renders as a currency string, e.g. not the raw integer)
    - ConditionDonutChart given ConditionBreakdown[] renders a donut + a swatch legend (assert a slice
      per condition + legend labels)
    - StatusStackChart given StatusBreakdown[] renders a 100%-stacked bar (assert each status segment present)
    - TopBorrowersChart given TopBorrower[] renders a bar per borrower (assert borrower names)
    - MonthlyLoanActivityChart given MonthlyLoanActivity[] renders an area + a line over months
      (assert month ticks + that both series render)
    - EACH chart with an EMPTY dataset renders the RetroChartFrame empty state (RetroEmptyState text),
      NOT a throwing/blank chart
  </behavior>
  <action>
    All six import recharts named primitives + the shared `retroChartTheme` (`SERIES`, `seriesAt`,
    `INK`, `STROKE_WIDTH`, `GRID`, `AXIS_TICK_STYLE`, `VALUE_LABEL_STYLE`, `markProps`) + `RetroChartFrame`
    + the summary types from `@/features/analytics/types`. Each takes its sub-array as a prop (e.g.
    `CategoryValueChart({ data }: { data: CategoryStats[] })`) — they are PURE presentational
    components; the page (13b-04) feeds them slices of the summary. `isEmpty = data.length === 0`.
    - CategoryValueChart: BarChart over category_stats, x = name, y = total_value (CENTS → formatCents
      on the value axis/labels), bars walk the palette via `<Cell fill={seriesAt(i).fill} {...markProps}/>`.
    - LocationValueChart: single-series bar (mint accent per the single-series rule), value = total_value
      (CENTS → formatCents), title-bar accent mint.
    - ConditionDonutChart: PieChart `innerRadius` (donut), one `<Cell>` per condition walking the
      palette, + a swatch `<Legend>` (custom retro legend — pastel swatch + ink border + mono label).
    - StatusStackChart: a 100%-STACKED bar — normalize each status count to a share of the total and
      render stacked segments (one segment per status, palette-walked, ink-stroked). Title-bar accent
      neutral/blue.
    - TopBorrowersChart: bar per borrower (x = name, y = total_loans or active_loans — pick total_loans;
      show active as a second value label or a paired bar), butter/loan accent.
    - MonthlyLoanActivityChart: ComposedChart over monthly_loan_activity — an `<Area>` (loans_created:
      blue series-1 fill + 2px ink TOP stroke) + a `<Line>` (loans_returned: mint series-3 stroke,
      square ink-stroked `<dot>` markers). x = month (formatted short month/year, mono tick), blue accent.
    Marks: NO `radius` on bars (square caps), NO `<defs>` gradients, axis ticks use AXIS_TICK_STYLE
    (mono tabular-nums), gridlines GRID color, baseline 2px ink. NO default `<Tooltip>` skin — either
    omit Tooltip or pass a custom retro `content`. Titles + legend + axis captions via <Trans>/t.
    Compose retro atoms only through `@/components/retro`.
  </action>
  <verify>
    <automated>cd frontend2 && bun run lint:tsc && bun run test src/features/analytics/components/charts.test.tsx</automated>
  </verify>
  <done>Charts test green: all six render from mocked sub-arrays + degrade to the empty state; value charts format CENTS; marks read the shared theme (no gradients, no rounded caps).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| summary payload → SVG marks | server-supplied category/borrower/status labels render as SVG `<text>` / axis ticks; recharts/React escape them — no raw HTML injection surface |
| npm registry → frontend2 deps | a NEW package (recharts) crosses into the dependency tree |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13b-SC | Tampering | `bun add recharts` (new dep) | mitigate | blocking package-legitimacy checkpoint (Task gate) verifies recharts on npmjs.com (no typosquat) BEFORE install; lockfile committed so the resolved tree is pinned + reviewable |
| T-13b-03 | Spoofing | mislabeled series implying server semantics | mitigate | the series palette is a fixed presentational ordering from sketch 009; chart titles/legends name the real dataset (condition/status/borrower) — no fabricated categories; empty datasets render an explicit empty state, never a misleading zero-bar |
| T-13b-04 | DoS | recharts inflating every route's bundle | transfer | mitigated by the Wave-2 wiring plan 13b-05 (React.lazy /analytics + `charts` manualChunk); ANL-03's build gate asserts the main chunk carries zero charting bytes — this plan only AUTHORS the importers |
</threat_model>

<verification>
- `cd frontend2 && bun run lint:tsc` clean (tsc -b — VALIDATION landmine: bare `tsc --noEmit` is silent).
- `bun run test src/features/analytics/components/charts.test.tsx` green (six charts + empty states).
- `grep -q '"recharts"' package.json && grep -q recharts bun.lock` — dep + lockfile committed.
- Marks read `retroChartTheme` constants only (no inline gradient `<defs>`, no `radius` rounded caps);
  axis labels use mono tabular-nums; titles are Silkscreen via the Window.
</verification>

<success_criteria>
- ANL-01: category, location, condition (donut), status (100% stacked) charts render from summary data, themed per sketch 009.
- ANL-02: top-borrowers bar + monthly area+line charts render from summary data.
- recharts installed, lockfile committed, every chart in a retro Window with the locked marks.
</success_criteria>

<output>
Create `.planning/phases/13b-analytics/13b-02-SUMMARY.md` when done (record the installed recharts
version, the exported theme constant names, the RetroChartFrame prop contract, and each chart's prop
type so 13b-04's AnalyticsPage composes them against verified signatures).
</output>
