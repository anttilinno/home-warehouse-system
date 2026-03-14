---
phase: 47-completion-workflow-and-polish
plan: 01
subsystem: ui
tags: [react, next-intl, context, quick-capture, items-list, offline]

# Dependency graph
requires:
  - phase: 45-quick-capture-ui
    provides: QuickCapturePage, BatchCaptureContext, useBatchCapture hook
  - phase: 46-photo-sync-pipeline
    provides: CapturePhotoUploader, storePhoto, photo IndexedDB pipeline
provides:
  - BatchCaptureContext with sessionThumbnails, addSessionThumbnail, clearSessionThumbnails
  - Session summary bottom Sheet in QuickCapturePage (shows count + thumbnail grid)
  - handleDone and handleDismissSummary flow with proper URL revocation
  - itemsApi.list() needs_review query param support
  - Needs Review toggle button in items list with mutual exclusion vs Show Archived
affects: [48-item-detail-needs-review, future-quick-capture-improvements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Object URLs created per-item in handleSave, tracked in context state, revoked in clearSessionThumbnails/resetSettings/unmount
    - Mutual exclusion pattern between showNeedsReview and showArchived toggles
    - needs_review query param passed as undefined (not false) to avoid spurious URL params

key-files:
  created: []
  modified:
    - frontend/lib/contexts/batch-capture-context.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/items/quick-capture/page.tsx
    - frontend/lib/api/items.ts
    - frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx
    - frontend/messages/en.json
    - frontend/messages/ru.json

key-decisions:
  - "Session thumbnails stored as object URLs (strings) in context, not Blob objects — avoids large data in React state"
  - "Thumbnail captured via URL.createObjectURL(photos[0].blob) before the revokeObjectURL loop in handleSave — guarantees URL is valid when added to context"
  - "needs_review passed as showNeedsReview || undefined so false value does not append query param to URL"
  - "Needs Review and Show Archived are mutually exclusive — toggling one resets the other"

patterns-established:
  - "Object URL lifecycle: create before revoke loop, store in context, revoke in clear/reset/unmount"
  - "Toggle mutual exclusion: each toggle's onClick resets the other state"

requirements-completed: [COMP-04]

# Metrics
duration: 15min
completed: 2026-03-14
---

# Phase 47 Plan 01: Completion Workflow and Polish Summary

**Session summary bottom sheet showing captured item count and thumbnail grid, plus server-side Needs Review filter toggle on items list**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-14T21:08:00Z
- **Completed:** 2026-03-14T21:23:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Extended BatchCaptureContext with sessionThumbnails state, addSessionThumbnail, and clearSessionThumbnails — all with proper object URL revocation in reset, clear, and unmount paths
- Wired session summary bottom Sheet into QuickCapturePage — Done button triggers handleDone which opens sheet when captureCount > 0; sheet shows count, up to 8 thumbnails; "Go to Items" dismisses, revokes URLs, resets session, navigates; "Capture More" closes without navigating
- Added needs_review?: boolean to itemsApi.list() and a Needs Review toggle button to items page that refetches with needs_review=true; mutually exclusive with Show Archived

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BatchCaptureContext with session thumbnail tracking** - `011aa619` (feat)
2. **Task 2: Session summary sheet in QuickCapturePage** - `7153812b` (feat)
3. **Task 3: Needs Review filter in items list + itemsApi.list() param** - `cd474b1c` (feat)

## Files Created/Modified
- `frontend/lib/contexts/batch-capture-context.tsx` - Added sessionThumbnails state, addSessionThumbnail, clearSessionThumbnails; URL revocation in resetSettings and unmount
- `frontend/app/[locale]/(dashboard)/dashboard/items/quick-capture/page.tsx` - summaryOpen state, handleDone, handleDismissSummary, thumbnail capture in handleSave, session summary Sheet JSX
- `frontend/lib/api/items.ts` - Extended list() params with needs_review?: boolean
- `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx` - showNeedsReview state, useInfiniteScroll dependency, Needs Review toggle button, mutual exclusion with showArchived
- `frontend/messages/en.json` - sessionSummary, sessionSummaryDescription, sessionSummaryContinue, sessionSummaryCapture (quickCapture ns); needsReview (items ns)
- `frontend/messages/ru.json` - Same keys in Russian

## Decisions Made
- Session thumbnails stored as object URLs (strings) in context state, not Blob objects — avoids large data in React state tree and is consistent with existing object URL patterns in the codebase
- Thumbnail captured via `URL.createObjectURL(photos[0].blob)` before the existing `URL.revokeObjectURL` loop in `handleSave` — guarantees the URL is valid when added to context
- `needs_review` passed as `showNeedsReview || undefined` so `false` value does not append `needs_review=false` to the query string
- Needs Review and Show Archived are mutually exclusive — toggling either resets the other to false

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in items/page.tsx (`getPendingCreates<Item>`) unrelated to this plan — scoped out per deviation rules
- Pre-existing Vitest failures in `client.test.ts` and `use-offline-mutation.test.ts` — both files were already modified before this plan (confirmed via git stash verification)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- COMP-04 complete: quick-capture session summary and Needs Review filter both functional
- Ready for Phase 47 Plan 02: remaining i18n keys and item detail needs_review workflow

---
*Phase: 47-completion-workflow-and-polish*
*Completed: 2026-03-14*
