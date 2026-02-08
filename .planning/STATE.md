# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-08)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** v1.6 Format Personalization - Phase 33 complete

## Current Position

**Milestone:** v1.6 Format Personalization
**Phase:** 34 of 34 (Number Format Rollout) -- Complete
**Plan:** 2 of 2 in current phase
**Status:** Phase 34 complete
**Last activity:** 2026-02-08 -- Completed 34-01-PLAN.md (dashboard number format rollout)

Progress: [################################] 98% (105/107 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 105 (from v1-v1.6)
- Average duration: ~15 min per plan
- Total execution time: ~26 hours

**By Milestone:**

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1 | 5 | 14 | Complete |
| v1.1 | 6 | 12 | Complete |
| v1.2 | 6 | 19 | Complete |
| v1.3 | 4 | 22 | Complete |
| v1.4 | 5 | 20 | Complete |
| v1.5 | 3 | 9 | Complete |
| v1.6 | 5 | 11 | In progress |

## Accumulated Context

### Decisions

All v1.5 decisions archived in `.planning/milestones/v1.5-ROADMAP.md`.

Key patterns established:
- Settings forms use Label/Input pattern with react-hook-form + zod
- useDateFormat hook extended with parseDate and placeholder utilities for parsing and input hints
- User preferences stored in users table with DB migration pattern
- UpdatePreferences entity method returns error (changed from void) for separator conflict validation
- New format preference fields placed after theme, before avatarPath in Reconstruct parameter order
- Format hook trio pattern: useDateFormat, useTimeFormat, useNumberFormat all follow identical structure (useAuth -> useMemo -> useCallback)
- TimeFormatSettings uses simpler RadioGroup (no custom format) since time is strictly 12h/24h
- Format settings cards placed between Data Management and Active Sessions on settings page
- NumberFormatSettings uses Select dropdowns (not RadioGroup) for separator choices with client-side conflict validation
- Format fallback pattern: Relative time helpers show "X ago" for recent items, fall back to user's date format for older items
- useMemo dependency pattern: formatDate added to exportColumns useMemo dependencies to ensure fresh formatters when user changes format
- All date displays and CSV exports now respect user's chosen date format preference
- Date input format hints pattern: Native HTML5 date inputs use Label format hints to communicate app's date format while allowing browser-native validation
- TIME_FORMAT_MAP placed in use-date-format.ts to keep formatDateTime self-contained (compose date + time format strings)
- Scan history uses relative-time-with-hook-fallback pattern: "X ago" for recent, formatDateTime for older entries
- Currency formatting pattern: formatCurrencyValue helper inside component composes currency symbol + formatNumber(amount, 2)
- Decimal input pattern: type="text" + inputMode="decimal" + parseNumber validation + dynamic placeholder with user's decimalSeparator
- CSV export with user format: Use formatNumber in column formatter functions for decimal columns

### Pending Todos

**Manual Testing Required:**
- [ ] SCAN-01 through SCAN-07: Barcode scanning manual verification
- [ ] iOS PWA: Camera permission persistence

### Blockers/Concerns

Carried forward:
- Safari iOS manual testing pending
- CGO_ENABLED=0 build has webp library issue -- dev builds work fine
- Jobs package coverage limited by pgxpool/Redis requirements

## Session Continuity

Last session: 2026-02-08
Stopped at: Completed 34-01-PLAN.md (dashboard number format rollout) - Phase 34 complete
Resume file: `.planning/phases/34-number-format-rollout/34-01-SUMMARY.md`
Next step: Phase 34 complete - milestone v1.6 ready for completion audit

---
*Updated: 2026-02-08 after completing 34-01-PLAN.md*
