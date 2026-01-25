---
phase: 01-indexeddb-foundation
plan: 02
subsystem: offline-sync
tags: [indexeddb, sync, offline-first, stale-while-revalidate, react-context]

dependency_graph:
  requires:
    - "01-01"
  provides:
    - "proactive-data-caching"
    - "offline-read-capability"
    - "sync-state-tracking"
  affects:
    - "01-03"
    - "02-01"

tech_stack:
  added: []
  patterns:
    - "stale-while-revalidate"
    - "parallel-fetch"
    - "workspace-isolation"

key_files:
  created:
    - frontend/lib/db/sync-operations.ts
    - frontend/lib/hooks/use-offline-data.ts
  modified:
    - frontend/lib/contexts/offline-context.tsx

decisions:
  - id: sync-limit
    choice: "High limit (10000) for initial fetch"
    rationale: "Home inventory systems typically have hundreds to low thousands of items; simplifies implementation while meeting use case"
  - id: sync-timing
    choice: "Sync on app load and when coming back online"
    rationale: "Proactive caching ensures data is available before user goes offline"
  - id: workspace-change
    choice: "Clear all cached data on workspace switch"
    rationale: "Prevents data leakage between workspaces; simplifies cache invalidation"

metrics:
  duration: "~4 minutes"
  completed: "2026-01-22"
---

# Phase 01 Plan 02: Background Sync & Proactive Caching Summary

Proactive data caching via syncWorkspaceData function that fetches all 7 entity types in parallel and stores them in IndexedDB on app load.

## What Was Built

### 1. Sync Operations Module (189 lines)

`frontend/lib/db/sync-operations.ts`

- `syncWorkspaceData(workspaceId)` - Main sync function that fetches all entity data
- `syncEntity(entityType, fetchFn)` - Helper for syncing individual entity types
- `getLastSyncTimestamp()` - Get timestamp of last successful sync
- `getSyncedWorkspaceId()` - Get workspace ID that was last synced

**Key Features:**
- Syncs all 7 entity types in parallel (items, inventory, locations, containers, categories, borrowers, loans)
- Clears cached data when workspace changes (prevents cross-workspace data leakage)
- Records sync metadata (lastSync timestamp, workspaceId) in syncMeta store
- Graceful error handling with detailed error messages

### 2. useOfflineData Hook (147 lines)

`frontend/lib/hooks/use-offline-data.ts`

Implements stale-while-revalidate pattern:
1. Returns cached data immediately (stale)
2. Fetches fresh data in background (revalidate)
3. Updates state when fresh data arrives
4. Falls back to cached data if fetch fails (offline resilience)

**Exports:**
- `useOfflineData<T>({ store, fetchFn, enabled })` - Hook for offline-first data access

**Returns:**
- `data` - The data array (cached or fresh)
- `isLoading` - Whether initial load is in progress
- `isStale` - True when showing cached data while fetching
- `error` - Error from most recent fetch attempt
- `refetch` - Function to manually trigger refresh

### 3. OfflineContext Integration

Extended `frontend/lib/contexts/offline-context.tsx` with sync capabilities:

**New State:**
- `isSyncing` - Whether sync is in progress
- `lastSyncTimestamp` - Timestamp of last successful sync
- `syncError` - Error message if sync failed
- `syncCounts` - Record counts for each entity type

**New Functions:**
- `triggerSync()` - Manually trigger workspace data sync

**Auto-sync Triggers:**
- Initial sync when DB is ready and online
- Re-sync when coming back online after being offline

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fetch limit | 10000 items | Home inventory typically has hundreds to low thousands; avoids pagination complexity |
| Parallel sync | Promise.all for all entities | Maximizes sync speed; all entities independent |
| Workspace isolation | Clear all data on switch | Prevents data leakage; simpler than selective invalidation |
| Sync timing | On load + back online | Proactive caching ensures data ready before offline |

## Commits

| Hash | Description |
|------|-------------|
| 8e85949 | feat(01-02): create sync operations module for offline caching |
| e2a22b4 | feat(01-02): create useOfflineData hook with stale-while-revalidate |
| ae903dd | feat(01-02): integrate sync into OfflineContext with auto-trigger |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] TypeScript compilation succeeds (`mise run fe-build`)
- [x] sync-operations.ts exports syncWorkspaceData and syncEntity
- [x] use-offline-data.ts exports useOfflineData hook (147 lines > 50 min)
- [x] sync-operations.ts has 189 lines (> 80 min)
- [x] OfflineContext exposes isSyncing, lastSyncTimestamp, syncError, syncCounts, triggerSync
- [x] Key links verified:
  - sync-operations.ts imports from all 7 API modules
  - sync-operations.ts uses putAll from offline-db.ts
  - use-offline-data.ts uses getAll from offline-db.ts

## Next Phase Readiness

Ready for Plan 01-03 (Offline Read Views):
- All workspace data is cached on app load
- useOfflineData hook available for offline-first data access
- syncMeta contains lastSync and workspaceId for cache validation

## Usage Example

```typescript
// In a component
const { isSyncing, lastSyncTimestamp, syncError, triggerSync } = useOffline();

// Using the offline data hook
const { data: items, isLoading, isStale } = useOfflineData({
  store: 'items',
  fetchFn: () => itemsApi.list(workspaceId, { limit: 10000 }).then(r => r.items),
  enabled: !!workspaceId,
});
```
