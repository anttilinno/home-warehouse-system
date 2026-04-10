---
phase: 49-auth-api-client
plan: 03
subsystem: frontend2-auth-ui
tags: [auth-ui, login, register, oauth, retro-styling, i18n]
dependency_graph:
  requires: [auth-context, route-guard, api-client, auth-types]
  provides: [auth-page, login-form, register-form, oauth-buttons, oauth-callback]
  affects: [frontend2/src/features/auth/, frontend2/src/routes/index.tsx, frontend2/src/styles/globals.css]
tech_stack:
  added: []
  patterns: [tab-toggle-state, inline-error-banner, oauth-full-page-nav, strict-mode-ref-guard]
key_files:
  created:
    - frontend2/src/features/auth/AuthPage.tsx
    - frontend2/src/features/auth/LoginForm.tsx
    - frontend2/src/features/auth/RegisterForm.tsx
    - frontend2/src/features/auth/OAuthButtons.tsx
    - frontend2/src/features/auth/AuthCallbackPage.tsx
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/styles/globals.css
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po
decisions:
  - "Simple useState per field for form state -- no form library per research recommendation"
  - "Inline SVG icons instead of icon library -- minimal Google/GitHub logos and form field icons"
  - "useRef(false) guard for OAuth callback strict-mode double-mount protection"
metrics:
  duration: 236s
  completed: "2026-04-10"
  tasks_completed: 2
  tasks_total: 3
  tests_added: 0
---

# Phase 49 Plan 03: Auth UI Pages Summary

Retro-styled auth UI with tab-toggled login/register panel, OAuth buttons with OR divider, and OAuth callback page -- all wired into routes and connected to AuthContext.

## What Was Built

### Task 1: AuthPage with Tab Toggle, LoginForm, RegisterForm

- Created `AuthPage.tsx` -- full viewport charcoal background, centered cream panel (max-width 420px), hazard stripe bar, decorative red X button (aria-hidden), file-folder tab toggle between LOGIN and REGISTER
- Active tab has cream background with no bottom border (merges with panel); inactive tab has gray background
- Tab switch clears error state and does not preserve form values
- Redirects to `/` via `<Navigate>` if already authenticated
- Created `LoginForm.tsx` -- email and password fields with inline SVG icons (envelope, lock), 3px thick borders, monospace font, retro amber focus ring
- Inline error banner between fields and submit button with `role="alert"` and `aria-live="assertive"`
- Error mapping: 401/invalid -> credential error, network/fetch -> connection error, other -> generic error
- Submit calls `useAuth().login()`, redirects to `location.state.from.pathname` or `/`
- Created `RegisterForm.tsx` -- four fields (name, email, password, confirm password) with same retro styling
- Client-side password match validation before API call
- Error mapping: 409/already exists -> email taken, network -> connection, other -> generic
- All strings wrapped in Lingui `t` macro for i18n
- All inputs have visually hidden `<label>` elements with `htmlFor`

### Task 2: OAuthButtons, AuthCallbackPage, Route Wiring

- Created `OAuthButtons.tsx` -- horizontal rule divider with centered "OR" text, Google and GitHub buttons with inline SVG provider icons
- OAuth buttons use `window.location.href = "/api/auth/oauth/{provider}"` for full-page navigation (not fetch)
- Buttons have `aria-label` attributes for screen readers
- Created `AuthCallbackPage.tsx` -- centered panel with "AUTHENTICATING..." loading state and three blinking dots CSS animation
- On mount: reads `code` and `error` from URL search params via `useSearchParams()`
- Uses `useRef(false)` guard to prevent double OAuth code exchange in React Strict Mode
- On success: calls `post("/auth/oauth/exchange", { code })`, stores refresh token, calls `refreshUser()`, navigates to `/`
- On error: shows "AUTHENTICATION FAILED" heading in red with "RETURN TO LOGIN" button
- Updated `routes/index.tsx`: replaced `LoginPlaceholder` and `CallbackPlaceholder` with real `AuthPage` and `AuthCallbackPage` imports
- Added blink keyframes animation to `globals.css`
- Updated i18n catalogs (28 total strings, 27 missing ET translations)

### Task 3: Visual Verification (Checkpoint)

Awaiting human visual verification of auth UI against BAM reference image.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8d5f146 | Build AuthPage with tab toggle, LoginForm, and RegisterForm |
| 2 | 1c276c6 | Add OAuthButtons, AuthCallbackPage, wire auth routes |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `bun run test`: 18/18 tests pass (all pre-existing tests still green)
- Grep checks: all exports, aria attributes, role="alert", window.location present
- No `LoginPlaceholder` or `CallbackPlaceholder` remain in routes
- `bun run build`: pre-existing tsc error in vite.config.ts (vitest `test` property not in UserConfigExport type) -- not caused by this plan

## Known Stubs

None -- all components are fully wired to AuthContext and API client.

## Self-Check: PASSED
