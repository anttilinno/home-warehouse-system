# Phase 61: Item Photos — Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 14 new/modified files
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend2/src/features/items/photos/ItemPhotoGallery.tsx` | component | CRUD + event-driven | `frontend2/src/features/items/ItemDetailPage.tsx` | role-match |
| `frontend2/src/features/items/photos/ItemPhotoGrid.tsx` | component | request-response | `frontend2/src/features/items/ItemsListPage.tsx` | role-match |
| `frontend2/src/features/items/photos/ItemPhotoTile.tsx` | component | request-response | `frontend2/src/components/retro/HazardStripe.tsx` + `RetroBadge` | partial |
| `frontend2/src/features/items/photos/ItemPhotoLightbox.tsx` | component | event-driven | `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` | role-match |
| `frontend2/src/features/items/photos/ItemThumbnailCell.tsx` | component | request-response | `frontend2/src/features/items/ItemsListPage.tsx` (row cell pattern) | role-match |
| `frontend2/src/features/items/photos/ItemHeaderThumbnail.tsx` | component | request-response | `frontend2/src/features/items/ItemDetailPage.tsx` (header section) | role-match |
| `frontend2/src/features/items/photos/useItemPhotoGallery.ts` | hook | CRUD | `frontend2/src/features/items/hooks/useItemMutations.ts` | exact |
| `frontend2/src/lib/api/itemPhotos.ts` | service | CRUD | `frontend2/src/lib/api/items.ts` | exact |
| `frontend2/src/lib/api.ts` | utility | request-response | self (add `put` function) | exact |
| `frontend2/src/features/items/ItemDetailPage.tsx` | component | request-response | self (PHOTOS seam at lines 229–240) | exact |
| `frontend2/src/features/items/ItemsListPage.tsx` | component | request-response | self (columns array, lines 110–115) | exact |
| `frontend2/src/components/retro/RetroFileInput.tsx` | component | file-I/O | self (lines 22, 121) | exact |
| `backend/internal/domain/warehouse/itemphoto/handler.go` | handler | request-response | self (`PhotoResponse` struct + `toPhotoResponse`, lines 883–837) | exact |
| `backend/internal/domain/warehouse/item/handler.go` | handler | request-response | self (`ItemResponse` struct + `toItemResponse`, lines 591–617) | exact |

---

## Pattern Assignments

### `frontend2/src/features/items/photos/ItemPhotoGallery.tsx` (component, CRUD + event-driven)

**Analog:** `frontend2/src/features/items/hooks/useItemMutations.ts` (mutation shape) + `frontend2/src/features/items/ItemDetailPage.tsx` (section layout)

**Imports pattern** — copy from `ItemDetailPage.tsx` lines 1–23:
```typescript
import { useRef, useState, useEffect } from "react";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { itemPhotosApi, itemPhotoKeys, type ItemPhoto } from "@/lib/api/itemPhotos";
import { itemKeys } from "@/lib/api/items";
import { RetroButton, RetroEmptyState } from "@/components/retro";
```

**ObjectURL cleanup pattern** (D-12 hard requirement — no existing analog, use RESEARCH.md pattern):
```typescript
const objectUrlsRef = useRef<Set<string>>(new Set());
const unmountedRef = useRef(false);

useEffect(() => {
  return () => {
    unmountedRef.current = true;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  };
}, []);
```

**Sequential upload pattern** — follow `useItemMutations.ts` mutation style but as an imperative loop:
```typescript
async function uploadFiles(files: File[]) {
  setUploading(true);
  for (const file of files) {
    if (unmountedRef.current) break;
    try {
      await itemPhotosApi.upload(wsId, itemId, file);
      qc.invalidateQueries({ queryKey: itemPhotoKeys.list(itemId) });
    } catch {
      addToast(t`Couldn't upload ${file.name}. Continuing with the rest.`, "error");
    }
  }
  if (!unmountedRef.current) setUploading(false);
}
```

**HEIC/mime rejection pattern** — inline before upload:
```typescript
const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function partitionFiles(files: File[]): { accepted: File[]; rejected: File[] } {
  return files.reduce(
    (acc, file) => {
      if (ACCEPTED_MIME_TYPES.has(file.type)) {
        acc.accepted.push(file);
      } else {
        acc.rejected.push(file);
      }
      return acc;
    },
    { accepted: [] as File[], rejected: [] as File[] },
  );
}
```

**Empty state pattern** — from `ItemDetailPage.tsx` lines 236–239 (`RetroEmptyState`):
```tsx
<RetroEmptyState
  title={t`NO PHOTOS YET`}
  body={t`Add photos to document this item.`}
  action={<RetroButton variant="primary" onClick={handleAddPhotos}>{t`ADD PHOTOS`}</RetroButton>}
/>
```

---

### `frontend2/src/features/items/photos/ItemPhotoGrid.tsx` (component, request-response)

**Analog:** `frontend2/src/features/items/ItemsListPage.tsx` (grid/table pattern)

This is a pure presentational component. No React Query. Receives `photos: ItemPhoto[]`, `onTileClick: (index: number) => void`.

**Tailwind grid pattern** (discretion: 3–4 columns responsive):
```tsx
<div className="grid grid-cols-3 md:grid-cols-4 gap-sm">
  {photos.map((photo, idx) => (
    <ItemPhotoTile
      key={photo.id}
      photo={photo}
      isPrimary={photo.is_primary}
      onClick={() => onTileClick(idx)}
    />
  ))}
</div>
```

---

### `frontend2/src/features/items/photos/ItemPhotoTile.tsx` (component, request-response)

**Analog:** `frontend2/src/components/retro/HazardStripe.tsx` (pending-state fill pattern)

**Pending tile with HazardStripe** — HazardStripe must override its default `height=8` with `absolute inset-0` positioning (Pitfall 5 from RESEARCH.md). The `height` prop uses an inline style; set it to `undefined` and rely on the parent's `h-full`:
```tsx
function ItemPhotoTile({ photo, isPrimary, onClick }: ItemPhotoTileProps) {
  const showPlaceholder =
    !photo.thumbnail_url ||
    photo.thumbnail_status === "pending" ||
    photo.thumbnail_status === "processing";

  return (
    <div
      className="aspect-square relative border-retro-thick border-retro-charcoal cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {showPlaceholder ? (
        <div className="relative w-full h-full">
          <HazardStripe
            className="absolute inset-0 h-full opacity-60"
            height={undefined}
          />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[12px] uppercase text-retro-charcoal">
            {t`PROCESSING…`}
          </span>
        </div>
      ) : (
        <img
          src={photo.thumbnail_url}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
        />
      )}
      {isPrimary && (
        <span className="absolute top-0 left-0 px-xs py-[2px] bg-retro-amber font-mono text-[10px] uppercase font-bold border-b border-r border-retro-charcoal">
          ★ {t`PRIMARY`}
        </span>
      )}
    </div>
  );
}
```

**HazardStripe source** (`frontend2/src/components/retro/HazardStripe.tsx` lines 1–15):
```typescript
// HazardStripe: height prop defaults to 8 (inline style).
// Override: pass height={undefined} + use className="h-full" to fill a container.
function HazardStripe({ height = 8, className }: HazardStripeProps) {
  return (
    <div
      className={`bg-hazard-stripe w-full ${className || ""}`}
      style={{ height }}
    />
  );
}
```

---

### `frontend2/src/features/items/photos/ItemPhotoLightbox.tsx` (component, event-driven)

**Analog:** `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` (lines 1–143)

This is the closest structural match — FloatingPortal + FloatingFocusManager + keyboard handler. Lightbox diverges: full-viewport fixed div instead of slide-over, no `isDirty` guard, z-60 instead of z-50.

**Imports pattern** — from `SlideOverPanel.tsx` lines 1–21:
```typescript
import { useRef, useId, useEffect, useState } from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  useFloating,
} from "@floating-ui/react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
```

**FloatingPortal + FloatingFocusManager pattern** — from `SlideOverPanel.tsx` lines 45–48, 85–124:
```typescript
const { refs, context } = useFloating({ open, onOpenChange: setOpen });

// Esc key handler (copy directly from SlideOverPanel.tsx lines 70–80):
useEffect(() => {
  if (!open) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [open, onClose]);

if (!open) return null;

return (
  <FloatingPortal>
    {/* Backdrop — z-60 (above SlideOverPanel z-50 and toasts z-50) */}
    <div
      className="fixed inset-0 bg-retro-ink/80 z-60"
      onClick={onClose}
      aria-hidden="true"
    />
    <FloatingFocusManager context={context} initialFocus={0}>
      <div
        ref={refs.setFloating}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-60 flex flex-col items-center justify-center"
      >
        {/* lightbox content */}
      </div>
    </FloatingFocusManager>
  </FloatingPortal>
);
```

**RetroConfirmDialog for delete** — from `SlideOverPanel.tsx` lines 125–136 and `ItemArchiveDeleteFlow.tsx` lines 77–103:
```tsx
const confirmRef = useRef<RetroConfirmDialogHandle>(null);

<RetroConfirmDialog
  ref={confirmRef}
  variant="destructive"
  title={t`CONFIRM DELETE`}
  body={t`Permanently delete this photo? This cannot be undone.`}
  escapeLabel={t`KEEP PHOTO`}
  destructiveLabel={t`DELETE PHOTO`}
  onConfirm={handleDelete}
/>
// Open via: confirmRef.current?.open()
```

**Lightbox navigation state after delete** (Pitfall 4 from RESEARCH.md):
```typescript
// After delete invalidation re-fetches the list:
const newPhotos = updatedPhotoList;
if (newPhotos.length === 0) {
  setOpen(false);
} else {
  setCurrentIndex((prev) => Math.min(prev, newPhotos.length - 1));
}
```

---

### `frontend2/src/features/items/photos/ItemThumbnailCell.tsx` (component, request-response)

**Analog:** `frontend2/src/features/items/ItemsListPage.tsx` (row cell pattern, lines 117–145)

Small 40×40 presentational cell. Receives `thumbnailUrl?: string | null`. Renders `<img>` when available, retro placeholder icon when not.

**Row cell styling pattern** — from `ItemsListPage.tsx` lines 119–131 (Link cell pattern; adapt for `<div>` with fixed dimensions):
```tsx
function ItemThumbnailCell({ thumbnailUrl }: { thumbnailUrl?: string | null }) {
  if (thumbnailUrl) {
    return (
      <div className="w-10 h-10 border-retro-thick border-retro-charcoal overflow-hidden flex-shrink-0">
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 border-retro-thick border-retro-charcoal overflow-hidden flex-shrink-0 relative">
      <HazardStripe className="absolute inset-0 h-full opacity-30" height={undefined} />
    </div>
  );
}
```

---

### `frontend2/src/features/items/photos/ItemHeaderThumbnail.tsx` (component, request-response)

**Analog:** Same as `ItemThumbnailCell.tsx` — same rendering logic, larger size (64×64). Pure presentational component.

**Pattern:** Identical to `ItemThumbnailCell.tsx` but with `w-16 h-16` Tailwind classes.

---

### `frontend2/src/features/items/photos/useItemPhotoGallery.ts` (hook, CRUD)

**Analog:** `frontend2/src/features/items/hooks/useItemMutations.ts` (lines 1–128)

**Imports pattern** — from `useItemMutations.ts` lines 1–13:
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { itemPhotosApi, itemPhotoKeys, type ItemPhoto } from "@/lib/api/itemPhotos";
import { itemKeys } from "@/lib/api/items";
```

**useMutation pattern** — from `useItemMutations.ts` lines 80–93 (archive mutation as template for non-optimistic):
```typescript
export function useRemovePhoto(itemId: string) {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (photoId) => itemPhotosApi.remove(workspaceId!, photoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemPhotoKeys.list(itemId) });
      addToast(t`Photo deleted.`, "success");
    },
    onError: () => addToast(t`Could not delete photo. Try again.`, "error"),
  });
}
```

**Optimistic setPrimary mutation** — from RESEARCH.md Pattern 4 (no direct codebase analog for optimistic update; closest is `useArchiveItem` without optimism):
```typescript
export function useSetPrimaryPhoto(itemId: string) {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation({
    mutationFn: ({ photoId }: { photoId: string }) =>
      itemPhotosApi.setPrimary(workspaceId!, photoId),
    onMutate: async ({ photoId }) => {
      await qc.cancelQueries({ queryKey: itemPhotoKeys.list(itemId) });
      const previous = qc.getQueryData(itemPhotoKeys.list(itemId));
      qc.setQueryData(itemPhotoKeys.list(itemId), (old: ItemPhoto[] | undefined) =>
        old?.map((p) => ({ ...p, is_primary: p.id === photoId })) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(itemPhotoKeys.list(itemId), context?.previous);
      addToast(t`Could not update primary photo. Try again.`, "error");
    },
    onSuccess: () => {
      // Invalidate all three keys to avoid Pitfall 3 (stale items list thumbnails)
      qc.invalidateQueries({ queryKey: itemPhotoKeys.list(itemId) });
      qc.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
      qc.invalidateQueries({ queryKey: itemKeys.lists() });
      addToast(t`Primary photo updated.`, "success");
    },
  });
}
```

---

### `frontend2/src/lib/api/itemPhotos.ts` (service, CRUD) — MODIFY

**Analog:** `frontend2/src/lib/api/items.ts` (lines 1–100)

**Action required (D-09):** Add `setPrimary` + fix form field name + add `thumbnail_status` to `ItemPhoto`.

**Confirmed gap — `put` does NOT exist in `api.ts`:** The current exports are `get`, `post`, `postMultipart`, `patch`, `del`. There is no `put`. It must be added (see api.ts pattern below).

**Current import line 1** (must add `put` once api.ts is updated):
```typescript
import { get, del, postMultipart, put } from "@/lib/api";
```

**Add to `ItemPhoto` interface** (after `thumbnail_url: string`, line 16):
```typescript
thumbnail_status?: "pending" | "processing" | "complete" | "failed";
```

**Add to `itemPhotosApi` object** (after `remove`):
```typescript
setPrimary: (wsId: string, photoId: string) =>
  put<void>(`/workspaces/${wsId}/photos/${photoId}/primary`),
```

**Fix form field name mismatch** (line 28, backend expects `"photo"` not `"file"`):
```typescript
// BEFORE:
form.append("file", file);
// AFTER:
form.append("photo", file);
```

**Keys pattern** — from `items.ts` lines 94–100 (identical structure already in itemPhotos.ts, no change needed):
```typescript
export const itemPhotoKeys = {
  all: ["itemPhotos"] as const,
  lists: () => [...itemPhotoKeys.all, "list"] as const,
  list: (itemId: string) => [...itemPhotoKeys.lists(), itemId] as const,
  details: () => [...itemPhotoKeys.all, "detail"] as const,
  detail: (id: string) => [...itemPhotoKeys.details(), id] as const,
};
```

---

### `frontend2/src/lib/api.ts` (utility, request-response) — MODIFY

**Analog:** self — `patch` function (lines 123–128) is the exact template for `put`.

**Add `put` after `patch` (line 129)**:
```typescript
export function put<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}
```

**Pattern source — `patch` at lines 123–128:**
```typescript
export function patch<T>(endpoint: string, data: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
```

---

### `frontend2/src/features/items/ItemDetailPage.tsx` — MODIFY

**Analog:** self

**PHOTOS seam to replace** (lines 229–240):
```tsx
// BEFORE (lines 229–240):
<section aria-labelledby="photos-h2">
  <h2
    id="photos-h2"
    className="text-[20px] font-bold uppercase text-retro-ink mb-md"
  >
    {t`PHOTOS`}
  </h2>
  <RetroEmptyState
    title={t`NO PHOTOS`}
    body={t`Photos will appear here after Phase 61.`}
  />
</section>

// AFTER:
<section aria-labelledby="photos-h2">
  <h2
    id="photos-h2"
    className="text-[20px] font-bold uppercase text-retro-ink mb-md"
  >
    {t`PHOTOS`}
  </h2>
  <ItemPhotoGallery itemId={item.id} />
</section>
```

**Header thumbnail addition** — insert `ItemHeaderThumbnail` into the amber-rail header div (lines 122–168), after the `<h1>` element:
```tsx
// In the flex header div (after <h1>):
{item.primary_photo_thumbnail_url && (
  <ItemHeaderThumbnail thumbnailUrl={item.primary_photo_thumbnail_url} />
)}
```

---

### `frontend2/src/features/items/ItemsListPage.tsx` — MODIFY

**Analog:** self

**Columns array** (lines 110–115) — prepend THUMB column:
```typescript
// BEFORE:
const columns = [
  { key: "name", header: t`NAME` },
  { key: "sku", header: t`SKU` },
  { key: "category", header: t`CATEGORY` },
  { key: "actions", header: t`ACTIONS`, className: "text-right" },
];

// AFTER:
const columns = [
  { key: "thumb", header: "", className: "w-12" },
  { key: "name", header: t`NAME` },
  { key: "sku", header: t`SKU` },
  { key: "category", header: t`CATEGORY` },
  { key: "actions", header: t`ACTIONS`, className: "text-right" },
];
```

**Row shape** — add `thumb` key to each row object (lines 117–195):
```typescript
const rows = items.map((item) => ({
  thumb: <ItemThumbnailCell thumbnailUrl={item.primary_photo_thumbnail_url} />,
  name: (/* existing */),
  // ... rest unchanged
}));
```

**Item type must gain optional field** (from `frontend2/src/lib/api/items.ts` `Item` interface):
```typescript
// Add after `is_archived?: boolean | null;` line:
primary_photo_thumbnail_url?: string | null;
primary_photo_url?: string | null;
```

---

### `frontend2/src/components/retro/RetroFileInput.tsx` — MODIFY

**Analog:** self

**Two changes required (D-10):**

Line 22 — `DEFAULT_ACCEPT` constant:
```typescript
// BEFORE:
const DEFAULT_ACCEPT = "image/jpeg,image/png,image/heic";
// AFTER:
const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";
```

Line 121 — helper text string:
```typescript
// BEFORE:
{t`JPEG, PNG, or HEIC up to 10 MB each.`}
// AFTER:
{t`JPEG, PNG, or WebP up to 10 MB each.`}
```

---

### `backend/internal/domain/warehouse/itemphoto/handler.go` — MODIFY

**Analog:** self

**Two changes required:**

`PhotoResponse` struct (line 883) — add `ThumbnailStatus`:
```go
// Add after UpdatedAt field in PhotoResponse struct:
ThumbnailStatus string `json:"thumbnail_status" doc:"Thumbnail processing status: pending|processing|complete|failed"`
```

`toPhotoResponse` function (line 819) — map the new field:
```go
// Add after UpdatedAt: p.UpdatedAt, in toPhotoResponse():
ThumbnailStatus: string(p.ThumbnailStatus),
```

---

### `backend/internal/domain/warehouse/item/handler.go` — MODIFY

**Analog:** self — `ItemResponse` struct (lines 591–617) and `toItemResponse` function.

**Option A: Add primary photo fields to `ItemResponse`** (lines 591–617):
```go
// Add after ObsidianURI field in ItemResponse struct:
PrimaryPhotoThumbnailURL *string `json:"primary_photo_thumbnail_url,omitempty"`
PrimaryPhotoURL          *string `json:"primary_photo_url,omitempty"`
```

The repository layer (`FindByWorkspaceFiltered` and `FindByID` in `repository.go`) must be extended with a LEFT JOIN on `item_photos WHERE is_primary = true` and populate these fields in `toItemResponse()`. The `Repository` interface (`repository.go` lines 23–44) does not currently support joins — this is a new query pattern for this domain, confirmed by reading the interface (no photo-related methods exist).

---

## Shared Patterns

### FloatingPortal + FloatingFocusManager (lightbox)
**Source:** `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` lines 1–143
**Apply to:** `ItemPhotoLightbox.tsx`

Key differences from SlideOverPanel:
- Lightbox uses `z-60` (not z-50) to sit above toast container
- No `isDirty` guard — close is always immediate
- Full-viewport `fixed inset-0` div, not a slide panel
- `FloatingFocusManager` still provides keyboard Tab trap

```typescript
// Core portal structure (from SlideOverPanel.tsx lines 85–101):
const { refs, context } = useFloating({ open, onOpenChange: setOpen });
// ...
return (
  <FloatingPortal>
    <div className="fixed inset-0 bg-retro-charcoal/40 z-40" onClick={attemptClose} aria-hidden="true" />
    <FloatingFocusManager context={context} initialFocus={0}>
      <div ref={refs.setFloating} role="dialog" aria-modal="true" aria-labelledby={titleId} ...>
```

### useMutation + invalidateQueries
**Source:** `frontend2/src/features/items/hooks/useItemMutations.ts` lines 32–128
**Apply to:** `useItemPhotoGallery.ts`, inline mutations in `ItemPhotoGallery.tsx`

Standard shape:
```typescript
return useMutation<ReturnType, unknown, InputType>({
  mutationFn: (input) => api.method(workspaceId!, input),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: relevantKeys });
    addToast(t`Success message.`, "success");
  },
  onError: () => addToast(t`Error message.`, "error"),
});
```

### RetroConfirmDialog (delete confirmation)
**Source:** `frontend2/src/components/retro/RetroConfirmDialog.tsx` lines 37–139
**Source (usage pattern):** `frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx` lines 77–103
**Apply to:** `ItemPhotoLightbox.tsx` (DELETE PHOTO button)

```typescript
// Always: useRef<RetroConfirmDialogHandle>(null), open via ref
const confirmRef = useRef<RetroConfirmDialogHandle>(null);
// <RetroConfirmDialog ref={confirmRef} ... />
// onClick: confirmRef.current?.open()
```

### Lingui i18n
**Source:** all existing components — `useLingui` from `@lingui/react/macro`
**Apply to:** all new TSX files

```typescript
const { t } = useLingui();
// Usage: t`STRING` (tagged template literal, not function call)
```

### useAuth
**Source:** `frontend2/src/features/items/hooks/useItemMutations.ts` line 8
**Apply to:** `useItemPhotoGallery.ts`, `ItemPhotoGallery.tsx`

```typescript
import { useAuth } from "@/features/auth/AuthContext";
const { workspaceId } = useAuth();
```

### useToast
**Source:** `frontend2/src/features/items/hooks/useItemMutations.ts` line 9
**Apply to:** `useItemPhotoGallery.ts`, `ItemPhotoGallery.tsx`

```typescript
import { useToast } from "@/components/retro";
const { addToast } = useToast();
// addToast(message, "success" | "error")
```

### Test file structure
**Source:** `frontend2/src/features/items/__tests__/ItemsListPage.test.tsx` lines 1–80
**Source (fixtures):** `frontend2/src/features/items/__tests__/fixtures.ts` lines 1–53

All new test files must use:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, setupDialogMocks, makeItem } from "../../../__tests__/fixtures";
// Mock AuthContext:
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    workspaceId: "00000000-0000-0000-0000-000000000001",
    isLoading: false,
    isAuthenticated: true,
    user: { id: "u1" },
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(),
  }),
}));
// Mock API module:
vi.mock("@/lib/api/itemPhotos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/itemPhotos")>();
  return {
    ...actual,
    itemPhotosApi: {
      ...actual.itemPhotosApi,
      listForItem: vi.fn(),
      upload: vi.fn(),
      remove: vi.fn(),
      setPrimary: vi.fn(),
    },
  };
});
```

Photo fixture factory (new — no existing analog, add to items `fixtures.ts`):
```typescript
export function makeItemPhoto(overrides: Partial<ItemPhoto> = {}): ItemPhoto {
  return {
    id: overrides.id ?? "photo-aaaaaaaa-0001",
    item_id: overrides.item_id ?? "55555555-5555-5555-5555-555555555555",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    filename: overrides.filename ?? "test.jpg",
    file_size: overrides.file_size ?? 102400,
    mime_type: overrides.mime_type ?? "image/jpeg",
    width: overrides.width ?? 800,
    height: overrides.height ?? 600,
    display_order: overrides.display_order ?? 0,
    is_primary: overrides.is_primary ?? false,
    caption: overrides.caption ?? null,
    url: overrides.url ?? "https://example.com/photos/test.jpg",
    thumbnail_url: overrides.thumbnail_url ?? "https://example.com/photos/test_thumb.jpg",
    thumbnail_status: overrides.thumbnail_status ?? "complete",
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    ...overrides,
  };
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `frontend2/src/features/items/photos/ItemPhotoTile.tsx` (pending-placeholder sub-pattern) | component | render | No existing square-tile with HazardStripe fill exists; HazardStripe is only used as a divider/error banner. Pattern sourced from RESEARCH.md + HazardStripe props inspection. |

---

## Critical Gaps Summary (must be fixed before Phase 61 features work)

| Gap | File | Action |
|---|---|---|
| `put()` missing from api.ts | `frontend2/src/lib/api.ts` | Add `put` function after `patch` (lines 123–128) |
| `setPrimary` missing from `itemPhotosApi` | `frontend2/src/lib/api/itemPhotos.ts` | Add method + import `put` |
| Form field mismatch `"file"` vs `"photo"` | `frontend2/src/lib/api/itemPhotos.ts` line 28 | Change `form.append("file", file)` → `form.append("photo", file)` |
| `thumbnail_status` missing from `ItemPhoto` | `frontend2/src/lib/api/itemPhotos.ts` | Add optional field to interface |
| `thumbnail_status` missing from `PhotoResponse` | `backend/.../itemphoto/handler.go` | Add to struct + `toPhotoResponse()` |
| `primary_photo_thumbnail_url` missing from `Item` | `frontend2/src/lib/api/items.ts` | Add optional fields to `Item` interface |
| `primary_photo_thumbnail_url` missing from `ItemResponse` | `backend/.../item/handler.go` | Add to `ItemResponse` struct + `toItemResponse()` + LEFT JOIN in repository |
| HEIC in `RetroFileInput` accept + helper text | `frontend2/src/components/retro/RetroFileInput.tsx` | Update line 22 + line 121 |

---

## Metadata

**Analog search scope:** `frontend2/src/features/items/`, `frontend2/src/lib/api/`, `frontend2/src/components/retro/`, `frontend2/src/features/taxonomy/panel/`, `backend/internal/domain/warehouse/item*/`
**Files read for pattern extraction:** 16
**Pattern extraction date:** 2026-04-16
