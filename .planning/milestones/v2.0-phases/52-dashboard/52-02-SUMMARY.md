---
phase: 52-dashboard
plan: 02
subsystem: frontend2/dashboard
tags: [dashboard, stats, activity-feed, sse, quick-actions]
dependency_graph:
  requires: [52-01]
  provides: [dashboard-page, stat-panels, activity-feed-sse, quick-action-cards]
  affects: [52-03]
tech_stack:
  added: []
  patterns: [eventsource-sse-refetch, endpoint-aware-test-mocks]
key_files:
  created:
    - frontend2/src/features/dashboard/StatPanel.tsx
    - frontend2/src/features/dashboard/ActivityFeed.tsx
    - frontend2/src/features/dashboard/QuickActionCards.tsx
  modified:
    - frontend2/src/features/dashboard/DashboardPage.tsx
    - frontend2/src/features/dashboard/__tests__/DashboardPage.test.tsx
    - frontend2/vitest.config.ts
decisions:
  - D-01: Used endpoint-aware mockGet.mockImplementation instead of ordered mockResolvedValueOnce to avoid race conditions between concurrent useEffect fetches
  - D-02: Fixed vitest.config.ts to include lingui SWC plugin (was missing, caused babel-plugin-macros errors)
metrics:
  duration: 6m
  completed: 2026-04-11T09:49:40Z
  tasks: 2
  files: 6
---

# Phase 52 Plan 02: Dashboard Page with Stats, Activity Feed, and Quick Actions Summary

HUD stat panels with monospace numbers and hazard stripes, terminal-style activity feed with SSE EventSource auto-refresh, and three quick-action navigation cards for items/scan/loans.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for StatPanel/DashboardPage | 44d9a44 | DashboardPage.test.tsx |
| 1 (GREEN) | StatPanel + DashboardPage with stats | 9fb4545 | StatPanel.tsx, DashboardPage.tsx, vitest.config.ts |
| 2 (RED) | Failing tests for ActivityFeed/QuickActionCards | 09d53e3 | DashboardPage.test.tsx |
| 2 (GREEN) | ActivityFeed, QuickActionCards, wiring | 10ef433 | ActivityFeed.tsx, QuickActionCards.tsx, DashboardPage.tsx, DashboardPage.test.tsx |

## What Was Built

### StatPanel (StatPanel.tsx)
- RetroPanel with HazardStripe displaying a large 48px monospace number
- Uppercase 12px label with tracking-widest below the number
- Loading state shows "---" in gray when value is null
- aria-label for accessibility: "LABEL: value" or just "LABEL" when null

### ActivityFeed (ActivityFeed.tsx)
- Dark terminal-style panel (!bg-retro-charcoal override on RetroPanel)
- Formats log lines as `[HH:MM] ACTION entity_type: entity_name`
- Omits entity_name when null: `[HH:MM] ACTION entity_type`
- Empty state: `> NO ACTIVITY YET` with role="status"
- SSE EventSource opens on mount at `/api/workspaces/{id}/sse` with withCredentials
- EventSource onmessage triggers activity API re-fetch
- EventSource closes on unmount (cleanup in useEffect return)

### QuickActionCards (QuickActionCards.tsx)
- 3-column responsive grid (1 col mobile, 3 cols sm+)
- Cards link to /items (ADD ITEM), /scan (SCAN BARCODE), /loans (VIEW LOANS)
- RetroCard with RetroButton primary variant inside each card
- All labels i18n-ready via useLingui

### DashboardPage (DashboardPage.tsx)
- Assembles StatPanel grid, ActivityFeed, and QuickActionCards
- Fetches GET /workspaces/{id}/analytics/dashboard for stats
- Redirects to /setup when workspaceId is null and not loading
- 3 stat panels: ITEMS, CATEGORIES, LOCATIONS

## Test Coverage

13 tests in DashboardPage.test.tsx:
- StatPanel: value rendering (2), aria-label (2)
- DashboardPage: stats fetch + render (1), loading state (1), redirect (1)
- ActivityFeed: log line format with name (1), without name (1), empty state (1), EventSource lifecycle (1), SSE re-fetch (1)
- QuickActionCards: 3 links rendered (1)

All 111 tests pass across 14 test files. TypeScript compiles cleanly. Production build succeeds.

## Decisions Made

1. **D-01: Endpoint-aware mocks** - Used `mockGet.mockImplementation` that routes by endpoint URL instead of `mockResolvedValueOnce` ordering, since DashboardPage has concurrent useEffects (stats + activity) whose execution order is non-deterministic.
2. **D-02: Vitest lingui SWC plugin** - Added `@lingui/swc-plugin` to vitest.config.ts (was missing from the test config though present in vite.config.ts), fixing `babel-plugin-macros` module not found errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vitest.config.ts missing lingui SWC plugin**
- **Found during:** Task 1
- **Issue:** vitest.config.ts used bare `react()` plugin without `@lingui/swc-plugin`, causing tests using `useLingui` macro to fail with "Cannot find module 'babel-plugin-macros'"
- **Fix:** Added `plugins: [["@lingui/swc-plugin", {}]]` to the react SWC plugin config in vitest.config.ts
- **Files modified:** frontend2/vitest.config.ts
- **Commit:** 9fb4545

**2. [Rule 1 - Bug] Fixed non-deterministic mock ordering in DashboardPage tests**
- **Found during:** Task 2
- **Issue:** `mockResolvedValueOnce` ordering assumed stats fetch runs before activity fetch, but React useEffect execution order is non-deterministic, causing `entries.map is not a function` when activity fetch got the stats object
- **Fix:** Switched to endpoint-aware `mockImplementation` that returns correct data based on URL pattern
- **Files modified:** frontend2/src/features/dashboard/__tests__/DashboardPage.test.tsx
- **Commit:** 10ef433

**3. [Rule 1 - Bug] Fixed EventSource mock for `new` constructor usage**
- **Found during:** Task 2
- **Issue:** `vi.fn().mockImplementation(() => ({...}))` doesn't work with `new` keyword; jsdom throws "is not a constructor"
- **Fix:** Used a proper `class MockEventSource` with constructor that tracks instances
- **Files modified:** frontend2/src/features/dashboard/__tests__/DashboardPage.test.tsx
- **Commit:** 10ef433

## Known Stubs

None - all components are fully wired to API endpoints and render real data.

## Self-Check: PASSED
