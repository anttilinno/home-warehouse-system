---
phase: 30-format-infrastructure
plan: 01
subsystem: database, api, auth
tags: [postgresql, go, user-preferences, format-preferences]

requires:
  - phase: none
    provides: "Existing auth.users table with date_format, language, theme columns"
provides:
  - "time_format, thousand_separator, decimal_separator columns on auth.users"
  - "Full backend round-trip: entity -> service -> handler -> repository for three new preference fields"
  - "Separator conflict validation (400 if thousand_separator == decimal_separator)"
  - "GET /users/me returns time_format, thousand_separator, decimal_separator"
  - "PATCH /users/me/preferences accepts time_format, thousand_separator, decimal_separator"
affects: [30-02-frontend-hooks, 31-settings-ui]

tech-stack:
  added: []
  patterns: ["User preference column addition pattern extended with 3 new fields"]

key-files:
  created:
    - "backend/db/migrations/010_format_preferences.sql"
  modified:
    - "backend/internal/domain/auth/user/entity.go"
    - "backend/internal/domain/auth/user/service.go"
    - "backend/internal/domain/auth/user/handler.go"
    - "backend/internal/infra/postgres/user_repository.go"
    - "backend/internal/domain/auth/user/entity_test.go"
    - "backend/internal/domain/auth/user/service_test.go"
    - "backend/internal/domain/auth/user/handler_test.go"
    - "backend/internal/testutil/factory/user.go"

key-decisions:
  - "UpdatePreferences entity method now returns error (breaking change from void) for separator conflict validation"
  - "New format fields placed after theme and before avatarPath in Reconstruct parameter order"
  - "Separator conflict checks effective values (current + proposed) not just submitted values"

patterns-established:
  - "Separator conflict validation at entity level with effective-value resolution"

duration: 5min
completed: 2026-02-08
---

# Phase 30 Plan 01: Backend Format Preferences Summary

**Three new user preference columns (time_format, thousand_separator, decimal_separator) with full backend round-trip through migration, entity, service, handler DTOs, and repository**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-08T12:19:31Z
- **Completed:** 2026-02-08T12:24:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Database migration adds time_format (default '24h'), thousand_separator (default ','), and decimal_separator (default '.') to auth.users
- Entity layer extended with fields, getters, Reconstruct params, and separator conflict validation in UpdatePreferences
- All handler UserResponse and UserAdminResponse constructions include the three new fields
- Repository Save, all SELECT queries, and both scan functions thread the new columns end-to-end
- All 35+ existing tests pass with updated signatures

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and entity layer** - `7193109` (feat)
2. **Task 2: Service, handler DTOs, and repository** - `9f75aa9` (feat)

## Files Created/Modified
- `backend/db/migrations/010_format_preferences.sql` - Migration adding 3 columns to auth.users
- `backend/internal/domain/auth/user/entity.go` - User struct fields, Reconstruct, getters, UpdatePreferences with validation
- `backend/internal/domain/auth/user/service.go` - UpdatePreferencesInput struct and error handling
- `backend/internal/domain/auth/user/handler.go` - UserResponse, UserAdminResponse, UpdatePrefsRequestBody DTOs and all construction sites
- `backend/internal/infra/postgres/user_repository.go` - Save, SELECT queries, scan functions
- `backend/internal/domain/auth/user/entity_test.go` - Updated Reconstruct and UpdatePreferences test calls
- `backend/internal/domain/auth/user/service_test.go` - Updated Reconstruct and UpdatePreferences test calls
- `backend/internal/domain/auth/user/handler_test.go` - Updated UpdatePreferences test call
- `backend/internal/testutil/factory/user.go` - Updated Reconstruct calls in factory functions

## Decisions Made
- UpdatePreferences entity method changed from void to error return to support separator conflict validation -- callers updated accordingly
- Separator conflict validation checks effective values (existing + proposed) rather than only submitted values, preventing edge case where user submits only one separator that matches the existing value of the other

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test factory Reconstruct calls**
- **Found during:** Task 2 (backend build)
- **Issue:** `backend/internal/testutil/factory/user.go` calls `user.Reconstruct` with old 12-param signature, blocking compilation
- **Fix:** Added `u.TimeFormat()`, `u.ThousandSeparator()`, `u.DecimalSeparator()` to both Reconstruct calls in factory
- **Files modified:** `backend/internal/testutil/factory/user.go`
- **Verification:** `go build ./...` succeeds
- **Committed in:** 9f75aa9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend fully supports format preferences end-to-end
- Ready for Plan 30-02 (frontend hooks and User type extension)
- Frontend User type in auth.ts needs time_format, thousand_separator, decimal_separator fields added

---
*Phase: 30-format-infrastructure*
*Completed: 2026-02-08*
