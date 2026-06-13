---
phase: 10b-repairs-maintenance
plan: 03
type: execute
wave: 3
depends_on: [10b-02]
files_modified:
  - frontend2/src/features/repairs/hooks/useRepairPhotoMutations.ts
  - frontend2/src/features/repairs/hooks/useRepairAttachments.ts
  - frontend2/src/features/repairs/hooks/useRepairAttachments.test.tsx
  - frontend2/src/features/repairs/components/RepairRecordDialog.tsx
  - frontend2/src/features/repairs/components/RepairAttachmentPanel.tsx
  - frontend2/src/features/repairs/components/RepairAttachmentPanel.test.tsx
  - frontend2/src/features/repairs/components/AddAttachmentDialog.tsx
  - frontend2/src/features/repairs/components/RepairPhotoPanel.tsx
  - frontend2/src/features/items/components/PhotoUpload.tsx
  - frontend2/src/features/items/components/PhotoGallery.tsx
  - frontend2/src/features/repairs/components/RepairsDrawer.tsx
otmf_note: "PhotoUpload.tsx + PhotoGallery.tsx are SINGLE-WRITER shared files — this plan parametrizes their data seam (api+mutations props) WITHOUT changing their visual contract. RepairsDrawer.tsx is also edited here (wiring the PHOTOS/FILES sub-view seam left by Plan 10b-02) — serial after W2, sole W3 writer. Disjoint from Plan 10b-04 (which owns InventoryListPage/routes/Sidebar/maintenance)."
autonomous: true
requirements: [RPR-03, RPR-04]
must_haves:
  truths:
    - "Each repair record opens a sub-view (RetroTabs RECORD/PHOTOS/FILES) from the drawer"
    - "User can upload (real multipart, field photo + photo_type BEFORE/DURING/AFTER), list, and delete repair photos"
    - "User can list, add-link (file_id), and delete non-photo attachments — link-only, no byte storage built"
    - "PhotoUpload/PhotoGallery are reused for repair photos via a data-seam, with item photos unchanged"
  artifacts:
    - path: "frontend2/src/features/repairs/components/RepairRecordDialog.tsx"
      provides: "blue RetroDialog with RetroTabs RECORD/PHOTOS/FILES per repair record"
      contains: "RepairRecordDialog"
    - path: "frontend2/src/features/repairs/components/RepairPhotoPanel.tsx"
      provides: "PHOTOS tab reusing PhotoUpload/PhotoGallery via repair-scoped api+mutations"
      contains: "RepairPhotoPanel"
    - path: "frontend2/src/features/repairs/components/RepairAttachmentPanel.tsx"
      provides: "FILES tab: link/list/delete attachments (net-new)"
      contains: "RepairAttachmentPanel"
    - path: "frontend2/src/features/repairs/components/AddAttachmentDialog.tsx"
      provides: "blue dialog: pick file → mint file_id → link via repairAttachmentsApi.create"
      contains: "AddAttachmentDialog"
    - path: "frontend2/src/features/repairs/hooks/useRepairPhotoMutations.ts"
      provides: "usePhotoMutations-shaped hook keyed [repairs,wsId,repairId,photos]"
      contains: "useRepairPhotoMutations"
  key_links:
    - from: "frontend2/src/features/repairs/components/RepairPhotoPanel.tsx"
      to: "PhotoUpload/PhotoGallery via data-seam props (repairPhotosApi + useRepairPhotoMutations)"
      via: "parametrized api/mutations props (NOT hardwired photosApi)"
      pattern: "repairPhotosApi|useRepairPhotoMutations"
    - from: "frontend2/src/features/repairs/components/RepairsDrawer.tsx"
      to: "RepairRecordDialog (PHOTOS/FILES action wired)"
      via: "PHOTOS (n) / FILES (n) buttons open RepairRecordDialog on a chosen tab"
      pattern: "RepairRecordDialog"
    - from: "frontend2/src/features/repairs/components/AddAttachmentDialog.tsx"
      to: "repairAttachmentsApi.create (file_id link)"
      via: "two-step: items attachments upload → file_id → repairAttachmentsApi.create"
      pattern: "repairAttachmentsApi"
---

<objective>
RPR-03 (repair photos) + RPR-04 (non-photo attachments). A per-repair-record sub-view (RetroTabs RECORD/PHOTOS/FILES) opened from the repair drawer. PHOTOS reuses the shipped PhotoUpload/PhotoGallery via a parametrized data seam pointed at the repair-scoped api/hook (real multipart, field "photo" + required photo_type). FILES is a net-new link-only attachment panel (list/add-link/delete) — NO file-storage backend is built (the byte-storage endpoint is a project-wide stub; logged as a residue).

Purpose: Completes the repair drawer's heavy media UI without bloating the record list. Honors override #5 (real multipart photo upload, parametrize the atoms) and #6 (attachments link-only, log the byte-stub residue).
Output: photo + attachment hooks, RepairRecordDialog (tabs), RepairPhotoPanel, RepairAttachmentPanel, AddAttachmentDialog, the PhotoUpload/PhotoGallery seam, and the RepairsDrawer PHOTOS/FILES wiring.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/10b-repairs-maintenance/10b-RESEARCH.md
@.planning/phases/10b-repairs-maintenance/10b-UI-SPEC.md
@.planning/phases/10b-repairs-maintenance/10b-01-SUMMARY.md
@.planning/phases/10b-repairs-maintenance/10b-02-SUMMARY.md

# Templates to mirror / parametrize EXACTLY:
@frontend2/src/features/items/components/PhotoUpload.tsx
@frontend2/src/features/items/components/PhotoGallery.tsx
@frontend2/src/features/items/hooks/usePhotoMutations.ts
@frontend2/src/lib/api/photos.ts

<interfaces>
<!-- From 10b-01 + 10b-02. Import, do not re-derive. -->
repairPhotosApi (lib/api/repairPhotos.ts): list, upload(ws,repairId,file,photoType,caption?), updateCaption, del
repairAttachmentsApi (lib/api/repairAttachments.ts): list, create({file_id,attachment_type,title?}), del
Types: RepairPhoto, RepairPhotoType ("BEFORE"|"DURING"|"AFTER"), RepairAttachment, AttachmentType
RepairsDrawer (10b-02) left a PHOTOS(n)/FILES(n) seam per record-row — wire it here.

Query keys (LOCKED): photos ["repairs", wsId, repairId, "photos"]; attachments ["repairs", wsId, repairId, "attachments"].

file_id source for RPR-04 (OQ3): POST /items/{item_id}/attachments/upload (multipart) mints a File row + id.
  The bytes are NOT stored (backend stub) — this is link-only. The repair's owning item_id is resolvable
  in the drawer (entry.item_id). LOG the byte-storage stub as a residue in the SUMMARY.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: parametrize PhotoUpload/PhotoGallery + repair-photo hook + PHOTOS tab</name>
  <files>frontend2/src/features/items/components/PhotoUpload.tsx, frontend2/src/features/items/components/PhotoGallery.tsx, frontend2/src/features/repairs/hooks/useRepairPhotoMutations.ts, frontend2/src/features/repairs/components/RepairPhotoPanel.tsx</files>
  <action>
    SINGLE-WRITER seam on PhotoUpload.tsx + PhotoGallery.tsx: add an OPTIONAL data-seam so they can use a repair-scoped api+mutations instead of the hardwired photosApi/usePhotoMutations, WITHOUT changing their visual contract or breaking item-photo callers. Cleanest seam (OQ2 R6): accept optional props `api?` + `mutations?` (or a `scope` discriminator) that default to the existing items photosApi/usePhotoMutations(wsId,itemId); when provided, the components call the injected api/mutations. Keep all JSX/markup identical. Verify existing ItemDetail photo tests still pass (no behavior change for items).
    For repair photos add `photo_type` support: the upload path must append "photo_type" (BEFORE/DURING/AFTER — REQUIRED, Pitfall 1). Surface a BEFORE/DURING/AFTER select in the upload flow when in repair scope (RepairPhotoPanel owns the select if cleaner than threading it through PhotoUpload — planner's call; if the seam is too invasive, RepairPhotoPanel may render its own thin upload zone reusing PhotoUpload's per-file status idiom, but PREFER parametrization to avoid JSX drift — UI-SPEC §3).
    useRepairPhotoMutations.ts: mirror usePhotoMutations shape; invalidate ["repairs", wsId, repairId, "photos"]; wrap repairPhotosApi (upload/updateCaption/del); retroToast.error on failure.
    RepairPhotoPanel.tsx: compose the (now parametrized) PhotoUpload + PhotoGallery with repairPhotosApi + useRepairPhotoMutations(wsId, repairId). Empty → the gallery's own "No photos yet." Only wire list/upload/caption/delete (no set-primary/reorder/bulk — F2; degrade gracefully).
  </action>
  <verify>
    <automated>cd frontend2 && bunx tsc --noEmit && bun run test src/features/items 2>&1 | tail -5 && bun run test src/features/repairs 2>&1 | tail -5</automated>
  </verify>
  <done>tsc clean; existing item-photo tests still green (no visual/behavioral change for items); RepairPhotoPanel composes the parametrized atoms with the repair api/hook; photo_type is sent on upload.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: attachments — hook + AddAttachmentDialog + RepairAttachmentPanel (link-only)</name>
  <files>frontend2/src/features/repairs/hooks/useRepairAttachments.ts, frontend2/src/features/repairs/hooks/useRepairAttachments.test.tsx, frontend2/src/features/repairs/components/RepairAttachmentPanel.tsx, frontend2/src/features/repairs/components/RepairAttachmentPanel.test.tsx, frontend2/src/features/repairs/components/AddAttachmentDialog.tsx</files>
  <behavior>
    useRepairAttachments.test.tsx (server.use(...repairHandlers)):
    - list query keyed ["repairs", wsId, repairId, "attachments"] returns rows
    - createAttachment links a file_id and invalidates the attachments key
    - deleteAttachment removes a row and invalidates
    RepairAttachmentPanel.test.tsx:
    - renders attachment rows (type badge + title/file_name fallback + mime) with a DELETE action
    - empty fixture → "NO FILES" empty state
    - ADD FILE opens AddAttachmentDialog
  </behavior>
  <action>
    useRepairAttachments.ts: list query (keyed above) + createAttachment + deleteAttachment mutations wrapping repairAttachmentsApi, invalidating the attachments key; retroToast.error on failure.
    AddAttachmentDialog.tsx: blue RetroDialog (UI-SPEC §3 FILES + copywriting). Two-step (OQ3 link-only): (1) File RetroFileInput (required) → on pick POST /items/{item_id}/attachments/upload (multipart) to MINT a file_id (item_id = the repair's owning item, passed in). Show inline ✓ DONE / ✕ FAILED + RETRY using PhotoUpload's per-file status idiom. (2) Type RetroSelect (MANUAL/RECEIPT/WARRANTY/OTHER, default MANUAL). (3) Title optional (defaults to file name). Footer CANCEL + ADD FILE (disabled until file uploaded + type chosen). Submit → repairAttachmentsApi.create({file_id, attachment_type, title?}). On link error (404 file / 400 cross-workspace) retroToast.error "Couldn't attach this file. {reason}". Success → invalidate attachments key, close, toast "DONE · File attached." DO NOT build any byte-storage path — the upload endpoint is a metadata-only stub (log residue in SUMMARY).
    RepairAttachmentPanel.tsx: bg-bg-panel-2 list of attachment rows — RetroBadge of attachment_type (MANUAL info / RECEIPT ok / WARRANTY warn / OTHER neutral / PHOTO info) + title (or file_name fallback) + mono file_mime_type + DELETE (pink confirm). `⊕ ADD FILE` opens AddAttachmentDialog. Empty → RetroEmptyState NO FILES (UI-SPEC copy). If a file blob serve route is unconfirmed (F1), rows are display-only (no open affordance) — layout unchanged.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/repairs/hooks/useRepairAttachments.test.tsx src/features/repairs/components/RepairAttachmentPanel.test.tsx</automated>
  </verify>
  <done>Attachment hook + panel tests green; add-link/list/delete work against the real endpoints; NO file-storage backend built; residue noted for the gate.</done>
</task>

<task type="auto">
  <name>Task 3: RepairRecordDialog (tabs) + wire PHOTOS/FILES into RepairsDrawer</name>
  <files>frontend2/src/features/repairs/components/RepairRecordDialog.tsx, frontend2/src/features/repairs/components/RepairsDrawer.tsx</files>
  <action>
    RepairRecordDialog.tsx: blue RetroDialog titled `REPAIR — {description}` with a RetroTabs strip RECORD / PHOTOS / FILES (UI-SPEC §3). RECORD = read-only repair summary (description, status pill, cost via formatCents, dates, warranty, service provider). PHOTOS = <RepairPhotoPanel repairId={...}>. FILES = <RepairAttachmentPanel repairId={...}>. Opens on whichever tab the user clicked (PHOTOS vs FILES). Active tab folder = blue (the reserved accent). Nests correctly over the drawer via the Phase 3 modal stack.
    RepairsDrawer.tsx (serial W3 edit — sole W3 writer): wire the PHOTOS (n) / FILES (n) buttons left as a seam by Plan 10b-02 so each opens RepairRecordDialog on the matching tab for that repair record. Photo/file counts in the labels: read from each repair's photo/attachment counts if the list response carries them, else fetch lazily / show no count (do not block the list render). Keep the rest of the drawer unchanged.
  </action>
  <verify>
    <automated>cd frontend2 && bunx tsc --noEmit && bun run test src/features/repairs 2>&1 | tail -8</automated>
  </verify>
  <done>tsc clean; full repairs suite green; PHOTOS/FILES open RepairRecordDialog on the right tab; RECORD/PHOTOS/FILES render their panels.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → backend (multipart photo upload) | untrusted image bytes cross here |
| browser → backend (attachment link) | file_id + type cross here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-05 | Tampering | malicious upload (XSS via served image) | accept | backend serves with CSP default-src 'none' + Content-Disposition (repairphoto/handler.go); frontend may pre-validate type/size for UX, server authoritative |
| T-10b-06 | DoS | oversized photo upload | mitigate | backend 10MB cap (V12); frontend pre-validates size for UX before postMultipart |
| T-10b-07 | Information disclosure | cross-workspace file link | accept | backend rejects cross-workspace file_id with 400 (repairattachment/handler.go:62); UI surfaces the error toast |
| T-10b-SC | Tampering | npm/pip/cargo installs | mitigate | none — no packages installed (RESEARCH audit: nothing to vet) |
</threat_model>

<verification>
- tsc clean; full `bun run test src/features/repairs` + `src/features/items` green.
- Item-photo behavior unchanged after the seam (existing item tests green).
- Attachments are link-only; no byte-storage path exists in shipped code.
</verification>

<success_criteria>
- RPR-03: upload (multipart photo + photo_type), list, delete repair photos via the reused atoms.
- RPR-04: list + add-link + delete attachments against the real endpoints (link-only).
- RECORD/PHOTOS/FILES sub-view opens per repair record from the drawer.
- RESIDUE logged: attachment byte upload/serve is a pre-existing project-wide backend stub (relates to Phase 14b + audit IDOR); no file storage built this phase.
</success_criteria>

<output>
Create `.planning/phases/10b-repairs-maintenance/10b-03-SUMMARY.md` when done. Record the attachment byte-storage stub as a residue for the orchestrator to log at the gate.
</output>
