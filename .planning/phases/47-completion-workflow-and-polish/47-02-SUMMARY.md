---
phase: 47-completion-workflow-and-polish
plan: 02
subsystem: ui
tags: [react, next-intl, i18n, items, needs-review]

# Dependency graph
requires:
  - phase: 47-01
    provides: session summary, needs_review filter in items list, en.json sessionSummary* keys
provides:
  - Needs Review amber banner + Mark as Reviewed action on item detail page
  - Complete i18n coverage — sessionSummary* and needsReview* keys in en, et, ru
affects: [47-03, human verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [handleMarkAsReviewed follows same try/catch/finally/loadItem() pattern as handleArchive]

key-files:
  created: []
  modified:
    - frontend/app/[locale]/(dashboard)/dashboard/items/[id]/page.tsx
    - frontend/messages/en.json
    - frontend/messages/et.json
    - frontend/messages/ru.json

key-decisions:
  - "handleMarkAsReviewed uses itemsApi.update(wsId, id, { needs_review: false }) — no new API method needed"
  - "Amber banner placed between header row and main content grid for visual prominence"
  - "isMarkingReviewed loading state prevents double-tap; shows 'Marking...' in button"

patterns-established:
  - "Needs Review banner: conditional render on item.needs_review, amber-50/amber-200 border styling with dark mode variant"

requirements-completed: [COMP-04]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 47 Plan 02: Needs Review Banner + i18n Sweep Summary

**Amber Needs Review banner with Mark as Reviewed on item detail, and complete sessionSummary + needsReview translations across EN/ET/RU locale files**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T19:14:45Z
- **Completed:** 2026-03-14T19:17:00Z
- **Tasks:** 2 of 3 (checkpoint Task 3 awaiting human verification)
- **Files modified:** 4

## Accomplishments
- Item detail page now shows amber "Needs Review" banner when `item.needs_review === true`
- One-tap "Mark as Reviewed" calls `itemsApi.update(wsId, id, { needs_review: false })`, shows success toast, reloads item
- All three locale files (en, et, ru) now have matching key sets: `sessionSummary*` in `quickCapture` and `needsReview*` in `items`
- No new TypeScript errors introduced; pre-existing errors confirmed unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Needs Review banner and Mark as Reviewed on item detail** - `a719735d` (feat)
2. **Task 2: i18n sweep — complete translations in all three locale files** - `94439255` (feat)

**Plan metadata:** TBD after checkpoint approval

## Files Created/Modified
- `frontend/app/[locale]/(dashboard)/dashboard/items/[id]/page.tsx` - Added ClipboardList import, isMarkingReviewed state, handleMarkAsReviewed(), amber banner JSX
- `frontend/messages/en.json` - Added markAsReviewed, marking, markedAsReviewed, markReviewedFailed to items namespace
- `frontend/messages/et.json` - Added sessionSummary*, sessionSummaryDescription, sessionSummaryContinue, sessionSummaryCapture to quickCapture; added all 5 needsReview* keys to items
- `frontend/messages/ru.json` - Added markAsReviewed, marking, markedAsReviewed, markReviewedFailed to items (sessionSummary* was already present)

## Decisions Made
- `handleMarkAsReviewed` follows the exact same pattern as `handleArchive` — try/catch/finally with `loadItem()` on success
- Amber banner inserted between the header flex row and the main 3-column grid so it spans full width and is visible above content
- Used `itemsApi.update()` with `{ needs_review: false }` per plan spec; no new API method added

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures in `lib/api/__tests__/client.test.ts` (4 tests) and `lib/hooks/__tests__/use-offline-mutation.test.ts` (2 tests) — confirmed pre-existing by git stash verification. Not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Amber banner and Mark as Reviewed functionality is complete and committed
- All locale files are complete and consistent
- Task 3 (human verification of full completion workflow) is awaiting user walkthrough
- After verification approval, this plan will be fully complete

---
*Phase: 47-completion-workflow-and-polish*
*Completed: 2026-03-14*
