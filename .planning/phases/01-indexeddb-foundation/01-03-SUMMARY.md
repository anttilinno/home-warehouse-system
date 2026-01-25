---
phase: 01-indexeddb-foundation
plan: 03
subsystem: ui
tags: [pwa, offline, sync-indicator, react, shadcn, lucide-react]

# Dependency graph
requires:
  - phase: 01-02
    provides: OfflineContext with sync state (isSyncing, lastSyncTimestamp, triggerSync)
provides:
  - SyncStatusIndicator component for data freshness display
  - PwaInstallPrompt component for PWA installation
  - Dashboard integration for offline UI feedback
affects: [02-mutation-queue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Relative time formatting for freshness indicators
    - Conditional rendering based on sync state
    - LocalStorage persistence for UI preferences

key-files:
  created:
    - frontend/components/sync-status-indicator.tsx
    - frontend/components/pwa-install-prompt.tsx
  modified:
    - frontend/components/dashboard/header.tsx
    - frontend/components/dashboard/dashboard-shell.tsx

key-decisions:
  - "Replaced InstallBanner with PwaInstallPrompt for bottom floating card design"
  - "SyncStatusIndicator placed near SSE status indicator in header"
  - "Relative time uses simple thresholds (seconds < 60 = just now, minutes < 60 = Xm ago, etc.)"

patterns-established:
  - "Sync status indicator pattern: offline -> syncing -> synced with timestamp"
  - "PWA install prompt pattern: platform-specific instructions (iOS vs Chrome)"

# Metrics
duration: 3min
completed: 2026-01-22
---

# Phase 01 Plan 03: Offline UI Components Summary

**SyncStatusIndicator showing data freshness with relative time and PwaInstallPrompt for PWA installation integrated into dashboard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-22T21:26:40Z
- **Completed:** 2026-01-22T21:30:13Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created SyncStatusIndicator component showing sync state and data freshness
- Created PwaInstallPrompt component with platform-specific install instructions
- Integrated both components into dashboard layout (header and shell)
- Replaced top banner InstallBanner with bottom floating card PwaInstallPrompt

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SyncStatusIndicator component** - `e202c04` (feat)
2. **Task 2: Create PwaInstallPrompt component** - `4861417` (feat)
3. **Task 3: Integrate components into dashboard layout** - `69fb6f8` (feat)

## Files Created/Modified

- `frontend/components/sync-status-indicator.tsx` - Badge showing sync status with relative time (80 lines)
- `frontend/components/pwa-install-prompt.tsx` - Bottom floating install prompt (101 lines)
- `frontend/components/dashboard/header.tsx` - Added SyncStatusIndicator import and usage
- `frontend/components/dashboard/dashboard-shell.tsx` - Replaced InstallBanner with PwaInstallPrompt

## Decisions Made

1. **Replaced InstallBanner with PwaInstallPrompt** - The plan specified a bottom floating card design, while the existing InstallBanner was a top banner. Replaced to match the plan's design.

2. **SyncStatusIndicator placement** - Added next to SSEStatusIndicator in the header right-side area, grouping status indicators together.

3. **Simple relative time formatting** - Used straightforward thresholds:
   - < 60 seconds: "just now"
   - < 60 minutes: "Xm ago"
   - < 24 hours: "Xh ago"
   - >= 24 hours: "Xd ago"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 complete: IndexedDB foundation established
- All offline UI components integrated
- Ready for Phase 2: Mutation Queue & Optimistic UI

**Phase 1 complete.** Users can now:
- See when data was last synced ("2m ago", "just now", etc.)
- See syncing/offline states in the UI
- Install the PWA from the prompt
- All offline data is cached in IndexedDB

---
*Phase: 01-indexeddb-foundation*
*Completed: 2026-01-22*
