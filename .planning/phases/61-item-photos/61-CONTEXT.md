# Phase 61: Item Photos — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the item photo feature end-to-end: upload photos from item detail, display them in a retro gallery with a lightbox viewer, delete with confirmation, designate a primary photo, and show primary thumbnails in the items list and detail header. Client-side HEIC rejection and ObjectURL cleanup (v1.9 lesson) are in scope. SSE-driven thumbnail readiness is deferred to a later stage.

</domain>

<decisions>
## Implementation Decisions

### Gallery Viewer
- **D-01:** Photos render in a responsive thumbnail grid (3–4 columns) inside the PHOTOS section of the item detail page. The existing `RetroEmptyState` placeholder is replaced when photos exist.
- **D-02:** Clicking any thumbnail opens a **full-viewport overlay lightbox** — dark semi-transparent backdrop, photo centered and large, retro border/shadow treatment. NOT using `RetroDialog` (form-proportioned). New `ItemPhotoLightbox` component.
- **D-03:** Lightbox controls: **‹ prev** / **next ›** arrows, photo counter ("2 of 5"), **SET AS PRIMARY** button, **DELETE** button (triggers `RetroConfirmDialog` confirmation step), and **close (×)** button.

### Upload UX
- **D-04:** **ADD PHOTOS button** above the gallery grid. Opens the native file picker. Reuses `RetroFileInput` internals (or wraps it). Accept: `image/jpeg,image/png,image/webp` (HEIC removed — see D-10).
- **D-05:** **Sequential auto-upload** — files upload one-by-one immediately after selection. No explicit submit button. Gallery updates optimistically/on each upload success.
- **D-06:** ADD PHOTOS button shows a **loading/disabled state** while uploads are in progress. No per-file progress bars.

### Primary Photo
- **D-07:** Primary photo is **user-selectable**. The SET AS PRIMARY button in the lightbox calls `itemPhotosApi.setPrimary()`. The primary photo is the one shown as the thumbnail in the items list and detail header.
- **D-08:** Items list gets a **small square thumbnail column** as the first column (approx. 40×40px). Shows the primary photo's `thumbnail_url` when available, otherwise a retro placeholder (e.g., a small HazardStripe or icon tile). The `ItemsListPage` table columns are: **[thumb] | Name | SKU | Category | Actions**.
- **D-09:** `itemPhotosApi.setPrimary(wsId: string, photoId: string)` must be added to `frontend2/src/lib/api/itemPhotos.ts`. Backend endpoint: `PUT /workspaces/{wsId}/photos/{photoId}/primary`.

### HEIC Handling
- **D-10:** HEIC is **rejected client-side** with a clear error message. Update `RetroFileInput` accept types from `image/jpeg,image/png,image/heic` to `image/jpeg,image/png,image/webp`. If a HEIC file slips through the accept filter, show an inline error: "HEIC not supported — convert to JPEG or PNG first." No heic2any library.

### Thumbnail Loading States
- **D-11:** Backend generates thumbnails asynchronously (status: pending → complete). While pending, the gallery grid shows a **retro placeholder tile** in place of the thumbnail image. The full-size `url` field (always available immediately after upload) is used as the image src for the lightbox view — `thumbnail_url` is used for the grid only once available. No polling. SSE-driven thumbnail readiness is deferred to a later stage.

### ObjectURL Cleanup
- **D-12:** Any `ObjectURL`s created for preview purposes are tracked in a `ref` and revoked via `URL.revokeObjectURL` on component unmount (v1.9 lesson from requirements). This is a hard requirement per success criterion 5.

### Claude's Discretion
- Grid column count responsive breakpoints (e.g. `grid-cols-3 md:grid-cols-4`)
- Exact lightbox transition/animation (simple opacity fade or none — retro feel, no over-engineering)
- Whether the primary photo badge (★ or PRIMARY badge) appears on the grid thumbnail or only in the lightbox
- Whether to invalidate `itemPhotoKeys.list(itemId)` or also `itemKeys.detail(itemId)` after setPrimary (planner decides based on how thumbnail_url is served)
- Query invalidation strategy after upload/delete/setPrimary mutations
- Whether to add `itemsApi.listPrimaryPhotos()` or include `primary_photo` in the existing `Item` list response (planner confirms with backend shape)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Item Photo API
- `frontend2/src/lib/api/itemPhotos.ts` — `itemPhotosApi` (listForItem, get, upload, remove), `itemPhotoKeys`, `ItemPhoto` type. **Action required:** add `setPrimary(wsId, photoId)` → `PUT /workspaces/{wsId}/photos/{photoId}/primary` (D-09).

### Backend Endpoints (item photos)
- `backend/internal/domain/warehouse/itemphoto/handler.go` — All endpoints: list (`GET /items/{item_id}/photos/list`), get (`GET /photos/{id}`), set-primary (`PUT /photos/{id}/primary`), delete (`DELETE /photos/{id}`). Upload is a chi handler (not Huma): `POST /items/{item_id}/photos`.
- `backend/internal/domain/warehouse/itemphoto/entity.go` — `ItemPhoto` entity struct, `ThumbnailStatus` enum (pending/processing/complete/failed), `AllowedMimeTypes` (JPEG, PNG, WebP — no HEIC).

### Frontend Integration Points
- `frontend2/src/features/items/ItemDetailPage.tsx` — PHOTOS section placeholder at line 229. Replace with gallery component.
- `frontend2/src/features/items/ItemsListPage.tsx` — Add thumbnail as first column (D-08). No existing photo column.
- `frontend2/src/lib/api/items.ts` — Check if `Item` type includes `primary_photo` or `thumbnail_url`. Planner should confirm whether primary thumbnail data comes from the photos list or is embedded in the item response.

### Retro Component Library
- `frontend2/src/components/retro/RetroFileInput.tsx` — File picker component. **Action required:** update `DEFAULT_ACCEPT` from `image/jpeg,image/png,image/heic` to `image/jpeg,image/png,image/webp` (D-10).
- `frontend2/src/components/retro/RetroConfirmDialog.tsx` — For delete photo confirmation (D-03).
- `frontend2/src/components/retro/RetroEmptyState.tsx` — Empty state for 0 photos.
- `frontend2/src/components/retro/HazardStripe.tsx` — Candidate for the pending-thumbnail placeholder tile (D-11).

### Patterns Reference
- `.planning/phases/59-borrowers-crud/59-CONTEXT.md` — Archive-first confirm dialog pattern (D-02 there — primary ARCHIVE + secondary delete link). Adapt for photo delete (single confirm step is sufficient).
- `frontend2/src/features/dashboard/ActivityFeed.tsx` — SSE `EventSource` pattern for future SSE integration (thumbnail_ready deferred).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RetroFileInput` — file picker with size filtering and file list UI. Reuse for ADD PHOTOS button trigger; update accept types.
- `RetroConfirmDialog` — delete confirmation modal. Already used in items/borrowers flows.
- `RetroEmptyState` — zero-photo empty state ("NO PHOTOS YET" with ADD PHOTOS CTA).
- `HazardStripe` — candidate retro texture for pending-thumbnail tiles.
- `itemPhotosApi` + `itemPhotoKeys` — fully scaffolded in Phase 56. Just add `setPrimary`.

### Established Patterns
- **Mutation → invalidate → refetch:** All CRUD phases (58, 59, 60) invalidate the relevant query key after mutations. Follow the same pattern for photo upload/delete/setPrimary.
- **Slide-over panel pattern:** Not used here (photos live inline on the detail page, not in a panel).
- **RetroDialog for confirmation:** `RetroConfirmDialog` wraps `RetroDialog` — use it directly for delete confirmation.

### Integration Points
- Item detail page `PHOTOS` section is a ready seam (`section#photos-h2` in `ItemDetailPage.tsx`).
- Items list: `RetroTable` in `ItemsListPage.tsx` — add thumbnail as first column via the table's column config.
- Primary thumbnail on items list: needs to know the primary photo URL per item. Planner must confirm if `Item` list response includes `primary_thumbnail_url` or if a separate photos fetch is needed.

</code_context>

<specifics>
## Specific Ideas

- Lightbox is full-viewport overlay (not RetroDialog-sized) with retro border/shadow — feels like a proper photo viewer.
- Gallery grid is 3–4 columns of square thumbnails with a retro border treatment.
- SET AS PRIMARY button is in the lightbox alongside DELETE — not on hover in the grid.
- No HEIC support — reject clearly rather than silently fail or add a conversion library.
- Thumbnail SSE (update gallery live when background job completes) is deliberately deferred — keep Phase 61 scope tight.

</specifics>

<deferred>
## Deferred Ideas

- **SSE-driven thumbnail readiness** — Listen for `item_photo.updated` (or a new `thumbnail_ready` event) from the background job to replace the placeholder with the real thumbnail without a page refresh. Noted for a later polish stage.
- **Photo reordering** — Backend has `item_photo.reordered` event and bulk-caption/bulk-delete handlers. Drag-to-reorder in the gallery is a future phase.
- **Caption editing** — `ItemPhoto.Caption` field exists on backend. In-lightbox caption edit deferred.
- **Bulk delete / download** — Backend bulk handlers exist. Not in Phase 61 scope.
- **HEIC client-side conversion** — `heic2any` approach intentionally skipped. Revisit if user feedback shows friction.

</deferred>

---

*Phase: 61-item-photos*
*Context gathered: 2026-04-16*
