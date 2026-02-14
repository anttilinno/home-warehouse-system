---
phase: 40-compose-profiles-and-environment
verified: 2026-02-14T23:30:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 40: Compose Profiles and Environment Verification Report

**Phase Goal:** Developer runs `docker compose up` for dev and `docker compose --profile prod up` for full production stack with proper isolation

**Verified:** 2026-02-14T23:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `docker compose up` starts only postgres and redis with ports exposed to host | ✓ VERIFIED | `docker compose config --services` outputs exactly: `postgres`, `redis`. Dev postgres on 5432, redis on 6379 |
| 2 | `docker compose --profile prod up` starts the full stack including postgres-prod, backend, worker, scheduler, frontend, angie, and docspell | ✓ VERIFIED | `docker compose --profile prod config --services` includes all 12 services: postgres, redis, postgres-prod, migrate, backend, worker, scheduler, frontend, angie, docspell-postgres, docspell-restserver, docspell-joex |
| 3 | Prod postgres is a separate container with separate volume and no exposed ports | ✓ VERIFIED | postgres-prod service exists (line 44), uses named volume `postgres-prod-data` (line 54), NO ports section (verified lines 44-62) |
| 4 | Docspell services only start under the prod profile | ✓ VERIFIED | All three docspell services have `profiles: ["prod"]`: docspell-postgres (line 72), docspell-restserver (line 94), docspell-joex (line 118) |
| 5 | Migration targets postgres-prod in prod profile | ✓ VERIFIED | migrate service depends on postgres-prod (line 144), DATABASE_URL points to postgres-prod:5432 (line 147) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docker-compose.yml` | Dev/prod profile separation with isolated databases | ✓ VERIFIED | Contains postgres-prod service definition with prod profile, 10 total profile declarations |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| migrate service | postgres-prod | DATABASE_URL connection string | ✓ WIRED | Line 147: `postgresql://wh:${POSTGRES_PASSWORD:-wh}@postgres-prod:5432/warehouse_prod` |
| backend | postgres-prod | environment variables | ✓ WIRED | Line 165: DATABASE_URL points to postgres-prod:5432 |
| worker | postgres-prod | environment variables | ✓ WIRED | Line 195: GO_DATABASE_URL points to postgres-prod:5432 |
| scheduler | postgres-prod | environment variables | ✓ WIRED | Line 215: GO_DATABASE_URL points to postgres-prod:5432 |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| COMP-01: Dev profile runs only Postgres + Redis with exposed ports | ✓ SATISFIED | None — verified via `docker compose config --services` |
| COMP-02: Prod profile runs full stack | ✓ SATISFIED | None — verified via `docker compose --profile prod config --services` (12 services) |
| COMP-03: Prod Postgres uses separate container and volume, no exposed ports | ✓ SATISFIED | None — postgres-prod has named volume, no ports section |
| COMP-04: Docspell services moved to prod profile | ✓ SATISFIED | None — all 3 docspell services have `profiles: ["prod"]` |
| COMP-05: Migration runner executes before app services start | ✓ SATISFIED | None — migrate depends on postgres-prod, backend/worker/scheduler depend on migrate |
| ENV-01: Prod env vars set for production | ✓ SATISFIED | None — NODE_ENV=production (frontend), APP_ENV=production (backend), no DEBUG flags |
| ENV-02: Dev credentials not exposed in production containers | ✓ SATISFIED | None — JWT_SECRET uses required variable substitution `${JWT_SECRET:?}`, postgres password parameterized |
| ENV-03: Photo storage uses named Docker volume in prod | ✓ SATISFIED | None — `photo-storage:` named volume used by backend/worker/scheduler at /data/photos |

### Anti-Patterns Found

None detected.

**Checks performed:**
- No TODO/FIXME/XXX/HACK/PLACEHOLDER comments found
- No DEBUG environment variables in any service
- No empty implementations or placeholder values
- All services properly wired with dependencies

### Detailed Verification Results

**Profile Separation:**
- 10 services have `profiles: ["prod"]`: postgres-prod, migrate, backend, worker, scheduler, frontend, angie, docspell-postgres, docspell-restserver, docspell-joex
- 2 services have no profile (dev only): postgres, redis
- Dev compose starts only infrastructure: ✓
- Prod compose starts full stack: ✓

**Database Isolation:**
- Dev postgres: container `warehouse-postgres`, database `warehouse_dev`, port 5432 exposed, bind mount `./.data/postgres`
- Prod postgres: container `warehouse-postgres-prod`, database `warehouse_prod`, NO port exposure, named volume `postgres-prod-data`
- Separate healthchecks for each database: ✓
- Migration targets postgres-prod: ✓

**Environment Variables (Production Hardening):**
- **Backend:** JWT_SECRET required (fails if unset), APP_ENV=production, NO DEBUG flag, PHOTO_STORAGE_DIR=/data/photos
- **Worker:** GO_DATABASE_URL (worker-specific), REDIS_URL with redis:// prefix, PHOTO_STORAGE_DIR=/data/photos
- **Scheduler:** GO_DATABASE_URL (consistency with worker), REDIS_URL with redis:// prefix, PHOTO_STORAGE_DIR=/data/photos
- **Frontend:** NODE_ENV=production, NEXT_PUBLIC_API_URL="" (Angie proxies /api)

**Dependency Chain:**
```
postgres-prod (healthy) 
  → migrate (completed successfully)
    → backend/worker/scheduler (depends on migrate + redis)
      → angie (depends on backend + frontend health)
```

**Named Volumes:**
- `photo-storage`: Shared by backend, worker, scheduler for persistent photo data
- `postgres-prod-data`: Prod database persistence (isolated from dev)

**Commits Verified:**
- Task 1: `7d12773a` — Add prod Postgres and profile Docspell services (36 insertions, 5 deletions)
- Task 2: `745b3676` — Harden prod environment variables (7 insertions, 4 deletions)

Both commits exist in git history with expected changes.

### Human Verification Required

**1. Test Dev Compose Startup**

**Test:** Run `docker compose up` and verify only postgres + redis start
**Expected:** 
- Only 2 containers start: warehouse-postgres, warehouse-redis
- Postgres accessible on localhost:5432
- Redis accessible on localhost:6379
- No application services running

**Why human:** Requires actual docker runtime execution to verify startup behavior

**2. Test Prod Compose Startup**

**Test:** Set `JWT_SECRET=test-secret` and run `docker compose --profile prod up`
**Expected:**
- All 12 services start in correct order: postgres/redis → postgres-prod → migrate → backend/worker/scheduler/frontend → angie + 3 docspell services
- postgres-prod NOT accessible from host (no port 5432 exposure)
- postgres-prod volume persists at docker volume `postgres-prod-data`
- Application accessible via Angie on ports 80/443

**Why human:** Requires full stack runtime execution and port accessibility testing

**3. Test JWT_SECRET Requirement**

**Test:** Run `docker compose --profile prod config` WITHOUT setting JWT_SECRET
**Expected:** Error message: "required variable JWT_SECRET is missing a value: JWT_SECRET must be set"
**Why human:** Already verified programmatically (exit code 1), but human should confirm error message clarity

**4. Verify Photo Storage Persistence**

**Test:** 
1. Start prod stack with `JWT_SECRET=test docker compose --profile prod up -d`
2. Upload a photo via the application
3. Stop and remove all containers: `docker compose --profile prod down`
4. Restart prod stack
5. Verify photo still exists in application

**Expected:** Photos persist across container restarts via `photo-storage` named volume

**Why human:** Requires application interaction and data persistence testing across restarts

### Gaps Summary

No gaps identified. All must-haves verified, all requirements satisfied, no anti-patterns detected.

---

_Verified: 2026-02-14T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
