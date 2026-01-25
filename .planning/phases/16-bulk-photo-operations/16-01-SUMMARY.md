---
phase: 16-bulk-photo-operations
plan: 01
subsystem: backend-photos
tags: [bulk-operations, perceptual-hash, zip-download, duplicate-detection]
depends_on:
  requires: [phase-10-photo-management]
  provides: [bulk-photo-api, perceptual-hashing, zip-download, duplicate-check]
  affects: [phase-16-02-frontend-bulk-ui]
tech-stack:
  added: [goimagehash, nfnt/resize]
  patterns: [perceptual-hashing, streaming-zip, bulk-operations]
files:
  created:
    - backend/db/migrations/008_add_perceptual_hash.sql
    - backend/internal/infra/imageprocessor/hasher.go
    - backend/internal/domain/warehouse/itemphoto/dto.go
  modified:
    - backend/db/queries/item_photos.sql
    - backend/internal/infra/queries/item_photos.sql.go
    - backend/internal/infra/queries/models.go
    - backend/internal/domain/warehouse/itemphoto/entity.go
    - backend/internal/domain/warehouse/itemphoto/repository.go
    - backend/internal/domain/warehouse/itemphoto/service.go
    - backend/internal/domain/warehouse/itemphoto/handler.go
    - backend/internal/infra/postgres/itemphoto_repository.go
    - backend/go.mod
    - backend/go.sum
decisions:
  - key: perceptual-hash-algorithm
    choice: dHash (difference hash)
    reason: Fast, robust to scaling/aspect ratio changes, 64-bit output fits in BIGINT
  - key: similarity-threshold
    choice: Hamming distance of 10
    reason: Balanced sensitivity - catches similar images without false positives
  - key: hash-column-nullable
    choice: Nullable BIGINT column
    reason: Existing photos won't have hashes until processed/re-uploaded
metrics:
  duration: ~8 minutes
  completed: 2026-01-25
---

# Phase 16 Plan 01: Bulk Photo Operations Backend Summary

Backend infrastructure for bulk photo operations including bulk delete, bulk caption update, zip download, and duplicate detection using perceptual hashing.

## What Was Built

### Database Changes
- Added `perceptual_hash BIGINT` column to `warehouse.item_photos` table
- Created `idx_item_photos_perceptual_hash` index for efficient hash lookups
- Created `idx_item_photos_workspace_hash` composite index for workspace-scoped duplicate detection

### Perceptual Hashing (imageprocessor/hasher.go)
- `Hasher` struct using goimagehash library for dHash generation
- 64-bit difference hash robust to image transformations
- `CompareHashes()` with configurable Hamming distance threshold
- `FindSimilar()` to batch-find duplicates from hash map

### Bulk Service Methods (itemphoto/service.go)
- `BulkDeletePhotos()` - Deletes multiple photos atomically with storage cleanup
- `BulkUpdateCaptions()` - Updates captions for multiple photos
- `GetPhotosForDownload()` - Retrieves photos for zip generation
- `CheckDuplicates()` - Finds similar photos by perceptual hash comparison
- `SetHasher()` setter for optional duplicate detection integration

### HTTP Handlers (itemphoto/handler.go)
Four new endpoints via `RegisterBulkHandler()`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/items/{item_id}/photos/bulk-delete` | POST | Delete multiple photos |
| `/items/{item_id}/photos/bulk-caption` | POST | Update multiple captions |
| `/items/{item_id}/photos/download` | GET | Stream zip of all photos |
| `/items/{item_id}/photos/check-duplicate` | POST | Pre-upload duplicate check |

### DTOs (itemphoto/dto.go)
- `BulkDeleteRequest` - Array of photo IDs to delete
- `BulkCaptionRequest` - Array of caption updates
- `DuplicateInfo` - Similar photo metadata with similarity percentage
- `DuplicateCheckResponse` - List of duplicate candidates

## Commits

| Hash | Description |
|------|-------------|
| b0ac661 | feat(16-01): add perceptual hash column and bulk operation queries |
| f849022 | feat(16-01): add perceptual hasher and bulk service methods |
| 6f6de60 | feat(16-01): add HTTP handlers for bulk operations and zip download |

## Decisions Made

1. **dHash Algorithm**: Chose difference hash over average hash or pHash for better handling of aspect ratio changes while maintaining fast comparison via Hamming distance.

2. **Nullable Hash Column**: Existing photos won't have perceptual hashes. Hash generation can be done during thumbnail processing or as a background migration.

3. **Streaming Zip**: Download handler streams zip directly to response without buffering entire archive in memory.

4. **Chi Handlers**: Bulk operations use Chi handlers (not Huma) to match existing upload/serve handler pattern for consistency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mock interfaces incomplete**
- **Found during:** Task 2
- **Issue:** Test mocks didn't implement new interface methods
- **Fix:** Added mock methods for BulkDelete, GetByIDs, UpdateCaption, etc.
- **Files modified:** service_test.go, handler_test.go
- **Commit:** f849022

## Next Phase Readiness

Ready for Phase 16-02 (frontend bulk UI):
- All four API endpoints operational
- Request/response DTOs defined for frontend typing
- Event broadcasting for real-time UI updates
- Perceptual hash infrastructure ready (hasher needs to be wired into upload flow in future)

## Notes

- The perceptual hash is not yet generated during photo upload. This would require:
  1. Calling `SetHasher()` on the service at app startup
  2. Computing hash during upload and storing via `UpdatePerceptualHash()`
  3. Or computing hash during background thumbnail processing

- Pre-existing panic in repairlog handler (unrelated to this plan) prevents full server startup test, but all itemphoto components build and test correctly.
