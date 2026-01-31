---
phase: 25-frontend-unit-testing
plan: 02
subsystem: frontend-sync
tags: [vitest, unit-testing, sync-manager, offline, conflict-resolution]
dependency-graph:
  requires: [22-02]
  provides: [sync-manager-tests]
  affects: [25-05]
tech-stack:
  added: []
  patterns: [vi.mock-for-dependencies, broadcast-channel-mock, topological-sort-tests]
key-files:
  created:
    - frontend/lib/sync/__tests__/sync-manager.test.ts
  modified: []
decisions: []
metrics:
  duration: 8m
  completed: 2026-01-31
---

# Phase 25 Plan 02: SyncManager Comprehensive Tests Summary

Added comprehensive unit tests for the SyncManager class with 34 test cases covering queue processing, dependency handling, conflict resolution, error handling, and public API.

## What Was Done

### Task 1: Create comprehensive SyncManager test file

Created `frontend/lib/sync/__tests__/sync-manager.test.ts` with 1056 lines and 34 test cases covering:

**1. Queue Processing (4 tests)**
- Lock mechanism prevents concurrent processing
- Offline detection skips processing
- Mutations processed in entity order (categories -> locations -> items -> inventory)
- SYNC_STARTED and SYNC_COMPLETE events broadcast to listeners

**2. Dependency Handling (4 tests)**
- Mutations with unsynced dependencies are skipped
- Mutations process after dependencies sync
- Cascade failure when parent mutation fails
- MUTATION_CASCADE_FAILED broadcast for cascade failures

**3. Conflict Resolution (5 tests)**
- Non-critical conflicts auto-resolved with LWW (server wins)
- Critical conflicts queued for user review
- CONFLICT_AUTO_RESOLVED broadcast for auto-resolved conflicts
- CONFLICT_NEEDS_REVIEW broadcast for critical conflicts
- Conflicts logged to IndexedDB

**4. Error Handling and Retry (4 tests)**
- Network errors trigger retry with incremented retry count
- 4xx client errors (except 408, 429) marked as failed immediately
- Max retries exceeded marks mutation as failed
- MUTATION_FAILED broadcast when max retries reached

**5. Event Subscription (4 tests)**
- subscribe() returns unsubscribe function
- Listeners receive all event types
- unsubscribe() removes listener
- Multiple listeners receive events independently

**6. Public API (4 tests)**
- getPendingCount() returns correct count
- retryMutation() resets status and processes queue
- cancelMutation() removes mutation from queue
- destroy() cleans up listeners and channels

**7. Topological Sort (9 tests)**
- Categories: parents before children, single mutation, no parents, updates after creates, multi-level
- Locations: parents before children, single mutation, no parents, multi-level

### Mocking Strategy

```typescript
// BroadcastChannel mock (jsdom doesn't have it)
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(name: string) { this.name = name; }
  postMessage = vi.fn();
  close = vi.fn();
}
global.BroadcastChannel = MockBroadcastChannel;

// Mocked modules
vi.mock("../mutation-queue")   // getPendingMutations, updateMutationStatus, etc.
vi.mock("../conflict-resolver") // findConflictFields, classifyConflict, etc.
global.fetch = vi.fn()         // API calls
navigator.onLine = true/false  // Network state
localStorage.getItem()         // workspace_id
```

## Technical Details

- **Test file**: 1056 lines, 34 test cases
- **Coverage improvement for sync-manager.ts**:
  - Statements: 83.46%
  - Branch: 73.55%
  - Functions: 75%
  - Lines: 82.44%

### Key Patterns Used

1. **Instance-based testing**: Create fresh SyncManager in beforeEach, destroy in afterEach
2. **Navigator mock reset**: Reset navigator.onLine in afterEach to prevent test pollution
3. **Factory functions**: Used createMutationEntry from lib/test-utils for consistent test data
4. **Listener assertions**: Subscribe listener, process queue, assert on event types received

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 02a95fc | test(25-02): add comprehensive SyncManager class tests |

## Key Files

| File | Purpose |
|------|---------|
| frontend/lib/sync/__tests__/sync-manager.test.ts | Comprehensive SyncManager tests |

## Next Phase Readiness

Ready for 25-03 (MultiStepForm tests). The test patterns established here (vi.mock, listener assertions, cleanup) can be applied to form testing.
