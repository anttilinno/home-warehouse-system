---
phase: 04-pwa-screenshots-polish
plan: 03
subsystem: testing
tags: [e2e, playwright, offline, pwa]
requires:
  - 04-02 (OfflineIndicator with data-testid)
  - 03-03 (SyncManager, conflict resolution)
  - 02-02 (iOS Safari fallback sync)
provides:
  - E2E tests for offline flows
  - E2E tests for sync behavior
  - E2E tests for multi-tab scenarios
affects:
  - CI/CD pipeline (new test files)
  - Regression protection for PWA offline functionality
tech-stack:
  added: []
  patterns:
    - context.setOffline() for network simulation
    - browser.newContext() for multi-tab tests
    - Serial test execution for state isolation
key-files:
  created:
    - frontend/e2e/offline/offline-flows.spec.ts
    - frontend/e2e/offline/sync.spec.ts
    - frontend/e2e/offline/multi-tab.spec.ts
decisions:
  - choice: "Chromium only for offline tests"
    reason: "WebKit and Firefox have inconsistent offline simulation behavior"
  - choice: "Serial execution within test files"
    reason: "Prevents auth state conflicts and race conditions"
  - choice: "Wait for offline indicator before sync badge"
    reason: "OfflineIndicator responds faster than SyncStatusIndicator"
metrics:
  duration: ~13m
  completed: 2026-01-24
---

# Phase 04 Plan 03: E2E Tests for Offline Flows Summary

Comprehensive E2E test suite for offline PWA functionality using Playwright network simulation.

## What Was Built

### Core Offline Flow Tests (offline-flows.spec.ts)
6 test cases verifying fundamental offline experience:

1. **shows offline indicator when network disconnected** - Verifies CloudOff icon appears with proper aria-label
2. **hides offline indicator when network reconnected** - Verifies indicator disappears on reconnection
3. **retains cached data visibility when offline** - Verifies React state preservation
4. **shows sync status indicator in offline state** - Verifies SyncStatusIndicator shows "Offline" badge
5. **recovers gracefully from offline state** - Verifies navigation works after recovery
6. **offline indicator has correct accessibility attributes** - Verifies role="status" and aria-label

### Sync Behavior Tests (sync.spec.ts)
6 test cases verifying sync functionality:

1. **sync status changes from offline to synced when back online** - Full offline/online cycle
2. **shows syncing state briefly during sync** - Verifies transition states
3. **preserves data visibility across offline state transitions** - Data integrity
4. **multiple offline-online cycles maintain stability** - Stress test with waits
5. **sync status reflects pending count when offline with mutations** - Badge interactivity
6. **sync status shows proper icon when offline** - CloudOff icon verification

### Multi-Tab Tests (multi-tab.spec.ts)
5 test cases verifying multi-context behavior:

1. **both tabs show offline indicator when their network disconnected** - Independent indicators
2. **offline state is independent per tab** - Context isolation
3. **data visibility maintained in both tabs while offline** - Parallel state preservation
4. **tab going online first can sync while other remains offline** - Partial connectivity
5. **both tabs recover when going back online** - Full recovery

## Key Implementation Details

### Network Simulation Pattern
```typescript
await context.setOffline(true);
await page.evaluate(() => {
  window.dispatchEvent(new Event("offline"));
});
```

Both `setOffline()` and `dispatchEvent()` are needed:
- `setOffline()` blocks actual network requests
- `dispatchEvent()` triggers React's `useNetworkStatus` hook

### Multi-Tab Pattern
```typescript
const context1 = await browser.newContext({
  storageState: "playwright/.auth/user.json",
});
const page1 = await context1.newPage();
// ... test ...
await context1.close();
```

Each context has independent network state but shares IndexedDB.

### Stability Improvements
Tests include explicit pre-checks:
- `await page.waitForLoadState("domcontentloaded")`
- `await expect(page.locator("main")).toBeVisible()`
- Wait for `offline-indicator` before checking sync badge
- `waitForTimeout(500)` between rapid state transitions

## Commits

| Commit | Description |
|--------|-------------|
| 3800668 | test(04-03): add core offline flow E2E tests |
| 6032dc3 | test(04-03): add sync behavior E2E tests |
| abf6361 | test(04-03): add multi-tab offline E2E tests |
| 41a0716 | fix(04-03): improve offline test stability with pre-checks |

## Deviations from Plan

### Added Stability Improvements
- Added explicit page load checks before each test
- Added waits between rapid state transitions
- Wait for OfflineIndicator before SyncStatusIndicator
- Applied consistently across all test files

**Reason:** Tests were flaky when run in parallel due to timing issues with React state updates.

## Test Coverage Summary

| File | Tests | Coverage |
|------|-------|----------|
| offline-flows.spec.ts | 6 | Offline indicator, cached data, accessibility |
| sync.spec.ts | 6 | Sync transitions, cycling, badge states |
| multi-tab.spec.ts | 5 | Context isolation, parallel states |
| **Total** | **17** | Full offline flow coverage |

## Running the Tests

```bash
# All offline tests (recommended: single worker for reliability)
cd frontend && npx playwright test e2e/offline/ --project=chromium --workers=1

# Individual test files
npx playwright test e2e/offline/offline-flows.spec.ts --project=chromium
npx playwright test e2e/offline/sync.spec.ts --project=chromium
npx playwright test e2e/offline/multi-tab.spec.ts --project=chromium
```

## Phase 04 Status

This completes Phase 04 Plan 03 (E2E Tests for Offline Flows).

Phase 04 PWA Screenshots & Polish is now complete:
- [x] 04-01: PWA Screenshot Generation
- [x] 04-02: Subtle Offline Indicator Enhancement
- [x] 04-03: E2E Tests for Offline Flows

All 4 phases of the PWA Offline implementation are complete (13/13 plans).
