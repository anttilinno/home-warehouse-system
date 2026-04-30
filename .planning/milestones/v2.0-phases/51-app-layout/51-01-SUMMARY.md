---
phase: 51-app-layout
plan: "01"
subsystem: frontend2/layout
tags: [layout, components, tdd, retro-ui, react-router, lingui]
dependency_graph:
  requires: [phase-50-retro-components]
  provides: [Sidebar, TopBar, LoadingBar, ErrorBoundaryPage, useRouteLoading]
  affects: [51-02-AppShell]
tech_stack:
  added: []
  patterns: [NavLink-isActive-className, useLocation-loading-hook, ErrorBoundaryPage-errorElement]
key_files:
  created:
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/components/layout/TopBar.tsx
    - frontend2/src/components/layout/LoadingBar.tsx
    - frontend2/src/components/layout/ErrorBoundaryPage.tsx
    - frontend2/src/components/layout/useRouteLoading.ts
    - frontend2/src/components/layout/__tests__/Sidebar.test.tsx
    - frontend2/src/components/layout/__tests__/TopBar.test.tsx
    - frontend2/src/components/layout/__tests__/LoadingBar.test.tsx
    - frontend2/src/components/layout/__tests__/ErrorBoundary.test.tsx
  modified:
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/components/layout/index.ts
decisions:
  - "I18nProvider required in tests — all components using useLingui macro need i18n.load/activate + I18nProvider wrapper"
  - "Sidebar reduced from 4 to 2 nav items (Dashboard + Settings) per D-04"
  - "useRouteLoading uses useLocation() not useNavigation() — declarative BrowserRouter mode lacks navigation state"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-11"
  tasks_completed: 3
  files_created: 9
  files_modified: 2
---

# Phase 51 Plan 01: Layout Components Summary

**One-liner:** Five retro layout components (Sidebar with NavLink active states, TopBar with user info/avatar/logout, LoadingBar with useLocation hook, ErrorBoundaryPage with SYSTEM ERROR display, barrel export) built TDD with 23 passing tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create test stubs (RED) | 16a3f0b | 4 test files created |
| 2 | Implement Sidebar, LoadingBar, useRouteLoading, ErrorBoundaryPage (GREEN) | fdda2c9 | 4 component files + 3 test updates |
| 3 | Implement TopBar and barrel export (GREEN) | c102450 | TopBar.tsx + index.ts + TopBar test update |

## Verification

- `bun vitest run src/components/layout/__tests__/` — 23/23 tests pass (4 files)
- `tsc --noEmit` — TypeScript compiles clean
- Pre-existing failure in `LanguagePage.test.tsx` (missing compiled `locales/en/messages.ts`) — out of scope, logged below

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added I18nProvider to all layout test files**
- **Found during:** Task 2 GREEN phase run
- **Issue:** Components using `useLingui()` macro require `I18nProvider` context at test runtime. Without it all tests throw "useLingui hook was used without I18nProvider."
- **Fix:** Added `i18n.load("en", {}); i18n.activate("en");` and wrapped renders in `<I18nProvider i18n={i18n}>` — matching the pattern used in `DashboardPage.test.tsx` and other existing tests.
- **Files modified:** All 4 test files
- **Commits:** fdda2c9, c102450

**2. [Rule 1 - Bug] Sidebar updated from 4 to 2 nav items**
- **Found during:** Task 2 implementation
- **Issue:** Pre-existing Sidebar.tsx had 4 nav items (Dashboard, Items, Loans, Settings). Plan D-04 specifies exactly 2 items for Phase 51.
- **Fix:** Replaced with 2-item Sidebar (Dashboard at `/`, Settings at `/settings`) with `aria-label`, `className`, and `onNavClick` props.
- **Files modified:** `frontend2/src/components/layout/Sidebar.tsx`
- **Commit:** fdda2c9

## Known Stubs

None — all components render real data from `useAuth()` and route state.

## Deferred Items

- `LanguagePage.test.tsx` fails due to missing compiled `locales/en/messages.ts` — pre-existing issue, requires `bun run extract && bun run compile` (Lingui catalog compilation). Not introduced by this plan.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Components use React auto-escaping for `user.full_name` and `avatar_url` used only in `img src` (per T-51-01 mitigation). No `dangerouslySetInnerHTML` used.

## Self-Check: PASSED

- `frontend2/src/components/layout/Sidebar.tsx` — FOUND
- `frontend2/src/components/layout/TopBar.tsx` — FOUND
- `frontend2/src/components/layout/LoadingBar.tsx` — FOUND
- `frontend2/src/components/layout/ErrorBoundaryPage.tsx` — FOUND
- `frontend2/src/components/layout/useRouteLoading.ts` — FOUND
- `frontend2/src/components/layout/index.ts` — FOUND
- Commit 16a3f0b — FOUND
- Commit fdda2c9 — FOUND
- Commit c102450 — FOUND
