---
phase: 40-database-migration-and-backend-oauth-core
plan: 02
subsystem: auth
tags: [oauth, golang-x-oauth2, google, github, profile-fetcher, user-resolution, domain-service]

# Dependency graph
requires:
  - phase: 40-01
    provides: "sqlc queries for oauth_accounts, user entity with NewOAuthUser and hasPassword support"
provides:
  - "OAuthAccount entity with private fields and Reconstruct"
  - "OAuthProfile value object for provider profile data"
  - "Domain errors: ErrEmailNotVerified, ErrProviderNotSupported, ErrAccountAlreadyLinked, ErrCannotUnlinkLastAuth"
  - "OAuth Repository interface and PostgreSQL implementation"
  - "Google provider config (openid+email+profile scopes)"
  - "GitHub provider config (user:email scope) with /user/emails for private-email users"
  - "FetchGoogleProfile and FetchGitHubProfile profile fetchers"
  - "FindOrCreateUser service with email verification gate and auto-linking"
  - "UnlinkAccount with lockout guard"
  - "GetProviderConfig helper for handler use"
affects: [40-03, oauth-handler, frontend-oauth]

# Tech tracking
tech-stack:
  added: [golang.org/x/oauth2 v0.35.0]
  patterns:
    - "OAuth domain follows existing entity pattern: private fields, getters, Reconstruct"
    - "Provider profile fetchers return OAuthProfile value object"
    - "FindOrCreateUser: existing-link -> email-verification-gate -> auto-link-or-create"
    - "WorkspaceCreator interface decouples OAuth from workspace domain"

key-files:
  created:
    - "backend/internal/domain/auth/oauth/entity.go"
    - "backend/internal/domain/auth/oauth/errors.go"
    - "backend/internal/domain/auth/oauth/repository.go"
    - "backend/internal/domain/auth/oauth/providers.go"
    - "backend/internal/domain/auth/oauth/service.go"
    - "backend/internal/infra/postgres/oauth_repository.go"
  modified:
    - "backend/go.mod"
    - "backend/go.sum"

key-decisions:
  - "GetProviderConfig is a package-level function (not method on Service) since it needs no state"
  - "GitHub profile fetcher always uses /user/emails to handle private-email users (Pitfall 8-G)"
  - "FindOrCreateUser returns (nil, false, ErrEmailNotVerified) for unverified emails -- never auto-links"
  - "OAuthRepository returns nil (not error) for FindByProviderAndID when account not found -- matches user repo pattern"

patterns-established:
  - "OAuth entity pattern: private fields, getters, Reconstruct -- consistent with user/session entities"
  - "Provider-specific profile fetchers: FetchXxxProfile returns *OAuthProfile from provider APIs"
  - "UserService/WorkspaceCreator interfaces in OAuth service for dependency inversion"

requirements-completed: [OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04, OAUTH-05, OAUTH-06, SEC-01]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 40 Plan 02: OAuth Domain Package Summary

**OAuth domain with Google/GitHub provider configs, profile fetchers using /user/emails for GitHub private emails, and FindOrCreateUser service with email verification gate and lockout-safe unlink**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T15:32:35Z
- **Completed:** 2026-02-22T15:35:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Complete OAuth domain package: entity, errors, repository interface, providers, and service
- Google provider configured with openid+email+profile scopes; GitHub with user:email and /user/emails fetcher
- FindOrCreateUser implements security-first flow: existing link check, email verification gate, auto-link or create
- UnlinkAccount prevents lockout by checking remaining auth methods before removal
- PostgreSQL repository maps between sqlc-generated queries and domain entities

## Task Commits

Each task was committed atomically:

1. **Task 1: Install golang.org/x/oauth2 and create OAuth entity, errors, and repository** - `d6952d0d` (feat)
2. **Task 2: Create OAuth provider configs, profile fetchers, and FindOrCreateUser service** - `3af85775` (feat)

## Files Created/Modified
- `backend/go.mod` - Added golang.org/x/oauth2 v0.35.0 dependency
- `backend/go.sum` - Updated dependency checksums
- `backend/internal/domain/auth/oauth/entity.go` - OAuthAccount entity with private fields and OAuthProfile value object
- `backend/internal/domain/auth/oauth/errors.go` - Domain errors for email verification, provider support, linking, unlinking
- `backend/internal/domain/auth/oauth/repository.go` - Repository interface for OAuth account persistence
- `backend/internal/domain/auth/oauth/providers.go` - Google/GitHub configs and FetchGoogleProfile/FetchGitHubProfile
- `backend/internal/domain/auth/oauth/service.go` - FindOrCreateUser, ListAccounts, UnlinkAccount, GetProviderConfig
- `backend/internal/infra/postgres/oauth_repository.go` - PostgreSQL implementation using sqlc queries

## Decisions Made
- GetProviderConfig is a package-level function rather than a method on Service since it needs no state, just config
- GitHub profile fetcher always uses /user/emails endpoint (never relies on /user email field) to handle private-email users
- FindOrCreateUser returns (nil, false, ErrEmailNotVerified) for unverified emails -- never performs auto-linking
- OAuthRepository.FindByProviderAndID returns (nil, nil) for not-found accounts (consistent with user repository pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- OAuth domain package complete and compiles cleanly
- Service ready for wiring in handler layer (Plan 03: OAuth HTTP handler + state management)
- UserService and WorkspaceCreator interfaces need concrete implementations wired in main.go
- Provider configs need GOOGLE_CLIENT_ID/SECRET and GITHUB_CLIENT_ID/SECRET environment variables

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 40-database-migration-and-backend-oauth-core*
*Completed: 2026-02-22*
