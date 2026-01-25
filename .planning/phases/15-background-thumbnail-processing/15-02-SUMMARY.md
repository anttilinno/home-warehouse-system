---
phase: 15-background-thumbnail-processing
plan: 02
subsystem: api
tags: [asynq, background-jobs, thumbnails, image-processing, redis]

# Dependency graph
requires:
  - phase: 15-01
    provides: Database schema with thumbnail_status, thumbnail_small/medium/large_path columns and sqlc queries
provides:
  - ThumbnailProcessor job handler for async thumbnail generation
  - ThumbnailConfig struct for job registration
  - Updated itemphoto service with SetAsynqClient() for job enqueue
  - Non-blocking photo upload with pending thumbnail status
affects: [15-03, frontend-photo-display]

# Tech tracking
tech-stack:
  added: []
  patterns: [background-job-handler, async-service-pattern]

key-files:
  created:
    - backend/internal/jobs/thumbnail_processor.go
  modified:
    - backend/internal/jobs/tasks.go
    - backend/internal/jobs/scheduler.go
    - backend/cmd/scheduler/main.go
    - backend/internal/domain/warehouse/itemphoto/service.go
    - backend/internal/domain/warehouse/itemphoto/service_test.go

key-decisions:
  - "SetAsynqClient() setter pattern allows optional job queue integration"
  - "Upload returns immediately with pending status - thumbnails async"
  - "ThumbnailConfig struct groups processor dependencies cleanly"
  - "Removed sync thumbnail tests - no longer applicable to async flow"

patterns-established:
  - "Async service integration: Add SetClient() method, check for nil before enqueue"
  - "Job processor structure: Follow repair_reminders.go pattern with ProcessTask method"

# Metrics
duration: 6min
completed: 2026-01-25
---

# Phase 15 Plan 02: Thumbnail Processor Job Handler Summary

**Async thumbnail generation job with asynq, scheduler registration, and non-blocking itemphoto service upload**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-25T09:54:56Z
- **Completed:** 2026-01-25T10:01:28Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- ThumbnailProcessor job handler that downloads original, generates small/medium/large thumbnails, uploads to storage, and updates DB
- Scheduler integration with ThumbnailConfig for registering thumbnail processor
- Non-blocking photo upload that saves immediately and enqueues thumbnail job
- SSE events emitted on thumbnail_ready and thumbnail_failed
- Proper cleanup of multi-size thumbnails on photo deletion

## Task Commits

Each task was committed atomically:

1. **Task 1: Create thumbnail processor job handler** - `2c78491` (feat)
2. **Task 2: Register processor in scheduler** - `84eaef4` (feat)
3. **Task 3: Update itemphoto service for async** - `d11b7aa` (feat)

## Files Created/Modified
- `backend/internal/jobs/thumbnail_processor.go` - ThumbnailProcessor with ProcessTask handler, NewThumbnailGenerationTask factory
- `backend/internal/jobs/tasks.go` - Added TypeThumbnailGeneration constant
- `backend/internal/jobs/scheduler.go` - Added ThumbnailConfig struct, updated RegisterHandlers
- `backend/cmd/scheduler/main.go` - Initialize storage/processor, pass ThumbnailConfig
- `backend/internal/domain/warehouse/itemphoto/service.go` - Added SetAsynqClient(), modified UploadPhoto for async, updated DeletePhoto
- `backend/internal/domain/warehouse/itemphoto/service_test.go` - Updated tests for async thumbnail flow

## Decisions Made
- Used SetAsynqClient() setter method rather than constructor injection - allows optional integration, service works without queue
- Job enqueue failure is logged but doesn't fail upload - photo is usable, thumbnails just won't exist
- Emit both thumbnail_ready and thumbnail_failed SSE events - frontend can react to either
- Pass nil for ThumbnailConfig in tests - keeps test setup simple

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Had to update 8 test files calling RegisterHandlers() to add new nil parameter for ThumbnailConfig
- Removed 2 test cases that tested sync thumbnail failure cleanup (no longer applicable)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Thumbnail processor ready for integration testing
- Frontend needs to handle pending/processing/ready thumbnail states
- Phase 15-03 (polling API) can build on this foundation
- Scheduler binary ready to process thumbnail jobs when started

---
*Phase: 15-background-thumbnail-processing*
*Completed: 2026-01-25*
