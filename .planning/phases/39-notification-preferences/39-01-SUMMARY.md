---
phase: 39-notification-preferences
plan: 01
subsystem: auth
tags: [postgres, jsonb, go, user-preferences, notification]

# Dependency graph
requires:
  - phase: 35-profile-preferences
    provides: user preference entity fields, UpdatePreferences method, PATCH /users/me/preferences
provides:
  - notification_preferences JSONB column on auth.users
  - NotificationPreferences field on User entity with getter and merge-update method
  - notification_preferences in all API request/response types (UserResponse, UserAdminResponse, UpdatePrefsRequestBody)
  - notification_preferences persisted and returned via existing PATCH /users/me/preferences endpoint
affects: [39-notification-preferences plan 02 (frontend UI)]

# Tech tracking
tech-stack:
  added: []
  patterns: [JSONB column for flexible boolean preference maps, opt-out model with empty object default]

key-files:
  created:
    - backend/db/migrations/011_notification_preferences.sql
  modified:
    - backend/internal/domain/auth/user/entity.go
    - backend/internal/domain/auth/user/handler.go
    - backend/internal/domain/auth/user/service.go
    - backend/internal/infra/postgres/user_repository.go
    - backend/internal/testutil/factory/user.go
    - backend/internal/domain/auth/user/entity_test.go
    - backend/internal/domain/auth/user/service_test.go
    - backend/internal/domain/auth/user/handler_test.go
    - backend/internal/infra/postgres/user_repository_test.go

key-decisions:
  - "notification_preferences stored as JSONB map[string]bool with empty object default (opt-out model)"
  - "UpdateNotificationPreferences merges keys into existing map rather than replacing"
  - "Reconstruct initializes nil notificationPreferences to empty map for safety"

patterns-established:
  - "JSONB preference maps: marshal to []byte before DB insert, unmarshal from []byte after scan"

# Metrics
duration: 7min
completed: 2026-02-13
---

# Phase 39 Plan 01: Notification Preferences Backend Summary

**notification_preferences JSONB column on auth.users threaded through entity, repository, handler, and service with merge-update semantics**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-13T13:59:43Z
- **Completed:** 2026-02-13T14:06:43Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Database migration 011 adds notification_preferences JSONB column with empty object default
- User entity extended with notificationPreferences field, getter, and merge-update method
- All repository queries (INSERT, SELECT, RETURNING) include notification_preferences with JSON marshal/unmarshal
- PATCH /users/me/preferences accepts and persists notification_preferences; GET /users/me returns it
- All existing tests pass with updated signatures

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and Go entity extension** - `729b1768` (feat)
2. **Task 2: Repository, handler, service, and all Reconstruct call sites** - `7642b48e` (feat)

## Files Created/Modified
- `backend/db/migrations/011_notification_preferences.sql` - JSONB column migration (up/down)
- `backend/internal/domain/auth/user/entity.go` - notificationPreferences field, getter, UpdateNotificationPreferences, updated Reconstruct and UpdatePreferences signatures
- `backend/internal/domain/auth/user/handler.go` - NotificationPreferences in UserResponse, UserAdminResponse, UpdatePrefsRequestBody, all handler response builders, uploadAvatar JSON output
- `backend/internal/domain/auth/user/service.go` - NotificationPreferences in UpdatePreferencesInput, passed through to entity
- `backend/internal/infra/postgres/user_repository.go` - notification_preferences in all SQL queries, JSON marshal/unmarshal in scan functions
- `backend/internal/testutil/factory/user.go` - Updated Reconstruct calls in WithEmail and WithSuperuser
- `backend/internal/domain/auth/user/entity_test.go` - Updated Reconstruct test with notifPrefs, UpdatePreferences calls with nil
- `backend/internal/domain/auth/user/service_test.go` - Updated Reconstruct and UpdatePreferences calls
- `backend/internal/domain/auth/user/handler_test.go` - Updated UpdatePreferences call signature
- `backend/internal/infra/postgres/user_repository_test.go` - Fixed pre-existing broken UpdatePreferences call

## Decisions Made
- notification_preferences stored as JSONB map[string]bool with empty object default (opt-out model: empty = all enabled)
- UpdateNotificationPreferences uses merge semantics (only updates provided keys, preserves others)
- Reconstruct defensively initializes nil notificationPreferences to empty map

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed service_test.go Reconstruct call not mentioned in plan**
- **Found during:** Task 2 (updating all Reconstruct call sites)
- **Issue:** Plan listed entity_test.go and factory/user.go as Reconstruct callers but missed service_test.go
- **Fix:** Added nil notificationPreferences parameter to Reconstruct call in TestReconstruct
- **Files modified:** backend/internal/domain/auth/user/service_test.go
- **Verification:** go test passes
- **Committed in:** 7642b48e (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed handler_test.go UpdatePreferences call**
- **Found during:** Task 2 (compilation failed)
- **Issue:** handler_test.go calls UpdatePreferences directly with old 6-arg signature
- **Fix:** Added nil as 7th argument for notificationPreferences
- **Files modified:** backend/internal/domain/auth/user/handler_test.go
- **Verification:** go test passes
- **Committed in:** 7642b48e (Task 2 commit)

**3. [Rule 1 - Bug] Fixed pre-existing broken UpdatePreferences call in integration test**
- **Found during:** Task 2 (grep for all call sites)
- **Issue:** user_repository_test.go had UpdatePreferences call with only 3 arguments (broken since format preferences were added)
- **Fix:** Updated to full 7-argument signature
- **Files modified:** backend/internal/infra/postgres/user_repository_test.go
- **Verification:** File compiles (integration test, not run in unit test suite)
- **Committed in:** 7642b48e (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes necessary for compilation. No scope creep.

## Issues Encountered
- CGO_ENABLED=0 build fails due to pre-existing webp library issue (documented in STATE.md). Build with CGO enabled succeeds.
- Lint run shows pre-existing errcheck/staticcheck issues unrelated to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend fully ready for plan 02 (frontend notification preferences UI)
- PATCH /users/me/preferences accepts notification_preferences field
- GET /users/me returns notification_preferences in response
- Empty {} default means all notifications enabled (opt-out model)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 39-notification-preferences*
*Completed: 2026-02-13*
