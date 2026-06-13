# Phase 14b — Attachments + Paperless — CONTEXT

**Synthesised:** 2026-06-13 (orchestrator, backend surface verified inline). BACKEND + SECURITY + frontend.
**Goal:** item attachments (upload/list/set-primary/delete) + Paperless-ngx (settings/search/link) + the cross-tenant attachment IDOR (audit F1) fixed & test-guarded.
**Depends on:** Phase 7 (items), Phase 12 (settings hub).
**Requirements:** ATT-01, ATT-02, ATT-03, PPL-01, PPL-02, PPL-03.

## ⚠️ CRITICAL GROUND-TRUTH CORRECTIONS (verified this session — the roadmap/handoff were stale)
### F1 IDOR is ALREADY FIXED in current code (ATT-03 is mostly TEST-GUARDING)
The audit (`docs/audit/BACKEND-SECURITY.md` F1) describes the OLD vulnerable code (`_ = workspaceID`, `svc.GetAttachment(ctx, input.ID)`). The CURRENT code is already remediated:
- `attachment/handler.go`: EVERY route reads `workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)` and passes it — `svc.GetAttachment(ctx, input.ID, workspaceID)` (h.go:52), `svc.DeleteAttachment(ctx, input.ID, workspaceID)` (:236), `svc.SetPrimary(ctx, input.ItemID, input.ID, workspaceID)` (:199), `svc.ListByItem(ctx, input.ItemID, workspaceID)` (:30).
- `attachment/service.go`: signatures all take `workspaceID uuid.UUID` (GetAttachment/ListByItem/DeleteAttachment/SetPrimary).
- `infra/queries/attachments.sql.go`: `warehouse.attachments` HAS a `workspace_id` column; SELECT/DELETE scope `WHERE id = $1 AND workspace_id = $2` (FindByID :138, Delete :110). Files table likewise `WHERE id=$1 AND workspace_id=$2`.
→ **ATT-03 work = (1) VERIFY the scoping is complete + correct across ALL attachment routes (GET/DELETE/set-primary/list/upload), (2) ADD the missing guarding integration test** (cross-tenant 404 — there is almost certainly NO test yet; mirror the Phase-65 pattern at `backend/internal/domain/warehouse/item/handler_integration_test.go` + the `tests/testdb` harness, `-tags=integration`). If any route is found still unscoped, fix it. Run `gsd-security-auditor` to confirm. Update the audit F1 row to ✅ RESOLVED with the commit once the test lands.

### Byte-storage IS STILL A STUB (the real backend work)
`attachment/handler.go:82` — comment "For now, we'll create a placeholder storage key" — builds a `storageKey` string (`uploads/{ws}/{item}/{name}`) and records a `files` row via `svc.UploadFile` → `fileRepo.Save` (a DB ROW), but **never writes the uploaded bytes to disk/storage** (no `Storage.Save` call; the multipart bytes are discarded). So attachments are metadata-only / link-only (the 10b/11 carried stub).
→ FIX: mirror the itemphoto storage path. `infra/storage/{storage.go,local_storage.go}` defines a `Storage` interface `Save(ctx, workspaceID, itemID, filename string, reader io.Reader) (path, error)` used by `itemphoto/service.go` (injected + `uploadDir`). Inject the same `Storage` (or the existing photoStorage instance from router.go) into `attachment.Service`, write the real bytes on upload, store the real path as `storage_key`, and add a download/serve route if attachments need retrieval (check if one exists). NOTE the related audit lows: F14 zip-slip + F20 path-containment + F15 content-type — apply the same sanitisation itemphoto uses.

## Backend surface (VERIFIED)
### Attachments (ATT-01/02) — domain `attachment`, workspace-scoped `/api/workspaces/{wsId}`
- `GET /items/{item_id}/attachments` → list (ListByItem, scoped).
- `POST /items/{item_id}/attachments/upload` → multipart upload (currently stores no bytes — see stub).
- `POST /items/{item_id}/attachments` → create-from-existing-file (CreateAttachment).
- `POST /items/{item_id}/attachments/{id}/set-primary` → set primary (scoped).
- `GET /attachments/{id}` + `DELETE /attachments/{id}` → get/delete (scoped via workspace_id now).
- Entity fields: id, item_id, file_id, attachment_type, title, is_primary, external_doc_id, dms_type, created_at, updated_at, workspace_id. Files: original_name, extension, mime_type, size_bytes, checksum, storage_key, uploaded_by.

### Paperless (PPL-01/02/03) — domain `paperless`, workspace-scoped
- `GET /paperless/settings` + `PUT /paperless/settings` + `DELETE /paperless/settings` → PPL-01 connection settings (get/put/delete). Settings page slots into Settings hub.
- `GET /paperless/search?query=&page=&page_size=` → `{ count, results }` → PPL-02 document search.
- `GET /paperless/documents/{id}` → resolve a document → PPL-03. LINKING: per paperless/handler.go:17-18 comment, linking "rides the existing attachment endpoints (POST /items/{item_id}/attachments)" with `external_doc_id`/`dms_type` set — so PPL-03 link-to-item = create an attachment with `external_doc_id = paperless doc id`, `dms_type = "paperless"` (no new endpoint).

## Frontend surface
- Item-attachment UI = GREENFIELD. Pattern to MIRROR: the repair-attachment UI (Phase 10b) — `features/repairs/components/{AddAttachmentDialog,RepairAttachmentPanel}.tsx` + `features/repairs/hooks/useRepairAttachments.ts` + `lib/api/repairAttachments.ts`. Build `lib/api/attachments.ts` + `features/items/components/ItemAttachmentPanel` (+ hooks), mount on the item detail page (Phase 7). Use the Phase-4 FileInput atom + the existing multipart upload helper (photos/postMultipart).
- Paperless = GREENFIELD: `lib/api/paperless.ts` + a Settings-hub page (`features/settings/PaperlessPage` — slots into the SettingsLayout/landing like the other Phase-12 settings pages) + a document-search UI + a "link to item" action (creates an attachment with external_doc_id/dms_type=paperless). Settings page mirrors the Phase-12 settings page pattern + routes under /settings.

## Open Questions (RESOLVED — investigator-verified 2026-06-13)
1. **Byte-storage truly unwired** — CONFIRMED STUB. `handler.go:83-86` builds placeholder `storageKey` via `fmt.Sprintf("uploads/%s/%s/%s",...)`, records the `files` row at :96 with that key, but NEVER calls `Storage.Save()` — bytes discarded. `service.go:45-65 UploadFile` only persists the File entity. **NO serve/download route exists** (itemphoto has `RegisterServeHandler` at itemphoto/handler.go:631-638; attachment has none). `attachment.NewService(fileRepo, attachmentRepo)` at service.go:27 takes NO Storage. → FIX: inject `storage.NewLocalStorage` (the `photoStorage` instance from router.go:265, or a new attachment dir), call `Storage.Save` on upload, persist the real returned path as storage_key, ADD a `RegisterServeHandler`-style GET download route.
2. **Existing attachment integration test** — NONE with `//go:build integration`. Only unit tests (handler_test.go/service_test.go, mocked) + a basic non-tagged `tests/integration/warehouse_test.go:52-80` (list/create, NO byte upload). ATT-03 cross-tenant 404 test + byte round-trip test are NET-NEW.
3. **Paperless link contract** — WIRED end-to-end. `CreateAttachmentRequest.Body.ExternalDocID *string` (handler.go:332) → `CreateAttachmentInput.ExternalDocID` (service.go:76); entity holds ExternalDocID + DMSType; SQL CREATE includes both cols. PPL-03 link = FRONTEND-ONLY wire (POST create-attachment with external_doc_id + dms_type="paperless").
4. **Migration** — NONE needed. `files.storage_key varchar(500)` already exists (001_initial_schema.sql:11).
5. **Storage signature to mirror** — `Save(ctx, workspaceID, itemID, filename string, reader io.Reader) (path string, err error)` (infra/storage/storage.go:13). itemphoto injection pattern: router.go:265 `photoStorage := storage.NewLocalStorage(photoStorageDir)`, :271 `itemphoto.NewService(itemPhotoRepo, photoStorage, ...)`. attachment wiring at router.go:302.
6. **Frontend multipart helper** — `postMultipart<T>(endpoint, form: FormData)` at `frontend2/src/lib/api.ts:154`. Mirror repair-attachment UI (features/repairs/components/{AddAttachmentDialog,RepairAttachmentPanel}.tsx + hooks/useRepairAttachments.ts + lib/api/repairAttachments.ts).
7. **Settings-hub slot** — planner to read Phase-12 SettingsLayout/landing registration + routes/index.tsx to mirror for PaperlessPage (single-writer files).

## Plan-split hint (for planner — ~5-7 plans; SEPARATE backend from frontend waves)
- WAVE 1 (BACKEND, may need rebuild+restart + integration tests):
  - A. ATT-03 SECURITY: audit + verify workspace scoping on ALL attachment routes; add the cross-tenant integration test (tests/testdb, -tags=integration). Update audit F1 → RESOLVED. (gsd-security-auditor on this.)
  - B. Byte-storage: inject Storage into attachment.Service, persist real bytes on upload + serve/download route + sanitisation (F14/F20/F15). Integration test the round-trip.
- WAVE 2 (FRONTEND, depends on backend being live):
  - C. lib/api/attachments.ts + item-attachment hooks + ItemAttachmentPanel (upload/list/set-primary/delete) mounted on item detail (ATT-01/02).
  - D. lib/api/paperless.ts + PaperlessPage settings (PPL-01) + document search (PPL-02) + link-to-item action (PPL-03, creates attachment w/ external_doc_id+dms_type).
  - E. wiring: routes (PaperlessPage under /settings) + Settings-hub landing row + item-detail panel mount (single-writer routes/index.tsx + SettingsLayout/landing + ItemDetailPage).
- Backend (Go) and frontend (bun) plans touch DISJOINT trees — can even parallelize across the language boundary, but the frontend attachment-upload UI should be tested against the FIXED byte-storage backend, so sequence C/D after A/B land + backend restart.

## Env note
Backend changes → REBUILD + RESTART: pkill the `main` exe holding :8080 (orphan survives killing `go run`), relaunch with the env block (JWT_SECRET, GO_DATABASE_URL=...warehouse_dev, REDIS_URL, etc — see .continue-here Env). Integration tests: `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test ... go test -tags=integration ./internal/domain/warehouse/attachment/... -v`.
