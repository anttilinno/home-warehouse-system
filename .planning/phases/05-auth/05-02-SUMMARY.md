---
phase: 05-auth
plan: 02
subsystem: testing
tags: [msw, vitest, react-query, react-router, auth, lingui]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: lib/api.ts cookie-JWT client + single-flight refresh; RequireAuth guard; vitest jsdom setup
provides:
  - Shared MSW node server + auth-endpoint handlers fixture (src/test/msw/*) reusable by Plans 03/04/05
  - api.ts auth-expired CustomEvent emitted once per failed refresh (additive, invariants preserved)
  - RequireAuth network/5xx retry surface (no spurious logout) + single auth-expired consumer with cleanup
affects: [05-auth Plan 03, 05-auth Plan 04, 05-auth Plan 05]

# Tech tracking
tech-stack:
  added: []  # msw/vitest already present — no new packages
  patterns:
    - "MSW shared fixture: setupServer in src/test/msw/server.ts, lifecycle in src/test/setup.ts, per-case server.use overrides"
    - "auth-expired event: single emitter (api.ts doRefresh failure) → single consumer (RequireAuth useEffect)"
    - "Status-aware guard: 401/403 redirect FIRST, then isPending, then network/5xx retry-not-logout"

key-files:
  created:
    - frontend2/src/test/msw/handlers.ts
    - frontend2/src/test/msw/server.ts
    - frontend2/src/test/setup.ts
    - frontend2/src/lib/api.test.ts
    - frontend2/src/features/auth/RequireAuth.test.tsx
  modified:
    - frontend2/src/lib/api.ts
    - frontend2/src/features/auth/RequireAuth.tsx
    - frontend2/vitest.config.ts

key-decisions:
  - "Dispatch auth-expired from inside doRefresh (single-flighted via refreshPromise) so concurrent 401s emit exactly one event"
  - "auth-expired fires on BOTH failure paths — no stored token early-throw AND refresh !ok — so a gone session always signals expiry"
  - "onUnhandledRequest: error in MSW setup keeps fixtures honest; safe because no existing test hits the network"
  - "RequireAuth retry branch uses isError (after 401/403 + isPending) so 403 never reaches the retry surface"

patterns-established:
  - "MSW node server fixture wired into vitest setupFiles; tests override per-case with server.use"
  - "auth-expired event single-emitter/single-consumer pattern (no scattered logout)"

requirements-completed: [AUTH-01, AUTH-05]

# Metrics
duration: ~20min
completed: 2026-06-13
---

# Phase 5 Plan 02: MSW substrate + api.ts auth-expired + RequireAuth hardening Summary

**Shared MSW auth fixture, an additive single-flight `auth-expired` CustomEvent in the locked api.ts client, and a RequireAuth retry surface that stops the v2.0 spurious-logout-on-5xx regression — all three proven with tests.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- Shared MSW v2 server + auth-endpoint handlers (`/api/...` prefix matching the BASE_URL) wired into the vitest jsdom run; reusable by Plans 03/04/05.
- api.ts now emits a single `auth-expired` CustomEvent on refresh failure — additive only, all four locked invariants (credentials include, single-flight refreshPromise, BASE_URL "/api", isFormData branch) verified untouched.
- RequireAuth gains the missing network/5xx half of the spurious-logout fix: a `role="alert"` retry surface with the contract copy, plus the single `auth-expired` consumer (useEffect + cleanup) the checker required.
- Full frontend suite green: 263 tests (250 baseline + 13 new), tsc clean, lint:imports OK, production build succeeds.

## Task Commits

1. **Task 1: MSW shared fixture (server + auth handlers)** - `aa04639` (test)
2. **Task 2: api.ts auth-expired event + invariant tests (TDD)** - `21c13a2` (test/RED) → `ac8ceb7` (feat/GREEN)
3. **Task 3: RequireAuth retry affordance + auth-expired consumer (TDD)** - `a7bcef2` (test) → `0ececba` (feat)

## Files Created/Modified
- `frontend2/src/test/msw/handlers.ts` - MSW v2 handlers for auth/identity/session/oauth endpoints, contract-shaped happy-path JSON.
- `frontend2/src/test/msw/server.ts` - `setupServer(...handlers)` shared node server.
- `frontend2/src/test/setup.ts` - beforeAll(listen, onUnhandledRequest:"error") / afterEach(resetHandlers) / afterAll(close).
- `frontend2/vitest.config.ts` - registered the new setup file in setupFiles (additive).
- `frontend2/src/lib/api.ts` - added `emitAuthExpired()` to both doRefresh failure paths (additive only).
- `frontend2/src/lib/api.test.ts` - auth-expired single-flight assertions + locked-invariant guards.
- `frontend2/src/features/auth/RequireAuth.tsx` - network/5xx retry surface + auth-expired useEffect consumer with cleanup.
- `frontend2/src/features/auth/RequireAuth.test.tsx` - both AUTH-05 branches + event consumer + cleanup, with the v2.0 negative regression assertion.

## Decisions Made
- Emitted `auth-expired` from inside `doRefresh` rather than from `request`, because `doRefresh` is the single-flighted unit — concurrent callers awaiting the shared `refreshPromise` therefore observe exactly one event (proven by the two-concurrent-401s test asserting `refreshCalls === 1` and one event).
- Fired the event on the no-stored-token early throw as well as the refresh `!ok` path, so a session that is already gone (no token to refresh) still signals expiry.
- Used `onUnhandledRequest: "error"` in the MSW setup — verified no existing test crosses the network, so this surfaces forgotten handlers without breaking the baseline.

## Deviations from Plan

None - plan executed exactly as written. (api.ts diff confirmed purely additive: `git diff <base> -- src/lib/api.ts` shows zero removed lines.)

## TDD Gate Compliance
- Task 2: RED commit `21c13a2` (3 auth-expired tests failed against the un-instrumented client; 4 invariant tests passed) → GREEN commit `ac8ceb7` (all 7 pass). RED was observed before GREEN.
- Task 3: test commit `a7bcef2` → feat commit `0ececba`. The new test depends on the new RequireAuth branches/consumer; both branches and the cleanup pass.

## Issues Encountered
None.

## Known Stubs
None — MSW handlers return placeholder tokens by design (test fixtures, threat T-05-08); these are not product stubs.

## Threat Flags
None — no new network surface introduced; all changes are test infrastructure + an additive client event + a guard branch.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 03/04/05 can import `@/test/msw/server` and override handlers per-case for login/register/OAuth/sessions/password/accounts flows.
- The `auth-expired` event contract is live: any future code path that calls the api client gets a single redirect-to-login via the RequireAuth consumer — no need to scatter logout logic.
- RequireAuth now safely tolerates transient backend outages (retry, not logout).

## Self-Check: PASSED

All 5 created files exist on disk; all 5 task commits (aa04639, 21c13a2, ac8ceb7, a7bcef2, 0ececba) present in git history.

---
*Phase: 05-auth*
*Completed: 2026-06-13*
