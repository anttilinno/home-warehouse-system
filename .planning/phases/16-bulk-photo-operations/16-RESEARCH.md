# Phase 16: Bulk Photo Operations - Research

**Researched:** 2026-01-25
**Domain:** Multi-select UI patterns, bulk API operations, zip streaming, perceptual image hashing
**Confidence:** HIGH

## Summary

This phase adds bulk operations to the existing photo gallery, enabling users to select multiple photos for delete, caption edit, and download actions, plus duplicate detection during upload. The project already has robust infrastructure supporting these features:

1. **Existing bulk selection infrastructure** - The `useBulkSelection<T>` hook and `BulkActionBar` component are production-ready, already used in items/containers/borrowers pages.

2. **Existing photo gallery** - The `PhotoGallery` component uses @dnd-kit for drag-and-drop reordering, with individual photo actions (edit caption, delete, download, set primary).

3. **Go's archive/zip** - Standard library supports streaming zip creation via `zip.Writer`, perfect for HTTP response streaming without buffering entire archives.

4. **Perceptual hashing** - The `goimagehash` library provides dHash/pHash/aHash algorithms for duplicate detection, with Hamming distance comparison for similarity.

**Primary recommendation:** Extend the existing `PhotoGallery` with a selection mode toggle, reuse `useBulkSelection` hook and `BulkActionBar`, add backend endpoints for bulk delete and zip download, and integrate perceptual hashing during upload.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.0.0 | Drag-and-drop in gallery | Already in use for photo reordering |
| @radix-ui/react-checkbox | ^1.0.0 | Accessible checkbox UI | Already integrated via shadcn/ui |
| archive/zip (Go std) | Go 1.25 | Zip file creation | Standard library, streaming support |
| disintegration/imaging | v1.6.2 | Image processing | Already in use for thumbnails |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| github.com/corona10/goimagehash | v1.1.0 | Perceptual image hashing | Duplicate detection during upload |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| goimagehash | dsoprea/go-perceptualhash | goimagehash more actively maintained, better docs |
| dHash | MD5/SHA256 | Cryptographic hashes only detect exact duplicates, not resized/compressed versions |
| Server-side zip | Client-side JSZip | Server-side is simpler, no client memory constraints |

**Installation:**
```bash
# Backend
go get github.com/corona10/goimagehash@v1.1.0

# Frontend (no new deps needed)
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── internal/
│   ├── domain/warehouse/itemphoto/
│   │   ├── handler.go           # Add bulk endpoints
│   │   ├── service.go           # Add bulk methods
│   │   └── repository.go        # Add batch queries
│   └── infra/
│       └── imageprocessor/
│           └── hasher.go        # NEW: perceptual hash generation
└── db/queries/
    └── item_photos.sql          # Add bulk delete query

frontend/
├── components/items/
│   ├── photo-gallery.tsx        # Add selection mode
│   └── photo-selection-bar.tsx  # NEW: bulk action bar for photos
├── lib/
│   ├── api/
│   │   └── item-photos.ts       # Add bulk API methods
│   └── hooks/
│       └── use-item-photos.ts   # Add bulk operations
└── messages/
    └── en.json                  # Add bulk operation translations
```

### Pattern 1: Selection Mode Toggle in Gallery
**What:** Add a selection mode that shows checkboxes on each photo, disables drag-and-drop while active
**When to use:** Gallery views with bulk operations
**Example:**
```typescript
// Source: Derived from existing photo-gallery.tsx + useBulkSelection pattern
interface PhotoGalleryProps {
  // ... existing props
  selectionMode?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
}

function PhotoGallery({ selectionMode = false, onSelectionChange, ...props }) {
  const { selectedIds, toggleSelection, isSelected, clearSelection } = useBulkSelection<string>();

  // Disable drag-and-drop in selection mode
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: selectionMode ? Infinity : 8, // Disable when selecting
      },
    }),
  );

  return (
    <DndContext sensors={sensors} ...>
      {photos.map((photo) => (
        <SortablePhotoItem
          key={photo.id}
          selectionMode={selectionMode}
          isSelected={isSelected(photo.id)}
          onSelect={() => toggleSelection(photo.id)}
          // ... other props
        />
      ))}
    </DndContext>
  );
}
```

### Pattern 2: Streaming Zip Download Handler
**What:** Stream zip file directly to HTTP response without buffering entire archive
**When to use:** Downloading multiple photos as zip
**Example:**
```go
// Source: Go archive/zip documentation
func (h *Handler) HandleDownloadPhotos(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    itemID := chi.URLParam(r, "item_id")

    // Get all photos for item
    photos, err := h.svc.ListPhotos(ctx, itemID, workspaceID)
    if err != nil {
        http.Error(w, "failed to list photos", http.StatusInternalServerError)
        return
    }

    // Set headers for zip download
    w.Header().Set("Content-Type", "application/zip")
    w.Header().Set("Content-Disposition",
        fmt.Sprintf("attachment; filename=\"item_%s_photos.zip\"", itemID[:8]))

    // Create zip writer that streams to response
    zipWriter := zip.NewWriter(w)
    defer zipWriter.Close()

    for i, photo := range photos {
        // Get file from storage
        reader, err := h.storage.Get(ctx, photo.StoragePath)
        if err != nil {
            continue // Skip failed files, don't abort entire download
        }

        // Create entry in zip
        filename := fmt.Sprintf("%02d_%s", i+1, photo.Filename)
        entry, err := zipWriter.Create(filename)
        if err != nil {
            reader.Close()
            continue
        }

        // Stream file content directly to zip entry
        io.Copy(entry, reader)
        reader.Close()
    }
}
```

### Pattern 3: Bulk Delete with Transaction
**What:** Delete multiple photos in a single transaction with proper cleanup
**When to use:** Bulk delete operations
**Example:**
```go
// Source: Derived from existing batch service pattern
func (s *Service) BulkDeletePhotos(ctx context.Context, photoIDs []uuid.UUID, workspaceID uuid.UUID) error {
    // Use transaction for atomicity
    return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
        queries := sqlc.New(tx)

        for _, photoID := range photoIDs {
            // Get photo to verify workspace and get storage path
            photo, err := queries.GetItemPhotoByID(ctx, sqlc.GetItemPhotoByIDParams{
                ID:          photoID,
                WorkspaceID: workspaceID,
            })
            if err != nil {
                continue // Skip if not found or wrong workspace
            }

            // Delete from database
            if err := queries.DeleteItemPhoto(ctx, sqlc.DeleteItemPhotoParams{
                ID:          photoID,
                WorkspaceID: workspaceID,
            }); err != nil {
                return err
            }

            // Queue storage cleanup (don't block on storage deletion)
            s.cleanupQueue.Add(photo.StoragePath)
            if photo.ThumbnailSmallPath != nil {
                s.cleanupQueue.Add(*photo.ThumbnailSmallPath)
            }
            // ... other thumbnail paths
        }

        return nil
    })
}
```

### Pattern 4: Perceptual Hash for Duplicate Detection
**What:** Generate perceptual hash during upload, compare against existing photos
**When to use:** Duplicate detection warning before upload
**Example:**
```go
// Source: goimagehash GitHub documentation
import "github.com/corona10/goimagehash"

func (p *Processor) GeneratePerceptualHash(ctx context.Context, path string) (uint64, error) {
    img, err := imaging.Open(path)
    if err != nil {
        return 0, fmt.Errorf("failed to open image: %w", err)
    }

    // Use difference hash (dHash) - good balance of speed and accuracy
    hash, err := goimagehash.DifferenceHash(img)
    if err != nil {
        return 0, fmt.Errorf("failed to generate hash: %w", err)
    }

    return hash.GetHash(), nil
}

func (s *Service) CheckForDuplicates(ctx context.Context, newHash uint64, itemID, workspaceID uuid.UUID) ([]DuplicateInfo, error) {
    // Get existing photos for item
    photos, err := s.repo.ListPhotosWithHashes(ctx, itemID, workspaceID)
    if err != nil {
        return nil, err
    }

    var duplicates []DuplicateInfo
    for _, photo := range photos {
        if photo.PerceptualHash == nil {
            continue
        }

        // Calculate Hamming distance
        newHashObj, _ := goimagehash.NewImageHash(*photo.PerceptualHash, goimagehash.DHash)
        existingHashObj, _ := goimagehash.NewImageHash(*photo.PerceptualHash, goimagehash.DHash)

        distance, _ := newHashObj.Distance(existingHashObj)

        // Threshold: 0 = identical, <10 = very similar, <15 = similar
        if distance < 10 {
            duplicates = append(duplicates, DuplicateInfo{
                PhotoID:   photo.ID,
                Distance:  distance,
                Thumbnail: photo.ThumbnailMediumPath,
            })
        }
    }

    return duplicates, nil
}
```

### Anti-Patterns to Avoid
- **Buffer entire zip in memory:** Use streaming `zip.Writer` directly to `http.ResponseWriter`
- **Delete storage before DB:** Always delete DB record first, queue storage cleanup separately
- **Block upload on duplicate check:** Return duplicates as warning, let user decide to proceed
- **Individual delete API calls in loop:** Use single bulk delete endpoint

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk selection state | Custom useState tracking | `useBulkSelection` hook | Already exists, handles edge cases |
| Selection action bar | Custom positioned div | `BulkActionBar` component | Already styled, animated, accessible |
| Image similarity | Simple file hash comparison | goimagehash perceptual hash | Catches resized/recompressed duplicates |
| Zip streaming | Buffer then send | archive/zip with ResponseWriter | Memory efficient, no size limit |
| Checkbox UI | Native checkbox | shadcn Checkbox (Radix) | Accessible, styled, consistent |

**Key insight:** The bulk selection and action bar infrastructure is already production-ready in this codebase. The photo gallery just needs to integrate it, not reinvent it.

## Common Pitfalls

### Pitfall 1: Selection Mode Conflicts with Drag-and-Drop
**What goes wrong:** User tries to drag while in selection mode, causing confusing behavior
**Why it happens:** Both features listen to pointer events
**How to avoid:**
1. Disable @dnd-kit sensors when `selectionMode=true`
2. Show clear visual indicator of current mode
3. Provide explicit "Select" button to enter selection mode
**Warning signs:** Photos move when user tries to select them

### Pitfall 2: Zip Download Timeout on Large Photo Sets
**What goes wrong:** Server timeout or client disconnect during large zip download
**Why it happens:** Synchronous streaming takes too long for many/large files
**How to avoid:**
1. Set generous timeout for download handler (5-10 minutes)
2. Consider background job for very large sets (>50 photos)
3. Add progress indication via SSE for background jobs
**Warning signs:** Partial zip files, connection reset errors

### Pitfall 3: Duplicate Detection False Positives
**What goes wrong:** System warns about duplicates for clearly different images
**Why it happens:** Perceptual hash threshold too aggressive
**How to avoid:**
1. Use dHash (difference hash) over aHash (more resistant to false positives)
2. Set conservative threshold (distance < 5 for "definite duplicate", < 10 for "similar")
3. Show thumbnail preview so user can confirm
**Warning signs:** Users ignoring all duplicate warnings

### Pitfall 4: Bulk Delete Race Condition
**What goes wrong:** User deletes photos while another request is modifying them
**Why it happens:** No optimistic locking on photos
**How to avoid:**
1. Use database transaction for bulk delete
2. Verify workspace ownership for each photo in transaction
3. Return success for already-deleted photos (idempotent)
**Warning signs:** Orphaned storage files, constraint violations

### Pitfall 5: Caption Bulk Edit UX Confusion
**What goes wrong:** User unclear if caption replaces or appends
**Why it happens:** Ambiguous UI for "edit captions of 5 photos"
**How to avoid:**
1. Show clear options: "Replace all captions" vs "Append to captions"
2. Preview showing which photos will be affected
3. Confirmation dialog with count
**Warning signs:** Support requests about "lost" captions

## Code Examples

Verified patterns from official sources and existing codebase:

### Database Schema Change
```sql
-- Source: Derived from existing schema + goimagehash requirements
-- Migration: Add perceptual hash column for duplicate detection

ALTER TABLE warehouse.item_photos
ADD COLUMN perceptual_hash BIGINT;

-- Index for fast similarity lookup (optional, for large photo sets)
CREATE INDEX idx_item_photos_hash ON warehouse.item_photos(perceptual_hash)
WHERE perceptual_hash IS NOT NULL;

COMMENT ON COLUMN warehouse.item_photos.perceptual_hash IS
'64-bit dHash perceptual hash for duplicate detection';
```

### Bulk Delete sqlc Query
```sql
-- name: BulkDeleteItemPhotos :exec
-- Delete multiple photos by ID (with workspace verification)
DELETE FROM warehouse.item_photos
WHERE id = ANY($1::uuid[])
  AND workspace_id = $2;

-- name: GetItemPhotosByIDs :many
-- Get multiple photos for bulk operations
SELECT * FROM warehouse.item_photos
WHERE id = ANY($1::uuid[])
  AND workspace_id = $2;
```

### Frontend Bulk Selection Integration
```typescript
// Source: Derived from existing useBulkSelection + PhotoGallery
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";

function PhotoGalleryWithBulkActions({ itemId, photos }) {
  const [selectionMode, setSelectionMode] = useState(false);
  const {
    selectedIdsArray,
    selectedCount,
    toggleSelection,
    isSelected,
    selectAll,
    clearSelection,
  } = useBulkSelection<string>();

  const handleBulkDelete = async () => {
    await itemPhotosApi.bulkDelete(workspaceId, itemId, selectedIdsArray);
    clearSelection();
    setSelectionMode(false);
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          variant={selectionMode ? "secondary" : "outline"}
          onClick={() => {
            setSelectionMode(!selectionMode);
            if (selectionMode) clearSelection();
          }}
        >
          {selectionMode ? "Cancel" : "Select"}
        </Button>
      </div>

      <PhotoGallery
        photos={photos}
        selectionMode={selectionMode}
        selectedIds={selectedIdsArray}
        onToggleSelect={toggleSelection}
      />

      <BulkActionBar selectedCount={selectedCount} onClear={clearSelection}>
        <Button onClick={handleBulkDelete} variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Selected
        </Button>
        <Button onClick={() => downloadAsZip(selectedIdsArray)}>
          <Download className="h-4 w-4 mr-2" />
          Download as ZIP
        </Button>
      </BulkActionBar>
    </>
  );
}
```

### API Client Extensions
```typescript
// Source: Derived from existing item-photos.ts pattern
export const itemPhotosApi = {
  // ... existing methods

  /**
   * Bulk delete multiple photos
   */
  bulkDelete: async (
    workspaceId: string,
    itemId: string,
    photoIds: string[]
  ): Promise<void> => {
    await apiClient.post(
      `/workspaces/${workspaceId}/items/${itemId}/photos/bulk-delete`,
      { photo_ids: photoIds },
      workspaceId
    );
  },

  /**
   * Bulk update captions for multiple photos
   */
  bulkUpdateCaptions: async (
    workspaceId: string,
    itemId: string,
    updates: Array<{ photo_id: string; caption: string }>
  ): Promise<void> => {
    await apiClient.post(
      `/workspaces/${workspaceId}/items/${itemId}/photos/bulk-caption`,
      { updates },
      workspaceId
    );
  },

  /**
   * Download photos as zip (returns blob URL)
   */
  downloadAsZip: async (
    workspaceId: string,
    itemId: string,
    photoIds?: string[]
  ): Promise<void> => {
    // Build URL with optional photo IDs filter
    let url = `/workspaces/${workspaceId}/items/${itemId}/photos/download`;
    if (photoIds && photoIds.length > 0) {
      url += `?ids=${photoIds.join(",")}`;
    }

    // Trigger browser download
    window.open(`${apiUrl}${url}`, "_blank");
  },

  /**
   * Check for duplicate photos before upload
   */
  checkDuplicates: async (
    workspaceId: string,
    itemId: string,
    file: File
  ): Promise<DuplicateInfo[]> => {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await apiClient.post<{ duplicates: DuplicateInfo[] }>(
      `/workspaces/${workspaceId}/items/${itemId}/photos/check-duplicate`,
      formData,
      workspaceId
    );
    return response.duplicates;
  },
};

interface DuplicateInfo {
  photo_id: string;
  distance: number;
  similarity_percent: number;
  thumbnail_url: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Individual delete calls | Bulk delete in transaction | Industry standard | Faster, atomic operations |
| Buffer zip then send | Streaming zip to response | Go 1.16+ | No memory limit on downloads |
| MD5 duplicate check | Perceptual hashing | 2020+ | Catches resized/recompressed dupes |
| Modal-based bulk edit | Inline selection + action bar | Modern UX | Faster workflow, less context switching |

**Deprecated/outdated:**
- Individual API calls for each selected item (use bulk endpoints)
- Full-page selection mode (use inline checkboxes)

## Open Questions

Things that couldn't be fully resolved:

1. **Perceptual hash threshold tuning**
   - What we know: dHash distance < 10 catches most duplicates
   - What's unclear: Optimal threshold for this specific use case (item photos)
   - Recommendation: Start with < 5 for "definite", show warning 5-10, test with real data

2. **Zip download for selected vs all**
   - What we know: Both use cases are valid
   - What's unclear: Should download button appear only in selection mode, or always?
   - Recommendation: Always show "Download All" in normal mode, "Download Selected" in selection mode

3. **Bulk caption edit UX**
   - What we know: Multiple photos need caption updates
   - What's unclear: Replace all with same caption, or edit each individually?
   - Recommendation: Provide both options - "Set same caption for all" and "Edit individually"

## Sources

### Primary (HIGH confidence)
- `frontend/lib/hooks/use-bulk-selection.ts` - Existing bulk selection hook
- `frontend/components/ui/bulk-action-bar.tsx` - Existing action bar component
- `frontend/components/items/photo-gallery.tsx` - Current gallery implementation
- `backend/internal/infra/imageprocessor/processor.go` - Existing image processor
- [Go archive/zip documentation](https://pkg.go.dev/archive/zip) - Streaming zip creation

### Secondary (MEDIUM confidence)
- [goimagehash GitHub](https://github.com/corona10/goimagehash) - Perceptual hashing library
- [WebSearch: React multi-select gallery patterns](https://medium.com/geekculture/creating-multi-select-dropdown-with-checkbox-in-react-792ff2464ef3)

### Tertiary (LOW confidence)
- WebSearch results for perceptual hash thresholds - Need testing with real data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already in use
- Architecture patterns: HIGH - Based on existing codebase patterns
- Bulk selection UI: HIGH - Components already exist
- Zip streaming: HIGH - Standard Go library, well-documented
- Perceptual hashing: MEDIUM - Library verified, thresholds need tuning

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (stable libraries, patterns well-established)
