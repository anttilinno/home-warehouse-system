---
phase: 40-database-migration-and-backend-oauth-core
plan: 01
subsystem: database, auth
tags: [postgresql, dbmate, sqlc, oauth, user-entity, nullable-password]

# Dependency graph
requires: []
provides:
  - "Migration 012: nullable password_hash + has_password column in auth.users"
  - "sqlc queries for auth.user_oauth_accounts (CRUD + count)"
  - "User entity with hasPassword field and NewOAuthUser constructor"
  - "Repository handling nullable password_hash via *string"
  - "UserResponse and UserAdminResponse include has_password field"
  - "CreateOAuthUser service method"
affects: [40-02, 40-03, oauth-handler, oauth-service, frontend-auth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nullable password_hash stored as NULL, mapped to empty string in domain entity"
    - "has_password boolean column for OAuth-only user detection"
    - "NewOAuthUser constructor for passwordless user creation"

key-files:
  created:
    - "backend/db/migrations/012_oauth_nullable_password.sql"
    - "backend/db/queries/oauth_accounts.sql"
    - "backend/internal/infra/queries/oauth_accounts.sql.go"
  modified:
    - "backend/internal/domain/auth/user/entity.go"
    - "backend/internal/domain/auth/user/service.go"
    - "backend/internal/domain/auth/user/handler.go"
    - "backend/internal/domain/auth/user/repository.go"
    - "backend/internal/infra/postgres/user_repository.go"
    - "backend/internal/infra/queries/models.go"

key-decisions:
  - "Empty passwordHash in domain entity maps to NULL in database, *string used for scanning"
  - "has_password column defaults to true so all existing users retain password-based auth"
  - "Save method handles NULL conversion: empty string passwordHash written as NULL"

patterns-established:
  - "OAuth-only user pattern: NewOAuthUser sets hasPassword=false, empty passwordHash"
  - "CheckPassword guard: returns false for empty hash to prevent bcrypt panic"

requirements-completed: [SCHM-01, SCHM-02]

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 40 Plan 01: Database Migration and Backend OAuth Core Summary

**Migration 012 makes password_hash nullable with has_password tracking; user entity extended with NewOAuthUser constructor and sqlc queries generated for oauth_accounts**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T15:20:12Z
- **Completed:** 2026-02-22T15:27:50Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Migration 012 applied: password_hash nullable, has_password boolean added with default true
- sqlc queries generated for user_oauth_accounts table (5 queries: get, list, create, delete, count)
- User entity extended with hasPassword field, NewOAuthUser constructor, safe CheckPassword
- Repository updated to handle nullable password_hash with *string scanning
- All API responses (UserResponse, UserAdminResponse, uploadAvatar) include has_password field
- CreateOAuthUser service method added to ServiceInterface and Service
- All existing tests pass with updated Reconstruct signatures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 012 and sqlc queries for oauth_accounts** - `c2a39f9e` (feat)
2. **Task 2: Extend user entity, repository, handler, and all call sites** - `2e96cc15` (feat)

## Files Created/Modified
- `backend/db/migrations/012_oauth_nullable_password.sql` - Makes password_hash nullable, adds has_password column
- `backend/db/queries/oauth_accounts.sql` - sqlc query definitions for user_oauth_accounts
- `backend/internal/infra/queries/oauth_accounts.sql.go` - Generated Go code for oauth_accounts queries
- `backend/internal/infra/queries/models.go` - Updated sqlc models with new columns
- `backend/internal/infra/queries/users.sql.go` - Regenerated users queries
- `backend/internal/domain/auth/user/entity.go` - hasPassword field, NewOAuthUser, safe CheckPassword, updated Reconstruct
- `backend/internal/domain/auth/user/entity_test.go` - Tests for NewOAuthUser, CheckPassword empty hash, UpdatePassword sets hasPassword
- `backend/internal/domain/auth/user/service.go` - CreateOAuthUser method and CreateOAuthUserInput
- `backend/internal/domain/auth/user/service_test.go` - Updated Reconstruct call
- `backend/internal/domain/auth/user/handler.go` - HasPassword in UserResponse, UserAdminResponse, uploadAvatar JSON
- `backend/internal/domain/auth/user/handler_test.go` - MockService.CreateOAuthUser added
- `backend/internal/domain/auth/user/repository.go` - Updated comment for nullable support
- `backend/internal/infra/postgres/user_repository.go` - Nullable password_hash handling, has_password in all queries
- `backend/internal/testutil/factory/user.go` - Updated Reconstruct calls with hasPassword parameter

## Decisions Made
- Empty passwordHash in domain entity maps to NULL in database using *string for scanning
- has_password column defaults to true so all existing users retain password-based auth
- Save method converts empty string passwordHash to NULL pointer for database insertion
- CheckPassword returns false immediately for empty hash rather than calling bcrypt (prevents panic)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Docker containers conflicted with main worktree containers; ran dbmate and sqlc directly instead of via mise tasks. No impact on outcome.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data layer foundation complete for OAuth functionality
- User entity, repository, and handler fully support OAuth-only users
- sqlc queries for oauth_accounts table ready for use in OAuth service/repository
- Phase 40 Plan 02 (OAuth domain package) can proceed

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 40-database-migration-and-backend-oauth-core*
*Completed: 2026-02-22*
