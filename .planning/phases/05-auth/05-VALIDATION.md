---
phase: 5
slug: auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 5 — Validation Strategy

> Two-stack phase: frontend auth surface + backend F2/F3 revocation fix.
> See 05-RESEARCH.md Validation Architecture for the endpoint contract map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + RTL + MSW (frontend); Go test + tests/testdb harness (backend, `-tags=integration`); Playwright (E2E vs live stack — UP at :5173/:8080) |
| **Config file** | `frontend2/vitest.config.ts`, `frontend2/playwright.config.ts`, backend `tests/testdb` |
| **Quick run command** | `cd frontend2 && bun run test src/` · `cd backend && go test ./internal/domain/auth/...` |
| **Full suite command** | frontend: `bun run test && bun run build && bun run lint:imports && bun run lint:tsc` · backend: `go build ./... && go test ./...` · integration: `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./internal/domain/auth/... -v` |
| **Estimated runtime** | ~40s frontend full · ~30s backend · ~60s integration+E2E |

---

## Sampling Rate

- **After every task commit:** affected specs (frontend) or package tests (backend)
- **After every plan wave:** full frontend suite + build + lint; backend `go build ./... && go test ./...` when backend touched
- **Before phase verification:** all of the above + Playwright E2E vs live stack + Go integration suite
- **Max feedback latency:** 60s (integration), 40s otherwise

---

## Per-Requirement Verification Map

| Requirement | Behavior to prove | Test Type |
|-------------|-------------------|-----------|
| AUTH-01 | login E2E (exists — keep green) + single-flight refresh unit (api.ts untouched invariant) | e2e + unit |
| AUTH-02 | register form → 201 → authenticated (MSW unit + E2E with unique email vs live stack) | unit + e2e |
| AUTH-03/04 | OAuth initiate URL building + /auth/callback exchange flow + error taxonomy (MSW; StrictMode double-exchange guard test) | unit (E2E skip-with-reason — providers unconfigured) |
| AUTH-05 | RequireAuth: HttpError 401/403 → redirect; network error/5xx → stay + retry affordance (MSW failure injection) | unit |
| AUTH-06 | WorkspaceProvider: init from /users/me/workspaces, localStorage persistence, switch invalidates queries; DashboardPage hardcode GONE (grep) | unit + grep |
| AUTH-07 | sessions list + revoke one/all-others (MSW); current-session badge | unit |
| AUTH-08 | password change: current verified; has_password=false → set-password form (no current field) | unit |
| AUTH-09 | delete account: type-DELETE gate, can-delete check, sole-owner error surfaced | unit |
| AUTH-10 | connected accounts link/unlink; last-method lockout guard disables unlink | unit |
| AUTH-11 | Authelia button env-gated: hidden when flag absent; routes to BARE /auth/authelia/login (NOT /api) — grep + unit | unit + grep |
| AUTH-12 | **Go integration (tags=integration): login → logout → refresh with old cookie → 401; revoked session NOT re-created (F3 guard — refresh after revoke must not mint a session row)** + E2E: logout then back-button/api call → /login | go-integration + e2e |

---

## Wave 0 Requirements

- [ ] Backend F2+F3 fix FIRST (logout revoke + remove/gate legacy-token fallback) with Go integration test in the same plan — frontend logout wiring depends on it
- [ ] WorkspaceProvider lands before any page consumes wsId from context
- [ ] api.ts changes (auth-expired event) covered by unit tests preserving single-flight invariant

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Real Google/GitHub OAuth round-trip | needs real provider creds | configure providers, run flow once |
| Authelia SSO round-trip | needs Authelia deployment | homelab ingress test |
| Login page visual vs sketch 007 | visual | eyeball |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
