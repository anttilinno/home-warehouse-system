# Phase 14b — VALIDATION (done-criteria)

Verified ground-truth (orchestrator 2026-06-13):
- **F1 IDOR already remediated in code** — handler passes workspaceID everywhere; service sigs take it; SQL scopes `WHERE id=$1 AND workspace_id=$2`. ATT-03 = VERIFY + ADD the missing guard test (cross-tenant 404), update audit F1 → RESOLVED.
- **Byte-storage is a STUB** (handler.go:82 placeholder key; no Storage.Save; bytes discarded). Real fix = inject the itemphoto `Storage` (infra/storage), persist bytes, serve/download, sanitise (F14 zip-slip/F20 path/F15 content-type).
- Paperless backend exists: `/paperless/settings` (GET/PUT/DELETE), `/paperless/search`, `/paperless/documents/{id}`. Linking = create an attachment with `external_doc_id` + `dms_type="paperless"` (no new endpoint).
- Item-attachment + paperless frontend = greenfield (mirror repair-attachment UI + Phase-12 settings page).

Per-requirement done criteria:
- **ATT-01** — item detail page: upload (Phase-4 FileInput, real multipart) + list attachments. Unit test panel; the upload must persist BYTES (depends on the byte-storage fix landing) — a real round-trip (upload → download returns the same bytes) proven by a backend integration test.
- **ATT-02** — set-primary + delete attachments (with confirm). Mutations invalidate the list.
- **ATT-03** — SECURITY: every attachment route (GET/DELETE/set-primary/list/upload) is workspace-scoped; a Go integration test (tests/testdb, -tags=integration) proves a cross-tenant attachment id returns 404 (mirror Phase-65 item handler_integration_test.go cross-tenant subtest). gsd-security-auditor confirms no residual IDOR. Audit F1 row flipped to ✅ RESOLVED with the commit SHA.
- **PPL-01** — Paperless settings page in the Settings hub: get/put/delete connection settings (URL + token). Mirrors Phase-12 settings page + route under /settings + landing row.
- **PPL-02** — document search UI over `/paperless/search`.
- **PPL-03** — link a found document to an item (creates an attachment with external_doc_id + dms_type=paperless); appears in the item's attachment list.

Gate (phase):
- BACKEND: `cd backend && go build ./... && go test ./...` (no-integration lane green) + the tagged integration tests: `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration ./internal/domain/warehouse/attachment/... -v` (cross-tenant 404 + byte round-trip green). Rebuild + RESTART the :8080 backend after backend changes.
- FRONTEND: `cd frontend2 && bun run lint:tsc && bun run test && bun run build && bun run lint:imports` green.
- Live E2E: item-detail attachment upload+list+delete + paperless settings page render.
- gsd-verifier PASS; gsd-security-auditor confirms ATT-03.

Landmines: backend orphan `main` survives killing `go run` — pkill the exe on :8080 before relaunch; integration tests invisible without `-tags=integration`; bare-tsc silent-pass (use lint:tsc); the multipart upload helper (mirror photos); apply itemphoto sanitisation to attachment storage (zip-slip/path/content-type).
