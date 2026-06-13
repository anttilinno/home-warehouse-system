---
phase: 14b-attachments
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/internal/domain/warehouse/attachment/service.go
  - backend/internal/domain/warehouse/attachment/handler.go
  - backend/internal/domain/warehouse/attachment/storage_integration_test.go
  - backend/internal/api/router.go
autonomous: true
requirements: [ATT-01]
must_haves:
  truths:
    - "Uploading a file persists the real bytes to disk (not just a DB row)"
    - "The stored bytes can be downloaded back unchanged via a serve route"
    - "Downloaded content is workspace-scoped (cross-tenant id → 404)"
  artifacts:
    - path: "backend/internal/domain/warehouse/attachment/handler.go"
      provides: "Multipart upload handler (real bytes) + serve/download handler"
      contains: "ParseMultipartForm"
    - path: "backend/internal/domain/warehouse/attachment/service.go"
      provides: "Storage-injected service that writes bytes on upload"
      contains: "storage"
  key_links:
    - from: "attachment upload handler"
      to: "storage.Storage.Save"
      via: "io.Reader from the multipart file"
      pattern: "\\.Save\\(ctx"
    - from: "attachment serve handler"
      to: "storage.Storage.Get"
      via: "files.storage_key"
      pattern: "\\.Get\\(ctx"
---

<objective>
Wire real byte storage into item attachments. Today the upload endpoint records
a `files` row with a placeholder storage_key and DISCARDS the uploaded bytes
(handler.go:82-96 — "we'll create a placeholder storage key"; no Storage.Save).
This plan injects the existing `storage.Storage` into the attachment service,
adds a Chi multipart upload route that writes the real bytes and persists the
real returned path as storage_key, and adds a serve/download GET route. A
backend integration test proves the upload→download byte round-trip.

Purpose: ATT-01 — the item-detail upload must persist BYTES, provable by a real
round-trip, so the Wave-2 frontend panel can upload and re-download files.
Output: a storage-backed attachment service, a multipart upload + serve route,
router wiring, and a round-trip integration test.

NON-GOALS: do NOT remove or change the existing huma JSON metadata endpoint
`POST /items/{item_id}/attachments/upload` — repair-attachment (Phase 10b)
mints file_ids through it. Add the byte path as a NEW Chi route alongside it.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14b-attachments/14b-CONTEXT.md
@.planning/phases/14b-attachments/14b-VALIDATION.md

<interfaces>
<!-- MIRROR the itemphoto Chi multipart + serve pattern. Adapt path/field names. -->
From backend/internal/infra/storage/storage.go:
  Save(ctx, workspaceID, itemID, filename string, reader io.Reader) (path string, err error)
  Get(ctx, path string) (io.ReadCloser, error)
  Delete(ctx, path string) error
  // local_storage.go already sanitises (SanitizeFilename + filepath.Rel containment, F20 fixed)

From backend/internal/domain/warehouse/itemphoto/handler.go (the pattern to mirror):
  func RegisterUploadHandler(r chi.Router, svc, broadcaster, urlGenerator)  // r.Post("/items/{item_id}/photos", h.HandleUpload)
  HandleUpload: GetWorkspaceID(ctx) → GetAuthUser(ctx) → uuid.Parse(chi.URLParam("item_id"))
               → r.ParseMultipartForm(MaxFileSize) → file,header,err := r.FormFile("photo")
               → defer file.Close() → svc.UploadPhoto(..., file, header, ...)
  func RegisterServeHandler(r chi.Router, svc, storageGetter)  // r.Get("/items/{item_id}/photos/{photo_id}", h.HandleServe)
  servePhoto: GetWorkspaceID → parse id → svc.GetPhoto → verify photo.WorkspaceID==ws (else 404)
             → storage.Get(ctx, storagePath) → set Content-Type → io.Copy to w
             → sets Cache-Control + (add) X-Content-Type-Options: nosniff (F15/audit nosniff gap)

From backend/internal/domain/warehouse/attachment/service.go (CHANGE THIS):
  NewService(fileRepo FileRepository, attachmentRepo AttachmentRepository) *Service  // ADD storage param
  UploadFile(ctx, UploadFileInput{WorkspaceID,OriginalName,Extension,MimeType,SizeBytes,Checksum,StorageKey,UploadedBy}) (*File, error)
  GetAttachment(ctx, id, workspaceID) (*Attachment, error)  // for serve-route workspace check
  // File entity exposes: .ID(), and the files row stores storage_key, mime_type, original_name

From backend/internal/api/router.go (single-writer wiring — THIS plan owns the attachment wiring lines):
  :265 photoStorage, err := storage.NewLocalStorage(photoStorageDir)   // REUSE this instance
  :302 attachmentSvc := attachment.NewService(fileRepo, attachmentRepo)  // ADD photoStorage arg
  :569 attachment.RegisterRoutes(wsAPI, attachmentSvc, broadcaster)      // huma JSON routes (keep)
  // Chi `r` is in scope in the /workspaces/{workspace_id} closure (see :524-525 itemphoto upload/serve)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Inject Storage into the attachment service + add an upload-bytes path</name>
  <files>backend/internal/domain/warehouse/attachment/service.go</files>
  <behavior>
    - NewService gains a `storage storage.Storage` dependency (3rd param).
    - A new service method (e.g. UploadFileBytes) takes
      (ctx, workspaceID, itemID uuid.UUID, header *multipart.FileHeader,
       reader io.Reader, uploadedBy *uuid.UUID): it calls storage.Save with the
      workspace + item + filename, computes the SHA-256 checksum while/after
      copying, and persists a File row whose StorageKey is the REAL path Save
      returns (NOT a placeholder). Returns the *File.
    - On a Save error the File row is NOT created (no orphan metadata).
  </behavior>
  <action>
    Import `io`, `mime/multipart`, and the storage package. Add `storage
    storage.Storage` to the Service struct and NewService signature. Add the
    UploadFileBytes method described above. Sanitise the filename via the
    storage layer (Save already calls SanitizeFilename) and derive Extension
    from filepath.Ext(header.Filename). Compute checksum over the bytes you
    write (tee the reader or read-all then store). Keep the existing UploadFile
    (JSON metadata path) UNCHANGED so repair-attachment keeps working. Update
    the ServiceInterface in this file to add the new method.
  </action>
  <verify>
    <automated>cd backend && go build ./internal/domain/warehouse/attachment/...</automated>
  </verify>
  <done>Service compiles with a storage dependency and an UploadFileBytes method that writes real bytes + stores the real path as storage_key.</done>
</task>

<task type="auto">
  <name>Task 2: Add Chi multipart upload + serve/download handlers</name>
  <files>backend/internal/domain/warehouse/attachment/handler.go</files>
  <action>
    Mirror itemphoto's Chi handlers (NOT huma — multipart needs raw Chi). Add:
    (1) An UploadHandler with HandleUpload: GetWorkspaceID + GetAuthUser, parse
        item_id from chi.URLParam, r.ParseMultipartForm(MaxFileSize) (define a
        MaxFileSize const, e.g. 25<<20), r.FormFile("file"), read optional
        attachment_type (default OTHER) + title form values, call
        svc.UploadFileBytes then svc.CreateAttachment, publish the
        "attachment.created" event (same shape as the existing huma upload
        route), respond 201 JSON with the AttachmentResponse. Validate
        attachment_type via AttachmentType.IsValid (400 on bad).
    (2) A ServeAttachmentHandler with HandleServe: GetWorkspaceID, parse id,
        svc.GetAttachment(ctx, id, workspaceID) (404 on miss → already
        workspace-scoped), fetch the File row for storage_key + mime_type, then
        storage.Get(ctx, storageKey), set Content-Type from the STORED mime_type
        (fallback mime.TypeByExtension), set `X-Content-Type-Options: nosniff`
        and `Content-Disposition: attachment; filename="<original_name>"`,
        io.Copy the reader to w. 404 if the file is missing on disk.
    (3) RegisterUploadHandler(r chi.Router, svc, broadcaster) →
        r.Post("/items/{item_id}/attachments/file", h.HandleUpload).
    (4) RegisterServeHandler(r chi.Router, svc, storageGetter-or-storage) →
        r.Get("/attachments/{id}/file", h.HandleServe).
    Choose route suffixes (/file) that do NOT collide with the existing huma
    routes (/items/{item_id}/attachments/upload, /attachments/{id}). To resolve
    storage in the serve handler, pass the storage instance (or a small getter)
    in via the Register function — mirror itemphoto's photoStorageGetter.
    LANDMINE: a huma route GET /attachments/{id} already exists; the Chi serve
    route MUST be a distinct path (/attachments/{id}/file) to avoid a huma
    collision at boot.
  </action>
  <verify>
    <automated>cd backend && go build ./internal/domain/warehouse/attachment/...</automated>
  </verify>
  <done>handler.go exposes RegisterUploadHandler (POST .../attachments/file, real bytes) and RegisterServeHandler (GET /attachments/{id}/file, workspace-scoped download) and compiles.</done>
</task>

<task type="auto">
  <name>Task 3: Wire storage into the attachment service in router.go</name>
  <files>backend/internal/api/router.go</files>
  <action>
    Update the attachment wiring (single-writer; this plan owns these lines):
    pass the existing `photoStorage` instance (router.go:265) into
    `attachment.NewService(fileRepo, attachmentRepo, photoStorage)` at :302.
    Inside the /workspaces/{workspace_id} chi closure (alongside the itemphoto
    upload/serve registrations ~:524-525), add
    `attachment.RegisterUploadHandler(r, attachmentSvc, broadcaster)` and
    `attachment.RegisterServeHandler(r, attachmentSvc, <storage-or-getter>)`.
    Keep the existing huma `attachment.RegisterRoutes(wsAPI, attachmentSvc,
    broadcaster)` at :569. Reuse the photoStorage dir (no new env var, no new
    storage instance) per CONTEXT OQ5.
  </action>
  <verify>
    <automated>cd backend && go build ./... </automated>
  </verify>
  <done>Whole backend compiles; attachment service is storage-backed; both new Chi routes are registered without a huma route collision at boot.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Byte round-trip integration test</name>
  <files>backend/internal/domain/warehouse/attachment/storage_integration_test.go</files>
  <behavior>
    - Upload a small known byte buffer via the Chi multipart upload route
      (workspace A context) → 201; capture the returned attachment id.
    - GET /attachments/{id}/file (workspace A) → 200, body bytes EQUAL the
      uploaded buffer; Content-Type matches the sent mime; header carries
      X-Content-Type-Options: nosniff.
    - GET /attachments/{id}/file with workspace B context → 404 (cross-tenant).
  </behavior>
  <action>
    New file, `//go:build integration` + `// +build integration`, package
    `attachment_test`. Use `testdb.SetupTestDB(t)`, a real
    `attachment.NewService(fileRepo, attachmentRepo, storage.NewLocalStorage(t.TempDir()))`,
    and an inline chi surface with the workspace/user-injecting middleware
    (mirror the harness in 14b-01's test + item handler_integration_test.go).
    Seed an item row so the FK holds. Build a multipart body with httptest.
    Assert the three behaviors. Use t.TempDir() for the storage base so the test
    is self-cleaning.
  </action>
  <verify>
    <automated>cd backend && TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./internal/domain/warehouse/attachment/... -v</automated>
  </verify>
  <done>Round-trip test passes: upload persists bytes, download returns the same bytes with nosniff, cross-tenant download is 404.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → multipart upload | Untrusted filename + bytes + content-type cross here |
| client → serve route | Caller may request another tenant's attachment id |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14b-03 | Tampering | upload filename (zip-slip F14) | mitigate | storage.Save calls SanitizeFilename + filepath.Base before persisting |
| T-14b-04 | Information Disclosure | serve route (cross-tenant) | mitigate | svc.GetAttachment(ctx,id,workspaceID) 404s on cross-tenant; serve test asserts it |
| T-14b-05 | Tampering | path traversal on Get (F20) | mitigate | local_storage.resolveWithinBase uses filepath.Rel (already fixed); paths are DB-derived |
| T-14b-06 | Spoofing | served Content-Type (F15) | mitigate | serve sets X-Content-Type-Options: nosniff + Content-Disposition: attachment; type from stored mime |
| T-14b-SC | Tampering | go deps | accept | No new go modules (storage/testdb/testify already vendored) |
</threat_model>

<verification>
- `cd backend && go build ./...` green.
- `cd backend && go test ./...` green (default lane, no integration tag).
- `cd backend && TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration ./internal/domain/warehouse/attachment/... -v` green (round-trip + cross-tenant 404).
- REBUILD + RESTART the :8080 backend after this lands (pkill the orphan `main` on :8080 first) so Wave 2 tests against real byte storage.
</verification>

<success_criteria>
ATT-01 backend half satisfied: an item attachment upload persists real bytes, those bytes download back unchanged via a workspace-scoped serve route, and the round-trip is guarded by a tagged integration test. The Phase-10b JSON metadata endpoint is untouched.
</success_criteria>

<output>
Create `.planning/phases/14b-attachments/14b-02-SUMMARY.md` when done. Note the new route paths (POST .../attachments/file, GET /attachments/{id}/file) and the upload form field names for the Wave-2 frontend plans.
</output>
