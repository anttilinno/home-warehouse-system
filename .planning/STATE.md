# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-22)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** v1.8 Social Login -- Phase 40 (Backend OAuth Core)

## Current Position

Phase: 40 of 42 (Database Migration and Backend OAuth Core)
Plan: 1 of 3 in current phase
Status: Executing
Last activity: 2026-02-22 -- Completed 40-01 (database migration + user entity OAuth support)

Progress: [###░░░░░░░] 33%

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
Stopped at: Completed 40-01-PLAN.md (database migration + user entity OAuth support)
Next step: Execute 40-02-PLAN.md

---
*Updated: 2026-02-22 after 40-01 execution*
