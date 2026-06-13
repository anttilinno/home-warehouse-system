---
phase: 13-dashboard
plan: 04
subsystem: frontend2-dashboard
tags: [dashboard, hud, feature-flag, svg, data-pending]
requires:
  - frontend2/src/lib/types.ts (DashboardStats)
  - frontend2/src/components/retro (Window)
provides:
  - frontend2/src/features/dashboard/components/HudRow.tsx (flag-gated HUD: SVG gauge + sparkline + counts)
affects:
  - "Plan 13-05 mounts <HudRow stats={...} /> on DashboardPage (gate lives inside HudRow, so unconditional mount is safe)"
tech-stack:
  added: []
  patterns:
    - "Build-time feature flag: import.meta.env.VITE_FEATURE_HUD_ROLLUPS === 'true' (default off), mirrors SocialLoginButtons VITE_AUTHELIA_ENABLED"
    - "Hand-rolled SVG (donut arc via polar/arc-path math + dashed baseline) — no charting library (POL-04)"
key-files:
  created:
    - frontend2/src/features/dashboard/components/HudRow.tsx
    - frontend2/src/features/dashboard/components/HudRow.test.tsx
  modified: []
decisions:
  - "Flag default OFF; HudRow returns null when VITE_FEATURE_HUD_ROLLUPS !== 'true' so the live dashboard is byte-identical to today"
  - "capacity_target is a client constant (CAPACITY_TARGET_PLACEHOLDER=500) labelled 'data pending' — no backend endpoint invented"
  - "14-day sparkline renders an empty dashed baseline (series=[]), NOT fabricated points — the seam for a future series is the local `series` array"
metrics:
  duration: ~10m
  completed: 2026-06-13
---

# Phase 13 Plan 04: HudRow — Flag-Gated SVG Summary

Flag-gated dashboard HUD row (DASH-04): a hand-rolled SVG capacity gauge + a 14-day
activity sparkline + key counts, compiled in only when `VITE_FEATURE_HUD_ROLLUPS === "true"`
(DEFAULT OFF) and rendered with honest "data pending" treatment where the backend has no data.

## What shipped

`HudRow({ stats?: DashboardStats })` — standalone component, NOT yet mounted (Plan 13-05 mounts it).

- **Flag gate (FOUND-06 / Conflict-3):** first executable line reads
  `import.meta.env.VITE_FEATURE_HUD_ROLLUPS === "true"`; returns `null` when unset/false.
  Mirrors the proven `=== "true"` precedent in `features/auth/SocialLoginButtons.tsx`
  (VITE_AUTHELIA_ENABLED). Because the gate lives inside the component, Plan 13-05 can
  mount `<HudRow>` unconditionally and the flag-off behavior is preserved.
- **Capacity gauge:** hand-rolled 270° SVG donut arc (`arcPath` from `polar()` coordinate
  math). Fill ratio = `total_inventory / CAPACITY_TARGET_PLACEHOLDER`.
- **14-day sparkline:** hand-rolled `<svg>`; renders a dashed flat baseline (`<line>`),
  no `<polyline>`, because no backend series exists.
- **Counts:** `total_items`, `active_loans`, `low_stock_items` from the passed-in
  `DashboardStats` prop (no duplicate fetch — the page already holds stats).
- **No charting library.** Raw SVG only (POL-04 bundle budget; charting is Phase 13b).

### HudRow import path + props (for Plan 13-05)

```ts
import { HudRow } from "@/features/dashboard/components/HudRow";
// <HudRow stats={stats.data} />   // stats?: DashboardStats — optional
```

## Data-pending reality (CARRY-FORWARD — backend coordination)

VALIDATION-confirmed: `/analytics/activity` accepts `limit` only, and there is no
`capacity_target` field on the backend. This plan ships the UI honestly rather than
faking data:

1. **`capacity_target` does not exist.** The gauge fills against a client constant
   `CAPACITY_TARGET_PLACEHOLDER = 500`, captioned `target 500 · data pending`. When the
   backend ships a real target, replace the constant — the gauge math is unchanged.
2. **No `/activity?days=14` aggregate exists.** The sparkline `series` is `[]`, so it
   renders a dashed baseline + `data pending` caption (never a fabricated line). The seam
   for a future client-derivable or backend series is the local `series: number[]` array.

Both gaps are documented in a top-of-file comment in `HudRow.tsx` and remain tracked
in the roadmap. Threat T-13-08 (misleading fabricated data) is mitigated by the explicit
placeholders; T-13-09 (charting lib in bundle) is mitigated by the grep-gate below.

## Verification

| Check | Result |
|-------|--------|
| `bun run test src/features/dashboard/components/HudRow.test.tsx` | PASS — 6/6 |
| `! grep -REn "from ['"](recharts\|chart.js\|d3)" HudRow.tsx` (grep-gate) | PASS — no charting-lib import |
| `bunx tsc --noEmit` | PASS — clean |

Tests cover: flag unset → null + no svg; flag 'false' → null; flag 'true' → gauge svg +
sparkline svg + counts; empty series → 'data pending', no `<polyline>`; enabled with
`stats` undefined → counts fall back to `—`.

## Deviations from Plan

None — plan executed exactly as written. No npm/bun packages installed (raw SVG).

## Self-Check: PASSED

- FOUND: frontend2/src/features/dashboard/components/HudRow.tsx
- FOUND: frontend2/src/features/dashboard/components/HudRow.test.tsx
- FOUND commit 3f27d2a7 (test/RED), e406f721 (feat/GREEN)
