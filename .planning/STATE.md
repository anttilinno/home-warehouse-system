# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-22)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** Planning next milestone

## Current Position

Phase: 42 of 42 (all phases complete)
Plan: All complete
Status: Milestone v1.8 shipped
Last activity: 2026-02-22 -- v1.8 Social Login milestone completed and archived

Progress: [######░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 119 (v1 through v1.8)
- Average duration: ~15 min per plan
- Total execution time: ~30 hours

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
| v1.8 | 3 | 7 | Complete |

## Accumulated Context

### Decisions

See `.planning/PROJECT.md` Key Decisions table for full list.

Key v1.8 decisions:
- Backend-driven Authorization Code flow (no NextAuth.js or frontend OAuth libraries)
- Single new dependency: golang.org/x/oauth2 v0.35.0 with built-in PKCE
- One-time code exchange pattern for token handoff (avoids cross-origin cookie issues)
- No provider token storage (columns left NULL, avoids encryption complexity)
- Empty passwordHash in domain entity maps to NULL in database via *string scanning
- has_password column defaults to true so existing users retain password-based auth
- Full page redirect after OAuth exchange (window.location.href) to ensure AuthProvider picks up token
- sessionStorage for redirect_to preservation across OAuth flow (auto-clears on tab close)
- OAuthErrorHandler uses Suspense boundary wrapper for useSearchParams in Next.js App Router
- Inline text message below buttons (not tooltip) for offline indication -- more accessible on mobile

### Pending Todos

- [ ] SCAN-01 through SCAN-07: Barcode scanning manual verification
- [ ] iOS PWA: Camera permission persistence
- [ ] Google OAuth Consent Screen verification (external process)
- [ ] PWA standalone mode OAuth on iOS: physical device testing

### Blockers/Concerns

Carried forward:
- Safari iOS manual testing pending
- CGO_ENABLED=0 build has webp library issue -- dev builds work fine
- Jobs package coverage limited by pgxpool/Redis requirements
- Google Consent Screen verification can take days/weeks (testing mode supports 100 users)

## Session Continuity

Last session: 2026-02-22
Stopped at: v1.8 Social Login milestone completed and archived
Next step: `/gsd:new-milestone` for next milestone

---
*Updated: 2026-02-22 after v1.8 milestone completion*
