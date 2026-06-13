---
phase: 12-settings
plan: 01
subsystem: auth/member (backend)
tags: [members, parity, email-add, identity-enrich, go]
requires:
  - "auth.users.email/full_name already selected by ListMembersByWorkspace join (workspace_members.sql.go:167)"
  - "user.Service.GetByEmail (domain/auth/user/service.go:116)"
provides:
  - "GET /members returns email + full_name per member"
  - "POST /members accepts {email, role} → resolves to an existing user id"
  - "member.UserFinder port + member.ErrUserNotRegistered (404)"
affects:
  - "Plan 12-06 (frontend Members page) binds to the enriched MemberResponse + email add body"
tech-stack:
  added: []   # NO new Go modules — composes existing user/member packages
  patterns:
    - "Narrow port interface (UserFinder) in the consumer package + adapter in router.go to avoid import cycles"
    - "Separate ReconstructWithIdentity constructor to preserve existing Reconstruct callers"
key-files:
  modified:
    - backend/internal/domain/auth/member/entity.go
    - backend/internal/domain/auth/member/handler.go
    - backend/internal/domain/auth/member/service.go
    - backend/internal/domain/auth/member/errors.go
    - backend/internal/infra/postgres/member_repository.go
    - backend/internal/api/router.go
    - backend/internal/domain/auth/member/handler_test.go
    - backend/internal/domain/auth/member/service_test.go
  created:
    - .planning/phases/12-settings/12-01-SUMMARY.md
    - .planning/phases/12-settings/deferred-items.md
decisions:
  - "Retained the user_id add path alongside email (dual-path DTO) per binding override 7 — keeps existing user_id integration callers green; Email wins when both supplied."
  - "UserFinder is a narrow FindUserIDByEmail(ctx,email)(uuid.UUID,error) port in the member package (NOT *user.User) to keep the member domain decoupled from the user entity."
  - "Adapter memberUserFinder in router.go maps user.ErrUserNotFound / shared.ErrNotFound → member.ErrUserNotRegistered."
metrics:
  duration_sec: 496
  completed: 2026-06-13
  tasks: 2
  files_modified: 8
---

# Phase 12 Plan 01: Members Backend Enrich + Add-by-Email Summary

Surfaced member identity (email + full_name) on the list path and added an
add-by-email resolution to POST /members — without building any email-invite /
email-send system. Two surgical, TDD'd Go changes over the existing member
domain; zero new modules; no SQL or generated-code edits.

## What Changed

### Task 1 — Identity enrichment on read (TDD)
- `entity.go`: added optional read-only `email` + `fullName` fields with
  `Email()` / `FullName()` getters, and a new `ReconstructWithIdentity(...)`
  constructor that delegates to the existing `Reconstruct` then sets identity.
  The original `Reconstruct` signature is untouched (all existing callers/tests
  intact).
- `member_repository.go`: `ListByWorkspace` now calls `ReconstructWithIdentity`
  passing `row.Email` / `row.FullName` (already selected by the live join).
  `FindByWorkspaceAndUser` still uses identity-less `Reconstruct` (GetMember has
  no join).
- `handler.go`: `MemberResponse` gained `Email string json:"email,omitempty"`
  and `FullName string json:"full_name,omitempty"`; `toMemberResponse` copies
  `m.Email()` / `m.FullName()`. Add/Get paths serialize them as empty (omitted).

### Task 2 — Add-by-email (TDD)
- `errors.go`: added `ErrUserNotRegistered` (wraps `shared.ErrNotFound`).
- `service.go`: introduced `UserFinder` port
  (`FindUserIDByEmail(ctx, email) (uuid.UUID, error)`), injected via
  `NewService(repo, users)`. `AddMemberInput` gained `Email string`. `AddMember`
  resolves Email→user-id when present (returns `ErrUserNotRegistered` on
  not-found / nil), otherwise uses `UserID`. Existing Exists/NewMember/Save flow
  and all guards are unchanged.
- `handler.go`: `AddMemberRequest.Body` now `{ email, user_id?, role }`
  (Email is the parity add path; user_id retained as optional). Maps
  `ErrUserNotRegistered` → `huma.Error404NotFound("no registered user with that email")`.
- `router.go`: added `memberUserFinder` adapter over `userSvc.GetByEmail`
  (maps not-found → `member.ErrUserNotRegistered`); construction site updated to
  `member.NewService(memberRepo, memberUserFinder{users: userSvc})`.

## Verified Contract Shapes (for Plan 12-06)

`MemberResponse` JSON (list path populates email/full_name; add/get omit them):
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "role": "owner|admin|member|viewer",
  "invited_by": "uuid (optional)",
  "email": "string (list path only, omitempty)",
  "full_name": "string (list path only, omitempty)",
  "created_at": "RFC3339",
  "updated_at": "RFC3339"
}
```

`POST /members` request body:
```json
{ "email": "user@example.com", "role": "member" }
```
- Registered email → 200 with the added member.
- Unregistered email → 404 `{"message":"no registered user with that email"}`.
- Already a member → 400 (existing ErrAlreadyMember path, unchanged).
- `user_id` (UUID) still accepted as an alternative to `email`; `email` wins if both present.

## Guards (binding override 7) — untouched & verified

- Own-role-change → 400 (`ErrCannotChangeOwnRole`): unchanged, test green.
- Last-owner removal → 400 (`ErrCannotRemoveOwner`): unchanged, test green.

## Gates

- `go build ./...` — rc=0 (clean).
- `go vet ./internal/domain/auth/member/... ./internal/api/...` — rc=0 (clean).
- `go test ./internal/domain/auth/member/...` — PASS. New cases:
  `TestMemberHandler_List/response_carries_email_and_full_name_identity_fields`,
  `TestService_AddMemberByEmail/{registered, unregistered→ErrUserNotRegistered, already-member}`,
  `TestMemberHandler_AddMember/{adds_member_by_email_successfully, returns_404_when_email_is_not_a_registered_user}`.
- Integration (`-tags=integration`, `TEST_DATABASE_URL=...warehouse_test`):
  `TestMultiTenant_*` and `TestPermission_*` — ALL PASS on this branch.
- gofmt — clean on all 8 modified files.

## Deviations from Plan

### Auto-additions (Rule 2 — keep existing contract correct)
**1. Retained the `user_id` add path alongside `email` in AddMemberRequest.**
- Found during: Task 2 (integration-test impact scan).
- Issue: switching the body to email-only would break existing integration
  callers that POST `{"user_id": ...}` (e.g. `approval_pipeline_test.go`
  `addMemberToWorkspace`, `workflow_test.go`). Binding override 7 explicitly
  permits "keep the existing user_id path working too if the DTO supports both."
- Fix: `AddMemberRequest.Body` accepts both `email` (omitempty) and
  `user_id` (omitempty); the service resolves Email first, else uses UserID.
  No integration test files were edited (out of scope).
- Files: handler.go, service.go.

## Pre-existing, out-of-scope failures (logged, NOT fixed)

See `deferred-items.md`:
- `TestMultiUserWorkflow` fails on `GET /auth/me` 404 — fails identically on the
  base SHA; route-mount gap, unrelated to members.
- `TestApprovalPipeline_*` fail on review-gating (202 expected) — fail on base
  SHA too; separate in-progress approval-pipeline feature. Plan 12-01 actually
  improved the member-add step within these (base returned 422, now 200).

## Known Stubs

None. No hardcoded/placeholder data introduced; email/full_name are threaded
from the live SQL join, not fabricated.

## Threat Flags

None beyond the plan's threat_model. The add-by-email existence oracle
(T-12-02, disposition: accept) is exposed only to an already-authenticated
workspace admin and reveals no more than existing login flows.

## Self-Check: PASSED
