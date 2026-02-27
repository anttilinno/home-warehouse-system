---
phase: 44-capture-infrastructure
plan: 01
subsystem: database, ui
tags: [indexeddb, offline, react-hooks, quick-capture, blob-storage]

requires:
  - phase: 43-backend-schema-and-needs-review-api
    provides: needs_review column and API endpoints on the backend
provides:
  - needs_review field on frontend Item/ItemCreate/ItemUpdate types
  - CapturePhoto type and quickCapturePhotos IndexedDB store (v5)
  - useAutoSKU hook for generating QC-prefixed SKU codes
  - useCapturePhotos hook for photo blob CRUD operations
affects: [44-02-PLAN, 45-quick-capture-ui]

tech-stack:
  added: []
  patterns: [IndexedDB version upgrade with oldVersion guard, blob storage in IndexedDB]

key-files:
  created:
    - frontend/lib/hooks/use-auto-sku.ts
    - frontend/lib/hooks/use-capture-photos.ts
  modified:
    - frontend/lib/types/items.ts
    - frontend/lib/db/types.ts
    - frontend/lib/db/offline-db.ts

key-decisions:
  - "CapturePhotoStatus as union type rather than enum for tree-shaking"
  - "Auto-increment key for quickCapturePhotos instead of UUID for IndexedDB performance"

patterns-established:
  - "IndexedDB blob storage: CapturePhoto with tempItemId linkage to mutation queue"
  - "Auto-SKU format: QC-{base36-timestamp}-{4-random} for quick capture items"

requirements-completed: [QC-05, SYNC-02]

duration: 2min
completed: 2026-02-27
---

# Phase 44 Plan 01: Capture Infrastructure Data Layer Summary

**IndexedDB v5 with quickCapturePhotos blob store, needs_review on Item types, useAutoSKU and useCapturePhotos hooks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T13:23:49Z
- **Completed:** 2026-02-27T13:25:39Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added needs_review field to Item, ItemCreate, and ItemUpdate frontend types
- Created CapturePhoto type with blob storage, tempItemId linkage, and status tracking
- Bumped IndexedDB to v5 with quickCapturePhotos store including tempItemId and status indexes
- Created useAutoSKU hook generating QC-{base36-timestamp}-{random} format SKU codes
- Created useCapturePhotos hook with storePhoto, getPhotosByTempItemId, deletePhotosByTempItemId, deletePhoto

## Task Commits

Each task was committed atomically:

1. **Task 1: Add needs_review to Item types and extend IndexedDB schema to v5** - `bee4588` (feat)
2. **Task 2: Create useAutoSKU hook and useCapturePhotos hook** - `5d9ac17` (feat)

## Files Created/Modified
- `frontend/lib/types/items.ts` - Added needs_review field to Item, ItemCreate, ItemUpdate
- `frontend/lib/db/types.ts` - Added CapturePhoto interface, CapturePhotoStatus type, quickCapturePhotos store schema
- `frontend/lib/db/offline-db.ts` - Bumped DB_VERSION to 5, added quickCapturePhotos upgrade block
- `frontend/lib/hooks/use-auto-sku.ts` - New hook for QC-prefixed auto-SKU generation
- `frontend/lib/hooks/use-capture-photos.ts` - New hook for photo blob CRUD in IndexedDB

## Decisions Made
None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete for Phase 44 Plan 02 (batch settings and offline wiring)
- CapturePhoto type and useCapturePhotos hook ready for Phase 45 Quick Capture UI
- useAutoSKU hook ready for SKU generation in capture flow

---
*Phase: 44-capture-infrastructure*
*Completed: 2026-02-27*
