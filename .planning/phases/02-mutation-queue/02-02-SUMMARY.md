---
phase: 02-mutation-queue
plan: 02
subsystem: sync
tags: [syncmanager, background-sync, ios-fallback, broadcastchannel, offline]

dependency-graph:
  requires:
    - 02-01 (MutationQueue infrastructure)
    - 01-03 (OfflineContext)
  provides:
    - SyncManager with queue processing
    - iOS fallback for browsers without Background Sync
    - OfflineContext mutation state
  affects:
    - 02-03 (Optimistic UI hooks will use SyncManager)
    - Phase 3 (Conflict resolution)

tech-stack:
  added: []
  patterns:
    - BroadcastChannel for SW communication
    - Singleton pattern for SyncManager
    - iOS fallback (online + visibilitychange events)

key-files:
  created:
    - frontend/lib/sync/sync-manager.ts
  modified:
    - frontend/lib/contexts/offline-context.tsx
    - frontend/app/sw.ts

decisions:
  - id: sync-trigger-pattern
    choice: "SW notifies main thread via BroadcastChannel"
    rationale: "IndexedDB access is simpler in main thread; SW just triggers sync"
  - id: fallback-events
    choice: "online + visibilitychange"
    rationale: "Covers iOS Safari and Firefox which lack Background Sync API"
  - id: processing-lock
    choice: "isProcessing boolean flag"
    rationale: "Simple lock prevents concurrent queue processing"

metrics:
  duration: 5m
  completed: 2026-01-24
---

# Phase 02 Plan 02: SyncManager & iOS Fallback Summary

SyncManager class with queue processing and iOS fallback via online/visibilitychange events, integrated into OfflineContext

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SyncManager class | 5934eca | frontend/lib/sync/sync-manager.ts |
| 2 | Integrate into OfflineContext | aa0abde | frontend/lib/contexts/offline-context.tsx |
| 3 | Add BackgroundSync to SW | 16c7c2a | frontend/app/sw.ts |

## Key Artifacts

### SyncManager (436 lines)

The SyncManager class orchestrates offline mutation queue processing:

```typescript
class SyncManager {
  private isProcessing = false;           // Lock for concurrent processing
  private channel: BroadcastChannel;      // SW communication
  private listeners: Set<SyncEventListener>;

  // Queue processing with locking
  async processQueue(): Promise<void>

  // API call with retry logic
  private async processMutation(mutation): Promise<boolean>

  // Build URL based on entity type
  private buildApiUrl(mutation): string

  // iOS fallback setup
  setupFallbackListeners(): () => void

  // Background Sync support check
  supportsBackgroundSync(): boolean
}
```

### Event Types

```typescript
type SyncEventType =
  | "SYNC_STARTED"
  | "SYNC_COMPLETE"
  | "SYNC_ERROR"
  | "SYNC_REQUESTED"
  | "MUTATION_SYNCED"
  | "MUTATION_FAILED"
  | "QUEUE_UPDATED";
```

### OfflineContext Additions

New context values exposed:
- `pendingMutationCount: number` - Count of pending offline mutations
- `isMutationSyncing: boolean` - Whether mutations are currently syncing
- `processMutationQueue: () => Promise<void>` - Manual trigger

### Service Worker Sync

```typescript
// BroadcastChannel for SW <-> main thread
const syncChannel = new BroadcastChannel("sync-status");

// Background Sync handler (Chrome/Edge)
self.addEventListener("sync", (event) => {
  if (event.tag === "mutation-queue-sync") {
    // Notify main thread to process queue
    syncChannel.postMessage({ type: "SYNC_REQUESTED", ... });
  }
});
```

## Architecture

```
+------------------+     BroadcastChannel      +------------------+
|  Service Worker  | <----"sync-status"------> |   SyncManager    |
|                  |                           |                  |
| sync event       |     SYNC_REQUESTED        | processQueue()   |
| message event    | <------------------------ | subscribe()      |
|                  |                           |                  |
+------------------+                           +------------------+
                                                      |
                                               +--------------+
                                               | OfflineContext|
                                               | pendingCount  |
                                               | isSyncing     |
                                               +--------------+
```

## iOS Fallback

For browsers without Background Sync API (Safari, Firefox):

1. **online event**: Process queue when device reconnects
2. **visibilitychange**: Process queue when tab becomes visible while online

Both registered via `syncManager.setupFallbackListeners()` in OfflineContext.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Build succeeds
- sync-manager.ts: 436 lines (>= 150 required)
- BroadcastChannel "sync-status" in place
- iOS fallback with online + visibilitychange events
- OfflineContext exposes all mutation state fields
- Service worker handles 'sync' events

## Next Phase Readiness

Ready for 02-03 (Optimistic Update Hooks):
- SyncManager singleton available at `syncManager`
- Queue processing triggered automatically on reconnect
- Event subscription available for UI updates
- pendingMutationCount exposed in OfflineContext
