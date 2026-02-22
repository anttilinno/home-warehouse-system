---
phase: 41-frontend-oauth-flow-and-connected-accounts
plan: 02
subsystem: auth
tags: [oauth, react, connected-accounts, password, security-settings]

# Dependency graph
requires:
  - phase: 41-frontend-oauth-flow-and-connected-accounts
    plan: 01
    provides: OAuthAccount interface, OAuth API methods, has_password on User type
  - phase: 40-backend-oauth-infrastructure
    provides: Backend OAuth endpoints (/auth/oauth/{provider}, /auth/oauth/accounts, DELETE /auth/oauth/accounts/{provider})
  - phase: 42-error-handling-internationalization-and-offline-polish
    provides: Translation keys for connectedAccounts and setPassword
provides:
  - ConnectedAccounts component for managing linked OAuth providers
  - OAuth-aware PasswordChange form that handles set-first-password flow
  - Backend UpdatePassword skip for OAuth-only users (no current password required)
  - Connected Accounts section in Security settings between Password and Sessions
affects: [settings-security-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [React key-based form remount on state change, unified Zod schema with conditional validation]

key-files:
  created:
    - frontend/components/settings/connected-accounts.tsx
  modified:
    - backend/internal/domain/auth/user/service.go
    - frontend/components/settings/security-settings.tsx
    - frontend/components/settings/password-change.tsx

key-decisions:
  - "Unified Zod schema with conditional refine for current_password instead of two separate schemas (avoids resolver type mismatch)"
  - "React key={String(hasPassword)} to remount PasswordChangeForm when user sets first password"
  - "Proactive unlink button disable when accounts.length === 1 && !has_password (frontend lockout guard)"

patterns-established:
  - "Conditional Zod validation: use .refine() with runtime flag for context-dependent field requirements"
  - "Form remount pattern: key prop on form wrapper component to reset form state on mode change"

requirements-completed: [SEC-02, ACCT-01, ACCT-02, ACCT-03, ACCT-04, ACCT-05, OAUTH-08]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 41 Plan 02: Connected Accounts Settings and OAuth Password Flow Summary

**Connected Accounts management UI with link/unlink/lockout guard, and conditional password form for OAuth-only users to set their first password**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T17:52:44Z
- **Completed:** 2026-02-22T17:56:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created ConnectedAccounts component that fetches linked OAuth providers and supports link/unlink with lockout guard
- Modified backend UpdatePassword to skip current password check for OAuth-only users (HasPassword() false)
- Adapted PasswordChange form to show "Set Password" mode (no current password field) for OAuth-only users
- Wired ConnectedAccounts section into SecuritySettings between Password and Sessions

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix backend UpdatePassword for OAuth-only users and create ConnectedAccounts component** - `8e8431e9` (feat)
2. **Task 2: Wire ConnectedAccounts into SecuritySettings and adapt PasswordChange for OAuth-only users** - `954f12b1` (feat)

## Files Created/Modified
- `backend/internal/domain/auth/user/service.go` - UpdatePassword skips current password check when user.HasPassword() is false
- `frontend/components/settings/connected-accounts.tsx` - New component: fetches OAuth accounts, link/unlink buttons, lockout guard warning
- `frontend/components/settings/security-settings.tsx` - Added ConnectedAccounts section with Link2 icon between Password and Sessions
- `frontend/components/settings/password-change.tsx` - Conditional "Set Password" / "Change Password" mode based on has_password, refreshUser after first password set

## Decisions Made
- Used a unified Zod schema with conditional `.refine()` for current_password instead of two separate schemas. Two separate schemas caused a TypeScript resolver type mismatch with react-hook-form. The unified approach keeps `current_password` always in the type but only validates it when `hasPassword` is true.
- Used React `key={String(hasPassword)}` on the form wrapper to force remount when has_password changes (after setting first password), ensuring form state resets cleanly.
- Proactively disable unlink button on frontend when `accounts.length === 1 && !has_password`, in addition to backend lockout guard (defense in depth).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript resolver type mismatch with dual Zod schemas**
- **Found during:** Task 2 (PasswordChange adaptation)
- **Issue:** Plan suggested two separate Zod schemas (changeSchema and setSchema) but zodResolver produces incompatible types when the schemas have different fields, causing TS2322 errors with react-hook-form
- **Fix:** Used a single unified schema with `current_password: z.string()` always present and conditional `.refine()` that only validates current_password when hasPassword is true
- **Files modified:** frontend/components/settings/password-change.tsx
- **Verification:** `npx tsc --noEmit` passes (no new errors)
- **Committed in:** 954f12b1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Schema approach changed from dual to unified, same end behavior. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in test/e2e files (6 errors in multi-step-form.test.tsx, a11y.spec.ts, fixtures/test.ts, multi-tab.spec.ts) -- all unrelated to this plan, same as 41-01

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 41 is now complete -- full OAuth flow from button click through provider to authenticated dashboard, with connected accounts management and password setting
- All frontend OAuth UI is in place: SocialLogin buttons, callback page, connected accounts, conditional password form
- Ready for production testing with real Google/GitHub OAuth credentials

---
*Phase: 41-frontend-oauth-flow-and-connected-accounts*
*Completed: 2026-02-22*
