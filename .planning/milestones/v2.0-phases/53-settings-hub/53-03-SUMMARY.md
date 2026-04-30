---
phase: 53-settings-hub
plan: "03"
subsystem: frontend2/settings
tags: [settings, appearance, language, formats, notifications, data, import, export]
dependency_graph:
  requires:
    - frontend2/src/features/settings/ToggleGroup.tsx
    - frontend2/src/features/auth/AuthContext.tsx
    - frontend2/src/lib/api.ts
    - frontend2/src/lib/i18n.ts
    - frontend2/src/lib/types.ts
  provides:
    - frontend2/src/features/settings/AppearancePage.tsx
    - frontend2/src/features/settings/LanguagePage.tsx
    - frontend2/src/features/settings/FormatsPage.tsx
    - frontend2/src/features/settings/NotificationsPage.tsx
    - frontend2/src/features/settings/DataPage.tsx
  affects:
    - frontend2/src/features/settings/__tests__/AppearancePage.test.tsx
    - frontend2/src/features/settings/__tests__/LanguagePage.test.tsx
    - frontend2/src/features/settings/__tests__/FormatsPage.test.tsx
    - frontend2/src/features/settings/__tests__/NotificationsPage.test.tsx
    - frontend2/src/features/settings/__tests__/DataPage.test.tsx
tech_stack:
  added: []
  patterns:
    - ToggleGroup for format selectors
    - Inline ON/OFF button pair for notification toggles (green/red active colors)
    - Raw fetch for binary export blob
    - FileReader.readAsDataURL for base64 import encoding
    - window.matchMedia guard for jsdom test compatibility
key_files:
  created: []
  modified:
    - frontend2/src/features/settings/AppearancePage.tsx
    - frontend2/src/features/settings/LanguagePage.tsx
    - frontend2/src/features/settings/FormatsPage.tsx
    - frontend2/src/features/settings/NotificationsPage.tsx
    - frontend2/src/features/settings/DataPage.tsx
    - frontend2/src/features/settings/__tests__/AppearancePage.test.tsx
    - frontend2/src/features/settings/__tests__/LanguagePage.test.tsx
    - frontend2/src/features/settings/__tests__/FormatsPage.test.tsx
    - frontend2/src/features/settings/__tests__/NotificationsPage.test.tsx
    - frontend2/src/features/settings/__tests__/DataPage.test.tsx
decisions:
  - "OnOffToggle uses inline buttons instead of ToggleGroup because notification ON/OFF requires per-option green/red active colors that ToggleGroup does not support"
  - "window.matchMedia guarded with typeof check to allow test environment (jsdom lacks matchMedia)"
  - "DataPage export uses raw fetch (not get<T>) because parseResponse returns undefined for non-JSON binary responses"
metrics:
  duration: ~4 min
  completed: 2026-04-11
  tasks_completed: 3
  files_created: 0
  files_modified: 10
---

# Phase 53 Plan 03: Preference and Data Subpages Summary

**One-liner:** Five functional settings subpages — theme toggle with data-theme apply, live Lingui locale switch, date/time/number format selectors with previews, master+category notification toggles, and workspace export/import via blob download and base64 JSON upload.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Appearance and Language subpages | 1831b6e | AppearancePage.tsx, LanguagePage.tsx, 5 test files (ToastProvider fix) |
| 2 | Formats and Notifications subpages | 535adef | FormatsPage.tsx, NotificationsPage.tsx |
| 3 | Data subpage — export and import | 1ea5203 | DataPage.tsx |

## What Was Built

**AppearancePage:** Three-option ToggleGroup (LIGHT/DARK/SYSTEM). On change: `patch /users/me/preferences` with `theme`, `refreshUser()`, sets `data-theme` on `<html>`. Mount effect applies current theme. System theme `matchMedia` change listener for live OS switch tracking.

**LanguagePage:** Two-option ToggleGroup (ENGLISH/EESTI). On change: `patch /users/me/preferences` with `language`, `refreshUser()`, `loadCatalog(language)` for live locale switch without page reload.

**FormatsPage:** Three sections each with ToggleGroup + `aria-live="polite"` preview:
- Date: YYYY-MM-DD / DD/MM/YYYY / MM/DD/YYYY, preview formats current date
- Time: 24H / 12H, preview formats current time via toLocaleTimeString
- Number: comma-dot / dot-comma / space-comma, preview formats 1234567.89 with selected separators
- Each section saves immediately via `patch /users/me/preferences`

**NotificationsPage:** Master ON/OFF toggle + HazardStripe separator + four category toggles (LOANS, INVENTORY, WORKSPACE, SYSTEM). Custom `OnOffToggle` component with green/red active states. Category toggles show disabled style when master is off. All saves build full `NotificationPreferences` object and `patch /users/me/preferences`.

**DataPage:**
- Export: raw `fetch` (not `get<T>`) for binary blob, `URL.createObjectURL` → anchor click → `revokeObjectURL` cleanup. Shows EXPORTING... loading state.
- Import: hidden `<input type="file" accept=".json">` triggered by button, `FileReader.readAsDataURL` for base64, `post` JSON body `{ format: "json", data: base64 }`. Shows IMPORTING... loading state. Partial import shows `(succeeded/total)` in toast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ToastProvider to all 5 settings test wrappers**
- **Found during:** Task 1 verification
- **Issue:** Test stubs from Plan 01 rendered pages without `ToastProvider`. Once implementations added `useToast()`, all 5 tests threw "useToast must be used within ToastProvider"
- **Fix:** Added `ToastProvider` import and wrapper to all 5 test files (AppearancePage, LanguagePage, FormatsPage, NotificationsPage, DataPage)
- **Files modified:** `__tests__/AppearancePage.test.tsx`, `__tests__/LanguagePage.test.tsx`, `__tests__/FormatsPage.test.tsx`, `__tests__/NotificationsPage.test.tsx`, `__tests__/DataPage.test.tsx`
- **Commit:** 1831b6e

**2. [Rule 1 - Bug] Guard window.matchMedia calls for jsdom environment**
- **Found during:** Task 1 verification (second test run)
- **Issue:** jsdom test environment does not implement `window.matchMedia`; both `resolveTheme()` and the system theme `useEffect` called it unconditionally, crashing AppearancePage test
- **Fix:** Added `typeof window.matchMedia === "function"` guard in `resolveTheme()` and in the `useEffect` listener setup
- **Files modified:** `frontend2/src/features/settings/AppearancePage.tsx`
- **Commit:** 1831b6e

## Known Stubs

None — all five subpages are fully implemented with API integration.

## Threat Flags

None — all API calls are workspace-scoped with credentials:include. Export endpoint uses authenticated fetch. Import sends base64 JSON to backend which validates format and structure (T-53-10, T-53-11 mitigations in place per plan threat model).

## Self-Check: PASSED

Files exist:
- `frontend2/src/features/settings/AppearancePage.tsx` — FOUND (contains ToggleGroup, data-theme, prefers-color-scheme, patch, refreshUser)
- `frontend2/src/features/settings/LanguagePage.tsx` — FOUND (contains ToggleGroup, loadCatalog, patch, refreshUser)
- `frontend2/src/features/settings/FormatsPage.tsx` — FOUND (contains 3 ToggleGroup, aria-live, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, 24h, 12h, thousand_separator, decimal_separator, patch, refreshUser)
- `frontend2/src/features/settings/NotificationsPage.tsx` — FOUND (contains notification_preferences, enabled, loans, inventory, workspace, system, disabled, HazardStripe, patch, refreshUser)
- `frontend2/src/features/settings/DataPage.tsx` — FOUND (contains export/workspace, credentials:include, response.blob(), createObjectURL, revokeObjectURL, workspace-export.json, import/workspace, FileReader, readAsDataURL, type="file", accept=".json", aria-label, HazardStripe, useToast, workspaceId)

Commits exist:
- 1831b6e — Task 1 (Appearance + Language + test fixes) — FOUND
- 535adef — Task 2 (Formats + Notifications) — FOUND
- 1ea5203 — Task 3 (Data) — FOUND

All 119 tests pass.
