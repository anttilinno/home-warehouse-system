# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-22)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
<<<<<<< HEAD
**Current focus:** v1.8 Social Login -- Phase 42 (Error Handling, Internationalization, and Offline Polish)

## Current Position

Phase: 42 of 42 (Error Handling, Internationalization, and Offline Polish)
Plan: 2 of 2 in current phase
Status: Phase Complete
Last activity: 2026-02-22 -- Completed 42-02 (Offline-aware social login buttons)
=======
**Current focus:** v1.8 Social Login -- Phase 41 (Frontend OAuth Flow and Connected Accounts)

## Current Position

Phase: 41 of 42 (Frontend OAuth Flow and Connected Accounts)
Plan: 2 of 2 in current phase (COMPLETE)
Status: Phases 40 and 41 complete
Last activity: 2026-02-22 -- Completed Phase 40 (Backend OAuth Core) and Phase 41 (Frontend OAuth Flow)
>>>>>>> phase-41

Progress: [######░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 112 (from v1-v1.7)
- Average duration: ~15 min per plan
- Total execution time: ~28 hours

**By Milestone:**

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1 | 5 | 14 | Complete |
| v1.1 | 6 | 12 | Complete |
| v1.2 | 6 | 19 | Complete |
| v1.3 | 4 | 22 | Complete |
| v1.4 | 5 | 20 | Complete |
| v1.5 | 3 | 9 | Complete |
| v1.6 | 5 | 9 | Complete |
| v1.7 | 5 | 7 | Complete |
| v1.8 | 3 | ? | In progress |
| Phase 40 P01 | 7min | 2 tasks | 14 files |
| Phase 40 P02 | 3min | 2 tasks | 8 files |
| Phase 40 P03 | 5min | 2 tasks | 2 files |
| Phase 42 P01 | 3min | 2 tasks | 5 files |
| Phase 42 P02 | 1min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

- v1.8: Backend-driven Authorization Code flow (no NextAuth.js or frontend OAuth libraries)
- v1.8: Single new dependency: golang.org/x/oauth2 v0.35.0 with built-in PKCE
- v1.8: One-time code exchange pattern for token handoff (avoids cross-origin cookie issues)
- v1.8: No provider token storage (columns left NULL, avoids encryption complexity)
- 40-01: Empty passwordHash in domain entity maps to NULL in database via *string scanning
- 40-01: has_password column defaults to true so existing users retain password-based auth
- 40-01: CheckPassword returns false immediately for empty hash (prevents bcrypt panic)
- [Phase 40]: Empty passwordHash maps to NULL in DB via *string scanning; has_password defaults to true for existing users
- 40-02: GetProviderConfig is a package-level function (no state needed, just config)
- 40-02: GitHub profile fetcher always uses /user/emails (Pitfall 8-G: /user may return null email)
- 40-02: FindOrCreateUser rejects unverified emails before any auto-linking (Pitfall 8-B)
- 40-02: OAuthRepository.FindByProviderAndID returns (nil, nil) for not-found (matches user repo pattern)
- 40-03: OAuth handler initialized in router.go (not main.go) to match existing architecture pattern
- 40-03: WorkspaceCreator adapter wraps workspace service with same name/slug logic as register
- 40-03: RedisClient interface uses Set/GetDel to avoid importing redis in domain layer
- 40-03: CSRF state cookie combines state and PKCE verifier in pipe-delimited format
<<<<<<< HEAD
- 42-01: OAuthErrorHandler uses Suspense boundary wrapper for useSearchParams in Next.js App Router
- 42-01: URL cleanup via window.history.replaceState avoids re-render cycle
- 42-01: Toast duration 8000ms for error messages (longer than default for readability)
- 42-02: Inline text message below buttons (not tooltip) for offline indication -- more accessible on mobile
- 42-02: No changes needed on register page -- SocialLogin already rendered, offline behavior inherited
=======
- v1.8: Full page redirect after OAuth exchange (window.location.href) to ensure AuthProvider picks up token
- v1.8: sessionStorage for redirect_to preservation across OAuth flow (auto-clears on tab close)
- v1.8: Hardcoded English strings on transient callback page (visible <2 seconds, i18n unnecessary)
- v1.8: has_password !== false for conditional form rendering (defaults to PasswordChange when user data is loading)
- v1.8: Inline ProviderIcon component reuses SVGs from social-login.tsx (simple, only 2 providers)
>>>>>>> phase-41

### Pending Todos

- [ ] SCAN-01 through SCAN-07: Barcode scanning manual verification
- [ ] iOS PWA: Camera permission persistence
- [ ] Google OAuth Consent Screen verification (external process, start early)

### Blockers/Concerns

Carried forward:
- Safari iOS manual testing pending
- CGO_ENABLED=0 build has webp library issue -- dev builds work fine
- Jobs package coverage limited by pgxpool/Redis requirements

New for v1.8:
- PWA standalone mode OAuth on iOS needs physical device testing (Pitfall 8-J)
- Google Consent Screen verification can take days/weeks (testing mode supports 100 users)

## Session Continuity

Last session: 2026-02-22
<<<<<<< HEAD
Stopped at: Completed 42-02-PLAN.md (Offline-aware social login buttons)
Next step: Phase 42 complete. All plans in this phase executed.

---
*Updated: 2026-02-22 after 42-02 execution*
=======
Stopped at: Merged Phase 40 (Backend OAuth Core) and Phase 41 (Frontend OAuth Flow)
Next step: Execute Phase 42 (Error Handling, Internationalization, and Offline Polish)

---
*Updated: 2026-02-22 after merging phases 40 and 41*
>>>>>>> phase-41
