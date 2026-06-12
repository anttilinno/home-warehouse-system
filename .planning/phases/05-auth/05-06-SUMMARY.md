---
phase: 05-auth
plan: 06
subsystem: auth-e2e
tags: [e2e, playwright, auth, revocation, workspace-switcher]
requires:
  - "05-03 RegisterPage (/register Create-account flow)"
  - "05-04 useLogout + TopBar logout confirm (POST /auth/logout revokes)"
  - "05-05 WorkspaceSwitcher pill (data-testid=workspace-pill)"
provides:
  - "Browser-layer AUTH-12 regression guard (logout actually revokes the session)"
  - "Register + workspace-switcher live-stack E2E coverage"
affects:
  - "frontend2/e2e (Playwright live-stack project: chromium + firefox)"
tech-stack:
  added: []
  patterns:
    - "Scoped test.skip(condition, reason) inside the test body — NOT top-level (avoids skipping the whole file)"
    - "page.request inherits the access_token cookie — protected-endpoint probe needs no token plumbing"
    - "Switcher assertion robust to single (label) vs multi (listbox) workspace shape"
key-files:
  created:
    - frontend2/e2e/auth.spec.ts
  modified: []
decisions:
  - "Logout-revocation assertion = post-logout GET /api/users/me returns 401 + redirect to /login (the old session cannot be reused)"
  - "Switcher test asserts presence/openability, not an actual switch, to stay deterministic when the seeder has a single workspace"
  - "OAuth Google/GitHub recorded as scoped test.skip with reason (provider creds + APP_URL=:5173 absent in CI per parity §7), not omitted"
metrics:
  duration: ~12m
  completed: 2026-06-13
  tasks: 1
  files: 1
---

# Phase 05 Plan 06: E2E Auth Specs Summary

Live-stack Playwright auth guards (`frontend2/e2e/auth.spec.ts`): a unique-email register flow, a real logout-that-revokes proof (the AUTH-12 browser complement to Plan 01's Go integration test), and the workspace switcher's live presence — with OAuth initiate recorded as scoped skip-with-reason.

## What Was Built

`frontend2/e2e/auth.spec.ts` extends the existing live-stack Playwright project (chromium + firefox, no `webServer` — the config expects the running stack) with three real tests plus two recorded OAuth skips:

1. **REGISTER (AUTH-02)** — navigates `/register`, fills Full name + a UNIQUE email (`e2e+${Date.now()}@test.local`) + an 8-char password + matching confirm, clicks "Create account", and asserts the URL becomes `/` with the dashboard's `Items` stat heading visible (the same authenticated marker the login spec uses). The timestamp suffix keeps the test idempotent across runs.
2. **SWITCHER VISIBLE (AUTH-06)** — logs in with seeder creds (exact-match `/^log in$/i` submit, now that the OAuth buttons share the login page), asserts `data-testid="workspace-pill"` is visible, then branches on shape: multi-workspace → the listbox trigger (`aria-haspopup="listbox"`, not disabled) opens and at least one `option` renders; single-workspace → the pill is a non-empty `aria-disabled` label. Presence/openability only — no actual switch — to stay deterministic.
3. **LOGOUT-REVOCATION (AUTH-12 end-to-end)** — logs in; confirms `GET /api/users/me` returns 200 (page.request inherits the cookie); logs out through the real UI (user pill → "Log out" menuitem → confirm dialog → danger "Log out"); then asserts the app lands on `/login`, a fresh `GET /api/users/me` returns **401** (the revoked session cannot be reused), and navigating to `/` bounces back to `/login`.
4. **OAUTH (AUTH-03/04)** — Google + GitHub initiate tests with a scoped `test.skip(true, reason)` inside each body (provider creds + `APP_URL=:5173` absent in CI per parity §7), so the skip is RECORDED, not silently absent.

## Verification

- **In-plan gate:** `cd frontend2 && npx playwright test --list e2e/auth.spec.ts` → exit 0, lists 10 tests (register + switcher + logout-revocation + 2 OAuth, × chromium + firefox).
- **Self-run vs live stack (chromium):** `E2E_USER=seeder@test.local E2E_PASS=password123 npx playwright test e2e/auth.spec.ts --project=chromium` → **3 passed, 2 skipped** (register 988ms, switcher 575ms, logout-revocation 1.1s).
- **Acceptance greps:** `test.skip` count 4 (≥2 ✓), `Date.now()` present (✓), `401` present in the logout test (✓), no `webServer` added to `playwright.config.ts`/`vite.config.ts` (✓).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Top-level `test.skip(true, …)` skipped the entire file**
- **Found during:** Task 1 (first live-stack self-run)
- **Issue:** The plan's literal phrasing — `test.skip(true, "…")` placeholders for the OAuth tests — placed at module scope caused Playwright to skip ALL tests in the file (register, switcher, and logout-revocation included). The first self-run reported `5 skipped`, silently disabling every real guard.
- **Fix:** Moved the skip INSIDE each OAuth test body (`test("…", async ({ page }) => { test.skip(true, reason); … })`) so the annotation marks only those two tests. Added a comment documenting why the top-level form is wrong. Re-ran: 3 passed, 2 skipped.
- **Files modified:** frontend2/e2e/auth.spec.ts
- **Commit:** 7716d6b

## Files Created

- `frontend2/e2e/auth.spec.ts` — 3 live-stack auth E2E tests + 2 recorded OAuth skips.

## Self-Check: PASSED

- `frontend2/e2e/auth.spec.ts` — FOUND
- Commit 7716d6b — FOUND
