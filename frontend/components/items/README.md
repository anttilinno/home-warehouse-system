# Item Photo Components

A comprehensive set of components for displaying and managing item photos with full drag-and-drop reordering, full-screen viewing, and caption editing capabilities.

## Components

### PhotoGallery

Displays photos in a responsive grid with drag-and-drop reordering and action menus.

**Features:**
- Responsive grid layout (1-4 columns based on screen size)
- Drag-and-drop reordering using @dnd-kit
- Primary photo badge indicator
- Hover overlays with actions
- Delete confirmation dialog
- Empty state with upload CTA
- Loading skeleton states

**Props:**
```typescript
interface PhotoGalleryProps {
  itemId: string;
  photos: ItemPhoto[];
  isLoading?: boolean;
  onPhotoClick?: (photo: ItemPhoto, index: number) => void;
  onReorder?: (photoIds: string[]) => Promise<void>;
  onSetPrimary?: (photoId: string) => Promise<void>;
  onEditCaption?: (photoId: string, currentCaption: string | null) => void;
  onDelete?: (photoId: string) => Promise<void>;
  onUploadClick?: () => void;
}
```

**Usage:**
```tsx
<PhotoGallery
  itemId={itemId}
  photos={photos}
  isLoading={isLoading}
  onPhotoClick={(photo, index) => openViewer(index)}
  onReorder={handleReorder}
  onSetPrimary={handleSetPrimary}
  onEditCaption={handleEditCaption}
  onDelete={handleDelete}
  onUploadClick={handleUploadClick}
/>
```

### PhotoViewer

Full-screen modal photo viewer with navigation, zoom, and keyboard shortcuts.

**Features:**
- Full-screen display with dark overlay
- Previous/Next navigation
- Zoom in/out (1x to 3x)
- Keyboard shortcuts (arrow keys, +/-, ESC)
- Touch gestures for swipe navigation
- Download original image
- Caption display
- Keyboard hints overlay

**Props:**
```typescript
interface PhotoViewerProps {
  photos: ItemPhoto[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Keyboard Shortcuts:**
- `←` / `→` - Previous/Next photo
- `+` / `-` - Zoom in/out
- `0` - Reset zoom
- `ESC` - Close viewer

**Usage:**
```tsx
<PhotoViewer
  photos={photos}
  initialIndex={currentIndex}
  open={viewerOpen}
  onOpenChange={setViewerOpen}
/>
```

### PhotoCaptionEditor

Modal dialog for editing photo captions with character limit.

**Features:**
- Character counter with visual feedback
- Enter to save, ESC to cancel
- 200 character limit
- Loading state during save

**Props:**
```typescript
interface PhotoCaptionEditorProps {
  photoId: string;
  currentCaption: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (photoId: string, caption: string) => Promise<void>;
}
```

**Usage:**
```tsx
<PhotoCaptionEditor
  photoId={editingPhotoId}
  currentCaption={currentCaption}
  open={editorOpen}
  onOpenChange={setEditorOpen}
  onSave={handleSaveCaption}
/>
```

### InlineCaptionEditor

Inline caption editor for quick edits without opening a dialog.

**Usage:**
```tsx
<InlineCaptionEditor
  currentCaption={photo.caption}
  onSave={handleSaveCaption}
  onCancel={handleCancel}
/>
```

### PhotoGalleryContainer

Pre-integrated container component that combines all photo components with the `useItemPhotos` hook.

**Props:**
```typescript
interface PhotoGalleryContainerProps {
  workspaceId: string;
  itemId: string;
  onUploadClick?: () => void;
}
```

**Usage:**
```tsx
<PhotoGalleryContainer
  workspaceId={workspaceId}
  itemId={itemId}
  onUploadClick={() => setUploadDialogOpen(true)}
/>
```

This is the easiest way to integrate photo gallery functionality. It handles all state management, API calls, optimistic updates, and error handling automatically.

## Full Integration Example

```tsx
"use client";

import { useState } from "react";
import { PhotoGalleryContainer } from "@/components/items";
import { PhotoUploadDialog } from "@/components/items/photo-upload-dialog";

export function ItemDetailPage({ item, workspaceId }) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div>
      <h1>{item.name}</h1>

      <section>
        <h2>Photos</h2>
        <PhotoGalleryContainer
          workspaceId={workspaceId}
          itemId={item.id}
          onUploadClick={() => setUploadOpen(true)}
        />
      </section>

      <PhotoUploadDialog
        workspaceId={workspaceId}
        itemId={item.id}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </div>
  );
}
```

## Manual Integration Example

For more control, you can use the individual components:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useItemPhotos } from "@/lib/hooks/use-item-photos";
import {
  PhotoGallery,
  PhotoViewer,
  PhotoCaptionEditor,
} from "@/components/items";

export function CustomPhotoGallery({ workspaceId, itemId }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [captionEditorOpen, setCaptionEditorOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);

  const {
    photos,
    loading,
    reorder,
    setPrimary,
    updateCaption,
    deletePhoto,
  } = useItemPhotos({ workspaceId, itemId });

  const handlePhotoClick = (photo, index) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const handleReorder = async (photoIds) => {
    try {
      await reorder(photoIds);
      toast.success("Photos reordered");
    } catch (error) {
      toast.error("Failed to reorder photos");
      throw error; // Re-throw to trigger gallery revert
    }
  };

  const handleSetPrimary = async (photoId) => {
    try {
      await setPrimary(photoId);
      toast.success("Primary photo updated");
    } catch (error) {
      toast.error("Failed to set primary photo");
    }
  };

  const handleEditCaption = (photoId, currentCaption) => {
    setEditingPhoto({ id: photoId, caption: currentCaption });
    setCaptionEditorOpen(true);
  };

  const handleSaveCaption = async (photoId, caption) => {
    try {
      await updateCaption(photoId, caption);
      toast.success("Caption updated");
    } catch (error) {
      toast.error("Failed to update caption");
      throw error; // Re-throw to keep dialog open
    }
  };

  const handleDelete = async (photoId) => {
    try {
      await deletePhoto(photoId);
      toast.success("Photo deleted");
    } catch (error) {
      toast.error("Failed to delete photo");
    }
  };

  return (
    <>
      <PhotoGallery
        itemId={itemId}
        photos={photos}
        isLoading={loading}
        onPhotoClick={handlePhotoClick}
        onReorder={handleReorder}
        onSetPrimary={handleSetPrimary}
        onEditCaption={handleEditCaption}
        onDelete={handleDelete}
      />

      <PhotoViewer
        photos={photos}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      {editingPhoto && (
        <PhotoCaptionEditor
          photoId={editingPhoto.id}
          currentCaption={editingPhoto.caption}
          open={captionEditorOpen}
          onOpenChange={setCaptionEditorOpen}
          onSave={handleSaveCaption}
        />
      )}
    </>
  );
}
```

## Internationalization

All text is internationalized using `next-intl`. The translation keys are under the `photos` namespace:

```json
{
  "photos": {
    "gallery": { ... },
    "viewer": { ... },
    "captionEditor": { ... }
  }
}
```

To add translations for other languages, add the corresponding keys to your locale files (e.g., `messages/es.json`, `messages/fr.json`).

## Styling

Components use Tailwind CSS with the project's design system. All colors, spacing, and animations follow the existing patterns.

### Responsive Breakpoints
- Mobile: 1 column
- Tablet (sm): 2 columns
- Desktop (lg): 3 columns
- Large Desktop (xl): 4 columns

### Color Tokens
- Primary photo badge: `bg-yellow-500/90`
- Overlay backgrounds: `bg-black/60`, `bg-black/80`
- Action buttons: `hover:bg-white/20`

## Dependencies

- `@dnd-kit/core` - Drag and drop core functionality
- `@dnd-kit/sortable` - Sortable list implementation
- `@dnd-kit/utilities` - Utility functions for transforms
- `next/image` - Optimized image loading
- `lucide-react` - Icons
- `next-intl` - Internationalization
- `sonner` - Toast notifications (optional, for container)

## Performance Considerations

1. **Image Loading**: Uses Next.js Image component for automatic optimization
2. **Responsive Sizes**: Configures appropriate sizes for responsive loading
3. **Lazy Loading**: Images load as they enter viewport
4. **Optimistic Updates**: UI updates immediately, then syncs with server
5. **Revert on Error**: Failed operations revert to previous state

## Accessibility

- Keyboard navigation support in viewer
- ARIA labels on all interactive elements
- Screen reader friendly
- Focus management in dialogs
- High contrast overlays for readability

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Touch gestures on mobile devices
- Keyboard shortcuts on desktop
- Responsive design for all screen sizes
