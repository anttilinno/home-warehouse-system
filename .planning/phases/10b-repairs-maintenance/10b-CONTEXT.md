# Phase 10b — Repairs + Maintenance — CONTEXT

**Goal:** Repair log (CRUD + start/complete + cost rollup + photos + non-photo attachments) on
an inventory entry, and recurring maintenance schedules (CRUD + `/maintenance/due` list +
complete-advances-next-due), plus a due-maintenance feed hook the Phase-13 dashboard consumes.

**Requirements:** RPR-01..04, MNT-01..03. **Depends on:** Phase 7b (inventory). **UI phase:** yes.
**Plans (roadmap):** TBD — large; expect 4-5 plans.

## What already exists (REUSE)
- Inventory is LIST + per-row DRAWERS. `frontend2/src/features/inventory/InventoryListPage.tsx`
  opens `MovementsDrawer` from a per-row `↧` action (see line 517 + the drawer at
  `features/inventory/components/MovementsDrawer.tsx`). The repair-log + maintenance UIs follow
  this SAME per-row-drawer pattern. **InventoryListPage.tsx is a shared shipped file → single
  writer / serialize when a plan adds the new row actions.**
- Photo atoms (Phase 7, ITEM-scoped): `features/items/components/{PhotoUpload,PhotoGallery,
  PhotoLightbox}.tsx`, `hooks/usePhotoMutations.ts`, `lib/api/photos.ts` (hardwired to
  `/items/{itemId}/photos`). RPR-03 reuses the ATOMS but must point at `/repairs/{id}/photos`
  → needs a repair-photos api + likely an injectable-endpoint or a thin wrapper (OQ2).
- No frontend attachment component exists → RPR-04 is net-new (OQ3).
- Mirror RHF+zod form/dialog patterns (InventoryFormPage, taxonomy dialogs), RetroTable,
  RetroBadge, RetroConfirmDialog, retroToast, HttpError mapping, the drawer shell from MovementsDrawer.

## Backend surface (verified 2026-06-13, all under `/workspaces/{wsId}`)
### Repair log (`repairlog/handler.go`)
- `GET /repairs` (list), `GET /repairs/{id}`, `POST /repairs`, `PATCH /repairs/{id}`,
  `POST /repairs/{id}/start`, `POST /repairs/{id}/complete` (body `new_condition?` → sets the
  inventory condition), `DELETE /repairs/{id}`,
  `GET /inventory/{inventory_id}/repairs` (per-entry list),
  `GET /inventory/{inventory_id}/repair-cost` → `{ items: [{ total_cost_cents, repair_count }] }`
  (RPR-02 rollup — note it returns a LIST of summaries; confirm grouping in research).
- Create body: `inventory_id`, `description` (req), `repair_date?`, `cost?` (CENTS, int),
  `service_provider?`, `is_warranty_claim?`, `reminder_date?`. Response carries `status`
  (lifecycle: created → start → complete), `completed_at?`.
### Repair photos (`repairphoto/handler.go`)
- `GET /repairs/{repair_log_id}/photos/list`, `GET .../photos/{id}`,
  `PUT .../photos/{id}/caption`, `DELETE .../photos/{id}` (+ a create/upload — confirm the
  upload mechanism: raw multipart vs file_id — OQ2).
### Repair attachments (`repairattachment/handler.go`)
- `GET /repairs/{repairLogId}/attachments`, `POST .../attachments` (body `file_id` +
  `attachment_type` + `title` — so a FILE must be uploaded FIRST to get a file_id, THEN linked;
  find the file-upload endpoint + any frontend uploader — OQ3), `DELETE .../attachments/{attachmentId}`.
### Maintenance (`maintenance/handler.go`)
- `GET /maintenance` (list), `GET /maintenance/due` → `{ items: [{...,item_name,is_overdue}] }`
  (MNT-02 due list + the MNT-03 dashboard feed source), `GET /maintenance/{id}`,
  `POST /maintenance` (body `title` req, `notes?`, `interval_days` ≥1, `next_due`),
  `PATCH /maintenance/{id}`, `POST /maintenance/{id}/complete` (body `notes?` — completion
  ADVANCES next_due AND records a repair-log/note), `DELETE /maintenance/{id}`,
  `GET /inventory/{inventory_id}/maintenance` (per-entry schedules).
- Schedule response: `title, notes?, interval_days, next_due (YYYY-MM-DD), last_completed_at?`.

## Binding constraints / carry-forward
1. `limit` caps 100; per-endpoint envelope (some bare `{items}`, some paginated) — confirm each.
2. Costs are in CENTS (int) — format to currency in the UI; never send floats.
3. Overdue = server `is_overdue` flag on due-list rows (NEVER client date math — the loans lesson).
4. Render-loop guard; query-key prefixes `["repairs"|"maintenance", wsId, ...]` (+ per-inventory
   sub-keys like `["repairs", wsId, "by-inventory", invId]`).
5. routes/index.tsx single-writer/serialize (the `/maintenance/due` route); InventoryListPage.tsx
   single-writer (the new per-row repair/maintenance drawer triggers).
6. Declare EVERY edited file (incl. InventoryListPage callsite). Same-wave plans disjoint files.
7. complete-repair can set inventory condition → invalidate inventory caches too.

## Open Questions (RESOLVED — phase-researcher + ui-researcher + orchestrator, 2026-06-13)
- **OQ1 → per-row RetroDialog drawers on InventoryListPage** (mirror MovementsDrawer; NO inventory
  detail page — rows navigate to /items/:id). InventoryListPage.tsx is the single-writer for the
  two new row-action triggers (repairs + maintenance). Photos/attachments nest INSIDE the repair
  drawer, per repair record.
- **OQ2 repair photos → repair-photo upload is real multipart field `"photo"`** (Chi route
  `POST /repairs/{repair_log_id}/photos`, mirrors itemphoto; serve/thumbnail routes exist). Build a
  repair-scoped photos api + hook; REUSE PhotoUpload/PhotoGallery via parametrization OR a thin fork
  (planner's call — they hardwire photosApi + need a `photo_type` BEFORE/DURING/AFTER field). RPR-03
  is fully functional.
- **OQ3 attachments → LINK-ONLY (backend byte-storage is a project-wide STUB).** The only
  "upload" (`POST /items/{item_id}/attachments/upload`) is a huma JSON metadata-registration that
  creates a `files` row but does NOT store bytes (`// In production: handle actual file upload`).
  repair-attachment create links a `file_id` (`POST /repairs/{repairLogId}/attachments
  {file_id, attachment_type, title}`); list + delete exist. **DECISION:** ship RPR-04 as
  list + delete + an "add" that registers file metadata + links (to the real endpoint); do NOT
  build a file-storage backend this phase — byte upload/serve is a pre-existing cross-cutting
  backend stub (relates to the Phase-14b attachment work + audit IDOR). LOG it as a residue.
- **OQ4 → `POST /maintenance/{id}/complete` advances next_due by interval_days AND writes a
  repair-log row transactionally** (maintenance/service.go:187-211); UI just calls + invalidates
  both maintenance and repairs caches.
- **OQ5 cost rollup → `/inventory/{id}/repair-cost` returns a LIST grouped by `currency_code`**
  (never sum across currencies). RPR-02 displays per-currency totals (usually one). cents→currency
  via a NEW `lib/utils/money.ts` (no money util exists).
- **OQ6 status lifecycle → `PENDING → IN_PROGRESS → COMPLETED`** (repairlog/entity.go:17-21).
  Pill: Pending / In progress / Completed (server-flag discipline like loanStatus). EDIT/START/
  COMPLETE hidden on COMPLETED rows (backend rejects edits to completed).
- **OQ7 MNT-03 → just ship `useMaintenanceDue` + `/maintenance/due` now**; Phase 13 mounts the
  dashboard card. No dashboard work here.
- **OQ8 routes/nav → `/maintenance/due` standalone route + Sidebar entry**; schedules otherwise
  per-inventory drawers. routes/index.tsx + Sidebar.tsx single-writer (one plan owns them).

## Original Open Questions (now resolved above)
- OQ1 **Drawer mount**: confirm repair-log + maintenance are per-row drawers on InventoryListPage
  (mirror MovementsDrawer) vs a new inventory detail page. Specify the InventoryListPage edit
  (new row actions) and keep it single-writer. Where does the repair-PHOTOS/attachments UI live
  (nested in the repair drawer, per repair record)?
- OQ2 **Repair photos**: the `POST /repairs/{id}/photos` upload mechanism (raw multipart vs
  file_id)? Can `PhotoUpload`/`PhotoGallery`/`usePhotoMutations` be REUSED via endpoint injection,
  or do they hardwire `photosApi`? Define the minimal repair-photos api + reuse strategy.
- OQ3 **Attachments**: find the file-upload endpoint that yields a `file_id`, and whether any
  frontend uploader exists. Design the RPR-04 attachment component (upload file → link via
  `POST /repairs/{id}/attachments {file_id, attachment_type, title}` → list → delete).
- OQ4 **Maintenance complete**: confirm `POST /maintenance/{id}/complete` advances `next_due` by
  `interval_days` server-side and the `notes` behavior; the UI just calls it + invalidates.
- OQ5 **Cost rollup**: why does `/inventory/{id}/repair-cost` return a LIST of summaries? What is
  each summary grouped by? Define the RPR-02 display (single total vs per-group).
- OQ6 **Repair status lifecycle**: the exact statuses (created/in-progress/completed?) from
  start/complete, and the status-pill mapping (reuse loanStatus-style server-flag discipline).
- OQ7 **MNT-03 dashboard feed**: is this just shipping the `useMaintenanceDue` query hook +
  `/maintenance/due` page now, with Phase 13 mounting the card? (Likely yes — no dashboard work here.)
- OQ8 **routes**: `/maintenance` and/or `/maintenance/due` standalone routes + sidebar entry?
  Or maintenance only as per-inventory drawers + a due page? Resolve the route/nav surface.
