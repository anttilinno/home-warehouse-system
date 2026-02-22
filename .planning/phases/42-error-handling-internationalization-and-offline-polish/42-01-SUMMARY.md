---
phase: 42-error-handling-internationalization-and-offline-polish
plan: 01
subsystem: ui
tags: [next-intl, i18n, oauth, sonner, toast, translations]

# Dependency graph
requires:
  - phase: 40-database-migration-and-backend-oauth-core
    provides: Backend OAuth error codes (authorization_cancelled, email_not_verified, invalid_state, server_error, provider_unavailable)
provides:
  - OAuth translation keys (auth.oauth.*) in en.json, et.json, ru.json (28 keys each)
  - OAuthErrorHandler component mapping backend error codes to translated toast messages
  - Login page wired to display OAuth error toasts from URL params
affects: [42-02, phase-41-frontend-oauth-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [error-code-to-translation-key mapping via lookup object, Suspense-wrapped useSearchParams client component in server page]

key-files:
  created:
    - frontend/features/auth/components/oauth-error-handler.tsx
  modified:
    - frontend/messages/en.json
    - frontend/messages/et.json
    - frontend/messages/ru.json
    - frontend/app/[locale]/(auth)/login/page.tsx

key-decisions:
  - "OAuthErrorHandler uses Suspense boundary wrapper pattern for useSearchParams compatibility with Next.js App Router"
  - "URL cleanup uses window.history.replaceState to avoid triggering re-render/navigation cycle"
  - "Toast duration set to 8000ms (longer than default) so users have time to read error messages"

patterns-established:
  - "Error code mapping: OAUTH_ERROR_KEYS Record maps backend snake_case codes to camelCase translation key paths"
  - "Suspense wrapper: Export wrapper component wrapping inner component in Suspense fallback={null} for useSearchParams"

requirements-completed: [ERR-01, ERR-02, ERR-03, ERR-04, I18N-01]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 42 Plan 01: OAuth Error Handling & i18n Summary

**OAuth error code-to-translated-toast mapping with 28 translation keys across en/et/ru locales and OAuthErrorHandler component on login page**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T17:09:54Z
- **Completed:** 2026-02-22T17:12:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added 28 OAuth translation keys to all 3 locale files (en, et, ru) with identical structure
- Created OAuthErrorHandler component that reads oauth_error URL param, displays translated toast, and cleans URL
- Wired OAuthErrorHandler into login page so OAuth redirect errors are shown immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Add all OAuth translation keys to en.json, et.json, and ru.json** - `e69fb1f1` (feat)
2. **Task 2: Create OAuthErrorHandler component and wire it into login page** - `89c989fb` (feat)

## Files Created/Modified
- `frontend/messages/en.json` - Added auth.oauth namespace with 28 English translation keys
- `frontend/messages/et.json` - Added auth.oauth namespace with 28 Estonian translation keys
- `frontend/messages/ru.json` - Added auth.oauth namespace with 28 Russian translation keys
- `frontend/features/auth/components/oauth-error-handler.tsx` - Client component reading oauth_error param, mapping to translated toast
- `frontend/app/[locale]/(auth)/login/page.tsx` - Import and render OAuthErrorHandler before SocialLogin

## Decisions Made
- Used Suspense boundary wrapper pattern for useSearchParams (required by Next.js App Router)
- URL cleanup via window.history.replaceState avoids re-render cycle
- Toast duration 8000ms gives users time to read error messages
- Error codes map directly from backend snake_case to camelCase translation keys via lookup object

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compilation check failed due to missing node_modules in worktree (pre-existing environment issue, not related to changes). All existing files in the worktree have the same "Cannot find module" errors. Verified code structure and imports are correct by comparing with existing working patterns.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Translation keys ready for Phase 41 callback page to redirect errors to login with oauth_error param
- OAuthErrorHandler will display translated toasts for any of the 5 backend error codes
- Plan 42-02 (offline polish) can now use the oauth.offlineRequired translation key

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 42-error-handling-internationalization-and-offline-polish*
*Completed: 2026-02-22*
