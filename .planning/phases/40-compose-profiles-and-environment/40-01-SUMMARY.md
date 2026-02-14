---
phase: 40-compose-profiles-and-environment
plan: 01
subsystem: infra
tags: [docker, compose, profiles, postgres, production]

requires:
  - phase: none
    provides: existing docker-compose.yml with dev infrastructure
provides:
  - Dev/prod profile separation with isolated databases
  - postgres-prod container for production workloads
  - Docspell services behind prod profile
  - Production-hardened environment variables
affects: [41-dockerfiles, 42-production-config]

tech-stack:
  added: []
  patterns: [compose-profiles-for-environment-separation, parameterized-credentials]

key-files:
  created: []
  modified: [docker-compose.yml]

key-decisions:
  - "Separate postgres-prod container with named volume (not bind mount) for production data isolation"
  - "JWT_SECRET uses required variable substitution to prevent accidental deployment with defaults"
  - "Scheduler uses GO_DATABASE_URL for consistency with worker service"
  - "Frontend gets empty NEXT_PUBLIC_API_URL since Angie proxies /api paths"

patterns-established:
  - "Profile separation: no profile = dev infra only, prod profile = full stack"
  - "Credential parameterization: ${VAR:-default} for dev convenience, ${VAR:?error} for required secrets"

duration: 2min
completed: 2026-02-14
---

# Phase 40 Plan 01: Compose Profiles and Environment Summary

**Dev/prod compose profile separation with isolated postgres-prod, profiled Docspell, and hardened production environment variables**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T21:11:32Z
- **Completed:** 2026-02-14T21:13:39Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added postgres-prod container with prod profile, no exposed ports, named volume for data isolation
- Moved all three Docspell services behind prod profile (docspell-postgres, docspell-restserver, docspell-joex)
- Updated migrate/backend/worker/scheduler to target postgres-prod database
- Hardened environment variables: removed DEBUG, required JWT_SECRET, fixed REDIS_URL format, added APP_ENV and NODE_ENV

## Task Commits

Each task was committed atomically:

1. **Task 1: Add prod Postgres and profile Docspell services** - `7d12773a` (feat)
2. **Task 2: Fix prod environment variables for production readiness** - `745b3676` (fix)

## Files Created/Modified
- `docker-compose.yml` - Added postgres-prod service, profiled Docspell, hardened env vars

## Decisions Made
- postgres-prod uses named volume (`postgres-prod-data`) instead of bind mount for better portability
- JWT_SECRET uses `${JWT_SECRET:?}` syntax to fail fast if unset
- Scheduler env var changed from DATABASE_URL to GO_DATABASE_URL for consistency with worker
- Frontend NEXT_PUBLIC_API_URL set to empty string since Angie reverse proxy handles /api routing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- docker-compose.yml ready for Dockerfile creation (Phase 41)
- Production environment variables parameterized for .env file configuration (Phase 42)

---
*Phase: 40-compose-profiles-and-environment*
*Completed: 2026-02-14*
