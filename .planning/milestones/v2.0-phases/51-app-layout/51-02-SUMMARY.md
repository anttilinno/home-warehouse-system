---
phase: 51-app-layout
plan: "02"
subsystem: frontend2/layout
tags: [react, layout, routing, mobile, i18n, tdd]
dependency_graph:
  requires: [51-01]
  provides: [AppShell, nested-layout-routes]
  affects: [frontend2/src/routes/index.tsx, frontend2/src/components/layout/AppShell.tsx]
tech_stack:
  added: []
  patterns: [nested-layout-routes, mobile-drawer, tdd-red-green]
key_files:
  created:
    - frontend2/src/components/layout/AppShell.tsx
    - frontend2/src/components/layout/__tests__/AppShell.test.tsx
  modified:
    - frontend2/src/components/layout/index.ts
    - frontend2/src/routes/index.tsx
    - frontend2/locales/et/messages.po
decisions:
  - AppShell renders two nav elements (desktop + mobile drawer) so tests use getAllByRole
  - Routes keep all existing settings sub-routes (settings/* nested) not simplified inline
  - compiled .ts locale files gitignored so only .po files committed
metrics:
  duration: ~25 min
  completed: 2026-04-11
  tasks_completed: 3
  files_changed: 5
---

# Phase 51 Plan 02: AppShell Assembly and Route Restructure Summary

**One-liner:** AppShell with mobile drawer and nested layout routes using single RequireAuth + errorElement on the layout route.

## What Was Built

### AppShell component (`frontend2/src/components/layout/AppShell.tsx`)

The AppShell assembles all Plan 01 layout components into a working shell:

- `LoadingBar` at the very top (fixed, z-40)
- Skip link (`sr-only`, targets `#main-content`)
- Desktop sidebar: `hidden md:block fixed left-0 top-0 h-dvh w-[240px] z-10`
- Mobile drawer backdrop: `fixed inset-0 bg-black/50 z-20`, opacity transitions on open/close
- Mobile drawer panel: `fixed left-0 top-0 ... md:hidden`, `translate-x-0` / `-translate-x-full`
- Main column: `flex-1 md:ml-[240px]` with `TopBar` and `<main id="main-content">`
- `<Outlet />` inside main for child route content
- Escape key handler via `useEffect` (added/removed when `drawerOpen` changes)
- Location change effect closes drawer on navigation

### Route restructure (`frontend2/src/routes/index.tsx`)

- Single `<RequireAuth>` wrapping the AppShell layout route
- `errorElement={<ErrorBoundaryPage />}` on the layout route
- All authenticated routes nested (index, items, loans, scan, settings and sub-routes)
- `/login`, `/auth/callback`, `/demo`, `/setup` remain outside AppShell

### i18n (`frontend2/locales/et/messages.po`)

Added Estonian translations:
- "DASHBOARD" -> "JUHTPANEEL"
- "SETTINGS" -> "SEADED" (pre-existing)
- "LOGOUT" -> "LOGI VALJA"
- "RETURN TO BASE" -> "TAGASI BAASI"
- "Loading page" -> "Lehe laadimine"
- "Open navigation" -> "Ava navigatsioon"
- "Close navigation" -> "Sulge navigatsioon"
- "Skip to main content" -> "Liigu pohisisu juurde"
- "Something went wrong..." -> "Midagi laks valesti..."

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | AppShell test (RED) | 0c25133 | `__tests__/AppShell.test.tsx` |
| 2 | AppShell implementation (GREEN) | b7244f5 | `AppShell.tsx`, `index.ts`, `AppShell.test.tsx` (updated) |
| 3 | Routes restructure + i18n | 3246793 | `routes/index.tsx`, `locales/et/messages.po`, `locales/en/messages.po` |

## Verification Results

- `bun vitest run src/components/layout/__tests__/AppShell.test.tsx` — 8/8 tests pass
- `bun vitest run` (full suite) — 27 test files, 150 tests pass
- `bun run build` — production build succeeds (297.98 kB bundle)
- `lingui extract` — 138 strings, 94 missing ET (pre-existing, only new ones added here)
- `lingui compile` — catalogs compiled successfully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test used getByRole("navigation") but AppShell renders two nav elements**
- **Found during:** Task 2 (GREEN phase, running tests)
- **Issue:** AppShell renders Sidebar in both desktop fixed panel and mobile drawer panel. Both contain `<nav>` elements. `getByRole("navigation")` throws when multiple matches found.
- **Fix:** Updated test to use `getAllByRole("navigation")` and assert `length >= 1`. Also refactored drawer close assertions to query the mobile drawer panel directly by class (`md:hidden[class*='translate']`) rather than checking hamburger label.
- **Files modified:** `frontend2/src/components/layout/__tests__/AppShell.test.tsx`
- **Commit:** b7244f5

**2. [Rule 3 - Blocking] Routes restructure kept all settings sub-routes not mentioned in plan**
- **Found during:** Task 3
- **Issue:** Plan's example `AppRoutes` only showed `index` + `settings` routes. The actual routes/index.tsx had 12 authenticated routes including all settings subpages.
- **Fix:** Nested all 12 authenticated routes under the AppShell layout route, not just the 2 example routes.
- **Files modified:** `frontend2/src/routes/index.tsx`
- **Commit:** 3246793

**3. [Rule 3 - Blocking] Compiled .ts locale files are gitignored**
- **Found during:** Task 3 commit
- **Issue:** `frontend2/locales/*/messages.ts` files are in `.gitignore`. Only `.po` source files can be committed.
- **Fix:** Committed only `.po` files. The compiled `.ts` files are generated at build time.
- **Commit:** 3246793

### Pre-existing Issues (Out of Scope)

- `LanguagePage.test.tsx` was failing before this plan due to missing compiled `messages.ts` files (gitignored). Fixed itself once `lingui compile` ran in worktree.

## Threat Model Coverage

- **T-51-04 (high):** RequireAuth wraps the parent layout Route — all child routes inherit protection. Single guard, not per-route. Verified by route structure in `routes/index.tsx`.
- **T-51-05 (medium):** `errorElement` declared on layout route — confirmed working with React Router v7 declarative mode.
- **T-51-06 (low):** Escape key, backdrop click, and nav click all close drawer. Basic focus management without full focus trap.

## Known Stubs

None. All components render real data from existing hooks and context.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| AppShell.tsx exists | PASSED |
| AppShell.test.tsx exists | PASSED |
| routes/index.tsx exists | PASSED |
| commit 0c25133 (RED) | PASSED |
| commit b7244f5 (GREEN) | PASSED |
| commit 3246793 (routes+i18n) | PASSED |
| RequireAuth in routes | PASSED |
| errorElement in routes | PASSED |
| No NavBar/PageShell in routes | PASSED |
| ET translations present | PASSED |
