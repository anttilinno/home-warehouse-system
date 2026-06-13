---
phase: 13-dashboard
plan: 03
subsystem: ui
tags: [react, react-query, lingui, dashboard, retro-os, maintenance, expiring]

requires:
  - phase: 07b-inventory-expiring
    provides: useExpiringQuery (/inventory/expiring read)
  - phase: 10b-maintenance
    provides: useMaintenanceDueQuery (/maintenance/due feed, server is_overdue flag)
  - phase: 13-02-approvals
    provides: PendingApprovalsPanel (same-wave sibling, imported by the side rail)
provides:
  - SystemAlertsPanel — side-rail panel stacking an expiring-soon card + a maintenance-due card
  - DashboardSideRail — presentational right-rail container stacking PendingApprovals over SystemAlerts

affects: [13-05]

tech-stack:
  added: []
  patterns:
    - "Dashboard summary cards REUSE existing feature query hooks (no new api/hook) — React Query dedupes the shared keys"
    - "Server is_overdue flag rendered verbatim as a danger badge — no client date math (T-13-06)"

key-files:
  created:
    - frontend2/src/features/dashboard/components/SystemAlertsPanel.tsx
    - frontend2/src/features/dashboard/components/SystemAlertsPanel.test.tsx
    - frontend2/src/features/dashboard/components/DashboardSideRail.tsx
  modified: []

key-decisions:
  - "Reused useExpiringQuery + useMaintenanceDueQuery directly — zero new data layer (DASH-03 key_links honored)."
  - "Overdue cue is items.filter(is_overdue).length rendered as a RetroBadge variant=danger — server flag verbatim."
  - "DashboardSideRail kept layout-light (vertical flex gap-sp-4); Plan 13-05's DashboardPage owns the 2-col→1-col responsive switch."
  - "Typed import of PendingApprovalsPanel left as a same-wave seam (13-02 not present in this worktree) — not stubbed."

patterns-established:
  - "SystemAlertsPanel card: Link wrapper (count + label + optional trailing badge) with calm zero/loading/error degrade."

requirements-completed: [DASH-03]

duration: ~15min
completed: 2026-06-13
---

# Phase 13 Plan 03: SystemAlertsPanel + DashboardSideRail Summary

**System Alerts side-rail panel (expiring-soon + maintenance-due cards reusing the existing Phase-7b/10b hooks, server-flag overdue badge) plus the presentational DashboardSideRail that stacks PendingApprovals over SystemAlerts for Plan 13-05 to mount.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 / 2 complete
- **Files created:** 3

## Accomplishments

### Task 1 — SystemAlertsPanel (commit `13c7f362`)
- `SystemAlertsPanel.tsx`: a `Window`-chrome panel (titlebarVariant=butter, title `<Trans>System alerts</Trans>`) stacking two `Link` cards.
  - **Expiring soon** card → `useExpiringQuery()`; shows `data.total` (falls back to `items.length`), links to `/inventory/expiring`, calm "Nothing expiring" line at 0.
  - **Maintenance due** card → `useMaintenanceDueQuery()`; shows `items.length`, links to `/maintenance/due`, renders an OVERDUE `RetroBadge variant="danger"` with the overdue count when `items.some(i => i.is_overdue)` — the SERVER `is_overdue` flag is used verbatim (no client date math, T-13-06).
  - Each card degrades calmly: `isLoading` → mono "Loading…", `isError`/null → "—". No crash on empty, no error banner.
- `SystemAlertsPanel.test.tsx`: MSW-backed (handlers for `/inventory/expiring` + `/maintenance/due`, `useWorkspace` mocked to a fixed wsId), rendered under QueryClient + I18nProvider + MemoryRouter. 3 tests — expiring count + link, due count + overdue danger badge from server flag, both-empty calm states. **All 3 green.**

### Task 2 — DashboardSideRail (commit `c6cf75cd`)
- `DashboardSideRail.tsx`: presentational vertical stack (`flex flex-col gap-sp-4`) of `<PendingApprovalsPanel />` (imported from `@/features/approvals/components/PendingApprovalsPanel`, Plan 13-02) ABOVE `<SystemAlertsPanel />`. No data fetching, no required props. Layout-light — the responsive 2-col → 1-col switch lives in Plan 13-05's DashboardPage.

## Import paths for Plan 13-05 (page wiring)

- `import { DashboardSideRail } from "@/features/dashboard/components/DashboardSideRail";`
- `import { SystemAlertsPanel } from "@/features/dashboard/components/SystemAlertsPanel";` (if mounting individually)

The rail is the standalone right column; mount `<DashboardSideRail />` as the second grid column and let it drop below the main column on narrow viewports.

## Verification

- `bun run test src/features/dashboard/components/SystemAlertsPanel.test.tsx` → **3 passed**.
- `bunx tsc -p tsconfig.app.json --noEmit` → only **one** error remains: `TS2307 Cannot find module '@/features/approvals/components/PendingApprovalsPanel'` in `DashboardSideRail.tsx`. This is the **expected same-wave import seam** — Plan 13-02's `PendingApprovalsPanel.tsx` is not present in this worktree and resolves after merge. The plan instructs leaving a typed import (not a stub); all other type-checking is clean.
- grep `PendingApprovalsPanel|SystemAlertsPanel` in `DashboardSideRail.tsx` → **4** (composition confirmed).
- Hook reuse grep-confirmed: `SystemAlertsPanel.tsx` imports the existing `useExpiringQuery` + `useMaintenanceDueQuery` — no new expiring/maintenance api or hook created.

### tsc invocation note
Bare `bunx tsc --noEmit` exits 0 silently because the root `tsconfig.json` is a project-references solution that does not directly emit diagnostics for the app sources. The real app type-check is `bunx tsc -p tsconfig.app.json --noEmit` (used above), which surfaces both the expected seam error and any real errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MSW handler helper body typed `unknown` → `object`**
- **Found during:** Task 2 verification (`tsc -p tsconfig.app.json`).
- **Issue:** `expiringHandler`/`dueHandler` in `SystemAlertsPanel.test.tsx` declared the fixture param as `unknown`, which is not assignable to `HttpResponse.json`'s `JsonBodyType` (TS2345 ×2).
- **Fix:** Widened the param type to `object`. Tests re-run green.
- **Files modified:** frontend2/src/features/dashboard/components/SystemAlertsPanel.test.tsx
- **Commit:** `c6cf75cd`

**2. [Rule 1 - Bug] Test async race on count assertions**
- **Found during:** Task 1 test runs.
- **Issue:** Cards render labels immediately (before query resolves), so synchronous `getByText("2")` / empty-state assertions raced the React Query fetch and intermittently saw "Loading…".
- **Fix:** Switched count/empty-state assertions to `findBy*` (await resolution).
- **Files modified:** frontend2/src/features/dashboard/components/SystemAlertsPanel.test.tsx
- **Commit:** `13c7f362` (fixed before the Task 1 commit landed).

## Known Stubs

None. The only unresolved reference is the typed `PendingApprovalsPanel` import — an intentional same-wave seam (Plan 13-02), documented above; it is NOT a stub and resolves on merge.

## Self-Check: PASSED
- FOUND: frontend2/src/features/dashboard/components/SystemAlertsPanel.tsx
- FOUND: frontend2/src/features/dashboard/components/SystemAlertsPanel.test.tsx
- FOUND: frontend2/src/features/dashboard/components/DashboardSideRail.tsx
- FOUND commit: 13c7f362
- FOUND commit: c6cf75cd
