---
phase: 14-system-group
plan: 02
subsystem: ui
tags: [react-query, lingui, retro-ui, system-group, pending-changes]

# Dependency graph
requires:
  - phase: 13-dashboard
    provides: "pendingChanges.ts PendingChangeDTO type + bare { changes, total } envelope convention"
provides:
  - "myChangesApi.list(ws) → { changes, total } over GET /workspaces/{ws}/my-pending-changes"
  - "useMyChanges() hook keyed [my-changes, wsId], enabled on wsId, retry:false → { rows, total, isLoading, isError }"
  - "MyChangesPage — read-only /my-changes activity table (export name: MyChangesPage)"
affects: [14-08-wiring, 14-system-group]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Isolated tiny api module reaching a sibling endpoint (my-pending-changes) without sharing 14-01's pendingChanges.ts runtime deps — TYPE-only import of PendingChangeDTO"
    - "Activity-table page: LoansListPage Window shell minus tabs/filters/bulk; action+status → RetroBadge variant maps"

key-files:
  created:
    - frontend2/src/lib/api/myChanges.ts
    - frontend2/src/lib/api/myChanges.test.ts
    - frontend2/src/features/my-changes/hooks/useMyChanges.ts
    - frontend2/src/features/my-changes/hooks/useMyChanges.test.tsx
    - frontend2/src/features/my-changes/MyChangesPage.tsx
    - frontend2/src/features/my-changes/MyChangesPage.test.tsx
  modified: []

key-decisions:
  - "TYPE-only borrow of PendingChangeDTO from pendingChanges.ts (action/status unions) to avoid drift, with zero runtime coupling to 14-01's file"
  - "No 403/isForbidden path (unlike usePendingChangesQuery) — /my-pending-changes is open to all roles and returns only the caller's own changes"
  - "Entity id shown truncated to 8 chars with full id in title attr to keep the column narrow"

patterns-established:
  - "Pattern: action→variant (create=ok/update=info/delete=danger) and status→variant (pending=warn/approved=ok/rejected=danger) RetroBadge maps for change-row pills"

requirements-completed: [SYS-02]

# Metrics
duration: ~12min
completed: 2026-06-13
---

# Phase 14 Plan 02: My-Changes Page (SYS-02) Summary

**Read-only /my-changes activity table of the authenticated user's own recent mutations, sourced from the bare `{ changes, total }` envelope of GET /my-pending-changes (open to all roles, no 403 gate), composed from an isolated api module + useMyChanges hook + a RetroTable page.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-13T20:18Z
- **Completed:** 2026-06-13T20:21Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- `myChangesApi.list(ws)` reaching `GET /api/workspaces/{ws}/my-pending-changes`, returning the bare `{ changes: MyChangeDTO[]; total }` envelope (key `changes`, NOT items) — isolated from 14-01's `pendingChanges.ts` runtime (TYPE-only import of `PendingChangeDTO`).
- `useMyChanges()` hook keyed `["my-changes", wsId]`, `enabled: Boolean(wsId)` (no request fires without a workspace), `retry: false` (single settle, no retry-storm — T-14-06), exposing `{ rows, total, isLoading, isError }`.
- `MyChangesPage` — Window shell mirroring LoansListPage (no tabs/filters/bulk), a RetroTable with Entity / Action / Status / Requested columns, action+status RetroBadge pills, a calm RetroEmptyState on empty and a calm danger line on error. All strings via `<Trans>`/`t`.

## Task Commits

Each task was committed atomically (TDD: test + implementation per task commit):

1. **Task 1: myChanges api + useMyChanges hook + tests** - `28c11c13` (feat)
2. **Task 2: MyChangesPage activity table + page test** - `6c5ccf2c` (feat)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `frontend2/src/lib/api/myChanges.ts` - myChangesApi.list(ws) + MyChangeDTO; bare { changes, total } envelope over /my-pending-changes
- `frontend2/src/lib/api/myChanges.test.ts` - fetch-mock unit tests (URL shape + bare envelope, key changes not items)
- `frontend2/src/features/my-changes/hooks/useMyChanges.ts` - useMyChanges() keyed [my-changes, wsId], enabled on wsId, retry:false
- `frontend2/src/features/my-changes/hooks/useMyChanges.test.tsx` - MSW + QueryClient: fetches on wsId / disabled without one
- `frontend2/src/features/my-changes/MyChangesPage.tsx` - read-only RetroTable activity page (Entity/Action/Status/Requested)
- `frontend2/src/features/my-changes/MyChangesPage.test.tsx` - render tests (rows render with badges; empty→RetroEmptyState; error→calm line)

## Wiring contract for 14-08 (Wave 2)
- Route element: `import { MyChangesPage } from "@/features/my-changes/MyChangesPage"` (named export `MyChangesPage`); render at path `/my-changes`.
- Query key: `["my-changes", wsId]`. No props required — the page reads `useWorkspace()` itself.
- No role gate needed — the endpoint is open to all roles and self-scoped.

## Decisions Made
- TYPE-only borrow of `PendingChangeDTO` (action/status unions) from `pendingChanges.ts` keeps the file isolated from 14-01's runtime per the otmf_note ownership rule.
- No `isForbidden`/403 path (unlike `usePendingChangesQuery`) — `/my-pending-changes` returns only the caller's own changes.
- Entity id truncated to 8 chars (full id in `title`) to keep the Entity column narrow.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SYS-02 surface complete and tested; ready for 14-08 route + Sidebar wiring (Wave 2).
- No blockers.

## Self-Check: PASSED

All 6 created files exist on disk; both task commits (`28c11c13`, `6c5ccf2c`) present in git log. `bun run lint:tsc` clean; 7/7 plan tests green.

---
*Phase: 14-system-group*
*Completed: 2026-06-13*
