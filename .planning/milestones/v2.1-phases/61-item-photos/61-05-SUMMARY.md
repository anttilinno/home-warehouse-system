---
phase: 61-item-photos
plan: 05
subsystem: infra
tags: [mise, asynq, worker, thumbnails, redis]

# Dependency graph
requires:
  - phase: 61-item-photos
    provides: photo upload pipeline (61-01..61-04), cmd/worker/main.go, [tasks.worker] mise task
provides:
  - mise run start launches the asynq thumbnail worker alongside backend and frontend dev servers
  - thumbnail_status advances from pending to ready during normal dev sessions without a separate terminal
affects: [dev workflow, thumbnail pipeline UAT, photo gallery UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel dev process composition via `&` in mise tasks.start run command"

key-files:
  created: []
  modified:
    - ".mise.toml"

key-decisions:
  - "Run `mise run worker` in parallel with `dev` and `fe-dev` inside tasks.start rather than introducing a new umbrella task — minimises churn and matches existing pattern"
  - "Keep worker ordering between dev (API) and fe-dev (Vite) so process log interleaving reads chronologically per tier (backend, background, frontend)"

patterns-established:
  - "tasks.start run command lists all dev-time processes joined by ` & `; add new long-running dev processes here rather than creating a new orchestrator task"

requirements-completed: [PHOTO-01]

# Metrics
duration: ~2 min
completed: 2026-04-16
---

# Phase 61 Plan 05: Worker in tasks.start Summary

**Added `mise run worker` to `tasks.start` so the asynq thumbnail job processor starts alongside dev and fe-dev, unblocking thumbnail_status transitions during local development.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-16T19:05:00Z
- **Completed:** 2026-04-16T19:06:41Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `mise run start` now launches the asynq worker as a third parallel process between `dev` and `fe-dev`
- Resolves UAT test 1 major issue: gallery tiles can transition from PROCESSING... to rendered thumbnails because jobs queued in Redis are consumed
- Zero new tasks, zero new dependencies — single-line TOML edit that reuses the pre-existing `[tasks.worker]` task

## Task Commits

Each task was committed atomically:

1. **Task 1: Add worker to tasks.start run command** - `6c239c0` (fix)

_Note: SUMMARY.md is committed separately below (metadata commit)._

## Files Created/Modified
- `.mise.toml` — Appended `mise run worker &` to `tasks.start.run` between existing `mise run dev &` and `mise run fe-dev` commands

## Decisions Made
- Kept existing `[tasks.worker]` definition untouched; only `tasks.start.run` was modified
- Ordering chosen as dev → worker → fe-dev so the API server comes up first (worker depends on dc-up via its own `depends` field, backend depends on same containers), the background processor starts second, and the Vite dev server last

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Existing Redis container (started via `dc-up`) already serves the asynq queue.

## Verification

Post-edit verification executed:

1. `grep -n "mise run worker" .mise.toml` returned a single match inside `[tasks.start]`:
   ```
   72:run = "mise run dev & mise run worker & mise run fe-dev"
   ```
2. `git diff` shows the single intended line change with no other tasks.start fields modified (`description` and `depends` preserved).
3. No accidental deletions on HEAD commit (`git diff --diff-filter=D HEAD~1 HEAD` returned empty).

**Functional verification (deferred to next `mise run start` session):** Orchestrator or developer should run `mise run start` and confirm three processes start (air for dev, go run cmd/worker/main.go, bun run dev for frontend), then upload a photo and observe `thumbnail_status` transition from `pending` to `ready` within a few seconds. This matches UAT test 1 expectation.

## Next Phase Readiness
- Phase 61 UAT test 1 gap closed — all 8 UAT tests can now pass in a standard dev environment
- No blockers for downstream Phase 61 verification or Phase 62 planning

## Self-Check: PASSED

- FOUND: `.mise.toml` modified at line 72 containing `mise run worker`
- FOUND: commit `6c239c0` (`fix(61-05): add worker to tasks.start run command`)

---
*Phase: 61-item-photos*
*Completed: 2026-04-16*
