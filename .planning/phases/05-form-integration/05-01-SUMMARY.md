---
phase: 05-form-integration
plan: 01
subsystem: ui
tags: [offline, pwa, react, indexeddb, mutations, optimistic-ui]

# Dependency graph
requires:
  - phase: 02-mutation-queue
    provides: useOfflineMutation hook and mutation queue infrastructure
  - phase: 03-conflict-resolution
    provides: SyncManager with event subscription pattern
provides:
  - Items page form integrated with offline mutation support
  - Optimistic UI for offline item creation
  - Pending indicator badge for items awaiting sync
  - E2E tests for offline item mutation flows
affects: [locations-page, containers-page, inventory-page, categories-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [offline-form-integration, optimistic-state-merge]

key-files:
  created:
    - frontend/e2e/offline/offline-mutations.spec.ts
  modified:
    - frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx

key-decisions:
  - "Type casting for mutation payloads: Used Record<string, unknown> casting for hook compatibility"
  - "Optimistic state merge: Merge optimistic items with fetched items, excluding duplicates by ID"
  - "Pending click behavior: Show info toast instead of navigation for pending items"

patterns-established:
  - "Offline form pattern: useOfflineMutation hook + optimisticItems state + SyncManager subscription"
  - "Pending indicator: amber background + Cloud icon badge with animate-pulse"

# Metrics
duration: 12min
completed: 2026-01-24
---

# Phase 05 Plan 01: Form Integration for Offline Mutations Summary

**Items page form integrated with useOfflineMutation hook for offline-capable create/update with optimistic UI and pending indicators**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-24T16:00:00Z
- **Completed:** 2026-01-24T16:12:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Items page create/update forms now work offline via useOfflineMutation hook
- Optimistic items appear immediately in the list with _pending: true
- Pending items display amber background tint and "Pending" badge with Cloud icon
- Clicking pending items shows info toast instead of navigating
- SyncManager subscription clears optimistic state after successful sync
- E2E tests validate full offline create flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate item form to useOfflineMutation** - `789d253` (feat)
2. **Task 2: Add pending indicator to item table rows** - `d92d0ba` (feat)
3. **Task 3: Add E2E test for offline item creation** - `b87dce7` (test)

## Files Created/Modified
- `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx` - Integrated useOfflineMutation hooks, added optimistic state, pending indicators
- `frontend/e2e/offline/offline-mutations.spec.ts` - E2E tests for offline item creation and pending behavior

## Decisions Made
- **Type casting for hook compatibility:** Used `Record<string, unknown>` generic and explicit casts because ItemCreate/ItemUpdate types don't satisfy the hook's index signature constraint
- **Optimistic state merge pattern:** Added optimisticItems state that gets merged with fetched items in filteredItems useMemo, excluding duplicates by ID
- **Pending item click behavior:** Show info toast "Item pending sync" instead of navigation to prevent accessing temp IDs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript type constraint mismatch**
- **Found during:** Task 1 (Migrate item form to useOfflineMutation)
- **Issue:** useOfflineMutation hook requires `Record<string, unknown>` generic, but ItemCreate/ItemUpdate interfaces don't satisfy this constraint (missing index signature)
- **Fix:** Changed hook generic to `Record<string, unknown>` and added explicit casts when calling mutate functions
- **Files modified:** frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx
- **Verification:** Build passes with `mise run fe-build`
- **Committed in:** 789d253 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type-level fix only, no functional changes. No scope creep.

## Issues Encountered
None - plan executed smoothly after type constraint fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Items page is now fully offline-capable for create/update operations
- Same pattern can be applied to other entity pages (locations, containers, inventory, categories)
- E2E tests provide validation template for future offline form integrations

---
*Phase: 05-form-integration*
*Completed: 2026-01-24*
