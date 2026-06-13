---
phase: 10b-repairs-maintenance
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend2/src/lib/types.ts
  - frontend2/src/lib/utils/money.ts
  - frontend2/src/lib/utils/money.test.ts
  - frontend2/src/lib/api/repairs.ts
  - frontend2/src/lib/api/maintenance.ts
  - frontend2/src/lib/api/repairPhotos.ts
  - frontend2/src/lib/api/repairAttachments.ts
  - frontend2/src/features/repairs/repairStatus.ts
  - frontend2/src/features/repairs/repairStatus.test.ts
  - frontend2/src/features/repairs/schema.ts
  - frontend2/src/features/maintenance/schema.ts
  - frontend2/src/test/msw/repairHandlers.ts
  - frontend2/src/test/msw/maintenanceHandlers.ts
autonomous: true
requirements: [RPR-01, RPR-02, RPR-03, RPR-04, MNT-01, MNT-02, MNT-03]
must_haves:
  truths:
    - "cents → currency formatting exists as a single shared helper (formatCents)"
    - "repair/maintenance/repairPhotos/repairAttachments api modules call the verified backend routes with BARE {items} envelopes"
    - "repairStatus(status) maps PENDING/IN_PROGRESS/COMPLETED to pill variants by reading only the server status (no date math)"
    - "MSW handlers for repairs + maintenance exist so downstream component tests have HTTP deps"
  artifacts:
    - path: "frontend2/src/lib/utils/money.ts"
      provides: "formatCents(cents, currency?) via Intl.NumberFormat"
      contains: "formatCents"
    - path: "frontend2/src/lib/api/repairs.ts"
      provides: "repairsApi: byInventory, cost, get, create, update, start, complete, del"
      contains: "repairsApi"
    - path: "frontend2/src/lib/api/maintenance.ts"
      provides: "maintenanceApi: list, byInventory, due, get, create, update, complete, del"
      contains: "maintenanceApi"
    - path: "frontend2/src/lib/api/repairPhotos.ts"
      provides: "repairPhotosApi: list, upload (field photo + photo_type), updateCaption, del; toProxyUrl mapper"
      contains: "repairPhotosApi"
    - path: "frontend2/src/lib/api/repairAttachments.ts"
      provides: "repairAttachmentsApi: list, create (file_id link), del"
      contains: "repairAttachmentsApi"
    - path: "frontend2/src/features/repairs/repairStatus.ts"
      provides: "repairStatus() pure helper mirroring loanStatus.ts"
      contains: "repairStatus"
    - path: "frontend2/src/test/msw/repairHandlers.ts"
      provides: "per-test MSW handlers for repair routes"
      contains: "repairHandlers"
    - path: "frontend2/src/test/msw/maintenanceHandlers.ts"
      provides: "per-test MSW handlers for maintenance routes"
      contains: "maintenanceHandlers"
  key_links:
    - from: "frontend2/src/lib/api/repairPhotos.ts"
      to: "lib/api postMultipart + url.toProxyUrl"
      via: "import { postMultipart } from @/lib/api; import { toProxyUrl } from ./url"
      pattern: "postMultipart|toProxyUrl"
    - from: "frontend2/src/lib/api/repairs.ts"
      to: "/workspaces/{ws}/inventory/{id}/repair-cost"
      via: "get<{ items: RepairCostSummary[] }>"
      pattern: "repair-cost"
---

<objective>
Wave-0 foundation for Phase 10b. Create the four api modules (repairs, maintenance, repairPhotos, repairAttachments), the cents→currency util (money.ts), the wire types, the repairStatus server-flag helper, the RHF+zod form schemas, and the per-test MSW handler files — so every Wave-2/3 component plan has its data dependencies and test mocks ready.

Purpose: This phase is ~90% pattern-mirroring (loans.ts / photos.ts / loanStatus.ts / loanHandlers.ts). Shipping the contracts first prevents downstream plans from re-deriving them and lets component tests register MSW per-test.
Output: types, money util (+test), 4 api modules, repairStatus (+test), 2 schemas, 2 MSW handler files.
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
@.planning/phases/10b-repairs-maintenance/10b-CONTEXT.md

# Templates to mirror EXACTLY (read before writing):
@frontend2/src/lib/api/loans.ts
@frontend2/src/lib/api/photos.ts
@frontend2/src/lib/api/url.ts
@frontend2/src/lib/api.ts
@frontend2/src/features/loans/loanStatus.ts
@frontend2/src/features/loans/schema.ts
@frontend2/src/test/msw/loanHandlers.ts

<interfaces>
<!-- Verified backend contracts (10b-RESEARCH.md §Code Examples + OQ2/OQ3/OQ5/OQ6). Use directly. -->

CreateRepairBody (repairlog/handler.go:416-428):
  inventory_id: string (REQUIRED), description: string (REQUIRED, min 1),
  repair_date?: string (RFC3339), cost?: number (CENTS int), currency_code?: string,
  service_provider?: string, notes?: string, is_warranty_claim?: boolean, reminder_date?: string

Repair response: id, workspace_id, inventory_id, status ("PENDING"|"IN_PROGRESS"|"COMPLETED"),
  description, repair_date?, cost?, currency_code?, service_provider?, completed_at?,
  new_condition?, notes?, is_warranty_claim, reminder_date?

RepairCostSummary (GET /inventory/{id}/repair-cost → { items: RepairCostSummary[] }):
  currency_code?: string, total_cost_cents: number, repair_count: number

Repair photo upload: multipart POST /workspaces/{ws}/repairs/{repairId}/photos,
  fields: "photo" (File, REQUIRED), "photo_type" ("BEFORE"|"DURING"|"AFTER", REQUIRED), "caption"? .
  List: GET .../photos/list ; caption: PUT .../photos/{id}/caption ; delete: DELETE .../photos/{id}.
  Response carries absolute url + thumbnail_url → rewrite via toProxyUrl at the mapper boundary.

RepairAttachment (link-only): GET /workspaces/{ws}/repairs/{repairId}/attachments → { items, total };
  POST .../attachments { file_id (uuid REQ), attachment_type ("PHOTO"|"MANUAL"|"RECEIPT"|"WARRANTY"|"OTHER"), title? };
  DELETE .../attachments/{attachmentId}. List rows carry file_name?, file_mime_type?, file_size_bytes?.

CreateScheduleBody (maintenance/handler.go:312-320):
  inventory_id: string (REQ), title: string (REQ, 1..200), notes?: string,
  interval_days: number (REQ, >= 1), next_due: string (date)
Schedule response: id, title, notes?, interval_days, next_due (YYYY-MM-DD), last_completed_at?
Due row (GET /maintenance/due → { items }): schedule fields + item_id, item_name, is_overdue (server flag)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: money.ts util + wire types + repairStatus helper</name>
  <files>frontend2/src/lib/utils/money.ts, frontend2/src/lib/utils/money.test.ts, frontend2/src/lib/types.ts, frontend2/src/features/repairs/repairStatus.ts, frontend2/src/features/repairs/repairStatus.test.ts</files>
  <behavior>
    money.test.ts:
    - formatCents(4250, "EUR") returns a string containing "42.50" and the EUR symbol
    - formatCents(4250, "USD") returns a string containing "42.50" and the USD symbol
    - formatCents(0) returns a zero currency string (default currency "EUR" per A2)
    - formatCents accepts undefined currency and falls back to "EUR"
    repairStatus.test.ts:
    - repairStatus({status:"PENDING"}) → { variant: "info", label: "Pending" }
    - repairStatus({status:"IN_PROGRESS"}) → { variant: "warn", label: "In progress" }
    - repairStatus({status:"COMPLETED"}) → { variant: "ok", label: "Completed" }
  </behavior>
  <action>
    Create lib/utils/money.ts exporting `formatCents(cents: number, currency = "EUR"): string` using `new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)` (per RESEARCH §Code Examples / UI-SPEC §Cents rule; default "EUR" per A2). NEVER produce floats for the API — this is display-only.
    Add wire types to lib/types.ts (append, do not reorder existing exports): `Repair` (status union "PENDING"|"IN_PROGRESS"|"COMPLETED" + all response fields above), `RepairCostSummary`, `RepairPhoto` (id, repair_log_id, photo_type, caption?, url, thumbnail_url, created_at), `RepairPhotoType` = "BEFORE"|"DURING"|"AFTER", `RepairAttachment` (id, repair_log_id, file_id, attachment_type, title?, file_name?, file_mime_type?, file_size_bytes?), `AttachmentType` = "PHOTO"|"MANUAL"|"RECEIPT"|"WARRANTY"|"OTHER", `MaintenanceSchedule` (id, title, notes?, interval_days, next_due, last_completed_at?), `DueSchedule` (MaintenanceSchedule + item_id, item_name, is_overdue).
    Create features/repairs/repairStatus.ts mirroring features/loans/loanStatus.ts EXACTLY (pure fn, no React, reads only server status, no date math): per OQ6 map PENDING→{variant:"info",label:"Pending"}, IN_PROGRESS→{variant:"warn",label:"In progress"}, COMPLETED→{variant:"ok",label:"Completed"}. Variant union must match StatusPill's accepted variants ("info"|"warn"|"ok"|"danger").
  </action>
  <verify>
    <automated>cd frontend2 && bun run test src/lib/utils/money.test.ts src/features/repairs/repairStatus.test.ts</automated>
  </verify>
  <done>money.test.ts + repairStatus.test.ts green; types.ts exports compile (tsc clean).</done>
</task>

<task type="auto">
  <name>Task 2: four api modules (repairs, maintenance, repairPhotos, repairAttachments)</name>
  <files>frontend2/src/lib/api/repairs.ts, frontend2/src/lib/api/maintenance.ts, frontend2/src/lib/api/repairPhotos.ts, frontend2/src/lib/api/repairAttachments.ts</files>
  <action>
    Mirror lib/api/loans.ts envelope discipline EXACTLY: lists return BARE { items } (or { items, total } where the backend paginates) — NEVER model huma's $schema key.
    repairs.ts → `repairsApi`: byInventory(ws,invId) GET /workspaces/{ws}/inventory/{invId}/repairs returns { items, total }; cost(ws,invId) GET .../inventory/{invId}/repair-cost returns { items: RepairCostSummary[] }; get(ws,id); create(ws,body: CreateRepairBody); update(ws,id,body) PATCH (description?, repair_date?, cost?, currency_code?, service_provider?, notes? — NO status); start(ws,id) POST .../repairs/{id}/start; complete(ws,id,new_condition?) POST .../repairs/{id}/complete { new_condition }; del(ws,id). All cost values are CENTS (int); never send floats.
    maintenance.ts → `maintenanceApi`: list(ws,{page,limit}) GET /workspaces/{ws}/maintenance (cap limit at 100); byInventory(ws,invId) GET .../inventory/{invId}/maintenance; due(ws,days?) GET .../maintenance/due returns { items: DueSchedule[] }; get(ws,id); create(ws,body: CreateScheduleBody); update(ws,id,body); complete(ws,id,notes?) POST .../maintenance/{id}/complete { notes }; del(ws,id).
    repairPhotos.ts → `repairPhotosApi` (fork of photos.ts subset per OQ2): map() rewrites url + thumbnail_url via toProxyUrl (mirror photos.ts mapPhoto). list(ws,repairId) GET .../repairs/{repairId}/photos/list → items.map(map); upload(ws,repairId,file,photoType,caption?) builds FormData appending "photo", "photo_type" (REQUIRED — Pitfall 1), optional "caption", posts via postMultipart; updateCaption(ws,repairId,id,caption) PUT .../photos/{id}/caption; del(ws,repairId,id) DELETE .../photos/{id}. Do NOT add reorder/bulk/zip/set-primary unless confirmed in backend (F2) — only list/upload/caption/delete.
    repairAttachments.ts → `repairAttachmentsApi`: list(ws,repairId) GET .../attachments → { items, total }; create(ws,repairId,{file_id,attachment_type,title?}) POST .../attachments (LINK-ONLY per OQ3 — registers an existing file_id, does NOT upload bytes); del(ws,repairId,attachmentId) DELETE .../attachments/{attachmentId}.
    Import get/post/patch/del/put/postMultipart from @/lib/api and toProxyUrl from ./url (verified present: api.ts:143-176, url.ts:12).
  </action>
  <verify>
    <automated>cd frontend2 && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "lib/api/(repairs|maintenance|repairPhotos|repairAttachments)" | grep -v '^#' | (! grep -c .)</automated>
  </verify>
  <done>All four api modules type-check clean; exports present (grep confirms repairsApi/maintenanceApi/repairPhotosApi/repairAttachmentsApi).</done>
</task>

<task type="auto">
  <name>Task 3: RHF+zod schemas + MSW handler files</name>
  <files>frontend2/src/features/repairs/schema.ts, frontend2/src/features/maintenance/schema.ts, frontend2/src/test/msw/repairHandlers.ts, frontend2/src/test/msw/maintenanceHandlers.ts</files>
  <action>
    features/repairs/schema.ts — RHF+zod create/edit schema mirroring features/loans/schema.ts: description (string, min 1, required → message "Description is required."); repair_date (optional date string); cost (currency text field, inputMode decimal — zod transforms major-unit string → Math.round(value * 100) CENTS int; empty → omit cost; NEVER a float — UI-SPEC §Cents rule); service_provider (optional); is_warranty_claim (optional bool); reminder_date (optional date). Export the inferred type.
    features/maintenance/schema.ts — title (string, min 1, required → "Title is required."); interval_days (number, integer, min 1 → "Interval must be at least 1 day."); next_due (date string, required); notes (optional). Export the inferred type.
    test/msw/repairHandlers.ts — mirror loanHandlers.ts: match at the /api/... prefix; export a `repairHandlers` array registered per-test via server.use. Provide handlers for byInventory list (BARE { items, total }), cost (BARE { items }), start, complete, create, update, delete, get, and repair photos list + attachments list. ORDER specific sub-routes BEFORE catch-alls (/repairs/:id/start + /repairs/:id/complete BEFORE /repairs/:id). Fixtures: include one PENDING, one IN_PROGRESS, one COMPLETED repair (to exercise pills) and a multi-currency-free single cost summary plus optionally a 2-currency summary fixture helper.
    test/msw/maintenanceHandlers.ts — export `maintenanceHandlers`: list, byInventory, due (BARE { items } with one is_overdue:true + one is_overdue:false row, each carrying item_name), complete, create, update, delete. Specific routes before catch-alls.
    Do NOT add either handler array to the global handlers.ts (loanHandlers convention: imported + server.use per-test).
  </action>
  <verify>
    <automated>cd frontend2 && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(repairHandlers|maintenanceHandlers|repairs/schema|maintenance/schema)" | grep -v '^#' | (! grep -c .)</automated>
  </verify>
  <done>Schemas + both MSW handler files type-check clean; repairHandlers/maintenanceHandlers exported; fixtures include all three repair statuses and overdue/non-overdue due rows.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| frontend → backend API | All repair/maintenance/photo/attachment reads+writes cross here; wsId is in the path |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-01 | Tampering | float cost sent to API | mitigate | money.ts is display-only; schema transforms major-unit → Math.round(*100) cents int; api modules type cost as number(cents) |
| T-10b-02 | Information disclosure | cross-tenant repair/file access | accept | server enforces workspace guard on every route (V4); frontend only passes wsId in path, no client authz |
| T-10b-SC | Tampering | npm/pip/cargo installs | mitigate | none — no packages installed this phase (RESEARCH Package Legitimacy Audit: nothing to vet) |
</threat_model>

<verification>
- tsc clean across all new files.
- `bun run test src/lib/utils/money.test.ts src/features/repairs/repairStatus.test.ts` green.
- repairsApi/maintenanceApi/repairPhotosApi/repairAttachmentsApi + repairHandlers/maintenanceHandlers exported.
</verification>

<success_criteria>
- formatCents, four api modules, repairStatus, two schemas, two MSW handler files exist and type-check.
- Downstream Wave-2/3 plans can import all deps without re-deriving contracts.
</success_criteria>

<output>
Create `.planning/phases/10b-repairs-maintenance/10b-01-SUMMARY.md` when done.
</output>
