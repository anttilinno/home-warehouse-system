---
phase: 41-container-images
plan: 01
subsystem: infra
tags: [docker, dockerfile, multi-stage-build, compose, cgo, libwebp]

requires:
  - phase: 40-compose-profiles
    provides: docker-compose.yml with profile-based service definitions
provides:
  - Per-service Dockerfiles (server, worker, scheduler) with optimized dependencies
  - Worker image without CGO/libwebp overhead
affects: [42-deployment-scripts]

tech-stack:
  added: []
  patterns: [per-service-dockerfile, cgo-opt-out-for-pure-go]

key-files:
  created:
    - backend/Dockerfile.server
    - backend/Dockerfile.worker
  modified:
    - backend/Dockerfile.scheduler (renamed from Dockerfile)
    - docker-compose.yml

key-decisions:
  - "Worker uses CGO_ENABLED=0 and drops libwebp entirely (pure Go, no photo processing)"
  - "Scheduler retains libwebp for thumbnail processing jobs"
  - "Removed command overrides from compose since each Dockerfile has correct CMD"

patterns-established:
  - "Per-service Dockerfile: each backend binary gets its own Dockerfile with only required dependencies"

duration: 1min
completed: 2026-02-14
---

# Phase 41 Plan 01: Per-Service Dockerfiles Summary

**Split monolithic backend Dockerfile into three per-service variants: server and scheduler with CGO/libwebp, worker as pure Go without libwebp**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-14T21:51:42Z
- **Completed:** 2026-02-14T21:52:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created Dockerfile.server with CGO + libwebp for photo processing
- Created Dockerfile.worker as pure Go (CGO_ENABLED=0) without libwebp, saving build complexity and ~30MB
- Created Dockerfile.scheduler with CGO + libwebp for thumbnail jobs
- Updated docker-compose.yml to reference per-service Dockerfiles and removed redundant command overrides

## Task Commits

Each task was committed atomically:

1. **Task 1: Create per-service Dockerfiles** - `8506e2b6` (feat)
2. **Task 2: Update docker-compose.yml** - `f889bdf5` (feat)

## Files Created/Modified
- `backend/Dockerfile.server` - Multi-stage build for server binary with CGO + libwebp
- `backend/Dockerfile.worker` - Multi-stage build for worker binary, pure Go, no libwebp
- `backend/Dockerfile.scheduler` - Multi-stage build for scheduler binary with CGO + libwebp (renamed from Dockerfile)
- `docker-compose.yml` - Updated service build references to per-service Dockerfiles

## Decisions Made
- Worker uses CGO_ENABLED=0 since it only processes CSV imports, no photo/image work
- Scheduler retains libwebp and /data/photos since it runs thumbnail processing jobs
- Removed command overrides from worker and scheduler compose services since each Dockerfile now has the correct CMD built in

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three Dockerfiles ready for image building
- Compose validates with `docker compose --profile prod config`
- Ready for phase 42 deployment scripts

---
*Phase: 41-container-images*
*Completed: 2026-02-14*
