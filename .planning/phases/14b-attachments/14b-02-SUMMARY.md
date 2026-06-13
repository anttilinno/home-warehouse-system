---
phase: 14b-attachments
plan: 02
subsystem: backend / warehouse attachments
tags: [attachments, storage, multipart, security, idor, go]
requires:
  - Phase 7 (items — attachments FK on workspace_id+item_id)
  - infra/storage (Storage interface + LocalStorage, sanitisation already fixed)
provides:
  - storage-backed attachment.Service (real bytes persisted on upload)
  - POST /items/{item_id}/attachments/file (Chi multipart, real bytes)
  - GET /attachments/{id}/file (workspace-scoped serve/download)
affects:
  - Wave-2 frontend attachment panel (upload + re-download)
tech-stack:
  added: []          # no new go modules — storage/testdb/testify already vendored
  patterns:
    - mirror itemphoto Chi multipart + serve alongside huma (same router)
    - SHA-256 TeeReader checksum computed over the exact bytes written
    - serve route workspace-scoped via svc.GetAttachment (WHERE id=$1 AND workspace_id=$2)
key-files:
  created:
    - backend/internal/domain/warehouse/attachment/storage_integration_test.go
  modified:
    - backend/internal/domain/warehouse/attachment/service.go
    - backend/internal/domain/warehouse/attachment/handler.go
    - backend/internal/api/router.go
    - backend/internal/domain/warehouse/attachment/service_test.go
    - backend/internal/domain/warehouse/attachment/handler_test.go
decisions:
  - Reused the existing photoStorage instance (no new env var / dir) — CONTEXT OQ5
  - Serve path is /attachments/{id}/file (NOT /attachments/{id}) to avoid a huma collision at boot
  - On Storage.Save success but File/repo failure, the blob is rolled back (storage.Delete) — no orphan bytes
metrics:
  duration: ~25m
  completed: 2026-06-13
---

# Phase 14b Plan 02: Attachment Byte-Storage Fix + Serve Route Summary

Wired real byte storage into item attachments: a new Chi multipart route
(`POST /items/{item_id}/attachments/file`) persists the uploaded bytes via
`storage.Storage.Save` (storing the real returned path as the `files.storage_key`),
and a workspace-scoped serve route (`GET /attachments/{id}/file`) streams them back
with `nosniff` + `Content-Disposition: attachment`. The Phase-10b huma JSON metadata
endpoint (`POST .../attachments/upload`) is untouched. A tagged integration test
proves the upload→download byte round-trip and a cross-tenant 404.

## What changed

### Task 1 — storage-injected service (`64e3aac3`)
- `attachment.NewService(fileRepo, attachmentRepo, store)` now takes a
  `storage.Storage` (3rd param).
- `UploadFileBytes(ctx, workspaceID, itemID, header, reader, uploadedBy)`:
  `io.TeeReader` → `storage.Save` (sanitises filename: F14/F20 already fixed in
  `local_storage.go`), computes SHA-256 over the written bytes, persists a `File`
  whose `StorageKey` is the **real** returned path. On a `Save`/`NewFile`/repo
  failure the blob is rolled back (`storage.Delete`) so no orphan metadata or
  orphan bytes remain.
- `GetFile(ctx, id, workspaceID)` — workspace-scoped File lookup for the serve route.
- `ServiceInterface` extended with both methods; mock/unit tests updated for the
  new signature.

### Task 2 — Chi multipart upload + serve handlers (`d44fea0c`)
- `RegisterUploadHandler` → `POST /items/{item_id}/attachments/file`, multipart
  field **`file`**, optional form fields `attachment_type` (default `OTHER`,
  validated via `AttachmentType.IsValid`), `title`, `is_primary`. Persists bytes,
  creates the attachment, publishes `attachment.created` (same shape as the huma
  route), returns **201** `AttachmentResponse`. `MaxFileSize = 25 MiB`.
- `RegisterServeHandler` → `GET /attachments/{id}/file`. Workspace-scoped
  (`svc.GetAttachment` 404s on cross-tenant id), resolves the File row, streams
  `storage.Get`, sets `Content-Type` from the **stored** mime (fallback
  `mime.TypeByExtension`), `X-Content-Type-Options: nosniff`, and
  `Content-Disposition: attachment; filename="<sanitised>"`.

### Task 3 — router wiring (`ce1d8ce6`)
- `attachmentSvc := attachment.NewService(fileRepo, attachmentRepo, photoStorage)`
  (router.go:302) — reuses the existing `photoStorage` instance.
- Registered the two Chi handlers inside the `/workspaces/{workspace_id}` closure
  alongside the itemphoto Chi registrations. Huma `attachment.RegisterRoutes` kept.

### Task 4 — integration test (`7ed89b72`)
- `storage_integration_test.go` (`//go:build integration`, package
  `attachment_test`): real Postgres via `testdb.SetupTestDB`, storage-backed
  service with a `t.TempDir()` blob dir, seeds an item via `item.Service` for the
  FK. Asserts: upload → 201; download → 200 with byte-equal body + correct mime +
  `nosniff`; cross-tenant workspace serve → 404.

## Route contract for Wave-2 frontend

| Method | Path | Body / fields | Returns |
|--------|------|---------------|---------|
| POST | `/api/workspaces/{wsId}/items/{item_id}/attachments/file` | multipart: **`file`** (required), `attachment_type` (PHOTO\|MANUAL\|RECEIPT\|WARRANTY\|OTHER, default OTHER), `title` (opt), `is_primary` (`"true"`) | 201 `AttachmentResponse` |
| GET | `/api/workspaces/{wsId}/attachments/{id}/file` | — | 200 file bytes (`Content-Disposition: attachment`, `nosniff`); 404 cross-tenant / missing |

(Routes are workspace-scoped; the Vite proxy `/api` rewrite applies as for the
rest of the backend.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `NewService` signature change broke existing unit tests**
- **Found during:** Task 1
- **Issue:** Adding the `storage.Storage` 3rd param to `NewService` broke
  `service_test.go` (6 call sites) and the `MockService` in `handler_test.go`
  (no longer satisfied the widened `ServiceInterface`).
- **Fix:** Passed `nil` storage in the mocked unit tests (they don't exercise
  byte storage); added `UploadFileBytes` + `GetFile` methods to `MockService`.
- **Files modified:** `service_test.go`, `handler_test.go`
- **Commit:** `64e3aac3`

## Verification

- `cd backend && go build ./...` → exit 0 (clean).
- `cd backend && go test ./...` (default lane, no integration tag) → all green.
- Tagged round-trip:
  `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./internal/domain/warehouse/attachment/... -v`
  → `--- PASS: TestAttachment_ByteRoundTrip_Integration (0.20s)` and the full
  attachment package `ok`.

## Threat mitigations applied

- T-14b-03 (zip-slip F14) / T-14b-05 (path traversal F20): bytes go through
  `storage.Save` → `SanitizeFilename` + `filepath.Rel` containment (already fixed
  in `local_storage.go`); serve reads a DB-derived storage_key via the same
  contained `Get`.
- T-14b-04 (cross-tenant IDOR): serve route uses `svc.GetAttachment(ctx,id,ws)` →
  `WHERE id=$1 AND workspace_id=$2`; integration test asserts the 404.
- T-14b-06 (content-type sniffing F15): serve sets `X-Content-Type-Options: nosniff`
  + `Content-Disposition: attachment`, Content-Type from the stored mime.

## Follow-up for the orchestrator

- REBUILD + RESTART the `:8080` backend (pkill the orphan `main` first) so Wave-2
  tests run against real byte storage.
- Wave-2 frontend: build `lib/api/attachments.ts` + `ItemAttachmentPanel` against
  the route contract above.

## Known Stubs

None — the placeholder storage_key path described in CONTEXT (the old stub) is now
replaced by real byte persistence on the new route. The pre-existing huma JSON
metadata route (`POST .../attachments/upload`) intentionally remains metadata-only
(load-bearing for Phase-10b repair file-id minting; out of scope per the plan
NON-GOALS).

## Self-Check: PASSED

All declared files exist on disk; all four task commits (`64e3aac3`, `d44fea0c`,
`ce1d8ce6`, `7ed89b72`) are present in `git log`.
