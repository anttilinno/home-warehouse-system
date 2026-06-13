---
phase: 14b-attachments
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/internal/domain/warehouse/attachment/handler_integration_test.go
  - docs/audit/BACKEND-SECURITY.md
autonomous: true
requirements: [ATT-03]
must_haves:
  truths:
    - "A cross-tenant attachment id returns 404, not another tenant's row"
    - "Every attachment read/delete/set-primary/list route is workspace-scoped"
  artifacts:
    - path: "backend/internal/domain/warehouse/attachment/handler_integration_test.go"
      provides: "Cross-tenant 404 integration guard (//go:build integration)"
      contains: "go:build integration"
  key_links:
    - from: "handler_integration_test.go"
      to: "attachment.Service + postgres repos + testdb"
      via: "real Postgres, two workspaces"
      pattern: "testdb.SetupTestDB"
---

<objective>
Lock the F1 cross-tenant attachment IDOR fix behind a real-Postgres integration
test, and confirm (by re-reading the code) that every attachment route is
workspace-scoped. The fix already shipped (audit F1 → RESOLVED, commit
f49e4b48); this plan adds the MISSING regression guard — there is currently no
`//go:build integration` test for attachment cross-tenant isolation.

Purpose: ATT-03 — prove a leaked attachment UUID cannot reach another tenant's
row, so a future revert of the scoping clause fails CI.
Output: a new integration test file + an audit row confirming the test guards F1.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14b-attachments/14b-CONTEXT.md
@.planning/phases/14b-attachments/14b-VALIDATION.md

<interfaces>
<!-- Mirror this existing integration test EXACTLY for harness + huma+chi setup -->
From backend/internal/domain/warehouse/item/handler_integration_test.go (lines 1-70):
  //go:build integration  /  // +build integration
  package item_test
  pool := testdb.SetupTestDB(t)
  workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")  // default test ws
  userID      := uuid.MustParse("00000000-0000-0000-0000-000000000002")
  // builds a real repo + real service, then a minimal chi+huma surface with a
  // middleware that injects workspace/user context (appMiddleware.GetWorkspaceID).

From backend/internal/domain/warehouse/attachment/service.go:
  func NewService(fileRepo FileRepository, attachmentRepo AttachmentRepository) *Service
  GetAttachment(ctx, id, workspaceID uuid.UUID) (*Attachment, error)   // ErrAttachmentNotFound when miss
  ListByItem(ctx, itemID, workspaceID uuid.UUID) ([]*Attachment, error)
  DeleteAttachment(ctx, id, workspaceID uuid.UUID) error
  SetPrimary(ctx, itemID, attachmentID, workspaceID uuid.UUID) error
  CreateAttachment(ctx, CreateAttachmentInput{WorkspaceID, ItemID, FileID, AttachmentType, Title, IsPrimary, ExternalDocID}) (*Attachment, error)

From backend/internal/domain/warehouse/attachment/handler.go:
  RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster)
  GET    /attachments/{id}                      → 404 "attachment not found" on cross-tenant miss
  DELETE /attachments/{id}                       → 404 on cross-tenant miss
  POST   /items/{item_id}/attachments/{id}/set-primary
  GET    /items/{item_id}/attachments            (list)

Repo constructors (find exact names in internal/infra/postgres/attachment_repository.go):
  postgres.NewAttachmentRepository(pool), postgres.NewFileRepository(pool) (confirm names by grep before writing).

SQL scoping already in place (internal/infra/queries/attachments.sql.go):
  FindByID:  WHERE id = $1 AND workspace_id = $2   (line 138)
  Delete:    WHERE id = $1 AND workspace_id = $2   (line 110)
  FindByItem:WHERE a.item_id = $1 AND a.workspace_id = $2 (line 197)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Re-verify workspace scoping across every attachment route</name>
  <files>backend/internal/domain/warehouse/attachment/handler.go (read-only), backend/internal/domain/warehouse/attachment/service.go (read-only), backend/internal/infra/queries/attachments.sql.go (read-only)</files>
  <action>
    Confirm by reading (do NOT change code unless a gap is found): every handler
    route reads `appMiddleware.GetWorkspaceID(ctx)` and threads it to the
    service; every service method takes `workspaceID uuid.UUID`; every SQL
    SELECT/DELETE/UPDATE scopes `... AND workspace_id = $N`. Routes to confirm:
    GET /attachments/{id}, DELETE /attachments/{id},
    POST /items/{item_id}/attachments/{id}/set-primary,
    GET /items/{item_id}/attachments (list), and both POST upload/create paths
    (workspaceID comes from context, not the body). If ANY route is found
    unscoped, fix it minimally and note it in the SUMMARY. Expected outcome per
    ground truth: NO gap — all scoped.
  </action>
  <verify>
    <automated>grep -c "GetWorkspaceID(ctx)" backend/internal/domain/warehouse/attachment/handler.go</automated>
  </verify>
  <done>All six routes confirmed workspace-scoped (grep count ≥ 6 GetWorkspaceID reads); no code change needed (or any gap fixed + noted).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add cross-tenant 404 integration test</name>
  <files>backend/internal/domain/warehouse/attachment/handler_integration_test.go</files>
  <behavior>
    - Seed: in workspace A (default test ws 00000000-...-0001), create an item +
      an attachment (via real repos/service). Capture the attachment id.
    - GET /attachments/{id} with workspace B context (a second, distinct ws uuid)
      → HTTP 404 (body "attachment not found"), NOT the workspace-A row.
    - DELETE /attachments/{id} with workspace B context → 404; then assert the
      attachment STILL EXISTS when read back with workspace A → 200.
    - Control: GET /attachments/{id} with workspace A context → 200 with the row.
  </behavior>
  <action>
    Create the file with `//go:build integration` + `// +build integration` tags
    (package `attachment_test`). Mirror the item handler_integration_test.go
    harness verbatim: `testdb.SetupTestDB(t)`, an inline chi+huma surface whose
    middleware injects workspace + user context. Build real repos
    (grep internal/infra/postgres/attachment_repository.go for the exact
    constructor names — likely `NewAttachmentRepository(pool)` /
    `NewFileRepository(pool)`) and a real `attachment.NewService(fileRepo,
    attachmentRepo)`. Seed an item row directly (reuse the item repo as the
    item test does, or insert via SQL through the pool) so the FK holds. Use two
    distinct workspace UUIDs — workspace A = the testdb default
    00000000-0000-0000-0000-000000000001 (already a member), workspace B = a
    second uuid the middleware injects for the cross-tenant call. Assert the
    three behaviors above with testify require/assert. Do NOT add a
    non-integration test (keep the default `go test ./...` lane fast).
  </action>
  <verify>
    <automated>cd backend && TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./internal/domain/warehouse/attachment/... -v</automated>
  </verify>
  <done>Tagged integration test passes: cross-tenant GET + DELETE return 404, same-tenant GET returns 200, attachment survives the cross-tenant delete attempt.</done>
</task>

<task type="auto">
  <name>Task 3: Confirm audit F1 row reflects the test guard</name>
  <files>docs/audit/BACKEND-SECURITY.md</files>
  <action>
    The F1 detail block already says RESOLVED (commit f49e4b48). Append a short
    note to the F1 detail section that the fix is now regression-guarded by
    `attachment/handler_integration_test.go` (cross-tenant 404, -tags=integration).
    Do NOT invent a new commit SHA — reference the test file by path. Keep the
    existing RESOLVED line intact.
  </action>
  <verify>
    <automated>grep -c "handler_integration_test" docs/audit/BACKEND-SECURITY.md</automated>
  </verify>
  <done>Audit F1 section references the new integration guard by path; existing RESOLVED status preserved.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → /attachments/{id} | A caller may present an attachment UUID belonging to another tenant |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14b-01 | Information Disclosure | GET /attachments/{id} | mitigate | SQL `WHERE id=$1 AND workspace_id=$2` (already shipped); this plan adds the cross-tenant 404 regression test |
| T-14b-02 | Tampering | DELETE /attachments/{id} | mitigate | Same scoping clause; test asserts the row survives a cross-tenant delete |
| T-14b-SC | Tampering | go test deps | accept | No new go modules added (testify/testdb already vendored) |
</threat_model>

<verification>
- `cd backend && go build ./...` green.
- `cd backend && go test ./...` green (integration test invisible without the tag — default lane stays fast).
- `cd backend && TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration ./internal/domain/warehouse/attachment/... -v` green.
- gsd-security-auditor confirms no residual attachment IDOR.
</verification>

<success_criteria>
ATT-03 satisfied: every attachment route is workspace-scoped (verified) AND a tagged Go integration test proves a cross-tenant attachment id returns 404 (mirroring the Phase-65 item cross-tenant guard). Audit F1 references the guard.
</success_criteria>

<output>
Create `.planning/phases/14b-attachments/14b-01-SUMMARY.md` when done.
</output>
