---
phase: 25-frontend-unit-testing
plan: 01
subsystem: hooks
tags: [testing, vitest, offline-sync, react-hooks]
requires:
  - 22-frontend-test-infrastructure
provides:
  - useOfflineMutation hook tests
  - Helper function tests (isPendingMutation, getPendingCreates, getPendingUpdates)
affects:
  - 25-02 (SyncManager tests can follow similar patterns)
tech-stack:
  added: []
  patterns:
    - vi.hoisted for mock functions with hoisted vi.mock
    - renderHook with act/waitFor for async hook testing
    - Mock module factory with object exports
key-files:
  created:
    - frontend/lib/hooks/__tests__/use-offline-mutation.test.ts
  modified: []
decisions:
  - id: FE-MOCK-01
    title: Use vi.hoisted for mock functions with vi.mock factory
    reason: vi.mock is hoisted to top of file, so mock functions must be created with vi.hoisted() to be available in the factory
metrics:
  duration: 15 min
  completed: 2026-01-31
---

# Phase 25 Plan 01: useOfflineMutation Hook Tests Summary

**One-liner:** Comprehensive tests for useOfflineMutation hook covering queue behavior, optimistic updates, network state, and helper functions using vi.hoisted pattern for mock factories.

## What Was Done

Created comprehensive test suite for the useOfflineMutation hook (FE-01 requirement) with 29 test cases covering:

### Queue Behavior Tests (4 tests)
- Queues mutation and returns idempotency key
- Queues mutation before calling onMutate (verified via invocationCallOrder)
- Passes entity, operation, and payload to queueMutation
- Passes dependsOn array for hierarchical entity creation

### Optimistic Update Tests (6 tests)
- Calls onMutate with payload, tempId, and dependsOn
- Writes optimistic data to IndexedDB for creates
- Writes optimistic data to IndexedDB for updates
- Verifies correct put() call count for operations
- Handles IndexedDB write errors gracefully for creates
- Handles IndexedDB write errors gracefully for updates

### Network State Tests (3 tests)
- Triggers sync when online (navigator.onLine = true)
- Does not trigger sync when offline (navigator.onLine = false)
- Handles sync errors gracefully (processQueue rejection)

### isPending State Tests (2 tests)
- isPending is false initially
- Returns boolean from useTransition

### Helper Function Tests (14 tests)
- isPendingMutation: 6 tests covering true/false/_pending behavior
- getPendingMutationsForEntity: 3 tests for filtering and exclusion
- getPendingCreates: 2 tests for create extraction with _pending flag
- getPendingUpdates: 3 tests for update extraction with entityId

## Key Implementation Details

### Mock Setup Pattern
```typescript
// Use vi.hoisted to create mocks that work with hoisting
const { mockProcessQueue } = vi.hoisted(() => ({
  mockProcessQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sync/sync-manager", () => ({
  syncManager: {
    processQueue: mockProcessQueue,
  },
}));
```

### Navigator.onLine Mocking
```typescript
// Reset in afterEach to avoid test pollution
Object.defineProperty(navigator, "onLine", {
  value: true,
  writable: true,
  configurable: true,
});
```

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 985e5bb | test(25-01): add comprehensive useOfflineMutation hook tests |

## Verification Results

```
29 tests pass in 46ms
- Queue behavior: 4 tests
- Optimistic updates: 6 tests
- Network state: 3 tests
- isPending state: 2 tests
- Helper functions: 14 tests
```

## Files Changed

| File | Change |
|------|--------|
| frontend/lib/hooks/__tests__/use-offline-mutation.test.ts | +689 lines |

## Next Phase Readiness

Phase 25-02 (SyncManager tests) can proceed. The vi.hoisted pattern established here will be useful for mocking the SyncManager dependencies.
