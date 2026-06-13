# Phase 13b — VALIDATION (done-criteria)

Confirmed facts (orchestrator-verified 2026-06-13):
- All analytics endpoints exist, GET, workspace-scoped, Huma bare-body (response IS the array/object). `/analytics/summary?months=N` returns all 5 chart datasets in one call; out-of-stock is SEPARATE (`/analytics/out-of-stock`).
- No chart lib installed; no `/analytics` route; greenfield `features/analytics/`.
- Sidebar Analytics NavItem is present-but-disabled (no `to`) → wire `to="/analytics"`.
- Lazy pattern precedent = `/scan` React.lazy route + vite `manualChunks` function (`scanner` chunk). recharts = the locked lib.
- Sketch 009 locks the chart marks (series palette, pastel-fill/ink-stroke, mono value labels, Silkscreen titles only).
- `total_value` is **cents** → format via existing null-safe `money.ts` (10b landmine: null-currency white-screen — guard).

Per-requirement done criteria:
- **ANL-01** — Analytics page renders category-breakdown + location-value + condition/status-distribution charts from real backend data (summary endpoint). Each chart in a retro Window, themed per sketch 009 (pastel fill + 2px ink stroke). Unit test: charts render given a mocked summary; values/labels present.
- **ANL-02** — same page renders top-borrowers + monthly-loan-activity charts from real data. Monthly = area+line over months.
- **ANL-03** — recharts is dynamic-imported: `/analytics` is a React.lazy route AND a `charts` manualChunk isolates the recharts vendor. DONE-CRITERION (hard gate): after `bun run build`, the MAIN chunk gzip carries ZERO charting bytes — grep the build output / assert recharts only in the charts chunk + analytics page chunk. Non-analytics routes unaffected. Document main-chunk gzip before/after (must be ~unchanged).
- **ANL-04** — out-of-stock table from `/analytics/out-of-stock`; each row links to `/items/{id}`; empty → RetroEmptyState; min_stock_level shown, current stock 0 (danger mono). Unit test: rows render with working item links; empty state.

Gate (phase): `cd frontend2 && bun run lint:tsc && bun run test && bun run build && bun run lint:imports` all green; **bundle budget POL-04**: main/vendor chunk gzip must NOT grow with charting weight (charts chunk separate, loads only on /analytics — grep build manifest); live E2E (navigate to /analytics, charts + out-of-stock render); gsd-verifier goal-backward PASS.

Landmines: money.ts null-currency white-screen (10b); bare `tsc --noEmit` exits 0 silently → use `bun run lint:tsc` (`tsc -b`); render-loop on hook deps; backend `limit` caps (analytics limits max 50, fine). recharts is a NEW dep → install + commit lockfile; verify it doesn't leak into main chunk.
