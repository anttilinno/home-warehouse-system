# Phase 15: Background Thumbnail Processing - Research

**Researched:** 2026-01-25
**Domain:** Go background job processing, image processing, WebP encoding
**Confidence:** HIGH

## Summary

This phase introduces asynchronous thumbnail generation to make photo uploads non-blocking. The system already has robust infrastructure for this:

1. **Existing asynq job scheduler** - Production-ready Redis-backed job queue with exponential backoff, retry handling, and priority queues already in use for loan/repair reminders and cleanup tasks.

2. **Existing image processor** - Complete `imageprocessor` package with `GenerateAllThumbnails()` supporting small/medium/large sizes (150/400/800px), JPEG/PNG/WebP output, and validation.

3. **CGO blocker for WebP** - The current `kolesa-team/go-webp` library requires CGO. For `CGO_ENABLED=0` production builds, fallback to JPEG thumbnails is needed, or use the pure-Go `nativewebp` library (lossless only).

**Primary recommendation:** Extend the existing asynq infrastructure with a new `TypeThumbnailGeneration` task, add a `thumbnail_status` column to track processing state, and emit SSE events for real-time UI feedback.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/hibiken/asynq | v0.25.1 | Background job queue | Already used for reminders/cleanup, Redis-backed, built-in exponential backoff |
| github.com/disintegration/imaging | v1.6.2 | Image resizing/processing | Pure Go, no CGO, already integrated in `imageprocessor` package |
| github.com/kolesa-team/go-webp | v1.0.5 | WebP encoding | Already integrated, BUT requires CGO |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| github.com/HugoSmits86/nativewebp | v1.2.0+ | Pure Go WebP encoding | For `CGO_ENABLED=0` builds, lossless only |
| golang.org/x/image/webp | included | WebP decoding | Already in use for input format support |

### WebP Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| kolesa-team/go-webp (CGO) | nativewebp (pure Go) | Lossless only, no lossy compression |
| WebP output | JPEG output | Larger files but works everywhere with CGO_ENABLED=0 |
| External binary (cwebp) | Shell out to cwebp | Adds system dependency, more complex deployment |

**WebP Strategy Decision:**
Given the CGO blocker mentioned in project constraints, recommend:
1. **Development/Docker builds (CGO_ENABLED=1):** Use existing `kolesa-team/go-webp` for lossy WebP
2. **Static/Alpine builds (CGO_ENABLED=0):** Fall back to JPEG thumbnails with high quality (85)
3. **Future:** Consider `nativewebp` for lossless WebP when acceptable

**Installation:** Already in go.mod, no new dependencies required for core functionality.

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── internal/
│   ├── jobs/
│   │   ├── tasks.go                 # Add TypeThumbnailGeneration constant
│   │   ├── thumbnail_processor.go   # New: thumbnail generation task handler
│   │   └── scheduler.go             # Register thumbnail handler
│   ├── domain/warehouse/itemphoto/
│   │   ├── entity.go                # Add ThumbnailStatus field
│   │   ├── service.go               # Modify to queue async generation
│   │   └── repository.go            # Add status update methods
│   └── infra/
│       ├── imageprocessor/
│       │   └── processor.go         # Already complete, use GenerateAllThumbnails
│       └── events/
│           └── broadcaster.go       # Already complete, use for SSE
└── db/
    └── queries/
        └── item_photos.sql          # Add status update queries
```

### Pattern 1: Non-Blocking Upload with Background Processing
**What:** Photo upload saves original file, creates DB record with `processing` status, enqueues thumbnail job, returns immediately
**When to use:** All photo uploads (item photos, repair photos)
**Example:**
```go
// Source: Derived from existing itemphoto/service.go pattern
func (s *Service) UploadPhoto(ctx context.Context, input UploadInput) (*ItemPhoto, error) {
    // 1. Validate and save original file (existing logic)
    storagePath, err := s.storage.Save(ctx, workspaceID, itemID, filename, reader)
    if err != nil {
        return nil, err
    }

    // 2. Create DB record with "processing" status
    photo := &ItemPhoto{
        ID:              uuid.New(),
        ItemID:          itemID,
        StoragePath:     storagePath,
        ThumbnailStatus: ThumbnailStatusProcessing, // NEW: "processing"
        // ... other fields
    }
    createdPhoto, err := s.repo.Create(ctx, photo)
    if err != nil {
        s.storage.Delete(ctx, storagePath)
        return nil, err
    }

    // 3. Enqueue thumbnail generation job
    task := NewThumbnailGenerationTask(createdPhoto.ID, workspaceID)
    _, err = s.asynqClient.Enqueue(task,
        asynq.Queue(QueueDefault),
        asynq.MaxRetry(5),
        asynq.Timeout(5*time.Minute),
    )
    if err != nil {
        // Log error but don't fail - photo still usable
        log.Printf("Failed to enqueue thumbnail job: %v", err)
    }

    // 4. Return immediately - thumbnail generated async
    return createdPhoto, nil
}
```

### Pattern 2: Thumbnail Generation Job with SSE Notification
**What:** Background worker processes thumbnail job, updates DB status, emits SSE event
**When to use:** All thumbnail processing
**Example:**
```go
// Source: Derived from existing jobs/repair_reminders.go pattern
type ThumbnailProcessor struct {
    pool        *pgxpool.Pool
    processor   imageprocessor.ImageProcessor
    storage     storage.Storage
    broadcaster *events.Broadcaster
}

func (p *ThumbnailProcessor) ProcessTask(ctx context.Context, t *asynq.Task) error {
    var payload ThumbnailPayload
    if err := json.Unmarshal(t.Payload(), &payload); err != nil {
        return fmt.Errorf("unmarshal payload: %w", err)
    }

    // Get photo from DB
    photo, err := p.photoRepo.GetByID(ctx, payload.PhotoID)
    if err != nil {
        return fmt.Errorf("get photo: %w", err)
    }

    // Generate thumbnails in all sizes
    thumbnails, err := p.processor.GenerateAllThumbnails(
        ctx,
        photo.StoragePath,
        thumbnailBasePath,
    )
    if err != nil {
        // Update status to failed
        p.photoRepo.UpdateThumbnailStatus(ctx, photo.ID, ThumbnailStatusFailed)
        p.publishEvent(payload.WorkspaceID, "photo.thumbnail_failed", photo.ID)
        return err // Will be retried by asynq
    }

    // Save thumbnail paths and update status
    err = p.photoRepo.UpdateThumbnails(ctx, photo.ID, UpdateThumbnailInput{
        SmallPath:       thumbnails[ThumbnailSizeSmall],
        MediumPath:      thumbnails[ThumbnailSizeMedium],
        LargePath:       thumbnails[ThumbnailSizeLarge],
        ThumbnailStatus: ThumbnailStatusComplete,
    })
    if err != nil {
        return err
    }

    // Emit SSE event for real-time UI update
    p.publishEvent(payload.WorkspaceID, "photo.thumbnail_ready", photo.ID)
    return nil
}
```

### Pattern 3: Exponential Backoff with Asynq
**What:** Configure asynq with custom retry delay for thumbnail failures
**When to use:** All retryable thumbnail jobs
**Example:**
```go
// Source: Asynq documentation + existing scheduler.go pattern
server := asynq.NewServer(
    redisOpt,
    asynq.Config{
        Queues: config.Queues,
        Concurrency: 10,
        RetryDelayFunc: func(n int, err error, t *asynq.Task) time.Duration {
            // Exponential backoff: 1m, 2m, 4m, 8m, 16m
            // Capped at 16 minutes to avoid excessive delays
            delay := time.Duration(1<<uint(n-1)) * time.Minute
            if delay > 16*time.Minute {
                delay = 16 * time.Minute
            }
            return delay
        },
    },
)
```

### Anti-Patterns to Avoid
- **Blocking uploads on thumbnail generation:** Never wait for thumbnails before returning upload response
- **Storing thumbnails before DB record:** Always create DB record first, generate thumbnails async
- **No status tracking:** Must track processing/complete/failed status for UI feedback
- **Hardcoded retry counts:** Use asynq's configurable MaxRetry option

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with retries | Custom Redis polling loop | asynq | Battle-tested, exponential backoff built-in, monitoring UI |
| Image resizing | Manual image manipulation | disintegration/imaging | Handles EXIF orientation, aspect ratio, memory efficient |
| Multiple thumbnail sizes | Sequential generation | imageprocessor.GenerateAllThumbnails() | Already implemented, tested, handles all sizes |
| Real-time status updates | Polling API | Existing SSE broadcaster | Already in use for import progress |
| Job deduplication | Custom locking | asynq.Unique(ttl) option | Prevents duplicate processing |

**Key insight:** The existing infrastructure already handles 90% of this phase. The work is primarily integration and schema changes, not building new systems.

## Common Pitfalls

### Pitfall 1: Orphaned Files on Failure
**What goes wrong:** Thumbnail generation fails, original file left with no thumbnails, UI shows processing forever
**Why it happens:** No status tracking, no cleanup job
**How to avoid:**
1. Add `thumbnail_status` enum: `processing`, `complete`, `failed`
2. Add `thumbnail_attempts` counter
3. After max retries (5), mark as `failed` and notify user
4. Provide manual retry endpoint for failed thumbnails
**Warning signs:** Photos stuck in "processing" state after 24 hours

### Pitfall 2: Memory Exhaustion on Large Images
**What goes wrong:** Processing very large images (10000x10000) consumes excessive memory
**Why it happens:** Loading full image into memory for resizing
**How to avoid:**
1. Validate max dimensions during upload (existing: 8192x8192)
2. Set reasonable asynq task timeout (5 minutes)
3. Process one image at a time per worker (already configured)
**Warning signs:** Worker OOM crashes, zombie processes

### Pitfall 3: Race Condition on Status Updates
**What goes wrong:** UI shows "complete" but thumbnails not yet saved to storage
**Why it happens:** DB updated before file write completes
**How to avoid:**
1. Always save files to storage BEFORE updating DB status
2. Use database transaction for multi-field updates
3. Emit SSE event only after both storage and DB complete
**Warning signs:** 404s when loading "ready" thumbnails

### Pitfall 4: CGO Build Failures in CI/Production
**What goes wrong:** Build fails with `cgo: not supported` or WebP library linking errors
**Why it happens:** Alpine/scratch Docker images don't have C toolchain
**How to avoid:**
1. Feature flag for WebP encoding: `PHOTO_WEBP_ENABLED=true/false`
2. Default to JPEG thumbnails when CGO unavailable
3. Document build requirements clearly
**Warning signs:** CI passing locally but failing in GitHub Actions

### Pitfall 5: Missing SSE Event Handlers on Frontend
**What goes wrong:** Backend emits events but UI doesn't update
**Why it happens:** No event listener registered for new event types
**How to avoid:**
1. Define event types in shared constants (backend + frontend)
2. Add frontend SSE handlers for: `photo.thumbnail_ready`, `photo.thumbnail_failed`
3. Test with network throttling to verify async behavior
**Warning signs:** Manual page refresh required to see thumbnails

## Code Examples

Verified patterns from official sources and existing codebase:

### Database Schema Change
```sql
-- Source: Derived from existing schema patterns
-- Migration: Add thumbnail status tracking

ALTER TABLE warehouse.item_photos
ADD COLUMN thumbnail_status VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN thumbnail_small_path VARCHAR(500),
ADD COLUMN thumbnail_medium_path VARCHAR(500),
ADD COLUMN thumbnail_large_path VARCHAR(500),
ADD COLUMN thumbnail_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN thumbnail_error TEXT;

-- Add enum constraint
ALTER TABLE warehouse.item_photos
ADD CONSTRAINT item_photos_thumbnail_status_check
CHECK (thumbnail_status IN ('pending', 'processing', 'complete', 'failed'));

-- Index for finding photos needing processing
CREATE INDEX idx_item_photos_thumbnail_status
ON warehouse.item_photos(thumbnail_status)
WHERE thumbnail_status IN ('pending', 'processing');

COMMENT ON COLUMN warehouse.item_photos.thumbnail_status IS
'Thumbnail generation status: pending (not started), processing (in queue), complete (ready), failed (max retries exceeded)';
```

### Task Definition
```go
// Source: Derived from existing jobs/tasks.go pattern
const (
    // TypeThumbnailGeneration is the task type for generating photo thumbnails
    TypeThumbnailGeneration = "photo:generate_thumbnails"
)

// ThumbnailPayload contains data for thumbnail generation task
type ThumbnailPayload struct {
    PhotoID     uuid.UUID `json:"photo_id"`
    WorkspaceID uuid.UUID `json:"workspace_id"`
    PhotoType   string    `json:"photo_type"` // "item" or "repair"
}

// NewThumbnailGenerationTask creates a new thumbnail generation task
func NewThumbnailGenerationTask(photoID, workspaceID uuid.UUID, photoType string) *asynq.Task {
    payload, _ := json.Marshal(ThumbnailPayload{
        PhotoID:     photoID,
        WorkspaceID: workspaceID,
        PhotoType:   photoType,
    })
    return asynq.NewTask(TypeThumbnailGeneration, payload,
        asynq.MaxRetry(5),
        asynq.Timeout(5*time.Minute),
        asynq.Queue(QueueDefault),
    )
}
```

### SSE Event Types
```go
// Source: Derived from existing events pattern in broadcaster.go
// Event types for photo processing
const (
    EventPhotoThumbnailReady  = "photo.thumbnail_ready"
    EventPhotoThumbnailFailed = "photo.thumbnail_failed"
)

// ThumbnailReadyData is the SSE event payload when thumbnails are ready
type ThumbnailReadyData struct {
    PhotoID          string `json:"photo_id"`
    PhotoType        string `json:"photo_type"`
    SmallThumbnail   string `json:"small_thumbnail_url"`
    MediumThumbnail  string `json:"medium_thumbnail_url"`
    LargeThumbnail   string `json:"large_thumbnail_url"`
}
```

### Frontend SSE Handler (TypeScript)
```typescript
// Source: Derived from existing SSE patterns in frontend
interface ThumbnailReadyEvent {
  photo_id: string;
  photo_type: 'item' | 'repair';
  small_thumbnail_url: string;
  medium_thumbnail_url: string;
  large_thumbnail_url: string;
}

// In useSSE hook or similar
eventSource.addEventListener('photo.thumbnail_ready', (event) => {
  const data: ThumbnailReadyEvent = JSON.parse(event.data);
  // Update local cache or trigger refetch
  queryClient.invalidateQueries(['photos', data.photo_id]);
});

eventSource.addEventListener('photo.thumbnail_failed', (event) => {
  const data = JSON.parse(event.data);
  // Show toast notification
  toast.error(`Thumbnail generation failed for photo`);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous thumbnail generation during upload | Async queue-based processing | Industry standard | 10x faster uploads for users |
| Single thumbnail size | Multiple sizes (small/medium/large) | WebP adoption | Better UX across device sizes |
| JPEG-only output | WebP with JPEG fallback | 2020+ | 25-30% smaller file sizes |
| Polling for completion | SSE real-time updates | Already in use | Immediate UI feedback |

**Deprecated/outdated:**
- Synchronous thumbnail generation in upload handler (current implementation)
- Single `thumbnail_path` column (needs multiple sizes)

## Open Questions

Things that couldn't be fully resolved:

1. **WebP in CGO_ENABLED=0 builds**
   - What we know: Current go-webp library requires CGO, nativewebp only does lossless
   - What's unclear: Is lossless WebP acceptable for thumbnails? File size comparison needed
   - Recommendation: Start with JPEG fallback, evaluate nativewebp lossless in v1.3

2. **Thumbnail size for repair photos**
   - What we know: Item photos use small/medium/large (150/400/800px)
   - What's unclear: Should repair photos use same sizes or different?
   - Recommendation: Use same sizes for consistency, simpler code

3. **Cleanup of failed thumbnails**
   - What we know: Asynq archives failed tasks after max retries
   - What's unclear: Should there be a scheduled job to retry or cleanup stale "processing" photos?
   - Recommendation: Add admin endpoint to retry failed thumbnails, scheduled cleanup for orphans

## Sources

### Primary (HIGH confidence)
- `internal/jobs/scheduler.go` - Existing asynq infrastructure
- `internal/infra/imageprocessor/processor.go` - Existing image processor
- `internal/infra/events/broadcaster.go` - Existing SSE infrastructure
- `internal/domain/warehouse/itemphoto/service.go` - Current upload implementation
- [Asynq pkg.go.dev documentation](https://pkg.go.dev/github.com/hibiken/asynq) - Job queue API

### Secondary (MEDIUM confidence)
- [nativewebp pkg.go.dev](https://pkg.go.dev/github.com/HugoSmits86/nativewebp) - Pure Go WebP option
- [Asynq GitHub](https://github.com/hibiken/asynq) - Retry configuration examples

### Tertiary (LOW confidence)
- WebSearch results for WebP alternatives - Verified library exists but not tested

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in codebase
- Architecture: HIGH - Patterns derived from existing working code
- Pitfalls: HIGH - Based on real codebase constraints (CGO blocker)
- WebP alternatives: MEDIUM - Libraries exist but not tested in this project

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (stable libraries, no expected breaking changes)
