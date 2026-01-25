---
phase: 15-background-thumbnail-processing
plan: 01
subsystem: database, api
tags: [postgresql, sqlc, thumbnails, background-processing, async]

# Dependency graph
requires:
  - phase: 01-initial-schema
    provides: item_photos table with thumbnail_path column
provides:
  - thumbnail_status column for tracking processing state
  - multi-size thumbnail paths (small/medium/large)
  - sqlc queries for thumbnail status management
  - ThumbnailStatus enum in Go entity
affects: [15-02, 15-03, item-photos-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - VARCHAR with CHECK constraint for status enum
    - Partial index for efficient job queue lookups
    - Nullable paths for async processing

key-files:
  created:
    - backend/db/migrations/007_add_thumbnail_processing.sql
  modified:
    - backend/db/queries/item_photos.sql
    - backend/internal/domain/warehouse/itemphoto/entity.go
    - backend/internal/infra/queries/item_photos.sql.go

key-decisions:
  - "VARCHAR with CHECK constraint instead of ENUM type for thumbnail_status (easier to modify)"
  - "Partial index on pending/processing status for efficient job queue lookups"
  - "ThumbnailPath made optional for async processing (thumbnails generated in background)"
  - "Legacy thumbnail_path preserved for backward compatibility with GetBestThumbnail fallback"

patterns-established:
  - "ThumbnailStatus enum: pending -> processing -> complete/failed"
  - "Max 5 retry attempts tracked in thumbnail_attempts"
  - "Existing photos migrated to complete status with thumbnail_path -> thumbnail_medium_path"

# Metrics
duration: 12min
completed: 2026-01-25
---

# Phase 15 Plan 01: Thumbnail Schema and Entity Summary

**Database schema and Go entity extended with thumbnail processing status tracking, multi-size paths (150/400/800px), and sqlc queries for background job management**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-25T11:48:46Z
- **Completed:** 2026-01-25T12:00:46Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Database migration adds thumbnail_status, thumbnail_small/medium/large_path, thumbnail_attempts, thumbnail_error
- Partial index optimizes pending thumbnail lookups for background worker
- sqlc queries for UpdateThumbnailStatus, UpdateThumbnailPaths, ListPendingThumbnails, GetItemPhotoForProcessing
- ThumbnailStatus enum with IsValid() method and helper methods (IsThumbnailReady, GetBestThumbnail, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migration for thumbnail processing columns** - `44ee760` (feat)
2. **Task 2: Add sqlc queries for thumbnail status management** - `3f694eb` (feat)
3. **Task 3: Extend ItemPhoto entity with ThumbnailStatus enum and fields** - `771c16e` (feat)

## Files Created/Modified
- `backend/db/migrations/007_add_thumbnail_processing.sql` - Migration adding thumbnail status tracking columns
- `backend/db/queries/item_photos.sql` - New sqlc queries for thumbnail management
- `backend/internal/domain/warehouse/itemphoto/entity.go` - ThumbnailStatus enum and helper methods
- `backend/internal/infra/queries/item_photos.sql.go` - Generated sqlc code
- `backend/internal/domain/warehouse/itemphoto/service_test.go` - Updated tests for optional thumbnail_path

## Decisions Made
- Used VARCHAR(20) with CHECK constraint instead of PostgreSQL ENUM type for thumbnail_status (easier to add/modify values without migration)
- Partial index `WHERE thumbnail_status IN ('pending', 'processing')` ensures efficient job queue lookups without indexing completed photos
- Made ThumbnailPath validation optional in entity.Validate() to support async thumbnail generation
- Legacy ThumbnailPath field preserved for backward compatibility; GetBestThumbnail() falls back to it when medium path unavailable
- Max 5 attempts before marking as failed (aligns with asynq MaxRetry configuration planned for 15-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test expecting thumbnail_path to be required**
- **Found during:** Task 3 (Entity extension)
- **Issue:** Test `missing_thumbnail_path_fails_validation` expected error when thumbnail_path empty, but we made it optional
- **Fix:** Changed test to verify empty thumbnail_path passes validation for async processing
- **Files modified:** backend/internal/domain/warehouse/itemphoto/service_test.go
- **Verification:** All unit tests pass
- **Committed in:** 771c16e (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test update necessary for behavior change documented in plan. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema ready for background thumbnail job processing (15-02)
- Queries ready for worker to fetch pending photos and update status
- Entity ready for service layer to use ThumbnailStatus tracking
- No blockers for Phase 15 Plan 02 (Thumbnail Job and SSE Events)

---
*Phase: 15-background-thumbnail-processing*
*Completed: 2026-01-25*
