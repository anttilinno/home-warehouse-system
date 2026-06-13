---
phase: 07-items-photos
plan: 04
subsystem: frontend2/photo-pipeline-ui
tags: [photos, upload, gallery, lightbox, modal-stack, duplicate-check, reorder, bulk]
requires:
  - "photosApi (07-01): upload/checkDuplicate/setPrimary/updateCaption/reorder/del/bulkDelete/bulkCaption/downloadZip — url/thumbnail_url already /api-relative"
  - "validateUploadFile + compressImage (07-02): jpeg/png/webp accept-list + EXIF-aware canvas downscale"
  - "retro atoms: RetroDialog/RetroConfirmDialog/RetroFileInput/RetroTextarea/RetroBadge/BevelButton/useTableSelection"
  - "useModalStack (Phase 3): capture-phase ESC arbiter (TUI-02)"
provides:
  - "PhotoUpload — validate→compress→check-duplicate→upload dialog with per-file progress + retry"
  - "DuplicateWarningDialog — butter warning dialog (proceed/cancel per file)"
  - "PhotoGallery — grid + set-primary + delete-confirm + ◂/▸ reorder + bulk select/caption/delete + zip"
  - "CaptionDialog — blue 200-char caption editor (per-photo + bulk)"
  - "PhotoLightbox — chromeless dark portal viewer, modal-stack ESC, arrow/zoom nav, AA panel chrome"
  - "usePhotoMutations — upload/setPrimary/updateCaption/del/bulkDelete/bulkCaption/reorder, all invalidating the [\"items\", wsId] prefix"
affects:
  - "Plan 07-06 item-detail PHOTOS tab (mounts PhotoGallery + PhotoUpload + PhotoLightbox)"
tech-stack:
  added: []
  patterns:
    - "per-file upload queue with a launch-once effect (pipeline kicked off AFTER rows commit, never inside the setState updater)"
    - "optimistic reorder: local order state + revert-on-error via mutate onError"
    - "gallery bulk-select forces the ctrl/meta toggle path of useTableSelection so each tile toggles independently"
    - "lightbox arrow/zoom keys registered ONLY while open; ESC delegated entirely to useModalStack (no own ESC listener)"
key-files:
  created:
    - frontend2/src/features/items/hooks/usePhotoMutations.ts
    - frontend2/src/features/items/components/PhotoUpload.tsx
    - frontend2/src/features/items/components/PhotoUpload.test.tsx
    - frontend2/src/features/items/components/DuplicateWarningDialog.tsx
    - frontend2/src/features/items/components/PhotoGallery.tsx
    - frontend2/src/features/items/components/PhotoGallery.test.tsx
    - frontend2/src/features/items/components/CaptionDialog.tsx
    - frontend2/src/features/items/components/PhotoLightbox.tsx
    - frontend2/src/features/items/components/PhotoLightbox.test.tsx
  modified: []
decisions:
  - "Upload-dialog footer button is CLOSE (not DONE) — DONE collided with the per-file ✓ DONE badge text in tests and reads better as a dismiss"
  - "HEIC follows the PLAN (accept='image/jpeg,image/png,image/webp', validateUploadFile rejects HEIC) over the UI-SPEC's picker-accepts-HEIC note — aligns with the shipped 07-02 accept-list (Pitfall 2)"
  - "RetroFileInput keeps its own picked-file list; the per-file progress queue is rendered separately below it (atom unchanged)"
metrics:
  duration: ~10m
  completed: 2026-06-13
  tasks: 3
  files: 9
requirements: [ITEM-07, ITEM-08]
---

# Phase 07 Plan 04: Photo Pipeline UI Summary

The photo-pipeline UI for the item-detail PHOTOS tab, composed entirely from shipped Phase 4 retro atoms + the 07-01 `photosApi` + 07-02 image utils — zero new deps. Upload runs validate→compress→check-duplicate→upload with isolated per-file progress and retry; the gallery does set-primary, delete-confirm, button-based reorder (full id list, optimistic), caption edit, bulk select/caption/delete, and zip download; the lightbox is a chromeless dark portal viewer whose ESC flows exclusively through the modal stack. 22 component tests + tsc green.

## What Was Built

**Task 1 — PhotoUpload + DuplicateWarningDialog + usePhotoMutations** (`1c7ff693`)
- `usePhotoMutations(wsId, itemId)`: `upload/setPrimary/updateCaption/del/bulkDelete/bulkCaption/reorder`, each invalidating the `["items", wsId]` PREFIX (no `exact:true`) so the item-detail query and any nested photo-list re-fetch. Write paths surface a persistent `retroToast.error` on failure.
- `PhotoUpload`: blue `RetroDialog` "ADD PHOTOS"; `RetroFileInput accept="image/jpeg,image/png,image/webp"` maxSize 10MB multiple. Per file the pipeline is `validateUploadFile → compressImage → checkDuplicate → (dup? DuplicateWarningDialog) → upload(FormData field "photo")`. Each file is its own progress row (pending → {pct}% → ✓ DONE / ✕ FAILED + RETRY + error line); footer reads `{done}/{total} uploaded`. The pipeline is launched by a launch-once effect AFTER the queue rows commit (launching inside the `setQueue` updater patched ids that didn't exist yet — lost updates; fixed).
- `DuplicateWarningDialog`: **butter** titlebar (MANIFEST warning semantic, NOT pink danger); up to 4 existing thumbnails with a `{similarity}%` badge + `+{n}` overflow; CANCEL (skip this file) / UPLOAD ANYWAY (proceed). Per-file decision.

**Task 2 — PhotoGallery + CaptionDialog** (`f0220e75`)
- `PhotoGallery`: `repeat(auto-fill, minmax(96px,1fr))` grid of 96×96 ink-framed `object-cover` thumbnails rendered from the Plan-01 **/api-relative** `thumbnail_url` (never the raw absolute url). Click → `onOpenLightbox(index)`. `★ PRIMARY` badge on the primary cell; `★ SET PRIMARY` on the others → `setPrimary`. Per-photo `✕` → pink `RetroConfirmDialog` "DELETE PHOTO?". `◂`/`▸` swap with the neighbor → `reorder(full photo_ids[])` optimistic with revert-on-error. `✎` → `CaptionDialog`. A `SELECT` toggle turns tiles into independently-togglable selectable tiles (`useTableSelection`, forced toggle path) with a bulk bar: `{n} SELECTED` · EDIT CAPTION (bulk) · DELETE (confirm) · ✕ CLEAR. `⤓ DOWNLOAD ALL` / `⤓ DOWNLOAD {n}` → `downloadZip`.
- `CaptionDialog`: blue `RetroDialog` "EDIT CAPTION", `RetroTextarea` with a live `{n}/200` mono counter; Enter saves, ESC cancels (modal stack). Reused for per-photo and bulk-apply.

**Task 3 — PhotoLightbox** (`241c48ad`)
- Chromeless `fixed inset-0 z-40 bg-fg-ink/85` overlay through a `createPortal` to `document.body`; opens at a given index. Top chrome (`{i}/{n}`, ⊖/⊕ zoom 1×–3× `{pct}%`, ⤓ download-original, ✕ CLOSE) sits on an opaque `bg-bg-panel` strip (ink-on-panel AA — NOT white-on-photo). 44×44 `◂`/`▸` arrows clamped at bounds; ←/→ navigate and +/-/0 zoom while open (listener removed on close). ESC closes EXCLUSIVELY via `useModalStack` (no own document ESC listener — TUI-02). `role="dialog" aria-modal aria-label="Photo {i} of {n}"`; focus trapped + restored; `motion-reduce:transition-none` on the zoom transform. Caption strip (ink-on-panel) when present.

## Deviations from Plan

Plan executed as written; the two design-contract reconciliations below are recorded as decisions (no Rule 1-3 auto-fixes needed beyond ordinary test-driven implementation choices):

1. **HEIC** — followed the PLAN (`accept="image/jpeg,image/png,image/webp"`, `validateUploadFile` rejects HEIC client-side) over the UI-SPEC §4 note that the picker *accepts* HEIC. This matches the already-shipped 07-02 accept-list (HEIC server-rejected, Pitfall 2) and the plan's Task 1 behavior block explicitly. HEIC is rejected with the exact copy "That file type isn't allowed."
2. **Upload footer button label** is CLOSE, not DONE — the literal "DONE" string collided with the per-file `✓ DONE` success badge in tests, and a dismiss verb is clearer than a second "DONE".

## Authentication Gates

None.

## Verification

- `cd frontend2 && bun run test src/features/items/components/` → 3 files, 22 tests passed.
- `cd frontend2 && bun run test` (full suite) → 60 files, 412 tests passed.
- `cd frontend2 && bun run lint:tsc` (`tsc -b --noEmit`) → exit 0, clean.
- `cd frontend2 && bun run lint:imports` → OK.
- `grep -rE "@dnd-kit|next/image|lucide" src/features/items` → no matches (no new runtime deps; reorder is button-based, images are plain `<img>` on /api-relative urls).

## Threat Surface

Per the plan's `<threat_model>`: T-07-10 (XSS via caption/filename) — all captions/filenames render as React text nodes (escaped), no `dangerouslySetInnerHTML`. T-07-11 (malicious upload) — `validateUploadFile` accept-list + 10MB pre-check (UX), backend authoritative. T-07-13 (img leaking cookie to wrong origin) — every `<img src>` in PhotoGallery, DuplicateWarningDialog, and PhotoLightbox uses the Plan-01 /api-relative URLs only (same-origin proxy); the lightbox download uses `downloadBlob(photo.url, ...)` where `photo.url` is likewise /api-relative. T-07-SC — zero new installs. No new security-relevant surface beyond the register.

## Scope Confirmation

Files changed are confined to plan territory (`src/features/items/components/Photo*`, `DuplicateWarningDialog`, `CaptionDialog`, `src/features/items/hooks/usePhotoMutations`). No items list/hooks/routes/Sidebar (07-03 territory), no STATE.md, ROADMAP.md, vite.config.ts, or shared atoms/api touched.

## Commits

- `1c7ff693` feat(07-04): PhotoUpload pipeline + dup-warning dialog + usePhotoMutations
- `f0220e75` feat(07-04): PhotoGallery + CaptionDialog (primary, delete, reorder, bulk, zip)
- `241c48ad` feat(07-04): PhotoLightbox (modal-stack ESC, arrow/zoom nav, AA panel chrome)

## Self-Check: PASSED
