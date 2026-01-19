# Item Photos

This document describes the item photos feature in the Home Warehouse System, including storage architecture, API endpoints, configuration options, and troubleshooting.

## Feature Overview

The item photos feature allows users to upload, manage, and view photos for inventory items. Key capabilities include:

- **Multiple photos per item** - Upload unlimited photos with drag-and-drop support
- **Automatic thumbnail generation** - Server-side generation of optimized thumbnails (small: 150px, medium: 400px, large: 800px)
- **Primary photo designation** - Mark one photo as the primary/cover photo for each item
- **Photo captions** - Add optional text descriptions to photos
- **Drag-and-drop reordering** - Change display order with intuitive drag gestures
- **Client-side compression** - Automatic compression of large images (>2MB) before upload
- **PWA offline support** - Cached photos viewable offline with queued uploads
- **Lazy loading** - Progressive image loading with blur-up technique

## Storage Architecture

### File Organization

Photos are stored in a workspace-scoped directory structure:

```
uploads/
└── workspaces/
    └── {workspace_id}/
        └── items/
            └── {item_id}/
                ├── {filename}.{ext}           # Original photo
                └── thumb_{filename}.{ext}     # Thumbnail
```

### Database Schema

Photos are stored in the `warehouse.item_photos` table:

```sql
CREATE TABLE warehouse.item_photos (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    item_id UUID NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    caption TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Key constraints:
- **Cascade delete**: Photos are automatically deleted when their parent item is deleted
- **Unique primary**: Only one photo per item can be marked as primary (enforced by partial unique index)

## Configuration Options

Configure image processing via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PHOTO_THUMBNAIL_SMALL_SIZE` | 150 | Small thumbnail size in pixels |
| `PHOTO_THUMBNAIL_MEDIUM_SIZE` | 400 | Medium thumbnail size in pixels |
| `PHOTO_THUMBNAIL_LARGE_SIZE` | 800 | Large thumbnail size in pixels |
| `PHOTO_JPEG_QUALITY` | 85 | JPEG compression quality (0-100) |
| `PHOTO_WEBP_QUALITY` | 75 | WebP compression quality (0-100) |
| `PHOTO_MIN_WIDTH` | 100 | Minimum allowed image width |
| `PHOTO_MIN_HEIGHT` | 100 | Minimum allowed image height |
| `PHOTO_MAX_WIDTH` | 8192 | Maximum allowed image width |
| `PHOTO_MAX_HEIGHT` | 8192 | Maximum allowed image height |

## Thumbnail Sizes

Three thumbnail sizes are available:

| Size | Dimensions | Use Case |
|------|------------|----------|
| Small | 150x150 | Grid thumbnails, lists |
| Medium | 400x400 | Gallery view, cards |
| Large | 800x800 | Detail view, lightbox |

Thumbnails maintain aspect ratio - the dimension value represents the maximum width or height.

## API Endpoints

### Upload Photo

```http
POST /api/workspaces/{workspace_id}/items/{item_id}/photos
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form fields:
- file: The image file (required)
- caption: Optional caption text
```

Response: `201 Created`
```json
{
  "id": "uuid",
  "item_id": "uuid",
  "file_path": "path/to/file.jpg",
  "file_size": 12345,
  "mime_type": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "caption": "My photo caption",
  "is_primary": true,
  "display_order": 0,
  "urls": {
    "original": "/api/.../photos/{id}",
    "small": "/api/.../photos/{id}/small",
    "medium": "/api/.../photos/{id}/medium",
    "large": "/api/.../photos/{id}/large"
  }
}
```

### List Photos

```http
GET /api/workspaces/{workspace_id}/items/{item_id}/photos/list
Authorization: Bearer {token}
```

Response: `200 OK`
```json
[
  {
    "id": "uuid",
    "item_id": "uuid",
    "is_primary": true,
    "display_order": 0,
    "urls": {...}
  }
]
```

### Get Single Photo

```http
GET /api/workspaces/{workspace_id}/photos/{photo_id}
Authorization: Bearer {token}
```

### Serve Photo File

```http
GET /api/workspaces/{workspace_id}/items/{item_id}/photos/{photo_id}
GET /api/workspaces/{workspace_id}/items/{item_id}/photos/{photo_id}/thumbnail
Authorization: Bearer {token}
```

### Set Primary Photo

```http
PUT /api/workspaces/{workspace_id}/photos/{photo_id}/primary
Authorization: Bearer {token}
```

Response: `204 No Content`

### Update Caption

```http
PUT /api/workspaces/{workspace_id}/photos/{photo_id}/caption
Authorization: Bearer {token}
Content-Type: application/json

{
  "caption": "Updated caption"
}
```

### Reorder Photos

```http
PUT /api/workspaces/{workspace_id}/items/{item_id}/photos/order
Authorization: Bearer {token}
Content-Type: application/json

{
  "photo_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### Delete Photo

```http
DELETE /api/workspaces/{workspace_id}/photos/{photo_id}
Authorization: Bearer {token}
```

Response: `204 No Content`

## Supported Formats

| Format | MIME Type | Extension |
|--------|-----------|-----------|
| JPEG | image/jpeg | .jpg, .jpeg |
| PNG | image/png | .png |
| WebP | image/webp | .webp |

Maximum file size: **10 MB**

## Client-Side Features

### Compression

Images larger than 2MB are automatically compressed before upload:
- Maximum dimensions: 1920x1920 pixels
- Quality: 85%
- Format preserved (JPEG, PNG, WebP)

### Offline Support

The PWA service worker provides:
- **Photo caching**: Thumbnails cached for 90 days, full photos for 30 days
- **Upload queuing**: Uploads made while offline are queued in IndexedDB
- **Auto-sync**: Queued uploads automatically sync when back online

### Lazy Loading

The photo gallery implements:
- **Intersection Observer**: Photos load 200px before entering viewport
- **Blur-up technique**: Small thumbnail shown blurred while main image loads
- **Priority loading**: First 4 photos load immediately for fast initial render

## Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `PhotoUpload` | `components/items/photo-upload.tsx` | Drag-and-drop file upload |
| `PhotoGallery` | `components/items/photo-gallery.tsx` | Grid view with reordering |
| `PhotoViewer` | `components/items/photo-viewer.tsx` | Full-screen lightbox |
| `LazyPhoto` | `components/items/lazy-photo.tsx` | Optimized lazy loading |
| `PhotoCaptionEditor` | `components/items/photo-caption-editor.tsx` | Caption editing modal |

## Real-Time Updates

Photo changes broadcast via SSE (Server-Sent Events):

| Event | Payload | Trigger |
|-------|---------|---------|
| `item_photo.created` | Photo data | New upload |
| `item_photo.updated` | Photo data | Primary or caption change |
| `item_photo.reordered` | Photo IDs | Display order change |
| `item_photo.deleted` | Photo ID | Deletion |

## Troubleshooting

### Photos Not Uploading

1. **Check file size**: Maximum 10MB per file
2. **Check format**: Only JPEG, PNG, and WebP are supported
3. **Check dimensions**: Minimum 100x100, maximum 8192x8192 pixels
4. **Check permissions**: User must have `member` role or higher

### Thumbnails Not Generating

1. **Check disk space**: Ensure sufficient space in uploads directory
2. **Check temp directory**: Verify write permissions in temp directory
3. **Check image validity**: Corrupted images will fail validation

### Photos Not Displaying

1. **Check CORS**: Ensure API URL is correctly configured
2. **Check authentication**: Token must be valid
3. **Check workspace access**: User must have access to the workspace

### Offline Uploads Not Syncing

1. **Check service worker**: Ensure SW is registered and active
2. **Check IndexedDB**: Open DevTools > Application > IndexedDB > PhotoUploadQueue
3. **Check network**: Uploads sync when `navigator.onLine` is true

## Performance Recommendations

1. **Enable compression**: Client-side compression significantly reduces upload times
2. **Use WebP**: When possible, upload WebP images for smaller file sizes
3. **Set priorities**: The first few photos load with `priority={true}` for faster LCP
4. **Clean up**: Regularly delete unused photos to save storage

## Security Considerations

1. **Validation**: All uploads are validated for format and dimensions
2. **Workspace isolation**: Photos are scoped to workspaces
3. **Authentication**: All endpoints require valid JWT tokens
4. **Authorization**: Upload/modify requires `member` role or higher

## Admin Tools

### Regenerate Thumbnails

Use the admin CLI to regenerate thumbnails for all photos:

```bash
./backend/bin/server photo:regenerate-thumbnails --workspace <workspace_id>
```

### Cleanup Orphaned Files

Remove files that no longer have database records:

```bash
./backend/bin/server photo:cleanup-orphans --dry-run
./backend/bin/server photo:cleanup-orphans --execute
```

### Storage Usage Report

View storage usage by workspace:

```bash
./backend/bin/server photo:storage-report
```

## Related Documentation

- [Database Schema](DATABASE.md) - Complete database documentation
- [Approval Pipeline](APPROVAL_PIPELINE.md) - Role-based approval for changes
- [Frontend CLAUDE.md](../frontend/CLAUDE.md) - Frontend development guide
