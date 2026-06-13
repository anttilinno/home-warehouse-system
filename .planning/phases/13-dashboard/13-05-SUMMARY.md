---
phase: 13-dashboard
plan: 05
subsystem: frontend2-dashboard
tags: [dashboard, activity, relative-time, side-rail, hud, shortcuts, wave2]
requires:
  - frontend2/src/features/dashboard/components/DashboardSideRail.tsx (13-03, self-fetching rail)
  - frontend2/src/features/dashboard/components/HudRow.tsx (13-04, flag-gated HUD)
  - frontend2/src/features/approvals/components/PendingApprovalsPanel.tsx (13-02, via the rail)
  - frontend2/src/components/shortcuts (useShortcuts SSOT)
  - frontend2/src/lib/types.ts (DashboardStats, RecentActivity)
provides:
  - frontend2/src/features/dashboard/relativeTime.ts (formatRelativeTime util)
  - frontend2/src/features/dashboard/DashboardPage.tsx (extended page — the Phase-13 single writer of this file)
affects:
  - "Live E2E (login-dashboard.spec.ts) — the activity table columns changed (Time/Action/Entity/Actor/Status); any spec asserting the old Name column or 4-col table must update"
  - "The dashboard now renders the DASH-03 side rail (Pending Approvals + System Alerts) and the flag-gated DASH-04 HUD"
tech-stack:
  added: []
  patterns:
    - "Injectable-`now` pure formatter (formatRelativeTime(iso, now?)) for deterministic boundary tests"
    - "Render-loop-safe shortcut registration: stable navigate ref + useCallback per action + useMemo bindings + tRef for labels (mirrors ItemsListPage; landmine hit 4× this project)"
    - "Action-derived Status pill (ACTION_BADGES) — honest derivation, NOT a fabricated server status (T-13-10)"
key-files:
  created:
    - frontend2/src/features/dashboard/relativeTime.ts
    - frontend2/src/features/dashboard/relativeTime.test.ts
  modified:
    - frontend2/src/features/dashboard/DashboardPage.tsx
    - frontend2/src/features/dashboard/DashboardPage.test.tsx
decisions:
  - "Activity table final column set: Time / Action / Entity / Actor / Status. entity_name is folded into the Entity cell as a secondary muted line so the dropped Name column loses no data."
  - "Actor renders the raw user_id slug (first 8 chars, monospace) or '—' — RecentActivity carries user_id? only, NO actor name; no backend join invented this phase."
  - "Status pill is DERIVED from `action` via the existing ACTION_BADGES map (CREATE→ok, UPDATE→warn, DELETE→danger, MOVE/LOAN/RETURN→info, else neutral). RecentActivity has no status field — the pill is labelled with the action text, never presented as independent server state."
  - "relativeTime contract: <60s → '<1m'; <60m → 'Nm ago'; <24h → 'Nh ago'; ≥24h → absolute locale date+time (day/month/HH:MM). Future/negative deltas clamp to '<1m' (clock-skew guard)."
  - "HudRow mounted UNCONDITIONALLY between tiles and activity; the VITE_FEATURE_HUD_ROLLUPS gate lives inside HudRow (renders null by default → dashboard byte-identical to today)."
  - "Dashboard grid shape: mx-auto max-w-[1280px] grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-sp-5 — main column (tiles+HUD+activity) + right <DashboardSideRail/>; rail drops below on narrow."
  - "DASH-05 shortcuts: useShortcuts('dashboard', [N→/items/new, S→/scan, L→/loans]) with stable deps — no render-loop."
metrics:
  duration: ~15m
  completed: 2026-06-13
---

# Phase 13 Plan 05: DashboardPage Extend (DASH-01..05) Summary

Extended the existing 191-line DashboardPage (single-writer, surgical diff — not a rewrite)
to finish the dashboard: a true relative-time formatter for the activity table, an Actor +
action-derived Status column, the DASH-03 side rail, the flag-gated DASH-04 HUD, and the
DASH-05 N/S/L route shortcuts — with the DASH-01 tiles guarded by a regression assertion.

## What shipped

**`relativeTime.ts` — `formatRelativeTime(iso, now?: Date)`** (Task 1, TDD):
pure + locale-aware. `<1m` under 60s, `Nm ago` under an hour, `Nh ago` under 24h, an absolute
`toLocaleString(i18n.locale, {day, month, hour, minute})` at/after 24h. Future/negative deltas
clamp to `<1m`. 8 boundary tests (59m→ago, 23h→ago, 24h→absolute, skew guard) green.

**`DashboardPage.tsx` extension** (Task 2, TDD):
1. **DASH-02** — the Time cell now uses `formatRelativeTime`; the activity table columns became
   **Time / Action / Entity / Actor / Status**. `entity_name` is folded into the Entity cell as a
   secondary muted line. Actor = `row.user_id ? row.user_id.slice(0,8) : "—"` (monospace). Status =
   an `ACTION_BADGES[action]` pill (action-derived, honest — no status field on the wire).
2. **DASH-03** — body wrapped in `grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-sp-5` (max-w-[1280px]
   kept); main column (tiles + HUD + activity) + a right `<DashboardSideRail/>` that drops below on narrow.
3. **DASH-04** — `<HudRow stats={s}/>` mounted unconditionally between the tiles and the activity Window
   (self-gates on `VITE_FEATURE_HUD_ROLLUPS`, null by default).
4. **DASH-05** — `useShortcuts("dashboard", [N→/items/new, S→/scan, L→/loans])` with a stable `navigate`
   ref, one `useCallback` per action, a `useMemo` bindings array, and `tRef` for labels (render-loop-safe).
5. **DASH-01** — the four stat tiles unchanged; page test asserts they still render (regression guard).

## Tests

`DashboardPage.test.tsx` (rewritten to wrap Router + ShortcutsProvider, MSW for
dashboard/activity/expiring/maintenance-due/pending-changes): 4-tiles regression, action-derived
Status pill, Actor slug/— column, relative time on a recent row, side-rail mount with
**Pending approvals BEFORE System alerts** in DOM order, N/S/L shortcut registration, no render-loop.
6/6 green.

## Deviations from Plan

**1. [Rule 1 — test precision] Status-pill assertion disambiguated.**
- **Found during:** Task 2 (page test RED→GREEN).
- **Issue:** the Action cell renders the plain action text AND the Status cell renders the same text
  inside a badge, so `getByText("CREATE")` matched 2 nodes and threw.
- **Fix:** the test now asserts exactly 2 occurrences in the row and selects the pill by its
  `rounded-chip` badge class — still a genuine action-derived-pill assertion, just unambiguous.
- **Files modified:** frontend2/src/features/dashboard/DashboardPage.test.tsx
- **Commit:** cb90def4

Otherwise the plan executed as written.

## Verification

- `bunx tsc -p tsconfig.app.json --noEmit` → clean (exit 0).
- `bun run lint:tsc` (tsc -b) → clean.
- `bun run test` → **145 files, 968 tests passed**.
- `bun run build` → success (pre-existing >500 kB chunk-size advisory only, unrelated).
- `bun run lint:imports` → OK.

## Known Stubs

None new. (Pre-existing carry-forward stubs documented elsewhere: HudRow's capacity target +
14-day sparkline are honestly "data pending" — owned by Plan 13-04, not this plan.)

## Self-Check: PASSED

- frontend2/src/features/dashboard/relativeTime.ts — FOUND
- frontend2/src/features/dashboard/relativeTime.test.ts — FOUND
- frontend2/src/features/dashboard/DashboardPage.tsx — FOUND (modified)
- frontend2/src/features/dashboard/DashboardPage.test.tsx — FOUND (modified)
- commit 21b02a23 (Task 1) — FOUND
- commit cb90def4 (Task 2) — FOUND
