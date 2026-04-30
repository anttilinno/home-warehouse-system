---
phase: 54-tech-debt-code-fixes
plan: "02"
subsystem: frontend2
tags: [types, i18n, components, barrel-imports, lingui]
dependency_graph:
  requires: []
  provides:
    - entity_name-non-optional-type
    - notfoundpage-i18n-coverage
    - hazardstripe-component-authcallback
    - barrel-imports-settings
  affects:
    - frontend2/src/lib/types.ts
    - frontend2/src/routes/index.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po
    - frontend2/src/features/auth/AuthCallbackPage.tsx
    - frontend2/src/features/settings/*.tsx
tech_stack:
  added: []
  patterns:
    - Lingui t macro for all user-visible strings
    - All retro component imports via @/components/retro barrel
key_files:
  created: []
  modified:
    - frontend2/src/lib/types.ts
    - frontend2/src/routes/index.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po
    - frontend2/src/features/auth/AuthCallbackPage.tsx
    - frontend2/src/features/settings/AppearancePage.tsx
    - frontend2/src/features/settings/DataPage.tsx
    - frontend2/src/features/settings/NotificationsPage.tsx
    - frontend2/src/features/settings/LanguagePage.tsx
    - frontend2/src/features/settings/FormatsPage.tsx
    - frontend2/src/features/settings/__tests__/AppearancePage.test.tsx
    - frontend2/src/features/settings/__tests__/DataPage.test.tsx
    - frontend2/src/features/settings/__tests__/FormatsPage.test.tsx
    - frontend2/src/features/settings/__tests__/LanguagePage.test.tsx
    - frontend2/src/features/settings/__tests__/NotificationsPage.test.tsx
decisions:
  - entity_name is always present in API responses (nullable, never absent) — ? marker was incorrect
  - Test files in settings/__tests__/ also migrated to barrel for consistency (Rule 2 extension)
metrics:
  duration: ~10 minutes
  completed: "2026-04-14T17:15:18Z"
  tasks_completed: 3
  files_modified: 15
---

# Phase 54 Plan 02: i18n, Types, and Component Consistency Fixes Summary

**One-liner:** Remove optional marker from RecentActivity.entity_name, wrap NotFoundPage in Lingui t macro with EN+ET catalog entries, replace AuthCallbackPage inline hazard div with HazardStripe component, and consolidate all settings page imports to use the @/components/retro barrel.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix entity_name optional marker in types.ts | 5ca0843 | frontend2/src/lib/types.ts |
| 2 | Wrap NotFoundPage strings in t macro, update EN+ET catalogs | b595dfa | src/routes/index.tsx, locales/en/messages.po, locales/et/messages.po |
| 3 | Replace inline hazard stripe div + fix barrel imports in 5 settings pages | 89ea313 | AuthCallbackPage.tsx, 5 settings pages, 5 test files |

## Success Criteria Verification

- SC-4: `entity_name: string | null` in RecentActivity — confirmed, no `?` marker, build clean
- SC-5: NotFoundPage strings wrapped in t macro; "SECTOR NOT FOUND" + body in both EN and ET .po files; ET: "SEKTOR EI LEITUD", "Soovitud ala ei eksisteeri. Naase baasi."
- SC-6: AuthCallbackPage uses `<HazardStripe className="mb-md" />` from `@/components/retro`; no inline hazard div
- SC-7: Zero occurrences of `@/components/retro/RetroToast` in settings pages or their test files
- All 152 tests pass across 27 test files; TypeScript + Vite build clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Migrated ToastProvider barrel imports in 5 settings test files**
- **Found during:** Task 3 verification (`grep -r "retro/RetroToast" src/features/settings/`)
- **Issue:** The plan's acceptance criteria targets `src/features/settings/` which includes `__tests__/`. The 5 test files imported `ToastProvider` directly from `@/components/retro/RetroToast`, not the barrel.
- **Fix:** Changed `import { ToastProvider } from "@/components/retro/RetroToast"` to `import { ToastProvider } from "@/components/retro"` in all 5 test files. `ToastProvider` is exported from the barrel (index.ts line 11).
- **Files modified:** AppearancePage.test.tsx, DataPage.test.tsx, FormatsPage.test.tsx, LanguagePage.test.tsx, NotificationsPage.test.tsx
- **Commit:** 89ea313

## Known Stubs

None — all changes are correctness fixes with no placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `frontend2/src/lib/types.ts` — FOUND, entity_name: string | null confirmed
- `frontend2/locales/en/messages.po` — FOUND, SECTOR NOT FOUND entry confirmed
- `frontend2/locales/et/messages.po` — FOUND, SEKTOR EI LEITUD confirmed
- `frontend2/src/routes/index.tsx` — FOUND, useLingui import + t macro usage confirmed
- `frontend2/src/features/auth/AuthCallbackPage.tsx` — FOUND, `<HazardStripe className="mb-md" />` confirmed
- Commit 5ca0843 — FOUND
- Commit b595dfa — FOUND
- Commit 89ea313 — FOUND
- 27 test files, 152 tests all pass
- bun run build exits 0
