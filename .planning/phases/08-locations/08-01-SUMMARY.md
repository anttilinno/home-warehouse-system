---
phase: 08-locations
plan: 01
subsystem: frontend/offline
tags: [locations, offline-mutations, topological-sort, optimistic-ui]
dependency-graph:
  requires: [07-01]
  provides: [locations-offline-mutations, locations-topological-sort]
  affects: [09-containers]
tech-stack:
  added: []
  patterns: [topological-sort-locations, offline-mutation-hierarchy]
key-files:
  created: []
  modified:
    - frontend/lib/sync/sync-manager.ts
    - frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx
decisions: []
metrics:
  duration: 4min
  completed: 2026-01-24
---

# Phase 8 Plan 1: Offline Locations Mutations Summary

Locations page now supports offline create/update operations with optimistic UI, topological sort for parent-child sync ordering, and pending indicators showing hierarchy context.

## What Was Built

### 1. Topological Sort for Locations (sync-manager.ts)

Added `topologicalSortLocations` function using Kahn's algorithm, mirroring the categories implementation:
- Sorts create operations by parent-child dependency
- Uses `parent_location` field for hierarchy detection
- Ensures parents sync before children
- Updates processed before creates (no dependency issues)

Updated `processQueue` to apply topological sort when `entityType === 'locations'`.

### 2. Offline Mutation Support (locations/page.tsx)

Full offline capability following the categories pattern:

**State Management:**
- `optimisticLocations` state for pending mutations
- `mergedLocations` useMemo combining fetched and optimistic data
- Sync event subscription for cleanup on sync completion

**Offline Hooks:**
- `createLocationOffline` with dependsOn for hierarchy
- `updateLocationOffline` for editing existing locations

**UI Changes:**
- Pending locations show amber-50 background
- Cloud badge with "Pending" or "Pending... under [ParentName]"
- Dropdown menu hidden for pending locations
- Parent dropdown shows "(pending)" suffix for optimistic options

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `frontend/lib/sync/sync-manager.ts` | Added topologicalSortLocations, updated processQueue |
| `frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx` | Added offline mutation support, optimistic UI |

### Key Patterns Applied

1. **Topological Sort**: Kahn's algorithm for dependency ordering
2. **Optimistic State**: Merge pattern for immediate UI updates
3. **Dependency Tracking**: dependsOn for child-parent relationships
4. **Sync Events**: Subscribe pattern for cleanup after sync

## Commits

| Commit | Description |
|--------|-------------|
| d522ffb | feat(08-01): add topological sort for locations in sync-manager |
| 844f099 | feat(08-01): add offline mutation support to locations page |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors in app code
- Lint passes (only pre-existing warnings)
- topologicalSortLocations function exists and is called for locations
- Locations page uses offline mutation hooks
- Pending UI shows correctly with parent context

## Next Phase Readiness

Phase 8 Plan 2 (E2E tests) is ready to proceed. The offline mutation functionality is complete and follows the established pattern from categories.
