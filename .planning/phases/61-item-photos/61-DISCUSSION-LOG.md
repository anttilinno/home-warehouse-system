# Phase 61: Item Photos — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 61-item-photos
**Areas discussed:** Gallery viewer style, Upload UX, Primary photo UX, HEIC + thumbnail states

---

## Gallery Viewer Style

| Option | Description | Selected |
|--------|-------------|----------|
| Grid + modal lightbox | Thumbnail grid; clicking opens full-viewport overlay with prev/next + delete | ✓ |
| Horizontal strip only | Scrollable row, no fullscreen view | |
| Single featured + strip | Large primary photo on top, thumbnails below it | |

**User's choice:** Grid + modal lightbox

**Follow-up — Delete in lightbox:**

| Option | Description | Selected |
|--------|-------------|----------|
| Delete in lightbox | Trash/DELETE button inside lightbox triggers confirm dialog | ✓ |
| Grid-only delete | Delete only on thumbnail hover; lightbox is view-only | |

**Follow-up — Lightbox design:**

| Option | Description | Selected |
|--------|-------------|----------|
| Full-viewport overlay | Dark backdrop, retro border/shadow, photo-sized | ✓ |
| RetroDialog reuse | Wider RetroDialog (max-w-4xl) | |

---

## Upload UX

| Option | Description | Selected |
|--------|-------------|----------|
| ADD PHOTOS button | RetroButton above grid, opens file picker | ✓ |
| + tile in grid | Plus tile at end of thumbnail grid | |

**Follow-up — Upload flow:**

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential auto-upload | Files upload one-by-one immediately, no submit | ✓ |
| Queue with submit | Show queue, user confirms with UPLOAD button | |

**Follow-up — Progress:**

| Option | Description | Selected |
|--------|-------------|----------|
| Button loading state | ADD PHOTOS disabled/spinner while uploading | ✓ |
| Per-file progress | Progress indicator per file in gallery | |

---

## Primary Photo UX

| Option | Description | Selected |
|--------|-------------|----------|
| Auto: first uploaded = primary | No UI, first upload wins | |
| User-selectable via SET AS PRIMARY | Explicit control in lightbox | ✓ |

**Follow-up — List thumbnail:**

| Option | Description | Selected |
|--------|-------------|----------|
| Small square column (first col) | 40×40px thumbnail as first table column | ✓ |
| Inline in Name cell | Thumbnail inside Name cell, left of text | |

**Follow-up — Where to access SET AS PRIMARY:**

| Option | Description | Selected |
|--------|-------------|----------|
| In the lightbox | SET AS PRIMARY button alongside DELETE | ✓ |
| Grid hover action | Star icon on thumbnail hover | |

---

## HEIC + Thumbnail States

| Option | Description | Selected |
|--------|-------------|----------|
| Reject with clear error | Update accept types, show error message | ✓ |
| Client-side convert to JPEG | heic2any library, seamless for iPhone | |

**Follow-up — Thumbnail loading:**

| Option | Description | Selected |
|--------|-------------|----------|
| SSE for gallery refresh only | Invalidate cache on item_photo.created/deleted SSE; full-size url as fallback | |
| SSE + new thumbnail_ready event | Add backend broadcast from job processor | |
| Placeholder only, no SSE | Static placeholder, thumbnails on next refresh | |

**User's choice:** Retro placeholder for pending thumbnails; SSE thumbnail readiness deferred to a later stage.
**Notes:** User noted "Retro placeholder with SSE support? No polling." After clarification that thumbnail_ready SSE would need new backend work, user decided to defer SSE integration and keep Phase 61 scope tight.

---

## Claude's Discretion

- Grid responsive breakpoints
- Lightbox animation (fade or none)
- Primary badge placement (grid vs lightbox only)
- Query invalidation scope after setPrimary
- Whether primary_photo is embedded in Item list response or fetched separately

## Deferred Ideas

- SSE-driven thumbnail readiness (thumbnail_ready backend event)
- Photo reordering (drag-to-reorder)
- Caption editing
- Bulk delete / download
- HEIC client-side conversion (heic2any)
