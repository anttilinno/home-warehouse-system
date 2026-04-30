---
phase: 46-photo-sync-pipeline
plan: 01
subsystem: sync
tags: [indexeddb, offline, photo-upload, retry, optimistic-ui]

requires:
  - phase: 45-quick-capture-ui
    provides: QuickCapturePage, useCapturePhotos hook, quickCapturePhotos IndexedDB store
  - phase: 44-offline-photo-capture
    provides: CapturePhoto type, capture-photo-uploader.ts, handleItemSynced

provides:
  - Per-photo delete in handleItemSynced (delete on success, put-as-failed on failure)
  - resolvedItemId field on CapturePhoto for stateless retry
  - retryFailedPhotoUploads() export called on SYNC_COMPLETE and online events
  - Items page mount-time load of pending IndexedDB creates from any route

affects: [photo-sync, offline-context, items-page, quick-capture]

tech-stack:
  added: []
  patterns:
    - "Pre-write pattern: store resolvedItemId on all photos before upload loop so retry is always stateless"
    - "Per-photo delete: delete IndexedDB record individually only after confirmed upload success"
    - "Failed status pattern: mark failed uploads with status=failed + resolvedItemId for retry"
    - "Status-index retry: use getAllFromIndex on status=failed to find retry candidates"

key-files:
  created: []
  modified:
    - frontend/lib/db/types.ts
    - frontend/lib/sync/capture-photo-uploader.ts
    - frontend/lib/sync/__tests__/capture-photo-uploader.test.ts
    - frontend/lib/contexts/offline-context.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx
    - frontend/lib/hooks/__tests__/quick-capture-flow.test.ts

key-decisions:
  - "Pre-write resolvedItemId before upload loop: ensures retry always has server ID even if process interrupted mid-loop"
  - "Per-photo delete replaces bulk deletePhotosByTempId: failed photos survive, successful ones cleaned immediately"
  - "retryFailedPhotoUploads called non-blocking (.catch) on both SYNC_COMPLETE and wasOffline+isOnline events"
  - "getPendingCreates mount effect uses [] deps and filters by existing IDs to avoid duplicate optimistic items"
  - "quick-capture-flow.test.ts updated to db.delete/db.put mocks (transaction-based cleanup no longer used)"

patterns-established:
  - "Failed photo retry: mark status=failed with resolvedItemId, retry on next online/sync event via status index"

requirements-completed: [SYNC-03, SYNC-04]

duration: 12min
completed: 2026-03-14
---

# Phase 46 Plan 01: Photo Sync Pipeline Summary

**Per-photo delete with failed-status retry for SYNC-03, plus IndexedDB mount-load for items page cross-route pending visibility (SYNC-04)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-14T20:19:06Z
- **Completed:** 2026-03-14T20:22:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Fixed SYNC-03: `handleItemSynced` now pre-writes `resolvedItemId` on all photos before the upload loop, then deletes each photo individually on success or marks it `status="failed"` with `resolvedItemId` on failure — no photos silently lost on partial failure
- Added `retryFailedPhotoUploads()` export wired into `OfflineContext` on both `SYNC_COMPLETE` and the come-back-online effect — failed photos are retried automatically without user action
- Fixed SYNC-04: items page loads pending creates from IndexedDB on mount via `getPendingCreates("items")`, so quick-capture items created on the quick-capture route appear in the list immediately on navigation

## Task Commits

1. **Task 1: Fix capture-photo-uploader — per-photo delete, failed status, retry** - `21f6862b` (feat)
2. **Task 2: Wire retry into OfflineContext + load pending creates in items page** - `a70fdbcc` (feat)

## Files Created/Modified

- `frontend/lib/db/types.ts` - Added `resolvedItemId?: string` to `CapturePhoto` interface
- `frontend/lib/sync/capture-photo-uploader.ts` - Rewrote `handleItemSynced` (per-photo delete, pre-write resolvedItemId, failed marking); added `retryFailedPhotoUploads` export
- `frontend/lib/sync/__tests__/capture-photo-uploader.test.ts` - Updated mocks from transaction to delete/put; added 8 new test cases covering new behaviors (15 tests total, all green)
- `frontend/lib/contexts/offline-context.tsx` - Imported `retryFailedPhotoUploads`, added calls on SYNC_COMPLETE case and wasOffline+isOnline effect
- `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx` - Added `getPendingCreates` import and mount-only useEffect to merge pending IndexedDB creates into optimisticItems
- `frontend/lib/hooks/__tests__/quick-capture-flow.test.ts` - Updated mock setup and assertions to db.delete/db.put pattern (auto-fix)

## Decisions Made

- Pre-write `resolvedItemId` on all photos before upload loop: ensures stateless retry — if upload crashes mid-loop the next retry still has the server ID
- `retryFailedPhotoUploads` called non-blocking (`.catch()`) from context so photo retry failures never bubble up to break sync flow
- Items page mount effect uses `[]` deps and set-based deduplication to be idempotent if called multiple times

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated quick-capture-flow.test.ts to use db.delete/db.put mocks**
- **Found during:** Task 2 (full vitest suite run)
- **Issue:** `quick-capture-flow.test.ts` was mocking `db.transaction` and asserting `mockDbTransaction` was called for cleanup. After the capture-photo-uploader rewrite to use `db.delete()` directly, these assertions were broken (3 tests failed)
- **Fix:** Added `mockDbDelete` and `mockDbPut` to mock setup in both describe blocks; replaced `expect(mockDbTransaction).toHaveBeenCalledWith("quickCapturePhotos", "readwrite")` with `expect(mockDbDelete).toHaveBeenCalledWith(...)` assertions
- **Files modified:** `frontend/lib/hooks/__tests__/quick-capture-flow.test.ts`
- **Verification:** 13/13 tests pass in quick-capture-flow.test.ts
- **Committed in:** `a70fdbcc` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test update for implementation change)
**Impact on plan:** Necessary correctness fix. The test assertions reflected the old transaction-based cleanup which no longer exists. No scope creep.

## Issues Encountered

- 2 pre-existing failures in `use-offline-mutation.test.ts` (tests expect queue mutation without `workspaceId`, hook now always includes it) — out of scope for this plan, logged as pre-existing

## Next Phase Readiness

- SYNC-03 and SYNC-04 complete — v1.9 offline guarantee satisfied for photo data
- Photo retry is fully automatic: no photos lost on partial failure, cross-route pending items visible immediately
- Pre-existing `use-offline-mutation.test.ts` failures remain (2 tests) — should be addressed separately

---
*Phase: 46-photo-sync-pipeline*
*Completed: 2026-03-14*
