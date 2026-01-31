---
phase: 22-test-infrastructure-setup
plan: 02
subsystem: testing
tags: [vitest, coverage, v8, factories, mocking, offline, sync]
dependencies:
  requires: []
  provides: [frontend-test-utils, coverage-reporting, entity-factories, offline-mocks, sync-mocks]
  affects: [phase-25-frontend-testing]
tech-stack:
  added: ["@vitest/coverage-v8"]
  patterns: [factory-pattern, mock-utilities, test-isolation]
key-files:
  created:
    - frontend/vitest.setup.ts
    - frontend/lib/test-utils/index.ts
    - frontend/lib/test-utils/factories.ts
    - frontend/lib/test-utils/offline-mock.ts
    - frontend/lib/test-utils/sync-mock.ts
  modified:
    - frontend/package.json
    - frontend/vitest.config.ts
decisions:
  - id: use-v8-provider
    choice: V8 coverage provider over istanbul
    rationale: Better performance and accuracy for V8-based runtimes like Node/Bun
metrics:
  duration: 8m
  completed: 2026-01-31
---

# Phase 22 Plan 02: Frontend Test Utilities Summary

V8 coverage provider with reusable entity factories and offline/sync mocking utilities for frontend unit testing.

## What Was Built

### Coverage Configuration
- Installed `@vitest/coverage-v8` for V8-based coverage reporting
- Configured vitest.config.ts with coverage provider, reporters (text, html, json, lcov)
- Created vitest.setup.ts for mock reset between tests
- Added npm scripts: `test:unit`, `test:unit:watch`, `test:unit:coverage`

### Entity Factory Utilities (lib/test-utils/factories.ts)
- `createItem()` - Create typed Item entities with defaults
- `createLocation()` - Create typed Location entities
- `createContainer()` - Create typed Container entities
- `createBorrower()` - Create typed Borrower entities
- `createCategory()` - Create typed Category entities
- `createMutationEntry()` - Create MutationQueueEntry for sync tests
- `resetFactoryCounters()` - Reset ID counters between test runs

### Offline Mocking Utilities (lib/test-utils/offline-mock.ts)
- `mockOfflineState()` - Set up IndexedDB mock data
- `getOfflineDbMockImpl()` - Get mock implementation for offlineDb.getAll
- `mockOnline()` / `mockOffline()` - Control navigator.onLine status
- `resetOfflineMocks()` - Reset all offline mocks

### Sync Mocking Utilities (lib/test-utils/sync-mock.ts)
- `mockPendingMutations()` - Set up pending mutations for tests
- `getPendingMutationsMockImpl()` - Get mock for mutation queue
- `mockSyncManager()` / `createMockSyncManager()` - Create controllable sync manager mock
- `resetSyncMocks()` - Reset all sync mocks

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 00910ee | feat | Add @vitest/coverage-v8 and configure coverage reporting |
| 63d7da8 | feat | Add entity factory utilities for unit testing |
| ee5ae62 | feat | Add offline and sync mocking utilities |

## Verification

All verification criteria passed:

1. `bun run test:unit:coverage` produces coverage report with percentages
2. Coverage shows line, branch, function, and statement percentages
3. All 83 existing tests pass
4. lib/test-utils/ exports all factory and mock functions
5. Coverage HTML report at frontend/coverage/index.html

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

These utilities enable Phase 25 (Frontend Testing) to:
- Create test entities without boilerplate
- Mock offline state for PWA testing
- Mock sync behavior for mutation queue tests
- Track coverage progress toward 80% target
