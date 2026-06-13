---
phase: 12-settings
plan: 04
subsystem: settings-preferences
tags: [settings, preferences, i18n, formats, notifications, frontend2]
requires:
  - "12-02: settingsApi.updatePreferences/getMe, Preferences/User types, page stubs"
  - "i18n.ts: loadCatalog(locale), Locale type"
  - "retro: RetroSelect, RetroCheckbox, Window, BevelButton, retroToast"
provides:
  - "LanguagePage: language picker → PATCH {language} then loadCatalog once"
  - "RegionalFormatsPage: date/time/thousand/decimal selects + live preview + separator guard"
  - "NotificationsPage: 5 RetroCheckbox rows → full notification_preferences map PATCH"
affects:
  - "Phase 15 (format consumption read-hooks must bind to the SAME option tokens recorded below)"
tech-stack:
  added: []
  patterns:
    - "Pitfall 4 render-loop guard: lingui activation only in mutation onSuccess (event), never render"
    - "Partial PATCH from RHF dirtyFields (RegionalFormats)"
    - "Wholesale-map PATCH for notification_preferences (Pitfall 2)"
    - "Local controlled checkbox state (no toggle atom exists)"
key-files:
  created:
    - frontend2/src/features/settings/LanguagePage.test.tsx
    - frontend2/src/features/settings/RegionalFormatsPage.test.tsx
    - frontend2/src/features/settings/NotificationsPage.test.tsx
  modified:
    - frontend2/src/features/settings/LanguagePage.tsx
    - frontend2/src/features/settings/RegionalFormatsPage.tsx
    - frontend2/src/features/settings/NotificationsPage.tsx
decisions:
  - "Option tokens A1/A2 finalized (see Phase 15 Binding Contract below)"
  - "Live preview uses a fixed sample instant (2026-06-13 14:32) + 1234567.89; computed inline"
metrics:
  tasks: 3
  files: 6
  completed: 2026-06-13
---

# Phase 12 Plan 04: Language + Regional Formats + Notifications Summary

Three preferences subpages, all writing the single `PATCH /users/me/preferences` and reading
current values from the shared `["me"]` query: a language picker that activates the lingui
catalog after persisting, a regional-formats page with a local live preview and a
separator-conflict guard, and a notifications page of opt-out checkboxes that PATCHes the whole
preference map. All built TDD (RED → GREEN per task), stub bodies overwritten in-place keeping
export names. No routes/SettingsLayout/types/api edits.

## What Was Built

- **Task 1 — LanguagePage (SETT-05)** `[551db2b3]`: one blue `Window` "LANGUAGE", a `RetroSelect`
  of English/Eesti/Русский (values en/et/ru) pre-filled from `["me"].language`. On change a
  mutation PATCHes `{language}` FIRST; in `onSuccess` it `await loadCatalog(locale)` EXACTLY ONCE
  (event handler — Pitfall 4 render-loop guard; loadCatalog never runs in render/effect), then
  invalidates `["me"]` and toasts "Language updated." loadCatalog failure is non-fatal (catch +
  console.error, mirrors main.tsx). Helper line "Changes apply immediately."
- **Task 2 — RegionalFormatsPage (SETT-06)** `[a2c3b2d6]`: one blue `Window` "REGIONAL FORMATS",
  RHF+zod with four `RetroSelect`s. zod `.refine` rejects `thousand_separator === decimal_separator`
  with the inline danger message on the thousand field (decimal select also flips to danger border
  when conflicting) — mirrors backend `entity.go:252`. Submit builds the PATCH body from
  `dirtyFields` ONLY (partial). A live preview strip (`bg-bg-panel-2`, mono 12px tabular-nums)
  recomputes locally from `watch()` values BEFORE save — no backend call, no format read-hook
  (Phase 15 owns consumption). Toast "Changes saved." + invalidate `["me"]`.
- **Task 3 — NotificationsPage (SETT-07)** `[ae73c4cb]`: one blue `Window` "NOTIFICATIONS", intro
  "Email & in-app alerts for:", five `RetroCheckbox` rows (bold label + muted parenthetical).
  Local controlled state initialized opt-out (absent key → ON). Save sends the FULL five-key map
  (`{ notification_preferences: {...all five...} }`) — wholesale replace, Pitfall 2 — then
  invalidates `["me"]` and toasts "Notification settings saved." No toggle atom imported.

## Phase 15 Binding Contract (option tokens — A1/A2)

Phase 15 format read-hooks MUST bind to these exact persisted token strings (the option VALUEs):

| Field | Persisted tokens (value) |
|-------|--------------------------|
| `date_format` | `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, `DD.MM.YYYY` |
| `time_format` | `HH:mm` (24-hour), `h:mm A` (12-hour) |
| `thousand_separator` | `" "` (Space), `","` (Comma), `"."` (Period), `""` (None) |
| `decimal_separator` | `"."` (Period), `","` (Comma) |
| `notification_preferences` keys | `loan_alerts`, `expiry_alerts`, `maintenance_alerts`, `low_stock`, `workspace_activity` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.fn mock typing for loadCatalog**
- **Found during:** Task 1 (tsc gate)
- **Issue:** `vi.fn(async () => {})` typed loadCatalog as 0-arg, so `loadCatalog(locale)` failed tsc.
- **Fix:** typed the spy as `vi.fn(async (_locale: string) => {})`.
- **Files modified:** LanguagePage.test.tsx
- **Commit:** 551db2b3

Otherwise the plan executed as written.

## Verification

- `bun run lint:tsc` — clean.
- `bun run test src/features/settings/` — 6 files / 28 tests pass (includes the 7 new in this plan).
- `bun run lint:imports` — OK (zero new packages; no forbidden imports).

## Self-Check: PASSED

- All 6 key files present on disk.
- Commits 551db2b3, a2c3b2d6, ae73c4cb present in `git log` on `exec/12-04`.
