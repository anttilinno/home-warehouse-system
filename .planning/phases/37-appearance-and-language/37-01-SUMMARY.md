---
phase: 37-appearance-and-language
plan: 01
subsystem: ui
tags: [next-themes, tailwind-v4, dark-mode, i18n, next-intl, settings]

# Dependency graph
requires:
  - phase: 35-settings-shell-and-route-structure
    provides: settings layout shell with stub subpages for appearance and language
  - phase: 36-profile-security-and-regional-formats
    provides: settings component pattern (RadioGroup Card with raw fetch, refreshUser)
provides:
  - ThemeSettings component with 3-way theme selector (light/dark/system)
  - LanguageSettings component with 3-locale selector (en/et/ru)
  - ThemeSyncer in ThemeProvider for backend-to-client theme sync on login
  - CSS dark mode fix with :where() for zero specificity
  - Appearance and Language settings subpages (functional, replacing stubs)
  - i18n translations for appearance and language settings in all 3 locales
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Theme two-layer sync: next-themes for instant UI, backend for persistence"
    - "ThemeSyncer pattern: inner component inside ThemeProvider syncs user.theme to setTheme on login"
    - "Language change: no success toast because the language changing IS the feedback"

key-files:
  created:
    - frontend/components/settings/theme-settings.tsx
    - frontend/components/settings/language-settings.tsx
  modified:
    - frontend/app/globals.css
    - frontend/components/providers/theme-provider.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/settings/appearance/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/settings/language/page.tsx
    - frontend/messages/en.json
    - frontend/messages/et.json
    - frontend/messages/ru.json

key-decisions:
  - "ThemeSyncer as inner component inside NextThemesProvider (not separate hook) to access useTheme"
  - "eslint-disable for exhaustive-deps on ThemeSyncer useEffect to prevent sync loops"
  - "No success toast on language change per research pitfall 4 (page re-renders lose toast state)"

patterns-established:
  - "ThemeSyncer: sync backend theme preference to next-themes on user load without loops"
  - "Language switch: PATCH backend then router.replace(pathname, { locale }) for route change"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 37 Plan 01: Appearance and Language Summary

**Three-way theme selector with instant switching via next-themes, language selector with locale routing, CSS dark mode :where() fix, and backend theme sync on login**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T10:28:04Z
- **Completed:** 2026-02-13T10:32:20Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Appearance subpage with 3-way theme selector (Light/Dark/System) that changes theme instantly and persists to backend
- Language subpage with 3-locale selector (English/Eesti/Russian) that persists to backend and switches app locale
- CSS dark mode variant fixed from `:is(.dark *)` to `:where(.dark, .dark *)` for zero specificity and html/body matching
- ThemeSyncer component syncs backend theme preference to next-themes on user login (prevents wrong-theme flash)
- All text translated in en, et, ru locales

## Task Commits

Each task was committed atomically:

1. **Task 1: CSS fix, ThemeSettings component, appearance subpage, and theme sync** - `0ac1db7` (feat)
2. **Task 2: LanguageSettings component and language subpage** - `8b04f09` (feat)

## Files Created/Modified
- `frontend/app/globals.css` - Fixed dark mode variant from :is() to :where() for zero specificity
- `frontend/components/settings/theme-settings.tsx` - ThemeSettings with RadioGroup, instant setTheme, PATCH to backend, hydration-safe mounted check
- `frontend/components/settings/language-settings.tsx` - LanguageSettings with RadioGroup for 3 locales, flags, PATCH to backend, router.replace for locale switch
- `frontend/components/providers/theme-provider.tsx` - Added ThemeSyncer inner component for backend->client theme sync
- `frontend/app/[locale]/(dashboard)/dashboard/settings/appearance/page.tsx` - Replaced stub with functional appearance subpage
- `frontend/app/[locale]/(dashboard)/dashboard/settings/language/page.tsx` - Replaced stub with functional language subpage
- `frontend/messages/en.json` - Added settings.appearance and settings.language translation keys
- `frontend/messages/et.json` - Added Estonian translations for appearance and language settings
- `frontend/messages/ru.json` - Added Russian translations for appearance and language settings

## Decisions Made
- ThemeSyncer implemented as inner component inside NextThemesProvider (not a separate hook) because useTheme() must be called within the provider tree
- Used eslint-disable-line for react-hooks/exhaustive-deps on ThemeSyncer useEffect -- including theme/setTheme in deps would cause sync loops
- No success toast on language change: the language changing IS the user feedback (toast would be lost during navigation re-render anyway)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Frontend `bun run build` fails on prerendering `/en/login` due to "useAuth must be used within an AuthProvider" -- confirmed pre-existing issue (same error occurs on previous commit without our changes). Not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All appearance and language settings are functional
- Phase 37 has only 1 plan, so the phase is complete
- Ready to proceed to Phase 38 per v1.7 roadmap

---
*Phase: 37-appearance-and-language*
*Completed: 2026-02-13*
