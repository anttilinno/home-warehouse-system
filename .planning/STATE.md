# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-12)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** v1.7 Modular Settings -- Phase 37 (Appearance and Language)

## Current Position

Phase: 37 of 39 (Appearance and Language)
Plan: 1 of 1 in current phase
Status: Complete
Last activity: 2026-02-13 -- Completed 37-01 (appearance and language settings subpages)

## Performance Metrics

**Velocity:**
- Total plans completed: 109 (from v1-v1.7)
- Average duration: ~15 min per plan
- Total execution time: ~27 hours

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
| v1.7 | 5 | TBD | In progress |

## Accumulated Context

### Decisions

All v1.6 decisions archived in `.planning/milestones/v1.5-ROADMAP.md`.

Key patterns established:
- Settings forms use Label/Input pattern with react-hook-form + zod
- User preferences stored in users table with DB migration pattern
- Format hook trio pattern: useDateFormat, useTimeFormat, useNumberFormat
- No new SettingsContext needed -- useAuth() is the single source of truth
- Theme two-layer source of truth: next-themes (client) + backend (server) -- never a third
- Notification preferences as JSONB on auth.users (not a separate table)
- SettingsNav active state: exact pathname match for hub, prefix match for subpages
- Settings sidebar hidden below md; hub page serves as mobile navigation
- Live preview values computed inline without useMemo/useEffect for simplicity (35-02)
- Profile card links to dedicated /profile subpage for consistent navigation pattern (35-02)
- Settings subpage composition: page.tsx imports existing component(s) directly, no extra Card wrappers (36-01)
- ThemeSyncer pattern: inner component inside ThemeProvider syncs user.theme to setTheme on login (37-01)
- No success toast on language change: the language changing IS the feedback (37-01)

### Pending Todos

**Manual Testing Required:**
- [ ] SCAN-01 through SCAN-07: Barcode scanning manual verification
- [ ] iOS PWA: Camera permission persistence

### Blockers/Concerns

Carried forward:
- Safari iOS manual testing pending
- CGO_ENABLED=0 build has webp library issue -- dev builds work fine
- Jobs package coverage limited by pgxpool/Redis requirements
- Safari `navigator.storage.estimate()` returns approximate values -- Data & Storage subpage needs graceful degradation

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 37-01-PLAN.md (appearance and language settings subpages)
Next step: Phase 37 complete. Proceed to Phase 38 per v1.7 roadmap

---
*Updated: 2026-02-13 after 37-01 plan execution*
