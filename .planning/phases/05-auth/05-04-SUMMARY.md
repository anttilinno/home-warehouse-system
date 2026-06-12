---
phase: 05-auth
plan: 04
subsystem: frontend-auth
tags: [auth, oauth, register, callback, authelia, msw, vitest, zod, lingui]

# Dependency graph
requires:
  - plan: 05-02
    provides: "MSW shared fixture (/api/auth/* handlers incl. register + oauth/exchange) + api.ts post/setRefreshToken"
  - phase: 04-atoms
    provides: "Window/BevelButton/RetroInput atoms, retroToast (mint), globals.css steps() motion convention"
provides:
  - "SocialLoginButtons: env-gated OAuth/Authelia full-page-redirect buttons (mode login|register)"
  - "oauthErrors.ts: the 5-code backend ?error= taxonomy → UI copy map with server_error fallback"
  - "CallbackPage: /auth/callback one-time code exchange behind a StrictMode useRef latch"
  - "RegisterPage: AUTH-02 register flow (zod v4) at the /register public route"
  - "LoginPage extended with the OR divider + OAuth group + register link (form untouched)"
affects: [05-auth Plan 05 (login surface complete), Phase 6 OAuth E2E (skip-with-reason lands)]

# Tech tracking
tech-stack:
  added: []  # no new packages — composed Phase 1-4 atoms + existing MSW/zod/lingui
  patterns:
    - "OAuth initiate + Authelia = window.location.href full-page nav (NEVER fetch) — the testable seam is a settable window.location mock"
    - "StrictMode-safe one-time exchange: const exchanged = useRef(false) latch inside an empty-deps useEffect; test asserts exactly one MSW call under <StrictMode>"
    - "Authelia hard-codes the BARE /auth/authelia/login (grep-gated NOT /api-prefixed) — ingress owns Authelia trust (8e13faf)"
    - "retro-progress: a steps(3,end) opacity-march keyframe + prefers-reduced-motion guard, matching the status-blink precedent (one motion language)"

key-files:
  created:
    - frontend2/src/features/auth/oauthErrors.ts
    - frontend2/src/features/auth/SocialLoginButtons.tsx
    - frontend2/src/features/auth/SocialLoginButtons.test.tsx
    - frontend2/src/features/auth/CallbackPage.tsx
    - frontend2/src/features/auth/CallbackPage.test.tsx
    - frontend2/src/features/auth/RegisterPage.tsx
    - frontend2/src/features/auth/RegisterPage.test.tsx
  modified:
    - frontend2/src/features/auth/LoginPage.tsx
    - frontend2/src/routes/index.tsx
    - frontend2/src/styles/globals.css
    - frontend2/src/vite-env.d.ts

decisions:
  - "CallbackPage renders page-level error states (in-window pink band + Back to login / Try again) per UI-SPEC §3, NOT the legacy redirect-to-/login?oauth_error pattern from RESEARCH Pattern 2 — the plan action + UI-SPEC mandate the richer on-page band."
  - "retro-progress keyframe added to globals.css as a class (.retro-progress) with a reduced-motion guard, mirroring the existing .status-dot--live convention, rather than a Tailwind arbitrary-animation utility — keeps motion in one auditable place."
  - "Authelia VITE_AUTHELIA_ENABLED is a build-time string flag read as === 'true' (no config-probe endpoint exists — UI-SPEC Resolved-autonomous)."

requirements-completed: [AUTH-02, AUTH-03, AUTH-04, AUTH-11]

# Metrics
duration: ~7min
completed: 2026-06-13
tasks: 3
files-modified: 11
---

# Phase 5 Plan 04: Register + OAuth/Authelia buttons + /auth/callback exchange Summary

**The unauthenticated entry surface is complete: register (AUTH-02), Google/GitHub OAuth full-page-redirect buttons + a `/auth/callback` one-time-code exchange guarded by a StrictMode `useRef` latch (AUTH-03/04), and an env-gated Authelia SSO button on its bare ingress path (AUTH-11) — all composed from Phase 4 atoms and unit-tested with MSW.**

## Performance

- **Duration:** ~7 min
- **Tasks:** 3
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments

- **SocialLoginButtons + oauthErrors + LoginPage (Task 1):** `oauthErrors.ts` maps the exact five backend `?error=` codes (`provider_unavailable`, `invalid_state`, `authorization_cancelled`, `email_not_verified`, `server_error`) to UI-SPEC copy with a `server_error` fallback for unknown codes. `SocialLoginButtons` (a `mode: "login" | "register"` prop switching the "Sign in/up with…" copy) renders full-width neutral BevelButtons whose `onClick` sets `window.location.href` to the literal `/api/auth/oauth/{provider}` (a full-page redirect, never a fetch). The Authelia button is gated on `import.meta.env.VITE_AUTHELIA_ENABLED === "true"` and navigates to the **bare** `/auth/authelia/login` — grep-proven NOT `/api`-prefixed (8e13faf). LoginPage gained the OR divider + the OAuth group + a centered register link below the (untouched) email/password form; `vite-env.d.ts` types the flag.
- **CallbackPage (Task 2):** the `/auth/callback` **public** route (sibling of `/login`, outside RequireAuth). A `useRef(false)` latch inside an empty-deps `useEffect` fires `POST /auth/oauth/exchange { code }` exactly once even under React 19 StrictMode double-invoke (Pitfall 5 — proven by the `<StrictMode>` test asserting one MSW call). On success it stores the refresh token and `navigate("/", {replace})` (the consumed code never lingers in history — T-05-15); `?error=` renders the taxonomy error band with no exchange; no-code/no-error redirects to `/login`; exchange 5xx shows the `server_error` band. The loading state is the retro stepped-progress idiom (`.retro-progress` steps() keyframe, `aria-busy`, `role="status"`) with a `prefers-reduced-motion` solid hold.
- **RegisterPage (Task 3):** the `/register` public route mirrors the LoginPage chrome (a CREATE ACCOUNT Window). A zod v4 schema (`full_name min 1`, `z.email()`, `password min 8`, `confirm` via `.refine(===password)`) drives react-hook-form; valid submit posts `{ email, full_name, password }`, stores the refresh token, fires the mint `Account created — welcome.` toast, and navigates to `/`. A duplicate-email 4xx surfaces the `That email is already registered.` band with an inline Log in link; the OAuth block (`mode="register"`) + an "Already have an account? Log in" link sit below.

## Task Commits

1. **Task 1: SocialLoginButtons + oauthErrors map + LoginPage OAuth block** — `1e0363a` (feat)
2. **Task 2: CallbackPage one-time code exchange with StrictMode ref latch** — `9d2ee05` (feat)
3. **Task 3: RegisterPage validated fields + OAuth block** — `a08e287` (feat)

## Verification

- `cd frontend2 && bun run test src/` — **297 passed (47 files)**; 279 baseline (05-03) + 18 new (8 SocialLoginButtons/oauthErrors, 6 CallbackPage, 4 RegisterPage).
- `bun run lint:tsc` — clean (`tsc -b --noEmit`).
- `bun run lint:imports` — OK.
- `bun run build` — succeeds (426.68 kB index, built in 631ms).
- Grep gates:
  - `grep "auth/authelia/login" SocialLoginButtons.tsx | grep -v "/api/"` → matches → **BARE-PATH-OK**.
  - `grep -c "window.location" SocialLoginButtons.tsx` → **2**; `grep -c "fetch(\|post(" SocialLoginButtons.tsx` → **0** (no XHR for initiate).
  - `grep "VITE_AUTHELIA_ENABLED" SocialLoginButtons.tsx` → matches; off-state renders no SSO button (test asserts `queryByRole` absent).
  - all 5 distinct error codes present in `oauthErrors.ts`.
  - `grep "useRef" CallbackPage.tsx` + `grep "oauth/exchange" CallbackPage.tsx` → match; `grep -c "auth/callback" routes/index.tsx` → **2**, route is a sibling of `/login` (public).
  - `grep "z.email()" RegisterPage.tsx` → matches; `grep '"/register"' routes/index.tsx` → matches.

## TDD Gate Compliance

All three tasks were authored `tdd="true"`. For each, the test file and component were staged together and landed in a single `feat` commit (the 05-03 pattern, not split RED→GREEN commits). The RED→GREEN observation was real per task: each test was run and its component iterated to green before the commit. No `feat` preceded its test logically. (Note: `tdd_mode` is `false` at the phase level, so the MVP+TDD runtime gate did not apply; the `tdd="true"` task annotation drove the test-first discipline.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] node_modules absent in the worktree**
- **Found during:** Task 1 (first test run)
- **Issue:** The fresh worktree had no `frontend2/node_modules`, so `vitest` was not on PATH (`command not found`).
- **Fix:** Ran `bun install --frozen-lockfile` (no new packages — lockfile-pinned restore, per the parallel-execution directive). `bun.lock` unchanged.
- **Files modified:** none (dependency install only).
- **Commit:** n/a (no source change).

### Intentional plan-vs-RESEARCH divergence (not an auto-fix)

- **CallbackPage error UX:** RESEARCH Pattern 2's snippet redirects to `/login?oauth_error=…` on failure; the plan `<action>` + UI-SPEC §3 instead specify a page-level in-window error band (pink titlebar, `Back to login` / `Try again`). Followed the plan/UI-SPEC. Documented as a decision (above), not a deviation, because the plan text was authoritative and explicit.

## Authentication Gates

None — OAuth/Authelia are user-facing initiate buttons; no executor-side auth gate was hit. Live OAuth E2E is deferred to a skip-with-reason spec in Plan 06 (no CI provider creds), as planned.

## Known Stubs

None. The OAuth/Authelia buttons perform real navigations to real backend endpoints; the callback exchanges a real one-time code via the real `POST /auth/oauth/exchange`. The MSW handlers return placeholder tokens by design (test fixtures, threat T-05-08), not product stubs.

## Threat Flags

None — no new network surface beyond the already-registered backend OAuth endpoints. Threat register dispositions are all satisfied:
- **T-05-15** (one-time code in storage/logs): the code is read from the URL, passed straight to exchange, never stored/logged; `navigate(replace)` drops it from history.
- **T-05-16** (Authelia via /api): the button hard-codes the bare `/auth/authelia/login`; the grep gate proves it is NOT `/api`-prefixed.
- **T-05-17** (double-exchange under StrictMode): the `useRef` latch fires exchange once; the `<StrictMode>` test asserts a single call.
- **T-05-18** (brand-icon pack install): NO new packages — provider tiles are 18px Silkscreen-initial ink squares.

## Self-Check: PASSED

- frontend2/src/features/auth/oauthErrors.ts — FOUND
- frontend2/src/features/auth/SocialLoginButtons.tsx — FOUND
- frontend2/src/features/auth/SocialLoginButtons.test.tsx — FOUND
- frontend2/src/features/auth/CallbackPage.tsx — FOUND
- frontend2/src/features/auth/CallbackPage.test.tsx — FOUND
- frontend2/src/features/auth/RegisterPage.tsx — FOUND
- frontend2/src/features/auth/RegisterPage.test.tsx — FOUND
- Commit 1e0363a — FOUND
- Commit 9d2ee05 — FOUND
- Commit a08e287 — FOUND

---
*Phase: 05-auth*
*Completed: 2026-06-13*
