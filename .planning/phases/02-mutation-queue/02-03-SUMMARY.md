---
phase: 02-mutation-queue
plan: 03
subsystem: frontend-hooks
tags: [react, hooks, offline, optimistic-ui, broadcast]
depends_on: ["02-01", "02-02"]

provides:
  - useOfflineMutation hook for offline-capable mutations
  - Optimistic update pattern with IndexedDB persistence
  - Queue broadcast notifications via BroadcastChannel
  - Pending mutation restoration helpers

affects:
  - 02-04 (will use hook for entity-specific mutations)
  - Phase 3 conflict resolution (integrates with mutation queue)

tech-stack:
  added: []
  patterns:
    - "useTransition for isPending state"
    - "Queue-first optimistic updates"
    - "BroadcastChannel for cross-tab sync"

key-files:
  created:
    - frontend/lib/hooks/use-offline-mutation.ts
  modified:
    - frontend/lib/sync/mutation-queue.ts

decisions:
  - id: queue-before-optimistic
    choice: "Queue to IndexedDB before optimistic update"
    rationale: "Ensures mutations persist even if user closes tab immediately"
  - id: broadcast-export
    choice: "Export broadcastQueueUpdate function"
    rationale: "Allow external modules to trigger broadcasts if needed"
  - id: pending-marker
    choice: "_pending: true property on optimistic items"
    rationale: "Simple, consistent way to identify pending items in UI"

metrics:
  duration: "3m 46s"
  completed: "2026-01-24"
---

# Phase 2 Plan 3: useOfflineMutation Hook Summary

**One-liner:** React hook for offline mutations with queue-first persistence, optimistic IndexedDB writes, and cross-tab broadcast notifications.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useOfflineMutation hook | d530b2c | frontend/lib/hooks/use-offline-mutation.ts |
| 2 | Add broadcast notification | 836edd1 | frontend/lib/sync/mutation-queue.ts |
| 3 | Add restoration helpers | d530b2c | (included in Task 1) |

## What Was Built

### useOfflineMutation Hook

A React hook for performing offline-capable mutations with optimistic updates:

```typescript
const { mutate, isPending } = useOfflineMutation({
  entity: 'items',
  operation: 'create',
  onMutate: (payload, tempId) => {
    addOptimisticItem({ ...payload, id: tempId, _pending: true });
  },
});

const tempId = await mutate(itemData);
```

**Features:**
- Uses `useTransition` for `isPending` state
- Queues mutation to IndexedDB BEFORE optimistic update
- Writes optimistic data to entity store via `put()`
- Returns tempId (idempotencyKey) for tracking
- Triggers immediate sync if online

### BroadcastChannel Integration

Queue operations now broadcast updates via `BroadcastChannel('sync-status')`:

- `queueMutation()` - after adding new mutation
- `removeMutation()` - after removing mutation
- `updateMutationStatus()` - when status changes
- `removeMutationByIdempotencyKey()` - when mutation removed
- `cleanExpiredMutations()` - when expired items cleaned

Message format:
```typescript
{
  type: 'QUEUE_UPDATED',
  payload: { queueLength: number }
}
```

### Restoration Helpers

For restoring optimistic state after page refresh:

- `getPendingMutationsForEntity(entity)` - Get all pending mutations for entity
- `getPendingCreates<T>(entity)` - Get pending creates with tempId
- `getPendingUpdates<T>(entity)` - Get pending updates with entityId

## Technical Decisions

### Queue-First Pattern

Mutations are queued to IndexedDB before optimistic updates are applied. This ensures:
1. Mutations persist even if user closes tab immediately
2. Mutations can be restored after page refresh
3. No race conditions between state update and persistence

### Pending Marker Convention

Items with pending mutations are marked with `_pending: true`. This allows:
- UI components to show "Saving..." or visual indicators
- Easy filtering of pending vs synced items
- Simple check with `isPendingMutation()` helper

### Broadcast Scope

The `broadcastQueueUpdate()` function is exported for potential use by:
- SyncManager when processing queue manually
- Future components that need to trigger UI refresh

## Verification

```bash
# Build passes
mise run fe-build  # Success

# Line count meets minimum
wc -l frontend/lib/hooks/use-offline-mutation.ts  # 250 lines

# All exports present
grep "^export" frontend/lib/hooks/use-offline-mutation.ts
# - useOfflineMutation (hook)
# - isPendingMutation (helper)
# - getPendingMutationsForEntity (helper)
# - getPendingCreates (helper)
# - getPendingUpdates (helper)
```

## Deviations from Plan

None - plan executed exactly as written. Task 3 (restoration helpers) was included in Task 1 file since they're all part of the same module.

## Next Phase Readiness

Ready for 02-04: This hook will be used to create entity-specific mutation hooks (useCreateItem, useUpdateItem, etc.) that integrate with existing API patterns.
