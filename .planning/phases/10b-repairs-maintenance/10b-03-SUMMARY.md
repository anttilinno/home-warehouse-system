---
phase: 10b-repairs-maintenance
plan: 03
subsystem: repairs-ui
tags: [repairs, photos, attachments, react-query, retro-tabs, retro-dialog, data-seam, link-only]

# Dependency graph
requires:
  - phase: 10b-repairs-maintenance
    plan: 01
    provides: repairPhotosApi / repairAttachmentsApi / RepairPhoto+RepairAttachment+AttachmentType+RepairPhotoType types / repairHandlers MSW
  - phase: 10b-repairs-maintenance
    plan: 02
    provides: RepairsDrawer + the onOpenRecord PHOTOS/FILES seam wired here
  - phase: 07-photos
    provides: PhotoUpload + PhotoGallery + usePhotoMutations atoms parametrized here via a data seam
provides:
  - PhotoUpload/PhotoGallery DATA SEAM (injectable mutations/checkDuplicate/uploadVars/extraFields + capability gates) — item callsites unchanged
  - useRepairPhotoMutations (upload+caption+del; keyed [repairs,wsId,repairId,photos])
  - useRepairAttachments (list+create+delete; keyed [repairs,wsId,repairId,attachments])
  - RepairPhotoPanel (PHOTOS tab — reused atoms via the repair api/hook + BEFORE/DURING/AFTER select)
  - RepairAttachmentPanel + AddAttachmentDialog (FILES tab — link-only attachments)
  - RepairRecordDialog (RECORD/PHOTOS/FILES RetroTabs sub-view)
  - RepairsDrawer PHOTOS/FILES wiring (opens the record sub-view internally)
affects: [10b-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "single-writer data seam on shared atoms: optional injected mutations/api + capability gates; defaults preserve the item visual+behavioral contract exactly"
    - "repair-scoped query keys nested under the [repairs, wsId] prefix: photos=[…,repairId,photos], attachments=[…,repairId,attachments]"
    - "two-step link-only attachment: mint file_id via the metadata-only item upload endpoint (NO bytes stored) → link {file_id, attachment_type, title}"
    - "owning item_id resolved in the drawer from the inventory cache (prop override or [inventory,wsId] scan) — no InventoryListPage edit needed"

key-files:
  created:
    - frontend2/src/features/repairs/hooks/useRepairPhotoMutations.ts
    - frontend2/src/features/repairs/hooks/useRepairAttachments.ts
    - frontend2/src/features/repairs/hooks/useRepairAttachments.test.tsx
    - frontend2/src/features/repairs/components/RepairPhotoPanel.tsx
    - frontend2/src/features/repairs/components/RepairAttachmentPanel.tsx
    - frontend2/src/features/repairs/components/RepairAttachmentPanel.test.tsx
    - frontend2/src/features/repairs/components/AddAttachmentDialog.tsx
    - frontend2/src/features/repairs/components/RepairRecordDialog.tsx
  modified:
    - frontend2/src/features/items/components/PhotoUpload.tsx
    - frontend2/src/features/items/components/PhotoGallery.tsx
    - frontend2/src/features/repairs/components/RepairsDrawer.tsx

key-decisions:
  - "PhotoUpload/PhotoGallery seam = optional injected data props (mutations/checkDuplicate/uploadVars/extraFields/uploadDisabled + canSetPrimary/canReorder/canBulk/canDownloadZip). When NONE are supplied the atoms behave EXACTLY as the shipped item versions (guarded by 96 unchanged item tests)."
  - "RepairPhotoPanel renders its own BEFORE/DURING/AFTER select (threaded through PhotoUpload's extraFields + uploadVars) rather than baking photo_type into the shared atom — keeps item JSX clean."
  - "Repair photos drop dup-check/set-primary/reorder/bulk/zip (F2 — those backend routes don't exist); the gallery degrades to a caption+delete grid via capability gates."
  - "RepairsDrawer wires the record sub-view INTERNALLY (RepairRecordDialog) instead of requiring a parent onOpenRecord callback; the 10b-02 onOpenRecord prop is kept as an optional notification only."
  - "Owning item_id (needed to mint a file_id) is resolved inside the drawer from the inventory cache, avoiding an InventoryListPage edit (forbidden / 10b-04-owned)."

patterns-established:
  - "Capability-gated shared atoms: feature-flag the heavy item-only affordances off for a leaner reuse scope without forking the component."

requirements-completed: [RPR-03, RPR-04]

# Metrics
duration: ~9min
completed: 2026-06-13
---

# Phase 10b Plan 03: Repair Photos + Attachments Summary

**RPR-03 + RPR-04: a per-repair-record RECORD/PHOTOS/FILES sub-view opened from the repair drawer. PHOTOS reuses the shipped PhotoUpload/PhotoGallery atoms through a new injectable data seam (real multipart upload, required BEFORE/DURING/AFTER photo_type) with item callsites untouched; FILES is a net-new link-only attachment panel (mint file_id → link {file_id, attachment_type, title}) — no byte storage built (pre-existing backend stub, logged below).**

## Performance
- **Duration:** ~9 min
- **Tasks:** 3 (Task 2 via TDD)
- **Files created:** 8
- **Files modified:** 3 (2 shared atoms via the seam + RepairsDrawer wiring)

## Accomplishments
- **Data seam on PhotoUpload + PhotoGallery (single-writer):** optional injected `mutations` / `checkDuplicate` / `uploadVars` / `extraFields` / `uploadDisabled` (upload) and `mutations` + `canSetPrimary/canReorder/canBulk/canDownloadZip` capability gates (gallery). Defaults reproduce the item behavior byte-for-byte — all 96 item tests stay green.
- **useRepairPhotoMutations** — upload/caption/del shaped like usePhotoMutations, keyed `["repairs", wsId, repairId, "photos"]`, real multipart with a REQUIRED photo_type (narrowed to BEFORE/DURING/AFTER in the mutationFn).
- **RepairPhotoPanel** — composes the parametrized atoms with the repair api/hook; renders the ADD PHOTOS dialog + a BEFORE/DURING/AFTER stage select; gallery degrades to caption+delete (no dup/primary/reorder/bulk/zip).
- **useRepairAttachments** — list/create/delete keyed `["repairs", wsId, repairId, "attachments"]`, invalidating on settle (TDD: 3 hook tests).
- **AddAttachmentDialog** — two-step: pick file → JSON-POST `/items/{itemId}/attachments/upload` to mint a file_id (metadata-only, NO bytes) → link `{file_id, attachment_type, title}`; per-file mint status (✓ DONE / ✕ FAILED + RETRY); 404/400 link errors surface a contextual toast.
- **RepairAttachmentPanel** — typed badge rows (MANUAL info / RECEIPT ok / WARRANTY warn / OTHER neutral / PHOTO info) + title/file_name fallback + mono mime + pink-confirm DELETE; NO FILES empty state; ⊕ ADD FILE (TDD: 3 panel tests). Rows are display-only (no blob serve route confirmed, F1).
- **RepairRecordDialog** — blue RetroDialog `REPAIR — {description}` with a RetroTabs RECORD/PHOTOS/FILES strip (active folder = blue accent); RECORD is a read-only summary (description, status pill, formatCents cost, dates, provider, warranty, notes).
- **RepairsDrawer wiring** — PHOTOS/FILES buttons open the record sub-view on the matching tab; owning item_id resolved from the inventory cache. Drawer export + per-row action cluster unchanged.

## Task Commits
1. **Task 1: PhotoUpload/PhotoGallery seam + repair photo hook + PHOTOS panel** — `33599c09` (feat)
2. **Task 2: attachments hook + AddAttachmentDialog + RepairAttachmentPanel (TDD)** — `ff98736a` (feat; RED→GREEN, 3 hook + 3 panel tests)
3. **Task 3: RepairRecordDialog (tabs) + RepairsDrawer wiring** — `cee7c8de` (feat)

## Residues (for the gate)

### RPR-04 byte-storage backend stub (pre-existing, project-wide)
There is **no byte-ingesting file-upload endpoint** in the backend (verified in 10b-RESEARCH OQ3, exhaustive grep). The only file-creating route, `POST /items/{item_id}/attachments/upload`, is **JSON-metadata-only**: it records a `File` DB row (synthesizing a placeholder storage key `uploads/{ws}/{item}/{uuid}`) and returns its `file_id`, but **stores no actual bytes**. RPR-04 is therefore implemented **link-only** by design (override #6): the dialog mints a file_id from that metadata endpoint and links it; the uploaded bytes are NOT persisted or servable. Consequences:
- Attachment rows are **display-only** — there is no blob serve route to open the file (F1).
- A true "upload a real PDF receipt and re-download it" flow requires a NEW backend multipart files endpoint that stores bytes. That is backend work, **out of scope** for this frontend parity phase. Relates to Phase 14b + the full-audit cross-tenant attachment IDOR finding.
- **No byte-storage path exists in the shipped frontend code** — verified: only metadata POST + link/list/delete.

## Deviations from Plan
None of substance. Two implementation details worth recording:

**1. [Rule 3 - Blocking] `tsc -b` strictness on the seam contract**
- **Found during:** Task 3 (`bun run lint:tsc`, the project `tsc -b --noEmit` which is stricter than `bunx tsc --noEmit`).
- **Issue 1:** PhotoGallery's `deleteTarget`/`captionTarget` state was still typed `Photo | null` but `order` is now the looser `GalleryPhoto[]`.
- **Issue 2:** the injected `upload.mutateAsync` is contravariant — the shared `PhotoUploadMutations` interface offers `photoType?: string`, but the repair hook required the narrow `RepairPhotoType`, so the hook was not assignable to the seam.
- **Fix:** typed both gallery target states as `GalleryPhoto | null` (and dropped the now-unused `Photo` import); widened `RepairPhotoUploadVars.photoType` to `string`, narrowing/validating it to a `RepairPhotoType` (default BEFORE) inside the mutationFn.
- **Files modified:** PhotoGallery.tsx, useRepairPhotoMutations.ts
- **Commit:** `cee7c8de`

**2. [Plan latitude] RepairAttachmentPanel.test "ADD FILE opens dialog" assertion**
- The dialog title, footer button, and the panel CTA all render the text "ADD FILE" (collision). Asserted dialog open via the RetroSelect `Type *` label (associated via htmlFor) + the `File *` field text instead of `getByText("ADD FILE")`. Test-only; no production change.

All 11 edited files are within the plan's `files_modified` allow-list. No forbidden files touched (STATE/ROADMAP/api/vite/backend/routes/Sidebar/InventoryListPage/maintenance/MaintenanceDuePage all untouched).

## Issues Encountered
The shared-atom seam had to thread a contravariant mutation type and a structurally-divergent photo shape (RepairPhoto has no is_primary/filename/display_order). Resolved with a normalized `GalleryPhoto` shape (Photo satisfies it; RepairPhoto adapts via `toGalleryPhoto`) + capability gates rather than forking the components — avoiding JSX drift (UI-SPEC §3 preference).

## Verification Results
- `bun run lint:tsc` (`tsc -b --noEmit`) → exit 0, clean
- `bun run test src/features/items src/features/repairs` → **17 files, 125 tests passed** (96 item — unchanged after the seam — + 29 repairs incl. 6 new attachment tests)
- Item-photo behavior unchanged after the seam (all 96 item tests green, no callsite edits)
- Attachments are link-only; grep confirms no byte-storage path in shipped code

## Self-Check: PASSED
All 8 created files exist on disk; 3 files modified. All 3 task commits (33599c09, ff98736a, cee7c8de) present in `exec/10b-03` history.

---
*Phase: 10b-repairs-maintenance*
*Completed: 2026-06-13*
