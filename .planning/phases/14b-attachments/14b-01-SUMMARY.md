---
phase: 14b-attachments
plan: 01
subsystem: backend / warehouse-attachment security
tags: [security, idor, integration-test, tenant-isolation, ATT-03]
requires:
  - "f49e4b48 tenant-isolation threading (F1 fix already shipped in code)"
provides:
  - "Cross-tenant attachment IDOR regression guard (//go:build integration)"
  - "Audit F1 row flipped to ✅ RESOLVED"
affects:
  - "backend/internal/domain/warehouse/attachment"
  - "docs/audit/BACKEND-SECURITY.md"
tech-stack:
  added: []
  patterns:
    - "Mirrors Phase-65 item handler_integration_test.go (real Postgres, two workspaces, inline chi+huma surface)"
key-files:
  created:
    - "backend/internal/domain/warehouse/attachment/handler_integration_test.go"
  modified:
    - "docs/audit/BACKEND-SECURITY.md"
decisions:
  - "Seed attachment with a real backing file_id — DB CHECK constraint attachments_has_reference requires file_id OR external_doc_id"
metrics:
  duration: "~15m"
  completed: "2026-06-13"
---

# Phase 14b Plan 01: ATT-03 Attachment Security Test + Audit F1 Flip Summary

Locked the already-shipped F1 cross-tenant attachment IDOR fix behind a real-Postgres `//go:build integration` regression test (cross-tenant GET + DELETE → 404, same-tenant GET → 200, row survives a cross-tenant delete), and flipped the audit F1 row + detail block to ✅ RESOLVED citing the new guard.

## What Was Done

### Task 1 — Re-verify workspace scoping across every attachment route (read-only, no commit)
Confirmed by reading source — no code change needed (expected ground-truth outcome):
- `attachment/handler.go`: **6** `GetWorkspaceID(ctx)` reads (one per route: list, get, upload, create, set-primary, delete); each threads `workspaceID` to the service.
- `attachment/service.go`: every lookup/mutation signature takes `workspaceID uuid.UUID`.
- `infra/queries/attachments.sql.go`: SELECT/DELETE/UPDATE all scope by `workspace_id` — FindByID:138 (`WHERE id = $1 AND workspace_id = $2`), Delete:110, FindByItem (ListByItem):197, SetPrimary:261, plus the files-table FindByID:166 and Delete:124.

No gap found. Result matches CONTEXT/VALIDATION ground truth.

### Task 2 — Cross-tenant 404 integration test (net-new)
Created `backend/internal/domain/warehouse/attachment/handler_integration_test.go` (`//go:build integration`, package `attachment_test`), mirroring the Phase-65 item harness verbatim:
- `testdb.SetupTestDB(t)` → real Postgres; default workspace A = `00000000-...-0001`, workspace B = `uuid.New()` via `testdb.CreateTestWorkspace`.
- Real repos (`postgres.NewFileRepository`, `postgres.NewAttachmentRepository`) + real `attachment.NewService`. Item FK seeded via the real `item.NewService(...).Create`.
- Inline chi+huma surface whose middleware injects workspace+user context.
- Three subtests: same-tenant GET → 200 (control); cross-tenant GET → 404 (no title leak); cross-tenant DELETE → 404 + row survives (verified via both a workspace-A GET and a direct `svc.GetAttachment`).

### Task 3 — Flip audit F1 to RESOLVED
`docs/audit/BACKEND-SECURITY.md`:
1. Summary-table row (line 9) → `| F1 | CRITICAL | ✅ RESOLVED (`f49e4b48`) — ... |` (mirrors F2/F3 format).
2. Appended a RESOLVED blockquote at the end of the F1 detail section (before the `---` divider) citing `f49e4b48`, the workspace_id column + scoping clause line refs, and the new integration guard.
F2's RESOLVED line (line 10) and detail block (lines 83-90, incl. `TestLogout_RevokesSession`) untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Attachment seed violated DB CHECK constraint**
- **Found during:** Task 2 (first integration run)
- **Issue:** Seeding an attachment with neither `file_id` nor `external_doc_id` failed with `attachments_has_reference` CHECK violation (SQLSTATE 23514; `001_initial_schema.sql:789` requires `file_id IS NOT NULL OR docspell_item_id IS NOT NULL`).
- **Fix:** Seed a real backing file via `svc.UploadFile(...)` first and attach it via `FileID` — mirrors the production upload path.
- **Files modified:** `handler_integration_test.go` (test-only; no production code changed)
- **Commit:** included in the test-file commit

## Test Result

- `cd backend && go build ./...` → **green**.
- `cd backend && go test ./...` → **green (exit 0)**; integration test invisible without the tag — default lane stays fast.
- `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./internal/domain/warehouse/attachment/...` → **`ok ... 0.300s`**:
  ```
  --- PASS: TestAttachmentHandler_CrossTenant_Integration (0.20s)
      --- PASS: .../control:_same-tenant_GET_returns_200_with_the_seeded_attachment
      --- PASS: .../cross-tenant_GET_returns_404,_not_workspace-A's_row
      --- PASS: .../cross-tenant_DELETE_returns_404_and_the_attachment_survives
  ```

## Known Stubs

None introduced by this plan. (The pre-existing byte-storage stub in `attachment/handler.go:82` is out of scope — it is Wave-1 Branch B, a separate plan.)

## Self-Check: PASSED
- `backend/internal/domain/warehouse/attachment/handler_integration_test.go` — FOUND
- `docs/audit/BACKEND-SECURITY.md` F1 ✅ RESOLVED row + RESOLVED block — FOUND
