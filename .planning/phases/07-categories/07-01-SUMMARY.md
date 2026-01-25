---
phase: 07-categories
plan: 01
subsystem: ui, sync
tags: [offline, categories, hierarchical, topological-sort, optimistic-ui, dnd-kit]

# Dependency graph
requires:
  - phase: 06-infrastructure-borrowers
    provides: useOfflineMutation hook, syncManager entity ordering, pending indicator pattern
provides:
  - dependsOn parameter in useOfflineMutation for hierarchical entity dependencies
  - topologicalSortCategories function for parent-before-child sync ordering
  - Offline create/update support for categories with optimistic UI
  - Pending badge with parent context for subcategories
  - Disabled drag-drop for pending categories
affects: [07-02-locations, 08-containers-items]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Hierarchical offline mutations with dependsOn tracking
    - Topological sort (Kahn's algorithm) for parent-child ordering
    - Pending badge with parent context text

key-files:
  modified:
    - frontend/lib/hooks/use-offline-mutation.ts
    - frontend/lib/sync/sync-manager.ts
    - frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx

key-decisions:
  - "dependsOn parameter passed through mutate() to queueMutation() for hierarchical tracking"
  - "Topological sort applied only to categories entity type in processQueue"
  - "Pending badge shows 'Pending... under [ParentName]' for subcategories"
  - "Drag-drop disabled via useSortable disabled prop for pending categories"

patterns-established:
  - "Hierarchical offline mutation: check if parent is pending, pass dependsOn array with parent tempId"
  - "Parent context in pending badge: lookup parent name from allCategories array"
  - "Disable drag-drop for pending: useSortable({ disabled: category._pending === true })"

# Metrics
duration: 7min
completed: 2026-01-24
---

# Phase 07 Plan 01: Categories Offline Mutations Summary

**Offline category create/update with hierarchical parent-child dependency tracking using topological sort and pending badges with parent context**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-24T15:43:49Z
- **Completed:** 2026-01-24T15:50:48Z
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments

- Extended useOfflineMutation hook with dependsOn parameter for hierarchical entity support
- Implemented topological sort using Kahn's algorithm to sync parents before children
- Added offline create/update to categories page with optimistic UI
- Created pending indicator with parent context (e.g., "Pending... under Electronics")
- Disabled drag-drop for pending categories to prevent complex reparenting scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dependsOn support to useOfflineMutation hook** - `06c7e56` (feat)
2. **Task 2: Add topological sort for categories in sync-manager** - `2863ce2` (feat)
3. **Task 3: Add offline mutation support to categories page** - `fb0d580` (feat)
4. **Task 4: Add pending indicator with parent context and disable drag-drop** - `0274f3f` (feat)

## Files Created/Modified

- `frontend/lib/hooks/use-offline-mutation.ts` - Added dependsOn parameter to mutate() signature and onMutate callback
- `frontend/lib/sync/sync-manager.ts` - Added topologicalSortCategories function using Kahn's algorithm
- `frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx` - Integrated offline mutations with optimistic UI and pending indicators

## Decisions Made

- **dependsOn flow:** Parameter flows from mutate() -> queueMutation() -> onMutate callback, enabling both persistence and UI awareness of dependencies
- **Topological sort scope:** Only applied to categories entity type; locations will need similar treatment in 07-02
- **Parent context lookup:** getParentName helper searches allCategories array which includes both fetched and optimistic categories
- **Pending UI restrictions:** Hide edit/delete menu and disable drag-drop for pending items to prevent complex state scenarios

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **workspace_id not in Category type:** The Category interface from the API doesn't include workspace_id. Removed it from optimistic category creation as it's not needed for display.
- **mergedCategories declaration order:** Initially placed the useMemo after loadCategories, causing "used before declaration" error. Moved it before the tree useMemo that depends on it.
- **JSX comment syntax:** Self-closing tag with inline comment `{/* Spacer */}` caused syntax error. Removed the comment.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Categories offline support complete and verified
- Pattern established for locations (07-02) which have similar hierarchical structure
- topologicalSortCategories function provides template for topologicalSortLocations
- dependsOn infrastructure ready for use by any hierarchical entity

---
*Phase: 07-categories*
*Completed: 2026-01-24*
