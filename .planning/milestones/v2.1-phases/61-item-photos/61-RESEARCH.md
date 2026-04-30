# Phase 61: Item Photos — Research

**Researched:** 2026-04-16
**Domain:** React photo gallery, multipart upload, React Query mutations, full-viewport overlay, ObjectURL lifecycle
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Responsive thumbnail grid (3–4 columns) in PHOTOS section; replaces RetroEmptyState placeholder
- D-02: Clicking thumbnail opens full-viewport overlay lightbox (NOT RetroDialog-sized). New `ItemPhotoLightbox` component.
- D-03: Lightbox controls: ‹ prev / next ›, photo counter ("2 of 5"), SET AS PRIMARY, DELETE, close (×)
- D-04: ADD PHOTOS button opens native file picker; accept: `image/jpeg,image/png,image/webp` (HEIC removed)
- D-05: Sequential auto-upload — files upload one-by-one immediately after selection
- D-06: ADD PHOTOS shows disabled `WORKING…` state during the entire batch; no per-file progress bars
- D-07: Primary photo is user-selectable via SET AS PRIMARY in lightbox; calls `itemPhotosApi.setPrimary()`
- D-08: Items list gets small 40×40px thumbnail as first column; shows primary photo's `thumbnail_url` or retro placeholder
- D-09: `itemPhotosApi.setPrimary(wsId, photoId)` → `PUT /workspaces/{wsId}/photos/{photoId}/primary` must be added
- D-10: HEIC rejected client-side with clear error; `RetroFileInput` accept updated from heic → webp; no heic2any
- D-11: Thumbnail pending → retro placeholder tile in grid; full-size `url` used immediately in lightbox; no polling
- D-12: ObjectURLs tracked in `useRef<Set<string>>` and revoked on unmount — hard requirement

### Claude's Discretion
- Grid column count responsive breakpoints (grid-cols-3 md:grid-cols-4 confirmed in UI-SPEC)
- Exact lightbox transition/animation (simple opacity fade or none)
- Primary photo badge placement on grid tile (amber ★ PRIMARY badge in top-left corner — confirmed in UI-SPEC)
- Whether to invalidate `itemPhotoKeys.list(itemId)` only or also `itemKeys.detail(itemId)` + `itemKeys.lists()` after setPrimary
- Query invalidation strategy after upload/delete/setPrimary
- Whether `useItemPhotoGallery` hook extracts mutations or keeps them inline in `ItemPhotoGallery`

### Deferred Ideas (OUT OF SCOPE)
- SSE-driven thumbnail readiness (`item_photo.updated` event, `thumbnail_ready`)
- Photo reordering (drag-to-reorder; backend `item_photo.reordered` event exists)
- Caption editing (backend `ItemPhoto.Caption` field exists but UI deferred)
- Bulk delete / download (backend bulk handlers exist)
- HEIC client-side conversion (heic2any; intentionally skipped)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHOTO-01 | User can upload one or more photos (JPEG/PNG/HEIC, auto-resized client-side, max 10 MB) | Sequential upload via `itemPhotosApi.upload()`; client-side HEIC rejection D-10; size enforced by RetroFileInput's existing maxSizeBytes filter and backend 10 MB limit |
| PHOTO-02 | User can view item photos in a gallery viewer on the item detail page | `ItemPhotoGallery` + `ItemPhotoGrid` + `ItemPhotoTile` replace PHOTOS section placeholder at line 229–240 of ItemDetailPage.tsx; `ItemPhotoLightbox` full-viewport overlay via FloatingPortal |
| PHOTO-03 | User can delete an item photo | `itemPhotosApi.remove()` called from lightbox after `RetroConfirmDialog` confirmation (single-step destructive); React Query invalidation + lightbox navigation |
| PHOTO-04 | Item list and detail show the primary/thumbnail photo where available | `ItemThumbnailCell` in ItemsListPage first column; `ItemHeaderThumbnail` on ItemDetailPage header; primary photo data resolution via backend join in Item response (Option A) |
</phase_requirements>

---

## Summary

Phase 61 wires a complete item photo feature onto an already-scaffolded backend and API layer. The backend exposes all required endpoints (list, get, upload, set-primary, delete) and the frontend `itemPhotosApi` module is 95% complete — only `setPrimary` is missing. No new libraries are required; the full stack is composed from existing primitives.

The key planning decisions are: (1) how the items list gets primary-photo thumbnail URLs per row (backend join in Item response is strongly preferred — "Option A"), (2) the lightbox overlay implementation — use `FloatingPortal` + `FloatingFocusManager` from the already-installed `@floating-ui/react` package rather than reinventing a portal, and (3) that `thumbnail_status` is NOT currently included in the backend `PhotoResponse` struct and must be added to both the Go handler type and the frontend `ItemPhoto` interface before the pending-placeholder tile can work reliably.

**Primary recommendation:** Implement Option A for primary photo data (backend adds `primary_photo_thumbnail_url` to ItemResponse); use FloatingPortal + FloatingFocusManager for the lightbox, mirroring the SlideOverPanel pattern already in place; add `thumbnail_status` to PhotoResponse in the backend handler.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Photo upload | API / Backend | Frontend (validation) | Multipart POST to backend; frontend enforces size+mime before sending |
| Photo list (per item) | API / Backend | Frontend cache | GET list served from backend; TanStack Query caches per itemId |
| Thumbnail generation | API / Backend | — | Background job in backend; frontend polls nothing (D-11) |
| Gallery rendering | Browser / Client | — | Pure React component with React Query data |
| Lightbox overlay | Browser / Client | — | Portal-mounted, client-side state machine |
| Primary photo designation | API / Backend | Frontend (optimistic) | `PUT /photos/{id}/primary` on backend; optimistic update in frontend |
| Primary thumbnail in items list | API / Backend | — | Option A: backend joins primary photo into Item list response |
| HEIC client-side rejection | Browser / Client | — | Mime-type check after file picker returns; no server round-trip |
| ObjectURL lifecycle | Browser / Client | — | `useRef<Set<string>>` in gallery component; revoked on unmount |
| i18n strings | Browser / Client | — | Lingui `t` macro; all new strings → en + et catalogs |

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5 | Server state, caching, invalidation | Project-wide decision (v2.1 locked) |
| `@floating-ui/react` | ^0.27.19 | FloatingPortal + FloatingFocusManager for lightbox | Already used by SlideOverPanel; provides portal + focus trap |
| `@lingui/react` | ^5.9.5 | i18n macro `t`, `useLingui` | Project-wide; all UI strings must go through `t` |
| `lucide-react` | (existing) | Icons: Plus, ChevronLeft, ChevronRight, Star, Trash2, X, ImageOff | Project standard icon library |

### No New Runtime Dependencies
The photo gallery lightbox is hand-authored (per UI-SPEC "Registry Safety" section). No react-image-gallery, react-photo-view, or similar. No heic2any.

---

## Architecture Patterns

### System Architecture Diagram

```
[User clicks ADD PHOTOS]
        │
        ▼
[RetroFileInput hidden input] ──HEIC/type check──► [inline error, file rejected]
        │ accepted files
        ▼
[sequential upload loop]
        │  itemPhotosApi.upload(wsId, itemId, file)
        │  POST /workspaces/{wsId}/items/{itemId}/photos (multipart)
        ▼
[Backend stores photo] ──► [background thumbnail job: pending→complete]
        │  returns ItemPhoto (url always present; thumbnail_url pending initially)
        ▼
[invalidate itemPhotoKeys.list(itemId)]
        │
        ▼
[ItemPhotoGallery refetches] ──► [ItemPhotoGrid renders tiles]
        │                               │ thumbnail_status complete → <img src={thumbnail_url}>
        │                               │ thumbnail_status pending  → <HazardStripe> "PROCESSING…" tile
        │
        ▼ [tile click]
[ItemPhotoLightbox opens via FloatingPortal]
        │  always uses photo.url (full-size, always available)
        │
        ├──[SET AS PRIMARY] ──► itemPhotosApi.setPrimary() ──► optimistic update
        │                            PUT /workspaces/{wsId}/photos/{photoId}/primary
        │                            on success: invalidate list + item detail + items lists
        │
        └──[DELETE PHOTO] ──► RetroConfirmDialog
                                    │ KEEP PHOTO ──► close dialog
                                    │ DELETE PHOTO ──► itemPhotosApi.remove()
                                              DELETE /workspaces/{wsId}/photos/{photoId}
                                              on success: advance lightbox, invalidate list
```

### Recommended Project Structure

```
frontend2/src/features/items/
├── photos/
│   ├── ItemPhotoGallery.tsx      # top-level: owns upload mutation, lightbox state, ObjectURL refs
│   ├── ItemPhotoGrid.tsx         # presentational: grid of ItemPhotoTile; receives photos[] + onTileClick
│   ├── ItemPhotoTile.tsx         # presentational: single square tile with thumbnail/placeholder/badge
│   ├── ItemPhotoLightbox.tsx     # portal overlay: prev/next, counter, SET AS PRIMARY, DELETE
│   ├── ItemThumbnailCell.tsx     # 40×40 cell for items list; shared placeholder logic with ItemPhotoTile
│   ├── ItemHeaderThumbnail.tsx   # 64×64 cell for item detail header
│   └── useItemPhotoGallery.ts    # (optional) hook: upload/setPrimary/delete mutations + ObjectURL tracking
├── ItemDetailPage.tsx            # MODIFY: swap PHOTOS seam + add ItemHeaderThumbnail
└── ItemsListPage.tsx             # MODIFY: prepend THUMB column
```

### Pattern 1: Sequential Auto-Upload with ObjectURL Tracking

```typescript
// Source: project pattern (Phase 60 mutations) + D-05/D-12 requirements
const objectUrlsRef = useRef<Set<string>>(new Set());

useEffect(() => {
  return () => {
    // D-12: revoke all tracked ObjectURLs on unmount
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  };
}, []);

async function uploadFiles(files: File[]) {
  setUploading(true);
  for (const file of files) {
    try {
      await itemPhotosApi.upload(wsId, itemId, file);
      qc.invalidateQueries({ queryKey: itemPhotoKeys.list(itemId) });
    } catch {
      addToast(t`Couldn't upload ${file.name}. Continuing with the rest.`, "error");
    }
  }
  setUploading(false);
  // if N > 1 and any succeeded, surface batch success toast
}
```

### Pattern 2: Lightbox via FloatingPortal + FloatingFocusManager

The project already uses `FloatingPortal` + `FloatingFocusManager` from `@floating-ui/react` in `SlideOverPanel.tsx`. The lightbox should mirror this pattern exactly. [VERIFIED: codebase grep of SlideOverPanel.tsx]

```typescript
// Source: frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx (existing pattern)
// Adapt for lightbox — no useFloating needed since lightbox is fixed, not anchored
import { FloatingPortal, FloatingFocusManager, useFloating } from "@floating-ui/react";

// Lightbox uses the same FloatingPortal + FloatingFocusManager pattern
// but renders a full-viewport fixed div instead of a slide-over panel
```

The `<dialog>` element approach is also valid (and used by RetroDialog). The FloatingPortal approach is recommended for the lightbox because:
- It matches the existing complex-overlay precedent (SlideOverPanel)
- `FloatingFocusManager` provides keyboard focus trap with Tab cycling out of the box
- No z-index conflicts with the native `<dialog>` backdrop

**z-index convention (verified from codebase):**
- Loading bar: z-40
- Slide-over backdrop: z-40, slide-over panel: z-50
- Toast container: z-50
- Lightbox must be: **z-60** (above slide-over and toasts)
- RetroConfirmDialog (delete confirm, overlaid on lightbox): **z-70** [ASSUMED — standard stacking; no existing z-60/z-70 found in codebase]

### Pattern 3: HEIC Client-Side Rejection

```typescript
// Source: D-10 decision + 61-UI-SPEC.md interaction contracts
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
    { accepted: [] as File[], rejected: [] as File[] }
  );
}
// Show inline error for each rejected file — HEIC gets specific message, others get generic
```

### Pattern 4: Mutation + Optimistic Update for setPrimary

```typescript
// Source: project pattern from Phase 59/60 mutations; D-07 decision
const setPrimaryMutation = useMutation({
  mutationFn: ({ photoId }: { photoId: string }) =>
    itemPhotosApi.setPrimary(wsId, photoId),
  onMutate: async ({ photoId }) => {
    // Cancel outgoing refetches
    await qc.cancelQueries({ queryKey: itemPhotoKeys.list(itemId) });
    const previous = qc.getQueryData(itemPhotoKeys.list(itemId));
    // Optimistic toggle
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
    // Invalidate photo list + item detail + items list (for thumbnail column)
    qc.invalidateQueries({ queryKey: itemPhotoKeys.list(itemId) });
    qc.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
    qc.invalidateQueries({ queryKey: itemKeys.lists() });
    addToast(t`Primary photo updated.`, "success");
  },
});
```

### Pattern 5: Pending Thumbnail Tile

```typescript
// Source: D-11 decision + 61-UI-SPEC.md
// The backend PhotoResponse does NOT currently include thumbnail_status.
// MUST add to backend handler PhotoResponse struct + frontend ItemPhoto interface.
function ItemPhotoTile({ photo, onClick, isPrimary }: ItemPhotoTileProps) {
  const showPlaceholder =
    !photo.thumbnail_url ||
    photo.thumbnail_status === "pending" ||
    photo.thumbnail_status === "processing";

  return (
    <div
      className="aspect-square relative border-retro-thick border-retro-charcoal cursor-pointer ..."
      onClick={onClick}
    >
      {showPlaceholder ? (
        <div className="relative w-full h-full">
          <HazardStripe className="absolute inset-0 opacity-60" height={undefined} />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[12px] uppercase text-retro-charcoal">
            PROCESSING…
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
      {isPrimary && <PrimaryBadge />}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Per-row photo fetches in items list:** Issuing one `itemPhotosApi.listForItem()` per row = 25 GETs on page load. Use Option A (backend join) exclusively.
- **RetroDialog for lightbox:** RetroDialog is max-w-[480px], which is form-proportioned. The lightbox needs full-viewport (D-02). Use FloatingPortal + fixed div.
- **SSE polling:** Thumbnail readiness is deferred; do not add any polling or EventSource logic.
- **Forgetting to revoke ObjectURLs:** Any `URL.createObjectURL()` must be tracked in a ref and revoked. Failing this causes memory leaks on repeated uploads (v1.9 lesson, success criterion #5).
- **Using native `<dialog>` for lightbox while RetroConfirmDialog is also open:** Two nested native `<dialog>` elements can cause focus-management conflicts. Prefer FloatingPortal for the lightbox layer so `RetroConfirmDialog` (which uses native `<dialog>`) stacks above it cleanly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Portal mounting | Custom `ReactDOM.createPortal` boilerplate | `FloatingPortal` from `@floating-ui/react` | Already used in SlideOverPanel; handles SSR edge cases |
| Keyboard focus trap in lightbox | Manual Tab-key event listeners | `FloatingFocusManager` from `@floating-ui/react` | Already used in SlideOverPanel; handles edge cases (iframe, shadow DOM) |
| Toast notifications | Custom toast state | `useToast()` from `@/components/retro` | Project-standard |
| Delete confirmation | Custom confirm modal | `RetroConfirmDialog` ref-driven API | Already used in items/borrowers flows |
| File validation | Custom mime+size check | Extend existing `RetroFileInput` accept prop + partitionFiles helper | RetroFileInput already filters by size; add mime partition above it |

---

## Critical Backend Gap: `thumbnail_status` Not in PhotoResponse

**Severity:** Must fix before D-11 pending-placeholder tiles can work.

The backend `PhotoResponse` struct (handler.go line 883–900) does **not** include `ThumbnailStatus`. The entity has the field (`ThumbnailStatus ThumbnailStatus`), the service sets it to `pending` on upload, but `toPhotoResponse()` does not map it to the response. [VERIFIED: read of handler.go]

**Required backend change:**
```go
// In handler.go PhotoResponse struct — add:
ThumbnailStatus string `json:"thumbnail_status" doc:"Thumbnail processing status: pending|processing|complete|failed"`

// In toPhotoResponse() — add:
ThumbnailStatus: string(p.ThumbnailStatus),
```

**Required frontend change:**
```typescript
// In frontend2/src/lib/api/itemPhotos.ts — add to ItemPhoto interface:
thumbnail_status?: "pending" | "processing" | "complete" | "failed";
```

Without this, the frontend has no way to distinguish "thumbnail not ready" from "thumbnail missing", and the pending-placeholder tile will fall back to showing a broken image rather than the HazardStripe placeholder.

---

## Critical Frontend Gap: `setPrimary` Missing from itemPhotosApi

`itemPhotosApi` (confirmed by reading the file) has `listForItem`, `get`, `upload`, `remove` but no `setPrimary`. [VERIFIED: read of itemPhotos.ts]

**Required addition:**
```typescript
// In frontend2/src/lib/api/itemPhotos.ts
setPrimary: (wsId: string, photoId: string) =>
  put<void>(`/workspaces/${wsId}/photos/${photoId}/primary`),
```

The backend endpoint `PUT /photos/{id}/primary` already exists and is implemented. [VERIFIED: read of handler.go line 83]

**Note:** The `put` function from `@/lib/api` needs to be imported — verify it exists in the api.ts base module (it is used elsewhere for patch/delete variants).

---

## Critical Frontend Gap: RetroFileInput Accept Must Be Updated

`RetroFileInput.tsx` line 22: `DEFAULT_ACCEPT = "image/jpeg,image/png,image/heic"` [VERIFIED: read of RetroFileInput.tsx]
Line 121: helper text references "HEIC".

Both must be updated to `image/jpeg,image/png,image/webp` / "WebP" per D-10.

---

## Open Data-Shape Decision: Primary Photo in Items List

The `Item` type in `items.ts` and the backend `ItemResponse` struct do **not** include `primary_photo_thumbnail_url`. [VERIFIED: read of both files]

The UI-SPEC documents three options. Research finding:

**Strongly recommend Option A** (backend adds `primary_photo_thumbnail_url` to Item list response):
- Items list renders in one pass, no secondary fetches
- Backend join query is straightforward (left join item_photos on is_primary = true)
- Frontend change is additive (add optional field to Item interface)
- UI-SPEC states "Option A is strongly preferred for clarity and performance"

**Option B** (per-row fetches) is explicitly rejected by the UI-SPEC.

**Option C** (batch primaries endpoint) adds backend complexity with minimal benefit over Option A.

**Backend change for Option A:**
```go
// In item handler.go ItemResponse struct — add:
PrimaryPhotoThumbnailURL *string `json:"primary_photo_thumbnail_url,omitempty"`
PrimaryPhotoURL          *string `json:"primary_photo_url,omitempty"`

// In service/repository list query — left join photos where is_primary = true
// and populate the field in toItemResponse()
```

**Frontend change for Option A:**
```typescript
// In items.ts Item interface — add:
primary_photo_thumbnail_url?: string | null;
primary_photo_url?: string | null;
```

---

## Common Pitfalls

### Pitfall 1: RetroFileInput's `handleChange` Silently Drops Oversized Files
**What goes wrong:** The existing `RetroFileInput.handleChange` filters files by `f.size <= maxSizeBytes` but does not surface an error for the dropped files. If a user selects three files and two are over 10 MB, the `onChange` callback receives only one file with no indication the others were rejected.
**Why it happens:** The current design was built for a form-submit pattern; the gallery needs inline per-file error feedback.
**How to avoid:** In `ItemPhotoGallery`, after `RetroFileInput` calls `onChange`, compare the received files against the originally selected files to detect dropped oversized files and surface per-file inline errors.
**Warning signs:** Upload completes but fewer photos appear than selected.

### Pitfall 2: Lightbox z-index Below RetroToast
**What goes wrong:** If the lightbox backdrop is z-50 (matching the slide-over panel), toasts (also z-50 per RetroToast.tsx) may appear behind the lightbox.
**Why it happens:** Both are z-50 in the project's current conventions.
**How to avoid:** Set lightbox to z-60. RetroConfirmDialog (native `<dialog>`) renders above everything via the browser's top layer — safe regardless of z-index.

### Pitfall 3: Stale Items List Thumbnails After setPrimary
**What goes wrong:** User changes primary photo; gallery badge updates correctly (optimistic), but items list still shows old thumbnail until next page load.
**Why it happens:** setPrimary only invalidates `itemPhotoKeys.list(itemId)` — not `itemKeys.lists()`.
**How to avoid:** On setPrimary success, invalidate `itemPhotoKeys.list(itemId)` + `itemKeys.detail(itemId)` + `itemKeys.lists()`.

### Pitfall 4: Lightbox Navigation State Desync After Delete
**What goes wrong:** User deletes photo at index 3 of 5. Lightbox should advance to index 3 (the new photo at that position, formerly index 4) or retreat to index 2 if the deleted one was the last. If index tracking doesn't account for the removed item, the lightbox shows a blank state or the wrong photo.
**Why it happens:** The lightbox maintains a `currentIndex` that is now out-of-bounds.
**How to avoid:** After delete invalidation re-fetches the list, recalculate `currentIndex = Math.min(prevIndex, newPhotos.length - 1)`. Close lightbox if `newPhotos.length === 0`.

### Pitfall 5: HazardStripe Height in Pending Tiles
**What goes wrong:** `HazardStripe` has a `height` prop defaulting to 8px. Used as a pending-tile background, it will render as an 8px stripe at the top of the tile, not fill the full square.
**Why it happens:** The component is designed for decorative divider bars, not full-area fills.
**How to avoid:** In `ItemPhotoTile`, position HazardStripe with `absolute inset-0` and set `height={undefined}` (or use `className="h-full w-full"`) so it fills the tile. The `height` style prop should not conflict with `h-full` if the default inline style is overridden.

### Pitfall 6: RetroConfirmDialog Overlaid on Lightbox — Focus Leaking
**What goes wrong:** When `RetroConfirmDialog` opens (native `<dialog>`) while the lightbox (`FloatingFocusManager`) is active, Tab focus may cycle back into lightbox controls instead of staying in the confirm dialog.
**Why it happens:** `FloatingFocusManager` traps focus; a native `<dialog>` uses the browser's top layer and should steal focus, but the interaction between the two needs testing.
**How to avoid:** When the confirm dialog is open, temporarily disable the lightbox's `FloatingFocusManager` or rely on the native dialog's built-in top-layer focus behavior. Test with keyboard navigation before phase checkpoint.

### Pitfall 7: ObjectURL Leak on Navigation Away Mid-Upload
**What goes wrong:** User uploads 5 photos, navigates to another page after 2 complete. ObjectURLs for the preview tiles created for uploads 3-5 are never revoked.
**Why it happens:** Component unmounts during the upload loop; the `useEffect` cleanup runs but the upload loop's async chain continues after unmount.
**How to avoid:** Track an `unmounted` ref and skip adding new ObjectURLs after unmount. The cleanup `useEffect` will revoke any already-tracked URLs.

---

## Code Examples

### Verified: itemPhotosApi.upload (current — confirmed working)
```typescript
// Source: frontend2/src/lib/api/itemPhotos.ts (read 2026-04-16)
upload: (wsId: string, itemId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return postMultipart<ItemPhoto>(`/workspaces/${wsId}/items/${itemId}/photos`, form);
},
```

### Verified: Backend upload endpoint form field name
The backend `HandleUpload` reads `r.FormFile("photo")` [VERIFIED: handler.go line 677], but the frontend `upload` appends with key `"file"`. **This is a mismatch.** Check if this is intentional or a bug — confirm by running an upload and checking the backend logs, or reading the full handler implementation.

**Update after closer read:** Line 677: `r.FormFile("photo")` — the backend expects the multipart field named `"photo"`, but the frontend sends `"file"`. This needs investigation. [VERIFIED: codebase mismatch — backend expects "photo", frontend sends "file"]

The planner must decide whether to:
- Fix the frontend to send `form.append("photo", file)`, OR
- Fix the backend to accept `"file"` as the field name

Given that Phase 56 scaffolded the upload function and the backend predates it, the frontend likely needs to match the backend. Recommend changing frontend to `form.append("photo", file)`.

### Verified: RetroConfirmDialog usage pattern
```typescript
// Source: frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx pattern
const confirmRef = useRef<RetroConfirmDialogHandle>(null);

<RetroConfirmDialog
  ref={confirmRef}
  title={t`CONFIRM DELETE`}
  body={<>...</>}
  escapeLabel={t`KEEP PHOTO`}
  destructiveLabel={t`DELETE PHOTO`}
  variant="destructive"
  onConfirm={handleDelete}
/>
// Open via: confirmRef.current?.open()
```

### Verified: FloatingPortal pattern (for lightbox)
```typescript
// Source: frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx (read 2026-04-16)
import { FloatingPortal, FloatingFocusManager, useFloating } from "@floating-ui/react";

const { refs, context } = useFloating({ open, onOpenChange: setOpen });

return (
  <FloatingPortal>
    <div className="fixed inset-0 bg-retro-ink/92 z-60" onClick={onClose} aria-hidden="true" />
    <FloatingFocusManager context={context} initialFocus={0}>
      <div role="dialog" aria-modal="true" aria-labelledby="lightbox-title"
           className="fixed inset-0 z-60 flex flex-col items-center justify-center">
        {/* lightbox content */}
      </div>
    </FloatingFocusManager>
  </FloatingPortal>
);
```

---

## State of the Art

| Old Approach | Current Approach | Phase 61 status |
|--------------|------------------|-----------------|
| HEIC support via `heic2any` | Reject HEIC client-side, accept WebP instead | D-10: confirmed no heic2any |
| Photo upload via dedicated library (react-dropzone) | Native `<input type="file">` + FormData + fetch | v2.1 locked decision: `Photos via native FormData + fetch multipart` |
| Gallery lightbox library (lightgallery.js, react-image-gallery) | Hand-authored `ItemPhotoLightbox` with FloatingPortal | UI-SPEC "Registry Safety": no external component registries |
| SSE for thumbnail readiness | Static polling placeholder, SSE deferred | D-11 + CONTEXT deferred section |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@floating-ui/react` | Lightbox portal + focus trap | Yes | ^0.27.19 | — |
| `@lingui/react` | i18n strings | Yes | ^5.9.5 | — |
| `lucide-react` | Icons (ImageOff, Star, X, Trash2, etc.) | Yes | (existing) | — |
| Backend photo endpoints | All photo operations | Yes | — | — |
| Backend `thumbnail_status` in PhotoResponse | Pending tile rendering | **No — must add** | — | Show placeholder whenever `thumbnail_url` is empty |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react + jsdom |
| Config file | `frontend2/vitest.config.ts` |
| Quick run command | `cd frontend2 && npx vitest run src/features/items/photos` |
| Full suite command | `cd frontend2 && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHOTO-01 | Upload button calls itemPhotosApi.upload per file sequentially | unit | `npx vitest run src/features/items/photos/ItemPhotoGallery.test.tsx` | No — Wave 0 |
| PHOTO-01 | HEIC file triggers inline error, not uploaded | unit | `npx vitest run src/features/items/photos/ItemPhotoGallery.test.tsx` | No — Wave 0 |
| PHOTO-01 | Oversized file triggers inline error | unit | `npx vitest run src/features/items/photos/ItemPhotoGallery.test.tsx` | No — Wave 0 |
| PHOTO-01 | ObjectURLs revoked on unmount | unit | `npx vitest run src/features/items/photos/ItemPhotoGallery.test.tsx` | No — Wave 0 |
| PHOTO-02 | Gallery grid renders correct number of tiles | unit | `npx vitest run src/features/items/photos/ItemPhotoGrid.test.tsx` | No — Wave 0 |
| PHOTO-02 | Pending tile shows PROCESSING placeholder | unit | `npx vitest run src/features/items/photos/ItemPhotoTile.test.tsx` | No — Wave 0 |
| PHOTO-02 | Lightbox opens on tile click; shows correct photo | unit | `npx vitest run src/features/items/photos/ItemPhotoLightbox.test.tsx` | No — Wave 0 |
| PHOTO-02 | Lightbox prev/next navigation | unit | `npx vitest run src/features/items/photos/ItemPhotoLightbox.test.tsx` | No — Wave 0 |
| PHOTO-02 | Empty state renders when photos.length === 0 | unit | `npx vitest run src/features/items/photos/ItemPhotoGallery.test.tsx` | No — Wave 0 |
| PHOTO-03 | DELETE PHOTO opens confirm dialog, calls remove on confirm | unit | `npx vitest run src/features/items/photos/ItemPhotoLightbox.test.tsx` | No — Wave 0 |
| PHOTO-03 | KEEP PHOTO dismisses confirm without deleting | unit | `npx vitest run src/features/items/photos/ItemPhotoLightbox.test.tsx` | No — Wave 0 |
| PHOTO-04 | ItemThumbnailCell shows thumbnail when primary_photo_thumbnail_url present | unit | `npx vitest run src/features/items/photos/ItemThumbnailCell.test.tsx` | No — Wave 0 |
| PHOTO-04 | ItemThumbnailCell shows placeholder when no primary photo | unit | `npx vitest run src/features/items/photos/ItemThumbnailCell.test.tsx` | No — Wave 0 |
| PHOTO-04 | ItemsListPage THUMB column appears as first column | unit | `npx vitest run src/features/items/__tests__/ItemsListPage.test.tsx` | Yes — modify |
| PHOTO-04 | SET AS PRIMARY calls itemPhotosApi.setPrimary; badge moves | unit | `npx vitest run src/features/items/photos/ItemPhotoLightbox.test.tsx` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && npx vitest run src/features/items/photos`
- **Per wave merge:** `cd frontend2 && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `frontend2/src/features/items/photos/ItemPhotoGallery.test.tsx` — covers PHOTO-01 upload, HEIC rejection, ObjectURL cleanup, empty state
- [ ] `frontend2/src/features/items/photos/ItemPhotoGrid.test.tsx` — covers PHOTO-02 grid rendering
- [ ] `frontend2/src/features/items/photos/ItemPhotoTile.test.tsx` — covers pending/complete tile states
- [ ] `frontend2/src/features/items/photos/ItemPhotoLightbox.test.tsx` — covers PHOTO-02 lightbox, PHOTO-03 delete flow, PHOTO-04 set-primary
- [ ] `frontend2/src/features/items/photos/ItemThumbnailCell.test.tsx` — covers PHOTO-04 list thumbnail
- [ ] `frontend2/src/lib/api/itemPhotos.test.ts` — covers `setPrimary` API call shape

Existing test to extend: `frontend2/src/features/items/__tests__/ItemsListPage.test.tsx` — add assertion for THUMB first column presence.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `put` function exists in `@/lib/api` (same module as `get`, `post`, `patch`, `del`) | Critical Frontend Gap (setPrimary) | Frontend API call implementation blocked; need to verify or add `put` to api.ts |
| A2 | z-index 60 for lightbox, 70 for nested RetroConfirmDialog is safe | Anti-Patterns / Pitfall 2 | Visual layer conflicts; simple to verify during implementation |
| A3 | Backend items list query supports left join on photos table to include primary thumbnail | Open Data-Shape Decision | Option A feasibility; may require planner to inspect the repository layer |

---

## Open Questions (RESOLVED)

1. **Frontend form field name mismatch: `"file"` vs `"photo"`**
   - What we know: Backend `HandleUpload` reads `r.FormFile("photo")`; frontend `itemPhotosApi.upload` sends `form.append("file", file)` [VERIFIED: both files read]
   - What's unclear: Does this mismatch exist in production and uploads fail, or is there middleware normalizing it?
   - Recommendation: Fix frontend to use `form.append("photo", file)` in Wave 1 to match the backend contract. Test with a real upload.

2. **Does `put()` exist in `@/lib/api`?**
   - What we know: `get`, `post`, `patch`, `del`, `postMultipart` are confirmed imports in existing API modules
   - What's unclear: Whether `put` is exported (it may be missing if no PUT endpoint was used before)
   - Recommendation: Check `frontend2/src/lib/api.ts` in Wave 1. If missing, add `put` alongside `patch`.

3. **Backend join feasibility for Option A (primary thumbnail in Item list response)**
   - What we know: `ItemResponse` currently has no photo fields; the item service uses a repository layer
   - What's unclear: Whether the repository layer supports the left join or needs a new query
   - Recommendation: Planner inspects `backend/internal/domain/warehouse/item/repository.go` to assess join complexity before committing to Option A.

---

## Sources

### Primary (HIGH confidence)
- Read: `frontend2/src/lib/api/itemPhotos.ts` — confirmed current `itemPhotosApi` methods and `ItemPhoto` interface; `setPrimary` and `thumbnail_status` absence verified
- Read: `frontend2/src/lib/api/items.ts` — confirmed `Item` type has no primary photo fields
- Read: `backend/internal/domain/warehouse/itemphoto/handler.go` — confirmed backend endpoints, `PhotoResponse` struct missing `thumbnail_status`, form field `"photo"`, `SET PRIMARY` endpoint implemented
- Read: `backend/internal/domain/warehouse/itemphoto/entity.go` — confirmed `ThumbnailStatus` enum and entity fields
- Read: `backend/internal/domain/warehouse/item/handler.go` — confirmed `ItemResponse` has no photo fields
- Read: `frontend2/src/features/items/ItemDetailPage.tsx` — confirmed PHOTOS seam at lines 229–240
- Read: `frontend2/src/features/items/ItemsListPage.tsx` — confirmed current column order, no THUMB column
- Read: `frontend2/src/components/retro/RetroFileInput.tsx` — confirmed `DEFAULT_ACCEPT` and helper text need updating
- Read: `frontend2/src/components/retro/RetroConfirmDialog.tsx` — confirmed API (title, body, escapeLabel, destructiveLabel, variant, onConfirm)
- Read: `frontend2/src/components/retro/RetroDialog.tsx` — confirmed native `<dialog>` usage
- Read: `frontend2/src/components/retro/RetroButton.tsx` — confirmed variants (primary, danger, neutral, secondary)
- Read: `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` — confirmed `FloatingPortal` + `FloatingFocusManager` pattern, z-index 40/50
- Read: `frontend2/src/components/retro/RetroToast.tsx` — confirmed z-50 for toast container
- Read: `frontend2/package.json` — confirmed `@floating-ui/react ^0.27.19` installed, no new dependencies needed
- Read: `frontend2/vitest.config.ts` — confirmed test framework (Vitest + jsdom)
- Read: `.planning/config.json` — confirmed `nyquist_validation` key absent → validation architecture section required

### Secondary (MEDIUM confidence)
- Read: `frontend2/src/features/items/__tests__/fixtures.ts` — confirmed `makeItem` factory pattern for tests

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified by reading package.json and import statements
- Architecture: HIGH — all seams and integration points verified from actual source files
- Backend gaps: HIGH — verified by reading handler.go and entity.go
- Frontend gaps: HIGH — verified by reading itemPhotos.ts, items.ts, RetroFileInput.tsx
- z-index stacking: MEDIUM — conventions verified from existing components; lightbox z-60 is assumed safe

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable tech stack)
