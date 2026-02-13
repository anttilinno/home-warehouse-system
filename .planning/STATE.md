# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-12)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** v1.7 Modular Settings -- Phase 39 (Notification Preferences)

## Current Position

Phase: 39 of 39 (Notification Preferences)
Plan: 2 of 2 in current phase
Status: Phase Complete
Last activity: 2026-02-13 -- Completed 39-02 (notification preferences frontend UI)

## Performance Metrics

**Velocity:**
- Total plans completed: 112 (from v1-v1.7)
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
- Notification preferences as JSONB on auth.users (not a separate table) -- implemented in 39-01
- JSONB preference maps: marshal to []byte for DB, unmarshal from []byte on scan (39-01)
- UpdateNotificationPreferences uses merge semantics: only updates provided keys (39-01)
- SettingsNav active state: exact pathname match for hub, prefix match for subpages
- Settings sidebar hidden below md; hub page serves as mobile navigation
- Live preview values computed inline without useMemo/useEffect for simplicity (35-02)
- Profile card links to dedicated /profile subpage for consistent navigation pattern (35-02)
- Settings subpage composition: page.tsx imports existing component(s) directly, no extra Card wrappers (36-01)
- ThemeSyncer pattern: inner component inside ThemeProvider syncs user.theme to setTheme on login (37-01)
- No success toast on language change: the language changing IS the feedback (37-01)
- Inline formatRelativeTime in settings components rather than importing non-exported functions (38-01)
- Backup & Restore section rendered inline in page.tsx as simple Card with dialog trigger (38-01)
- Switch toggle auto-save pattern: isUpdating key tracks which toggle is saving, disables all during save (39-02)
- Client-side notification filtering via NOTIFICATION_CATEGORY_MAP (display-only, SSE untouched) (39-02)
- NotificationPreferences uses index signature for dynamic category access in Switch toggles (39-02)

### Pending Todos

**Manual Testing Required:**
- [ ] SCAN-01 through SCAN-07: Barcode scanning manual verification
- [ ] iOS PWA: Camera permission persistence

### Blockers/Concerns

Carried forward:
- Safari iOS manual testing pending
- CGO_ENABLED=0 build has webp library issue -- dev builds work fine
- Jobs package coverage limited by pgxpool/Redis requirements
- Safari `navigator.storage.estimate()` returns approximate values -- Data & Storage subpage has graceful degradation (resolved in 38-01)

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 39-02-PLAN.md (notification preferences frontend UI)
Next step: Phase 39 complete. All v1.7 Modular Settings phases done.

---
*Updated: 2026-02-13 after 39-02 plan execution*
