---
phase: 48-project-scaffold
plan: 02
subsystem: frontend2
tags: [routing, i18n, react-router, lingui, placeholder-pages, retro-design]
dependency_graph:
  requires: [frontend2-project, retro-design-tokens, vite-dev-server]
  provides: [client-side-routing, i18n-en-et, placeholder-pages]
  affects: [frontend2/src/, frontend2/locales/]
tech_stack:
  added: []
  patterns: [dynamic-catalog-loading, retro-panel-layout, locale-switching]
key_files:
  created:
    - frontend2/src/lib/i18n.ts
    - frontend2/src/routes/index.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po
  modified:
    - frontend2/src/App.tsx
    - frontend2/.gitignore
decisions:
  - "useLingui from @lingui/react/macro for t-macro, useLingui from @lingui/react for runtime i18n.locale access"
  - "Compiled Lingui .js catalogs added to .gitignore -- Vite plugin handles on-the-fly compilation"
metrics:
  duration: 136s
  completed: "2026-04-09T06:22:35Z"
  tasks_completed: 2
  tasks_total: 2
  checkpoint_pending: 1
  files_created: 4
  files_modified: 2
---

# Phase 48 Plan 02: React Router v7 Routes and Lingui i18n Summary

React Router v7 routing with 3 placeholder pages (Dashboard, Settings, 404) using retro design tokens, plus Lingui v5 i18n with EN/ET locale switching via dynamic catalog loading.

## Task Results

### Task 1: Add React Router v7 routes and Lingui i18n provider
**Commit:** `879b3c4`
**Status:** Complete

Created src/lib/i18n.ts with dynamic catalog loader supporting EN (English) and ET (Eesti) locales. Created src/routes/index.tsx with three placeholder pages -- Dashboard (/) with "Inventory HUD loading..." body and locale switcher, Settings (/settings) with "Configuration panels standing by.", and 404 (*) with "SECTOR NOT FOUND" heading and "RETURN TO BASE" link. All pages use RetroPanel layout component with charcoal background, cream panel, hazard stripe, thick ink borders, and raised shadow. Updated App.tsx to wrap the app in I18nProvider and BrowserRouter, with catalog preload before first render. Dashboard page includes Lingui t-macro test string "Welcome to Home Warehouse" and a locale switcher select element. Navigation bar with client-side Link elements on Dashboard and Settings pages. All imports from "react-router" (not "react-router-dom") per v7 convention.

### Task 2: Extract and compile Lingui message catalogs for EN and ET
**Commit:** `0c5c639`
**Status:** Complete

Ran lingui extract to generate PO catalog files from source -- 1 message extracted ("Welcome to Home Warehouse"). Added Estonian translation "Tere tulemast Home Warehouse'i" to locales/et/messages.po. English source catalog auto-populated. Ran lingui compile to generate optimized JS catalogs. Full build pipeline (tsc -b + vite build) passes with 32 modules transformed. Added locales/*/messages.js to .gitignore since Vite plugin compiles PO files on-the-fly (commit 2962656).

### Task 3: Verify scaffold in browser
**Status:** Checkpoint pending (human-verify)

This is a human verification checkpoint. After merge, the user should:
1. Start dev server: `cd frontend2 && bun run dev`
2. Open http://localhost:5173 -- verify retro design (charcoal bg, cream panel, hazard stripe, thick borders)
3. Verify "Welcome to Home Warehouse" text renders (i18n test string)
4. Switch locale to "Eesti" -- verify text changes to "Tere tulemast Home Warehouse'i"
5. Click Settings nav link -- verify client-side navigation to /settings without page reload
6. Navigate to /nonexistent -- verify "SECTOR NOT FOUND" 404 page
7. Click "RETURN TO BASE" -- verify navigation back to /

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] node_modules not present in worktree**
- **Found during:** Task 1 verification
- **Issue:** `bun run build` failed because node_modules were not installed in the git worktree
- **Fix:** Ran `bun install` to restore dependencies
- **Files modified:** none (node_modules is gitignored)

**2. [Rule 2 - Missing] Compiled Lingui catalogs not in .gitignore**
- **Found during:** Task 2 post-commit untracked file check
- **Issue:** `lingui compile` generated locales/*/messages.js files that are build artifacts
- **Fix:** Added `locales/*/messages.js` pattern to frontend2/.gitignore
- **Files modified:** frontend2/.gitignore
- **Commit:** 2962656

## Verification Results

- `bun run build` exits 0 (tsc -b + vite build, 32 modules, 697ms initial / 254ms cached)
- `bun run i18n:extract` finds 1 message ("Welcome to Home Warehouse")
- `bun run i18n:compile` compiles PO catalogs without errors
- frontend2/src/lib/i18n.ts contains loadCatalog, i18n.load, i18n.activate, defaultLocale, EN/ET locales
- frontend2/src/routes/index.tsx imports from "react-router" (not react-router-dom)
- frontend2/src/routes/index.tsx contains DASHBOARD, SETTINGS, SECTOR NOT FOUND, RETURN TO BASE
- frontend2/src/routes/index.tsx uses bg-retro-charcoal, bg-retro-cream, border-retro-thick, bg-hazard-stripe
- frontend2/src/routes/index.tsx imports useLingui from @lingui/react/macro
- frontend2/src/App.tsx contains I18nProvider, BrowserRouter, AppRoutes, loadCatalog
- frontend2/src/App.tsx does NOT contain react-router-dom
- locales/en/messages.po contains "Welcome to Home Warehouse"
- locales/et/messages.po contains "Tere tulemast Home Warehouse'i"

## Known Stubs

None -- all plan artifacts are fully wired. The placeholder page copy is intentional scaffolding per UI-SPEC.

## Self-Check: PASSED

All 6 files verified present. All 3 commit hashes (879b3c4, 0c5c639, 2962656) verified in git log.
