---
phase: 29-account-deletion
plan: 01
subsystem: auth
tags: [account-deletion, user-management, api]

# Dependency graph
requires: []
provides: [account-deletion-api, sole-owner-validation]
affects: [29-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [sole-owner-validation, type-to-confirm]

# File tracking
key-files:
  created: []
  modified:
    - backend/db/queries/workspace_members.sql
    - backend/internal/infra/queries/workspace_members.sql.go
    - backend/internal/domain/auth/user/errors.go
    - backend/internal/domain/auth/user/repository.go
    - backend/internal/domain/auth/user/service.go
    - backend/internal/domain/auth/user/handler.go
    - backend/internal/infra/postgres/user_repository.go
    - backend/internal/domain/auth/user/service_test.go
    - backend/internal/domain/auth/user/handler_test.go

# Decisions
decisions:
  - id: "29-01-001"
    decision: "Repository pattern for sole owner query"
    rationale: "Matches existing codebase patterns - queries accessed via Repository interface, not direct sqlc Queries struct"
  - id: "29-01-002"
    decision: "Personal workspace exclusion from blocking"
    rationale: "Personal workspace auto-created at registration should not block account deletion"
  - id: "29-01-003"
    decision: "Avatar cleanup before user deletion"
    rationale: "Matches existing pattern in deleteAvatar handler - file cleanup in handler, not service"

# Metrics
duration: 15min
completed: 2026-02-03
---

# Phase 29 Plan 01: Backend Account Deletion Summary

Backend API for account deletion with sole owner validation - DELETE /users/me validates constraints, cleans up avatar, deletes user with cascade.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6e212ce | feat | Add GetUserSoleOwnerWorkspaces SQL query |
| 439a53e | feat | Add CanDelete and Delete service methods |
| e29e6ee | feat | Add DELETE /users/me and GET /users/me/can-delete endpoints |

## What Was Built

### SQL Query
- `GetUserSoleOwnerWorkspaces` query in `workspace_members.sql`
- Returns workspaces where user is sole owner (blocking deletion)
- Excludes personal workspaces to not block personal account deletion

### Service Layer
- `ErrSoleOwnerOfWorkspace` error for validation failures
- `BlockingWorkspace` struct for returning workspace details
- `CanDelete(userID)` method checks sole owner constraints
- `Delete(userID)` method permanently removes user (CASCADE handles cleanup)
- Repository method `GetSoleOwnerWorkspaces` for database query

### API Endpoints
- `GET /users/me/can-delete` - Pre-check endpoint returns:
  - `can_delete: boolean`
  - `blocking_workspaces: [{id, name, slug}]`
- `DELETE /users/me` - Account deletion endpoint:
  - Requires `confirmation: "DELETE"` (case-insensitive)
  - Returns 400 if confirmation doesn't match
  - Returns 409 with workspace names if sole owner
  - Cleans up avatar file before deletion
  - Returns cleared auth cookies on success

## Decisions Made

1. **Repository pattern for sole owner query** - The codebase uses Repository interfaces rather than direct sqlc Queries access. Added `GetSoleOwnerWorkspaces` to user Repository interface.

2. **Personal workspace exclusion** - Personal workspaces (created at registration) should not block account deletion since they're deleted with the user anyway.

3. **Avatar cleanup in handler** - Matches existing pattern in `deleteAvatar` handler where file operations happen in handler, not service layer.

## Deviations from Plan

None - plan executed exactly as written.

## Test Updates

Updated mock implementations in both test files:
- `service_test.go`: Added `GetSoleOwnerWorkspaces` to MockRepository
- `handler_test.go`: Added `CanDelete` and `Delete` to MockService

## Verification

- [x] `mise run sqlc` generates without errors
- [x] `go build` compiles successfully
- [x] All user package tests pass
- [x] GetUserSoleOwnerWorkspaces query exists
- [x] CanDelete service method implemented
- [x] DELETE /users/me endpoint registered
- [x] GET /users/me/can-delete endpoint registered

## Next Phase Readiness

**For 29-02 (Frontend Account Deletion):**
- API endpoints ready for frontend integration
- GET /users/me/can-delete provides pre-check for UI state
- DELETE /users/me handles all backend validation
- Response format documented for frontend consumption

**Blockers:** None

**Dependencies resolved:** All backend infrastructure complete for frontend implementation.
