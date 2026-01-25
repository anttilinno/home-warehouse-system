---
phase: 02-mutation-queue
plan: 01
subsystem: sync
tags: [indexeddb, uuid, offline, mutation-queue, retry-logic]

# Dependency graph
requires:
  - phase: 01-indexeddb-foundation
    provides: IndexedDB schema and offline database utilities
provides:
  - MutationQueueEntry type for offline mutations
  - mutationQueue IndexedDB store with indexes
  - Queue CRUD operations (add, get, update, remove)
  - Retry logic with exponential backoff
  - TTL enforcement (7-day expiration)
affects: [02-02 optimistic-updates, 02-03 sync-engine, 03-conflict-resolution]

# Tech tracking
tech-stack:
  added: [uuid v13.0.0]
  patterns: [mutation-queue-pattern, exponential-backoff-with-jitter]

key-files:
  created:
    - frontend/lib/sync/mutation-queue.ts
  modified:
    - frontend/lib/db/types.ts
    - frontend/lib/db/offline-db.ts
    - frontend/package.json

key-decisions:
  - "UUIDv7 for idempotency keys (time-ordered, globally unique)"
  - "Auto-increment ID for IndexedDB keyPath (simple, efficient cursor iteration)"
  - "Unique index on idempotencyKey for deduplication"
  - "FIFO processing via timestamp sorting for pending mutations"

patterns-established:
  - "Mutation queue pattern: queue -> pending -> syncing -> (success/failed)"
  - "Exponential backoff: 1s, 2s, 4s, 8s, 16s capped at 30s with jitter"
  - "TTL cleanup: 7-day expiration for abandoned mutations"

# Metrics
duration: 8min
completed: 2026-01-24
---

# Phase 02 Plan 01: Mutation Queue Infrastructure Summary

**IndexedDB mutation queue with UUIDv7 idempotency keys, status tracking, and exponential backoff retry logic**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-24T10:00:00Z
- **Completed:** 2026-01-24T10:08:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Mutation queue infrastructure for offline create/update operations
- UUIDv7 idempotency keys for server-side deduplication
- Status tracking (pending, syncing, failed) with retry count
- Exponential backoff with jitter (max 5 retries, max 30s delay)
- 7-day TTL enforcement for expired mutation cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Install uuid and add MutationQueueEntry type** - `082bdc0` (feat)
2. **Task 2: Add mutationQueue store to IndexedDB** - `34cca2b` (feat)
3. **Task 3: Create mutation-queue.ts with queue operations** - `7e38174` (feat)

## Files Created/Modified

- `frontend/package.json` - Added uuid v13.0.0, @types/uuid v11.0.0
- `frontend/lib/db/types.ts` - MutationQueueEntry interface, MutationOperation/Status/EntityType types, updated OfflineDBSchema
- `frontend/lib/db/offline-db.ts` - Bumped DB_VERSION to 2, added mutationQueue store with indexes, exported getDB
- `frontend/lib/sync/mutation-queue.ts` - Full queue CRUD operations, retry logic helpers (347 lines)

## Decisions Made

- **UUIDv7 for idempotency keys:** Time-ordered and globally unique, better than random UUIDs for deduplication
- **Auto-increment ID for IndexedDB:** Simple and efficient for cursor iteration, separate from idempotencyKey
- **Unique index on idempotencyKey:** Enables fast deduplication and lookup by key
- **FIFO processing:** Sort pending mutations by timestamp (oldest first) for predictable sync order
- **Export getDB:** Allows mutation-queue.ts to access IndexedDB directly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Mutation queue infrastructure ready for optimistic update hooks
- Queue operations exported for use by sync engine
- Ready for 02-02 (optimistic update hooks) and 02-03 (sync engine)

---
*Phase: 02-mutation-queue*
*Completed: 2026-01-24*
