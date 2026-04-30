# Phase 51: App Layout - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the authenticated app shell for `/frontend2`: a retro-styled sidebar (Dashboard + Settings nav links, amber active state), top bar (app title left, user info + logout right), mobile-responsive hamburger drawer, route-level loading indicator (retro-amber top bar), error boundary page, and React Router v7 nested layout wiring. Auth pages (`/login`, `/auth/callback`) and `/demo` remain outside the shell with no sidebar/topbar.

</domain>

<decisions>
## Implementation Decisions

### Mobile Navigation Pattern
- **D-01:** Sidebar collapses into a hamburger slide-out drawer on mobile. Hamburger button is retro-styled (thick border, cream background, retro ☰ icon) — uses RetroButton component.
- **D-02:** When the drawer is open, a dark semi-transparent backdrop appears. Tapping anywhere on the backdrop closes the drawer.
- **D-03:** Drawer is a full-height slide-out panel from the left, same retro styling as the desktop sidebar.

### Sidebar Content & Active States
- **D-04:** Phase 51 sidebar contains two nav items only: **Dashboard** and **Settings**. Additional items (Items, Loans, etc.) will be added in future phases when those pages exist.
- **D-05:** Active nav item uses retro-amber background (`bg-retro-amber`) with `shadow-retro-pressed` (inset shadow) — pressed-button look matching BAM button states.
- **D-06:** User info (name, avatar) and logout button live in the **top bar only**. The sidebar is navigation-only.

### Top Bar
- **D-07:** Top bar layout: left side shows "HOME WAREHOUSE" app title in retro uppercase style; right side shows the logged-in user's name/avatar and a logout button.
- **D-08:** Logout button uses RetroButton component (neutral variant or danger variant — Claude's discretion).

### Loading State
- **D-09:** Route transitions show a thin retro-amber (`bg-retro-amber`) progress bar at the very top of the viewport — NProgress-style. No layout shift. Implemented via a simple state-driven bar on route changes.

### Error Boundary
- **D-10:** Error boundary page: charcoal full-screen background, centered RetroPanel with HazardStripe header, bold "SYSTEM ERROR" uppercase heading, error message displayed in monospace font, RetroButton to retry (navigate to `/` or call `error.reset()`).

### Route Structure
- **D-11:** React Router v7 nested routes pattern: a parent route component renders `<AppShell>` (sidebar + top bar + `<Outlet>`). All authenticated protected pages are children of this parent route. Auth routes (`/login`, `/auth/callback`) and `/demo` remain at the top level with no shell.
- **D-12:** `/demo` page stays standalone (no sidebar/topbar). It is a developer tool, not a user feature.

### Claude's Discretion
- Exact sidebar width (desktop) and animation/transition for mobile drawer
- Whether AppShell component lives in `components/layout/` or `features/layout/` (per Phase 48 D-08 it should be `components/layout/`)
- CSS transition style for the loading bar (linear vs ease-out)
- Whether user avatar is a circle/square with initials fallback or an actual image tag
- Exact wording of nav item labels in the sidebar (e.g., "DASHBOARD" vs "Dashboard")
- i18n string keys for new UI strings (follow Lingui t macro pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Design Reference (BAM aesthetic — pixel-accurate target)
- `.planning/references/retro-ui/3.png` — BAM full app layout: dark background, cream panels, hazard stripe headers, card grid, tabs — primary layout reference
- `.planning/references/retro-ui/2.png` — BAM UI components: buttons (default/hover/down states), hazard stripes, progress bars

### Existing Retro Components (Phase 50 — already built)
- `frontend2/src/components/retro/index.ts` — Barrel export for all 10 retro components
- `frontend2/src/components/retro/RetroPanel.tsx` — Panel with optional HazardStripe header
- `frontend2/src/components/retro/RetroButton.tsx` — Button with neutral/primary/danger/secondary variants
- `frontend2/src/components/retro/HazardStripe.tsx` — Hazard stripe divider
- `frontend2/src/components/retro/RetroToast.tsx` — Toast system (ToastProvider + useToast)

### Existing Routing & Auth (Phase 49 — to be refactored)
- `frontend2/src/routes/index.tsx` — Current routes including stub NavBar + PageShell (will be replaced by AppShell)
- `frontend2/src/App.tsx` — Root app with providers (BrowserRouter, AuthProvider, ToastProvider)
- `frontend2/src/features/auth/AuthContext.tsx` — useAuth hook (provides user info, logout function)
- `frontend2/src/features/auth/RequireAuth.tsx` — Existing route guard (may be superseded by AppShell nesting)

### Design Tokens
- `frontend2/src/styles/globals.css` — All `@theme` tokens (colors, spacing, shadows, borders, fonts)

### Project Context
- `.planning/REQUIREMENTS.md` — LAY-01, LAY-02, LAY-03 requirements
- `.planning/ROADMAP.md` — Phase 51 success criteria
- `.planning/phases/48-project-scaffold/48-CONTEXT.md` — D-08 directory layout (components/layout/ for shell components)
- `.planning/phases/50-design-system/50-CONTEXT.md` — Component patterns (forwardRef, className merge, Tailwind-only styling)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- All 10 retro components in `components/retro/` — sidebar, top bar, drawer, and error boundary all use these
- `useAuth()` hook — provides `user` (name/email), `isAuthenticated`, `logout()` function
- `RequireAuth` component — existing route guard that can be replaced by nested route pattern
- `globals.css` design tokens — `bg-retro-charcoal`, `bg-retro-cream`, `text-retro-ink`, `shadow-retro-raised`, `shadow-retro-pressed`, `bg-retro-amber`

### Established Patterns
- Tailwind CSS 4 utility classes only — no CSS-in-JS
- `forwardRef` + `className` merge for composable components
- React Router v7 library mode (`react-router` package, `BrowserRouter` in `App.tsx`)
- Lingui v5 `t` macro for all user-visible strings
- Feature-based directory structure; layout shell goes in `components/layout/`

### Integration Points
- `App.tsx` — wraps everything in `AuthProvider` + `ToastProvider`; no layout changes needed here
- `routes/index.tsx` — current stub `NavBar` + `PageShell` + route definitions will be replaced with `AppShell` nested route pattern
- Dashboard and Settings stub pages currently use inline `PageShell` wrapper — these stubs will be updated to use the new `<Outlet>` from AppShell

</code_context>

<specifics>
## Specific Ideas

- BAM reference image 3 shows the full app aesthetic: dark charcoal background, cream/off-white content panels, thick dark borders everywhere, hazard stripe used as decorative accents
- Top bar "HOME WAREHOUSE" title should match the BAM game-title style: bold, uppercase, retro-cream on dark background
- The hamburger button on mobile should be clearly a retro element — thick border, cream background, inset shadow on press — same visual language as RetroButton

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 51-app-layout*
*Context gathered: 2026-04-11 via /gsd-discuss-phase*
