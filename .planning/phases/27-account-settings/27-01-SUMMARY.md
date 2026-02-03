---
phase: 27-account-settings
plan: 01
subsystem: auth
tags: [avatar, user-profile, file-upload, go, chi-router, image-processing]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: user entity, repository, service patterns
  - phase: 15-item-photo
    provides: LocalStorage and ImageProcessor patterns
provides:
  - User avatar upload/serve/delete endpoints
  - User email update capability
  - AvatarStorageAdapter reusing LocalStorage
  - User entity extended with avatarPath field
affects: [27-account-settings, frontend-account-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AvatarStorageAdapter wrapping GenericStorage for avatar-specific operations
    - Chi router used directly for multipart file uploads (Huma limitations)
    - Avatar thumbnail generation reusing existing ImageProcessor

key-files:
  created:
    - backend/internal/domain/auth/user/avatar_storage.go
  modified:
    - backend/internal/domain/auth/user/entity.go
    - backend/internal/domain/auth/user/repository.go
    - backend/internal/domain/auth/user/service.go
    - backend/internal/domain/auth/user/handler.go
    - backend/internal/infra/postgres/user_repository.go
    - backend/internal/api/router.go

key-decisions:
  - "Task 1 skipped - avatar_path already in initial schema"
  - "Used AvatarStorageAdapter to reuse existing LocalStorage infrastructure"
  - "Chi router for multipart upload as Huma doesn't handle multipart well"
  - "150x150 avatar thumbnails matching existing photo patterns"

patterns-established:
  - "Storage adapter pattern: wrap generic storage with domain-specific interface"
  - "Avatar URL generation via generateAvatarURL helper"

# Metrics
duration: 25min
completed: 2026-02-03
---

# Phase 27 Plan 01: Avatar and Email Update Backend Summary

**User avatar upload/serve/delete with 150x150 thumbnails via Chi router, email update endpoint, and AvatarStorageAdapter reusing existing LocalStorage patterns**

## Performance

- **Duration:** 25 min
- **Started:** 2026-02-03T17:15:00Z
- **Completed:** 2026-02-03T17:40:00Z
- **Tasks:** 3 (1 skipped - already complete)
- **Files modified:** 12

## Accomplishments

- Extended User entity with avatarPath field, UpdateAvatar(), and UpdateEmail() methods
- Added avatar upload endpoint (POST /users/me/avatar) with multipart handling via Chi
- Added avatar serve endpoint (GET /users/me/avatar) with cache headers (1 year, immutable)
- Added avatar delete endpoint (DELETE /users/me/avatar)
- Added email update to existing profile update endpoint (PUT /users/me)
- Created AvatarStorageAdapter reusing existing LocalStorage infrastructure
- Updated UserResponse to include avatar_url field
- All tests passing with updated mocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration** - Skipped (avatar_path already in initial schema 001_initial_schema.sql)
2. **Task 2: Extend user entity and service** - `e030519` (feat)
3. **Task 3: Add avatar and email endpoints** - `52e2b60` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

**Created:**
- `backend/internal/domain/auth/user/avatar_storage.go` - AvatarStorageAdapter wrapping LocalStorage

**Modified:**
- `backend/internal/domain/auth/user/entity.go` - Added avatarPath field, UpdateAvatar(), UpdateEmail()
- `backend/internal/domain/auth/user/repository.go` - Added UpdateAvatar, UpdateEmail interface methods
- `backend/internal/domain/auth/user/service.go` - Added UpdateAvatar, UpdateEmail service methods
- `backend/internal/domain/auth/user/handler.go` - Avatar upload/serve/delete handlers, email update
- `backend/internal/infra/postgres/user_repository.go` - SQL queries for avatar and email updates
- `backend/internal/api/router.go` - Wiring avatar storage adapter and routes
- `backend/internal/testutil/factory/user.go` - Updated for new Reconstruct signature
- `backend/internal/domain/auth/user/entity_test.go` - Updated tests
- `backend/internal/domain/auth/user/handler_test.go` - Added mock methods
- `backend/internal/domain/auth/user/service_test.go` - Added mock methods
- `backend/internal/domain/warehouse/pendingchange/service_test.go` - Added mock methods

## Decisions Made

1. **Task 1 skipped** - avatar_path column already exists in 001_initial_schema.sql, no migration needed
2. **AvatarStorageAdapter pattern** - Wrapped existing GenericStorage interface to provide avatar-specific SaveAvatar/GetAvatar/DeleteAvatar methods, avoiding code duplication
3. **Chi router for multipart** - Used Chi router directly for POST /users/me/avatar since Huma doesn't handle multipart file uploads well
4. **Avatar thumbnails 150x150** - Consistent with existing photo thumbnail patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test factory missing avatarPath parameter**
- **Found during:** Task 2 (verification)
- **Issue:** factory/user.go Reconstruct calls missing new avatarPath parameter
- **Fix:** Added `u.AvatarPath()` to Reconstruct calls in WithEmail and WithSuperuser
- **Files modified:** backend/internal/testutil/factory/user.go
- **Verification:** Tests compile and pass
- **Committed in:** e030519 (Task 2 commit)

**2. [Rule 3 - Blocking] Test mocks missing new interface methods**
- **Found during:** Task 3 (verification)
- **Issue:** MockService and MockRepository in test files didn't implement new UpdateAvatar/UpdateEmail methods
- **Fix:** Added mock method implementations
- **Files modified:** handler_test.go, service_test.go, pendingchange/service_test.go
- **Verification:** Tests compile and pass
- **Committed in:** 52e2b60 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for test compilation. No scope creep.

## Issues Encountered

None - plan executed smoothly after discovering Task 1 was pre-completed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend avatar support complete, ready for frontend integration (Plan 02)
- Email update API ready, frontend can add email editing to profile form
- All existing tests pass with new functionality

---
*Phase: 27-account-settings*
*Completed: 2026-02-03*
