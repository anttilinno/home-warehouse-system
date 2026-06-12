---
phase: 05-auth
plan: 01
subsystem: backend-auth
tags: [auth, sessions, revocation, integration-test, security-audit]
requires:
  - "session.Service (FindByTokenHash, Revoke) — existing"
  - "AUTH-12 logout-revocation fix (commit f49e4b48) — existing"
provides:
  - "CurrentSession middleware: populates current-session id from refresh cookie"
  - "Cookie-capable integration harness helpers (RequestWithCookies/PostWithCookie)"
  - "Regression guards: logout revocation, F3 no-resurrection, is_current"
  - "Corrected BACKEND-SECURITY audit (F2/F3 RESOLVED)"
affects:
  - "AUTH-07 sessions UI (Plan 05-05): is_current + revoke-all-others now functional"
tech-stack:
  added: []
  patterns:
    - "SessionResolver/IdentifiedSession interfaces in middleware to avoid import cycle"
    - "Best-effort context enrichment middleware (never a hard auth gate)"
key-files:
  created:
    - ".planning/phases/05-auth/05-01-SUMMARY.md"
  modified:
    - "backend/internal/api/middleware/auth.go"
    - "backend/internal/api/router.go"
    - "backend/tests/integration/setup.go"
    - "backend/tests/integration/auth_test.go"
    - "docs/audit/BACKEND-SECURITY.md"
decisions:
  - "Decoupled CurrentSession from the session package via local interfaces + a router-side adapter to break the middleware<->session import cycle (session/handler.go already imports middleware)."
  - "Set cfg.RedisURL in the integration harness — empty string fatal'd NewRouter via redis.ParseURL; the production default is identical."
  - "CurrentSession swallows all lookup failures (no cookie / miss / revoked) by design — id is display/UX only; revoke authz still enforced by service ownership checks."
metrics:
  duration: "~25m"
  completed: "2026-06-12"
  tasks: 3
  files-modified: 5
---

# Phase 5 Plan 01: Backend Revocation Guard + WithCurrentSessionID Wire-up + Audit Doc Summary

Locked AUTH-12's already-shipped logout-revocation (commit f49e4b48) behind live-Postgres regression guards, closed the AUTH-07 backend gap by wiring a best-effort `CurrentSession` middleware that resolves the refresh-cookie session id into request context (making `is_current` and revoke-all-others functional), and corrected the stale BACKEND-SECURITY audit to mark F2/F3 RESOLVED with test citations.

## What Was Built

**Task 1 — CurrentSession middleware (AUTH-07 backend gap):** Added `CurrentSession(SessionResolver)` to `middleware/auth.go`, applied on the protected route group immediately after `JWTAuth`. It reads the `refresh_token` cookie, SHA-256-hashes it (mirroring `session.HashToken`), looks the row up, and wraps the context with `WithCurrentSessionID`. Every failure path (no cookie, lookup miss, revoked) passes through unchanged so SSE query-param and Bearer-only callers still authenticate. To break the `middleware` ↔ `session` import cycle (session/handler.go already imports middleware), the lookup contract is declared as local `SessionResolver`/`IdentifiedSession` interfaces, bridged by a `sessionResolverAdapter` in `router.go` where the session package is already in scope. Commit `97ae04a1`.

**Task 2 — Integration regression guards (AUTH-12/F2/F3, AUTH-07):** Added cookie-capable harness helpers (`RequestWithCookies`, `PostWithCookie`) — the stock harness sends only `Authorization: Bearer` and has no cookie jar, but logout/refresh and CurrentSession read cookies (Pitfall 3). Three `//go:build integration` tests:
- `TestLogout_RevokesSession`: cookie-bearing logout → refresh replay returns 401 with detail "revoked".
- `TestRefresh_RevokedSession_NoNewSession` (F3): revoked token replayed twice stays 401 (never 200); same-user session list does not regrow (no resurrected row).
- `TestSessions_CurrentSessionMarked` (AUTH-07): with both cookies present, exactly one session is `is_current=true` and revoke-all-others returns 2xx (not 400 "current session not found").

Guard property verified: temporarily removing the CurrentSession wiring makes `TestSessions_CurrentSessionMarked` fail (is_current false, revoke-all-others 400). Commit `c2ca21d9`.

**Task 3 — Audit doc correction:** Appended RESOLVED annotation blocks to F2 and F3 in `docs/audit/BACKEND-SECURITY.md` (original finding text preserved), citing commit f49e4b48 and the two new regression tests, and marked both severity-summary rows resolved. F1 and F4-F17 untouched. Commit `f8b0827f`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import cycle: middleware importing session**
- **Found during:** Task 1
- **Issue:** The plan's action wired `CurrentSession(sessionSvc *session.Service)` directly, but `session/handler.go` already imports the middleware package for `GetCurrentSessionID`/`GetAuthUser` — adding a `session` import to `middleware/auth.go` produced `import cycle not allowed`.
- **Fix:** Declared minimal `SessionResolver`/`IdentifiedSession` interfaces in middleware (no session import), inlined the SHA-256 hash, and added a `sessionResolverAdapter` in router.go to bridge `*session.Service` (whose `FindByTokenHash` returns `*session.Session`) to the interface. Behaviour identical to the plan's intent.
- **Files modified:** backend/internal/api/middleware/auth.go, backend/internal/api/router.go
- **Commit:** 97ae04a1

**2. [Rule 3 - Blocking] Integration harness fatal on empty RedisURL**
- **Found during:** Task 2 (sanity-running existing integration tests)
- **Issue:** `NewRouter` calls `redis.ParseURL(cfg.RedisURL)` with `log.Fatalf` on error; the integration harness builds `config.Config{}` directly (bypassing `config.Load`'s `getEnv` default), so `RedisURL` was `""` → `invalid URL scheme` → the entire test binary died before any test ran. This blocked ALL integration tests, not just the new ones.
- **Fix:** Set `RedisURL: "redis://localhost:6379/0"` (identical to the production `getEnv` default) in the harness `cfg`. Redis is lazily connected, so no live Redis is required at router build; a live Redis is present in this env regardless.
- **Files modified:** backend/tests/integration/setup.go
- **Commit:** c2ca21d9

## Verification

- `cd backend && go build ./...` — exit 0.
- `cd backend && go test ./...` (default lane, no integration tag) — 0 failures.
- `cd backend && TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./tests/integration/ -run 'Logout|RevokedSession|CurrentSessionMarked' -v` — all 3 PASS.
- `go test ./internal/api/middleware/... ./internal/domain/auth/session/...` — green.
- Guard negative-check: disabling the CurrentSession wiring fails `TestSessions_CurrentSessionMarked` (proves the test guards Task 1).
- Audit doc: `RESOLVED`×4, `f49e4b48`×4, both test names cited; F2/F3 original text preserved.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. The CurrentSession middleware reads an existing cookie and resolves an existing table; it is best-effort and never grants privilege (T-05-03 disposition: mitigate, satisfied).

## Self-Check: PASSED

- backend/internal/api/middleware/auth.go — FOUND
- backend/internal/api/router.go — FOUND
- backend/tests/integration/setup.go — FOUND
- backend/tests/integration/auth_test.go — FOUND
- docs/audit/BACKEND-SECURITY.md — FOUND
- Commit 97ae04a1 — FOUND
- Commit c2ca21d9 — FOUND
- Commit f8b0827f — FOUND
