---
phase: 41-frontend-oauth-flow-and-connected-accounts
plan: 02
subsystem: ui
tags: [react, oauth, settings, security, i18n, next-intl]

# Dependency graph
requires:
  - phase: 41-frontend-oauth-flow-and-connected-accounts (plan 01)
    provides: OAuth callback page, social login buttons, auth API methods
provides:
  - ConnectedAccounts component with link/unlink/lockout guard
  - SetPassword form for OAuth-only users
  - Updated SecuritySettings with conditional password form and connected accounts section
  - Translation keys for connected accounts and set password (en, et, ru)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional form rendering based on user.has_password for OAuth vs email users"
    - "Lockout guard pattern: disable disconnect when last auth method and no password"
    - "URL query param cleanup after OAuth provider linking"

key-files:
  created:
    - frontend/components/settings/connected-accounts.tsx
    - frontend/components/settings/set-password.tsx
  modified:
    - frontend/components/settings/security-settings.tsx
    - frontend/messages/en.json
    - frontend/messages/et.json
    - frontend/messages/ru.json

key-decisions:
  - "Used !== false for has_password check to default to PasswordChange when user is loading"
  - "Inline ProviderIcon component using same SVGs from social-login.tsx"

patterns-established:
  - "Lockout guard: canDisconnect checks has_password OR other providers exist"
  - "refreshUser call after setPassword to update auth context reactively"

requirements-completed: [SEC-02, ACCT-01, ACCT-02, ACCT-03, ACCT-04, ACCT-05, OAUTH-08]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 41 Plan 02: Connected Accounts UI Summary

**Connected Accounts component with provider link/unlink, lockout guard, and SetPassword form for OAuth-only users**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T17:01:16Z
- **Completed:** 2026-02-22T17:04:41Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ConnectedAccounts component shows Google/GitHub providers with connect/disconnect buttons and lockout guard
- SetPassword form for OAuth-only users (has_password=false) with new + confirm fields only
- SecuritySettings conditionally renders SetPassword vs PasswordChange based on has_password
- Connected Accounts section added between Sessions and Danger Zone in SecuritySettings
- Translation keys added for all 3 locales (en, et, ru) with proper Russian translations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ConnectedAccounts component** - `8c925f0e` (feat)
2. **Task 2: Create SetPassword form and update SecuritySettings** - `3f4839eb` (feat)

## Files Created/Modified
- `frontend/components/settings/connected-accounts.tsx` - Connected accounts with provider rows, link/unlink, lockout guard, ?linked= toast
- `frontend/components/settings/set-password.tsx` - Set password form for OAuth-only users, calls refreshUser after success
- `frontend/components/settings/security-settings.tsx` - Conditional PasswordChange/SetPassword, added ConnectedAccounts section
- `frontend/messages/en.json` - Added connectedAccounts and setPassword translation keys
- `frontend/messages/et.json` - Added connectedAccounts and setPassword translation keys (Estonian)
- `frontend/messages/ru.json` - Added connectedAccounts and setPassword translation keys (Russian)

## Decisions Made
- Used `has_password !== false` (not `=== true`) for conditional rendering so PasswordChange shows as default when user data is still loading
- Reused same SVG icons from social-login.tsx via inline ProviderIcon component rather than creating a shared component (keeps it simple, only 2 providers)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All frontend OAuth UI components complete (social login buttons, callback page, connected accounts, set password)
- Ready for end-to-end testing with backend OAuth endpoints
- OAuth consent screen verification for Google remains an external process

## Self-Check: PASSED

- All created files exist on disk
- All commit hashes verified in git log

---
*Phase: 41-frontend-oauth-flow-and-connected-accounts*
*Completed: 2026-02-22*
