---
phase: 03-layout-primitives-bottombar
plan: 06
subsystem: frontend2 application chrome (AppShell grid + provider/route wiring)
tags: [react, appshell, css-grid, data-collapsed, mobile-drawer, router, providers, e2e, a11y, i18n, tdd]
requires:
  - "TopBar (Plan 03-03: onLogout required, online?, user?, onToggleDrawer?)"
  - "Sidebar (Plan 03-04: collapsed + onToggleCollapse; rail CSS keys off [data-collapsed] ancestor)"
  - "PageHeader (Plan 03-04: segments: string[]; lastSync defaults '—')"
  - "Bottombar + Fab + F1HelpDialog (Plan 03-05: SSOT-consuming surfaces)"
  - "ShortcutsProvider + useShortcuts SSOT (Plan 03-01)"
  - "ModalStackProvider + useModalStack capture-phase ESC arbiter (Plan 03-02)"
  - "Window primitive (@/components/retro)"
provides:
  - "AppShell — 2x3 CSS-Grid shell carrying a single data-collapsed attribute; composes all chrome around a route <Outlet/>"
  - "MobileDrawer — off-canvas Navigator (<768px) role=dialog aria-modal, focus-trap + scrim/ESC/nav-selection close"
  - ".app-shell grid CSS in globals.css ([data-collapsed] rail, rail label/count hide, badge-dot reveal, reduced-motion)"
  - "App.tsx provider wiring (ShortcutsProvider + ModalStackProvider inside the router)"
  - "AppShell layout route (RequireAuth → AppShell → DashboardPage via Outlet)"
  - "Extended E2E shell smoke (login → collapse → F1/ESC)"
affects:
  - "Every authenticated route now renders inside AppShell — feature phases (4+) add child routes under the layout route + extend the route→segments map"
  - "DashboardPage no longer renders its own chrome; future pages render route-body only"
tech-stack:
  added: []
  patterns:
    - "CSS-only collapse: a single React `collapsed` boolean flips data-collapsed on .app-shell; CSS swaps grid-template-columns to the 60px rail (SHELL-02 — zero ResizeObserver/offsetWidth/getBoundingClientRect)"
    - "2x3 named-area grid (topbar spans both cols; sidebar spans rows 2-3; bottombar in main col row 3); main is the scroll container with min-width:0 (Silkscreen overflow guard)"
    - "Responsive split is CSS, not JS: <768px @media collapses the grid to single-column; desktop Sidebar `hidden md:block`, Bottombar `hidden md:flex`, MobileDrawer + Fab `md:hidden` — same DOM, CSS picks the surface"
    - "AppShell layout route: <Route element={<RequireAuth><AppShell/></RequireAuth>}> with an index child rendered through <Outlet/>"
    - "Providers mounted INSIDE the router so chrome + routes share the SSOT and modal stack"
    - "Route→breadcrumb segments derived from useLocation via a static map (placeholder routes ok)"
key-files:
  created:
    - frontend2/src/components/layout/AppShell.tsx
    - frontend2/src/components/layout/AppShell.test.tsx
    - frontend2/src/components/layout/MobileDrawer.tsx
    - frontend2/src/components/layout/MobileDrawer.test.tsx
  modified:
    - frontend2/src/styles/globals.css
    - frontend2/src/App.tsx
    - frontend2/src/routes/index.tsx
    - frontend2/src/features/dashboard/DashboardPage.tsx
    - frontend2/e2e/login-dashboard.spec.ts
decisions:
  - "Skip link uses Tailwind sr-only + focus:not-sr-only as the first focusable element targeting #main (main has id=main + tabIndex=-1). Keeps the link visually hidden until focused per the UI-SPEC accessibility contract."
  - "AppShell owns three booleans only — collapsed (the SOLE collapse state, no measurement), drawerOpen (TopBar hamburger), helpOpen (Bottombar F1 + the F1 key whose single keydown owner lives in F1HelpDialog). No chrome state lives above the Clock leaf, so the 1s tick never re-renders the shell (Pitfall 5)."
  - "AppShell does not fetch user/stats — it is route-agnostic chrome; TopBar/Sidebar accept those as optional props and render their placeholder/empty states. DashboardPage keeps its own data queries for the route body. This avoids a duplicate /users/me fetch in the shell and keeps the shell render-cheap."
  - "handleLogout navigates to /login (auth lands Phase 5); the confirm-before-logout dialog + modal-stack ESC contract already lives in TopBar, so ESC still never logs out."
  - "Route→segments is a static map in AppShell (OVERVIEW/INVENTORY/SYSTEM groupings); unknown paths fall back to ['OVERVIEW']. Feature phases extend the map as real routes land — no per-route PageHeader prop plumbing needed."
  - "DashboardPage de-dup: dropped its <Sidebar/> + <BrandMark> header wrapper and the now-unused me/User query+import (the shell owns identity chrome). The two-column grid collapsed to a single min-w-0 content column since AppShell's <Outlet/> wrapper provides the p-sp-5 gutter."
metrics:
  duration: ~24m
  completed: 2026-06-12
  tasks: 3
  files: 9
---

# Phase 3 Plan 6: AppShell Final Assembly Summary

The 2×3 CSS-Grid **AppShell** with a single CSS-only `data-collapsed` rail (zero JS measurement), the **MobileDrawer** off-canvas Navigator, and the provider/route wiring that mounts the whole shell — turning the wave-1–3 leaves and providers into the live chrome every authenticated route renders inside, capped with a Playwright shell smoke.

## What shipped

- **AppShell** (`AppShell.tsx`) — a `.app-shell` grid root carrying `data-collapsed={collapsed}` (a single `useState` boolean — the ONLY collapse state, no measurement). Composes TopBar (with `onToggleDrawer` + `onLogout`), the desktop Sidebar (`collapsed` + `onToggleCollapse`), PageHeader (route-derived segments), `<main id="main" tabIndex={-1}>` wrapping the route `<Outlet/>`, the desktop Bottombar (`onOpenHelp`), the mobile MobileDrawer + Fab, and the F1HelpDialog. A `sr-only`/`focus:not-sr-only` "Skip to content" link is the first focusable element targeting `#main`.
- **MobileDrawer** (`MobileDrawer.tsx`) — the Navigator rendered as a fixed `min(280px,86vw)` off-canvas overlay (`md:hidden`), `role="dialog" aria-modal="true"`, focus-trapped (Tab/Shift+Tab wrap), with scrim-click / ESC (shared modal stack) / nav-selection close and focus restore to the invoker.
- **globals.css** — the `.app-shell` 2×3 named-area grid, the `[data-collapsed]` 60px-rail column swap, rail `.nav-label`/`.nav-count` hide + `.nav-badge-dot` reveal, the `160ms` `grid-template-columns` transition, the `<768px` single-column collapse, and the `prefers-reduced-motion` instant guard.
- **App.tsx** — `ShortcutsProvider` + `ModalStackProvider` mounted inside the router (within `QueryClientProvider`, around `AppRoutes`) so chrome + routes share the SSOT and modal stack; the existing providers' relative order is untouched.
- **routes/index.tsx** — the authenticated branch is now an AppShell layout route (`<RequireAuth><AppShell/></RequireAuth>` with an `index` `DashboardPage` child through the `<Outlet/>`); `/login` + wildcard untouched.
- **DashboardPage.tsx** — dropped its own Sidebar + brand header (the shell owns chrome); kept the stat windows + recent-activity table; removed the now-unused `me`/`User` query+import.
- **E2E** — one shell smoke appended to `login-dashboard.spec.ts`: login → assert TopBar brand + Navigator + Bottombar → toggle collapse and assert `data-collapsed` flips → open the KEYBOARD SHORTCUTS dialog → ESC closes it and stays on `/`. The original three proxy/auth tests are untouched.

## Verification

- `cd frontend2 && bun run test` → **134 passed** (16 files; +13 new Task-1 specs over the 121 baseline).
- `cd frontend2 && bun run lint:tsc` → exit 0.
- `cd frontend2 && bun run lint:imports` → OK (no idb/serwist/offline/sync imports).
- `cd frontend2 && bun run build` → tsc -b + vite build clean.
- `npx playwright test --list e2e/login-dashboard.spec.ts` → exit 0, lists 4 tests × 2 projects (8 total).
- `git diff --quiet frontend2/vite.config.ts frontend2/playwright.config.ts` → both untouched (Pitfall 7 / T-03-15 mitigated).

Acceptance grep gates all pass: `data-collapsed` in AppShell.tsx + globals.css; no `ResizeObserver|offsetWidth|getBoundingClientRect` in AppShell.tsx; `grid-template-areas` + `prefers-reduced-motion` in globals.css; `ShortcutsProvider`/`ModalStackProvider` in App.tsx; `AppShell` in routes; `data-collapsed` + `KEYBOARD SHORTCUTS|F1` in the spec.

## Deviations from Plan

### Adjustments (not auto-fixes — test-authoring choices within scope)

**1. AppShell unit test queries the TopBar via `getByTestId("user-pill")`, not `getByRole("banner")`**
- **Found during:** Task 1 (writing AppShell.test.tsx)
- **Issue:** testing-library resolves two `banner` roles — the TopBar `<header role="banner">` AND the shared `Window` titlebar `<header>` (rendered by the Sidebar's Navigator). The duplicate is a property of the out-of-scope `Window` primitive's role computation, not AppShell.
- **Resolution:** Asserted the TopBar via its unique `data-testid="user-pill"` instead of the ambiguous `banner` role. No source change to the shared `Window` component (out of scope). Documented here as a known a11y observation (two `banner` landmarks when a `Window` is present) for a future chrome polish pass.

**2. Source-introspection test reads via `process.cwd()` not `import.meta.url`**
- **Found during:** Task 1 (the "no JS measurement APIs" assertion)
- **Issue:** `fileURLToPath(new URL("./AppShell.tsx", import.meta.url))` throws "URL must be of scheme file" under the vitest transform.
- **Resolution:** Read the component source via `resolve(process.cwd(), "src/components/layout/AppShell.tsx")` (vitest cwd is the package root). Pure test-harness mechanics; the assertion (no `ResizeObserver|offsetWidth|getBoundingClientRect`) is unchanged and passing.

No production-code deviations (Rules 1–4): the plan executed as written. Zero new packages (T-03-SC accept holds).

## Threat surface

No new endpoints, auth paths, or trust-boundary surface. The plan's `mitigate` dispositions are upheld: T-03-15 (vite/playwright config untouched — verified by `git diff --quiet`), T-03-16 (ESC closes the F1 dialog and stays on `/` — asserted in the E2E), T-03-17 (CSS-only collapse — grep-verified no measurement APIs), T-03-18 (no PII/session logging ported into the shell). No new threat flags.

## Known Stubs

- `AppShell` mounts the desktop Sidebar / MobileDrawer / TopBar with **no `stats`/`user` props** this phase — they render placeholder/empty identity chrome by design (the shell is route-agnostic; DashboardPage owns its own data). The TopBar workspace pill + ONLINE/SSE/bell slots remain Phase 5/6 placeholders as specified by the wave-3 contracts. These are intentional, contract-documented slots, not goal-blocking stubs: the plan's goal (assemble the chrome shell) is fully met.

## Notes for the next phase

- Feature phases add child routes under the existing AppShell layout route in `routes/index.tsx` and extend the `ROUTE_SEGMENTS` map in `AppShell.tsx` for their breadcrumbs.
- The shell does not fetch user/workspace identity — when Phase 5 lands AuthProvider, wire `user`/`online` into AppShell → TopBar/Sidebar (props already exist).
- The E2E shell smoke runs only against the live dev stack (backend :8080 + Postgres + dev :5173 per CLAUDE.md). CI gates on the unit suite + build; the smoke is local/when-the-stack-is-up, matching the existing spec posture.

## Self-Check: PASSED

- Created files verified on disk: AppShell.tsx, AppShell.test.tsx, MobileDrawer.tsx, MobileDrawer.test.tsx, 03-06-SUMMARY.md.
- Per-task commits verified in git log: 5a5dfea (Task 1), d960715 (Task 2), b36ef52 (Task 3).
