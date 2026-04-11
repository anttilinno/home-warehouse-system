---
phase: 52-dashboard
plan: 03
subsystem: frontend2/routes+navigation
tags: [routes, sidebar, navigation, stubs, i18n]
dependency_graph:
  requires: [52-02]
  provides: [items-stub-page, loans-stub-page, scan-stub-page, sidebar-navigation, restructured-routes]
  affects: [53-settings]
tech_stack:
  added: []
  patterns: [feature-based-page-imports, navlink-isactive-pattern]
key_files:
  created:
    - frontend2/src/features/items/ItemsPage.tsx
    - frontend2/src/features/loans/LoansPage.tsx
    - frontend2/src/features/scan/ScanPage.tsx
    - frontend2/src/features/settings/SettingsPage.tsx
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/components/layout/index.ts
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po
decisions:
  - D-01: Created Sidebar.tsx independently since Phase 51 runs in parallel worktree; orchestrator merge will reconcile
  - D-02: Kept per-route RequireAuth wrapping since AppShell from Phase 51 not yet available in this branch
  - D-03: Moved inline SettingsPage to features/settings/SettingsPage.tsx following stub pattern
metrics:
  duration: 5m
  completed: 2026-04-11T10:00:00Z
  tasks: 2
  files: 9
---

# Phase 52 Plan 03: Stub Routes, Sidebar Navigation, and Route Restructuring Summary

Three stub pages (Items, Loans, Scan) with retro RetroPanel styling, Sidebar with 4 NavLink items in correct order, routes restructured to use feature-based imports with all inline stubs removed, and 16 Estonian translations added.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create stub pages for Items, Loans, Scan | 338b5f6 | ItemsPage.tsx, LoansPage.tsx, ScanPage.tsx |
| 2 | Update Sidebar nav links and restructure routes | 50fc89a | Sidebar.tsx, index.ts, SettingsPage.tsx, routes/index.tsx, messages.po (en+et) |

## What Was Built

### Stub Pages (ItemsPage, LoansPage, ScanPage)
- RetroPanel with showHazardStripe and uppercase title per page
- "PAGE UNDER CONSTRUCTION" message in font-mono 14px
- Centered max-w-[480px] layout
- All strings wrapped in Lingui t macro for i18n

### SettingsPage (moved from inline)
- Extracted from routes/index.tsx to features/settings/SettingsPage.tsx
- Same stub pattern as other pages (RetroPanel + construction message)

### Sidebar (Sidebar.tsx)
- NavLink-based navigation with isActive className callback
- 4 items in order: Dashboard (/), Items (/items), Loans (/loans), Settings (/settings)
- Active state: amber background with pressed shadow
- Default state: cream background with raised shadow
- All labels i18n-ready via useLingui

### Routes Restructuring (routes/index.tsx)
- Removed inline DashboardPage, SettingsPage, NavBar, PageShell components
- DashboardPage imported from features/dashboard/DashboardPage
- All new pages imported from feature directories
- Added /items, /loans, /scan routes with RequireAuth wrapping
- NotFoundPage kept inline with RetroPanel styling
- Public routes: /login, /auth/callback, /demo unchanged

### i18n Translations
- 16 missing Estonian translations added (44/44 complete, 0 missing)
- Covers: dashboard nav, page titles, activity feed, quick actions, workspace setup

## Test Coverage

All 111 tests pass across 14 test files. No new tests added (stub pages are simple enough to not require dedicated tests; they will be covered by route-level tests in future phases).

## Decisions Made

1. **D-01: Independent Sidebar creation** - Phase 51 (app-layout) runs in a parallel worktree and creates its own Sidebar. Created Sidebar.tsx here with all 4 nav items; the orchestrator merge will reconcile the two versions.
2. **D-02: Per-route RequireAuth** - AppShell with Outlet pattern from Phase 51 not available in this branch. Kept existing per-route RequireAuth wrapping. Phase 51 merge will restructure to nested routes.
3. **D-03: SettingsPage extraction** - Moved inline SettingsPage to features/settings/ following the same stub pattern as ItemsPage/LoansPage/ScanPage, per plan guidance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added all 16 missing Estonian translations**
- **Found during:** Task 2
- **Issue:** lingui:extract showed 16 missing ET translations for dashboard, navigation, and stub page strings
- **Fix:** Added complete Estonian translations for all strings including dashboard stats labels, activity feed, quick actions, page titles, and workspace setup
- **Files modified:** frontend2/locales/et/messages.po
- **Commit:** 50fc89a

**2. [Rule 2 - Missing] Created SettingsPage stub in features directory**
- **Found during:** Task 2
- **Issue:** Plan indicated SettingsPage should be moved from inline to features/settings/ if it was still an inline stub
- **Fix:** Created frontend2/src/features/settings/SettingsPage.tsx with same stub pattern
- **Files modified:** frontend2/src/features/settings/SettingsPage.tsx
- **Commit:** 50fc89a

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| ItemsPage shows "PAGE UNDER CONSTRUCTION" | frontend2/src/features/items/ItemsPage.tsx | Intentional - items feature implementation in future phase |
| LoansPage shows "PAGE UNDER CONSTRUCTION" | frontend2/src/features/loans/LoansPage.tsx | Intentional - loans feature implementation in future phase |
| ScanPage shows "PAGE UNDER CONSTRUCTION" | frontend2/src/features/scan/ScanPage.tsx | Intentional - scan feature implementation in future phase |
| SettingsPage shows "PAGE UNDER CONSTRUCTION" | frontend2/src/features/settings/SettingsPage.tsx | Intentional - settings feature implementation in Phase 53 |

## Verification

- TypeScript: bunx tsc --noEmit -- PASSED
- Tests: npx vitest run -- 111 passed, 0 failed
- Build: bun run build -- PASSED (270.77 kB JS, 17.60 kB CSS)
- i18n: 44/44 strings translated for both EN and ET

## Self-Check: PASSED
