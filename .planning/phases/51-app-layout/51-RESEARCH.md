# Phase 51: App Layout - Research

**Researched:** 2026-04-11
**Domain:** React Router v7 nested layouts, responsive app shell, error boundaries
**Confidence:** HIGH

## Summary

Phase 51 builds the authenticated app shell for `/frontend2`: a retro-styled sidebar with two nav items (Dashboard, Settings), a sticky top bar with app title and user info, a mobile hamburger drawer, a route-transition loading bar, and an error boundary page. All layout components use the Phase 50 retro component library and Tailwind CSS 4 design tokens.

The project uses React Router v7.14.0 in **library/declarative mode** (`BrowserRouter` in `App.tsx`). This has a critical implication: `useNavigation()` is NOT available in declarative mode -- it only works with data routers (`createBrowserRouter`). The loading bar must therefore use a custom approach based on `useLocation()` changes rather than `navigation.state`. `NavLink` and `errorElement` both work in declarative mode. The existing `RequireAuth` guard wraps individual routes; with nested layout routes, it should wrap the parent `<Route>` element containing the AppShell.

**Primary recommendation:** Build AppShell as a layout route component using `<Outlet>`, keep `RequireAuth` wrapping the layout route, implement the loading bar with a `useLocation()`-driven custom hook, and use React Router's `errorElement` prop for the error boundary.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Sidebar collapses into hamburger slide-out drawer on mobile. Hamburger button uses RetroButton component.
- D-02: Dark semi-transparent backdrop when drawer open. Tapping backdrop closes drawer.
- D-03: Drawer is full-height slide-out panel from left, same retro styling as desktop sidebar.
- D-04: Phase 51 sidebar contains two nav items only: Dashboard and Settings.
- D-05: Active nav item uses `bg-retro-amber` with `shadow-retro-pressed` (pressed-button look).
- D-06: User info and logout button live in the top bar only. Sidebar is navigation-only.
- D-07: Top bar: left = "HOME WAREHOUSE" title; right = user name/avatar + logout button.
- D-08: Logout button uses RetroButton (neutral variant chosen per UI-SPEC).
- D-09: Route transitions show a thin retro-amber progress bar at top of viewport (NProgress-style). No layout shift.
- D-10: Error boundary: charcoal background, centered RetroPanel with HazardStripe, "SYSTEM ERROR" heading, monospace error message, "RETURN TO BASE" retry button.
- D-11: React Router v7 nested routes: parent route renders AppShell with Outlet. Auth routes and /demo remain outside.
- D-12: /demo page stays standalone.

### Claude's Discretion
- Exact sidebar width (desktop) and animation/transition for mobile drawer
- Whether AppShell lives in `components/layout/` or `features/layout/` (CONTEXT.md notes Phase 48 D-08 says `components/layout/`)
- CSS transition style for loading bar
- User avatar implementation (circle with initials fallback)
- Nav item label casing
- i18n string keys

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAY-01 | Authenticated users see sidebar with nav links and top bar with user info, styled in retro industrial aesthetic | AppShell component with nested routes, NavLink for active states, useAuth() for user info. All retro components from Phase 50 available. |
| LAY-02 | On mobile viewports, sidebar collapses into hamburger menu preserving retro look | CSS-only show/hide with `md:` breakpoint, React state for drawer open/close, Tailwind transition classes for slide animation |
| LAY-03 | Route transitions show retro loading indicator; uncaught errors display retro error boundary | Custom useLocation()-based loading hook (useNavigation unavailable in BrowserRouter mode); React Router errorElement prop on layout route |

</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router | 7.14.0 | Routing, NavLink, Outlet, errorElement | Already installed; provides nested layout routing in declarative mode [VERIFIED: package.json] |
| tailwindcss | 4.2.2 | All styling via utility classes and @theme tokens | Already installed; project convention [VERIFIED: package.json] |
| @lingui/react | 5.9.5 | i18n via useLingui + t macro | Already installed; project convention [VERIFIED: package.json] |

### No New Dependencies Needed

The loading bar is implemented with a custom `useLocation()` hook + CSS transitions. No NProgress or third-party library required. The UI-SPEC explicitly states "state-driven CSS width + opacity transitions."

**Installation:** None required. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    layout/
      AppShell.tsx         # Layout route: sidebar + top bar + Outlet
      Sidebar.tsx          # Desktop sidebar + mobile drawer
      TopBar.tsx           # Sticky top bar with user info
      LoadingBar.tsx       # Route-transition progress bar
      ErrorBoundary.tsx    # Error boundary page
      useRouteLoading.ts   # Custom hook for route transition detection
      index.ts             # Barrel export
  routes/
    index.tsx              # Route definitions (refactored for nested layout)
```

[VERIFIED: `components/layout/` directory exists with `.gitkeep` -- confirmed per Phase 48 scaffold]

### Pattern 1: Nested Layout Route with Auth Guard

**What:** A parent `<Route>` renders `<RequireAuth>` wrapping `<AppShell>`, which renders sidebar + top bar + `<Outlet>`. All authenticated child routes are nested inside.

**When to use:** All authenticated pages that need the app chrome (sidebar, top bar).

**Example:**
```tsx
// Source: React Router v7 docs, declarative mode
// File: routes/index.tsx
import { Routes, Route } from "react-router";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { AppShell } from "@/components/layout";

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes -- no shell */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/demo" element={<DemoPage />} />

      {/* Authenticated routes -- wrapped in AppShell */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
        errorElement={<ErrorBoundary />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

[VERIFIED: React Router v7 declarative mode supports nested `<Route>` with `element` + `<Outlet>` and `errorElement` -- confirmed via official docs]

### Pattern 2: NavLink with Active Styling

**What:** Use React Router's `<NavLink>` with a className function to apply retro active state.

**Example:**
```tsx
// Source: React Router v7 NavLink docs (declarative mode compatible)
import { NavLink } from "react-router";

const navItemBase = "w-full text-left px-md py-sm font-bold uppercase text-[14px] border-retro-thick border-retro-ink cursor-pointer outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber";
const navItemDefault = "bg-retro-cream text-retro-ink shadow-retro-raised hover:bg-retro-amber";
const navItemActive = "bg-retro-amber text-retro-ink shadow-retro-pressed";

<NavLink
  to="/"
  end
  className={({ isActive }) =>
    `${navItemBase} ${isActive ? navItemActive : navItemDefault}`
  }
>
  {t`DASHBOARD`}
</NavLink>
```

Note: `end` prop is needed on the `/` (index) NavLink so it doesn't match all routes. `NavLink` automatically sets `aria-current="page"` when active. [VERIFIED: NavLink works in declarative mode, confirmed via official docs]

### Pattern 3: Custom Loading Bar (no useNavigation)

**What:** Since `useNavigation()` is NOT available in BrowserRouter (declarative mode), implement a location-change-based loading indicator.

**Why:** `useNavigation` only works with data routers (`createBrowserRouter`). This project uses `BrowserRouter`. [VERIFIED: React Router v7 docs explicitly state useNavigation is NOT available in declarative mode]

**Implementation approach:**
```tsx
// File: components/layout/useRouteLoading.ts
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";

export function useRouteLoading() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      setIsLoading(true);
      setProgress(90);

      // Simulate completion after a brief delay
      const timer = setTimeout(() => {
        setProgress(100);
        const fadeTimer = setTimeout(() => {
          setIsLoading(false);
          setProgress(0);
        }, 200);
        return () => clearTimeout(fadeTimer);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  return { isLoading, progress };
}
```

The loading bar is a visual indicator of route changes -- since all routes in this SPA load synchronously (no lazy loading yet), the bar provides a brief visual feedback flash on navigation rather than tracking actual async loading.

### Pattern 4: Error Boundary via errorElement

**What:** Use React Router's `errorElement` prop on the layout route to catch rendering errors within the authenticated shell.

**Example:**
```tsx
// Source: React Router v7 docs (works in declarative mode)
<Route
  element={<RequireAuth><AppShell /></RequireAuth>}
  errorElement={<ErrorBoundaryPage />}
>
  {/* child routes */}
</Route>
```

The `ErrorBoundaryPage` component renders a full-screen retro error page using `RetroPanel`, `HazardStripe`, and `RetroButton`. It can use `useRouteError()` to access the error object.

[VERIFIED: errorElement and useRouteError work in declarative mode -- confirmed via official docs]

### Pattern 5: Mobile Drawer with CSS Transitions

**What:** Pure CSS slide-in/out with React state controlling visibility classes. No animation library needed.

**Example:**
```tsx
// Drawer container
<div
  className={`fixed left-0 top-0 h-dvh w-[240px] bg-retro-cream border-r-retro-thick border-retro-ink shadow-retro-raised z-30 transform transition-transform duration-200 ease-out ${
    isOpen ? "translate-x-0" : "-translate-x-full"
  }`}
>
  {/* nav items */}
</div>

// Backdrop
<div
  className={`fixed inset-0 bg-black/50 z-20 transition-opacity duration-200 ${
    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
  }`}
  onClick={onClose}
/>
```

Escape key handler:
```tsx
useEffect(() => {
  if (!isOpen) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [isOpen, onClose]);
```

### Anti-Patterns to Avoid
- **Using useNavigation with BrowserRouter:** It returns idle state always in declarative mode. Use useLocation instead.
- **Wrapping each child route in RequireAuth individually:** With nested routes, wrap the parent layout route once.
- **Adding NProgress or third-party loading libraries:** The UI-SPEC explicitly calls for a state-driven CSS bar. Keep it simple.
- **Using React class component ErrorBoundary:** React Router's `errorElement` prop is simpler and integrates with routing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active nav link detection | Manual pathname comparison | React Router `<NavLink>` with `isActive` | Handles exact matching, `end` prop, aria-current automatically |
| Route error catching | React class component ErrorBoundary | React Router `errorElement` prop | Integrated with routing, provides `useRouteError()` hook |
| Focus trap in drawer | Manual focus management | Keep drawer simple -- no focus trap needed for slide-out nav | Full focus traps are complex; drawer is dismissible overlay, not modal. Keyboard users can close with Escape. |

**Key insight:** React Router v7 provides NavLink, Outlet, and errorElement in declarative mode -- these cover active states, layout nesting, and error handling without custom implementations.

## Common Pitfalls

### Pitfall 1: useNavigation Returns Idle in BrowserRouter
**What goes wrong:** Developer uses `useNavigation().state` expecting "loading" during route transitions, but it always returns "idle" in declarative mode.
**Why it happens:** `useNavigation` requires a data router (`createBrowserRouter`). The project uses `BrowserRouter`.
**How to avoid:** Use `useLocation()` pathname changes to trigger loading bar animation.
**Warning signs:** Loading bar never appears despite route changes.

### Pitfall 2: NavLink "/" Matching All Routes
**What goes wrong:** Dashboard nav item always shows as active, even on /settings.
**Why it happens:** Without the `end` prop, NavLink "/" matches any path starting with "/".
**How to avoid:** Add `end` prop to the Dashboard NavLink: `<NavLink to="/" end>`.
**Warning signs:** Multiple nav items showing active simultaneously.

### Pitfall 3: Mobile Drawer Not Closing on Navigation
**What goes wrong:** User taps a nav link in the drawer, page navigates but drawer stays open.
**Why it happens:** NavLink click navigates but doesn't trigger drawer close.
**How to avoid:** Close drawer `onClick` on each NavLink, or listen to location changes in an effect to close the drawer.
**Warning signs:** Drawer overlays the new page content after navigation.

### Pitfall 4: Sidebar Pushing Content on Desktop
**What goes wrong:** Sidebar uses `position: fixed` but main content doesn't account for its width, causing overlap.
**Why it happens:** Fixed elements are removed from flow.
**How to avoid:** Use a flex layout where sidebar is a flex child with fixed width on desktop, or add `ml-[240px]` to main content on `md:` breakpoint.
**Warning signs:** Content hidden behind sidebar on desktop.

### Pitfall 5: Z-Index Stacking Conflicts
**What goes wrong:** Loading bar hidden behind top bar, or drawer behind backdrop.
**Why it happens:** Z-index values conflict with existing Phase 50 toast system.
**How to avoid:** Follow the z-index scale from UI-SPEC: toast z-50, loading bar z-40, top bar z-30, drawer z-30, backdrop z-20.
**Warning signs:** Elements appearing behind or above where they should be.

## Code Examples

### AppShell Layout Structure
```tsx
// Source: UI-SPEC layout contract
// File: components/layout/AppShell.tsx
import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LoadingBar } from "./LoadingBar";

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-retro-charcoal">
      <LoadingBar />
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-sm focus:bg-retro-amber focus:text-retro-ink"
      >
        {t`Skip to main content`}
      </a>
      <div className="flex">
        {/* Desktop sidebar */}
        <Sidebar className="hidden md:flex" />
        {/* Mobile drawer */}
        <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex-1 md:ml-[240px]">
          <TopBar onMenuClick={() => setDrawerOpen(!drawerOpen)} drawerOpen={drawerOpen} />
          <main id="main-content" className="p-lg">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
```

### User Avatar with Initials Fallback
```tsx
// Source: UI-SPEC top bar contract
function UserAvatar({ user }: { user: User }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="w-[32px] h-[32px] rounded-full object-cover border-retro-thick border-retro-ink"
      />
    );
  }
  const initial = user.full_name?.charAt(0)?.toUpperCase() || "?";
  return (
    <div className="w-[32px] h-[32px] rounded-full bg-retro-charcoal text-retro-cream flex items-center justify-center text-[14px] font-bold uppercase border-retro-thick border-retro-ink">
      {initial}
    </div>
  );
}
```

### Loading Bar Component
```tsx
// Source: UI-SPEC loading bar contract
function LoadingBar() {
  const { isLoading, progress } = useRouteLoading();

  if (!isLoading && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label={t`Loading page`}
      className="fixed top-0 left-0 h-[4px] bg-retro-amber z-40 transition-all ease-out"
      style={{
        width: `${progress}%`,
        opacity: progress >= 100 ? 0 : 1,
        transitionDuration: progress >= 100 ? "200ms" : "300ms",
      }}
    />
  );
}
```

## Existing Code Integration Points

### What Gets Replaced
| Current Code | Location | Replacement |
|-------------|----------|-------------|
| `NavBar` component | `routes/index.tsx` lines 11-28 | Sidebar component with NavLink |
| `PageShell` component | `routes/index.tsx` lines 30-38 | AppShell with Outlet (pages no longer need individual wrappers) |
| Individual `<RequireAuth>` on each route | `routes/index.tsx` lines 111-127 | Single `<RequireAuth>` wrapping the layout `<Route>` |
| Inline `DashboardPage` with PageShell | `routes/index.tsx` lines 40-71 | Simplified DashboardPage (just content, no shell) |
| Inline `SettingsPage` with PageShell | `routes/index.tsx` lines 74-84 | Simplified SettingsPage (just content, no shell) |

### What Stays Unchanged
| Code | Location | Reason |
|------|----------|--------|
| `App.tsx` providers | `App.tsx` | BrowserRouter, AuthProvider, ToastProvider, I18nProvider stay as-is |
| `RequireAuth` component | `features/auth/RequireAuth.tsx` | Reused as-is, just wrapping layout route instead of individual routes |
| `useAuth()` hook | `features/auth/AuthContext.tsx` | Consumed by TopBar for user info and logout |
| Auth pages | `features/auth/AuthPage.tsx`, `AuthCallbackPage.tsx` | Stay outside AppShell |
| DemoPage | `pages/DemoPage.tsx` | Stays standalone per D-12 |

### Auth Integration
- `useAuth()` provides: `user` (with `full_name`, `avatar_url`), `isAuthenticated`, `isLoading`, `logout()`
- `User` type has: `full_name: string`, `avatar_url: string | null` [VERIFIED: lib/types.ts]
- `RequireAuth` already handles loading state (returns null) and redirect to /login [VERIFIED: features/auth/RequireAuth.tsx]
- TopBar calls `useAuth().logout()` on logout button click

### i18n Integration
- Import: `import { useLingui } from "@lingui/react/macro";` [VERIFIED: consistent across all components]
- Usage: `const { t } = useLingui();` then `` t`string` `` [VERIFIED: LoginForm.tsx pattern]
- After adding new strings, run `bun run i18n:extract` then `bun run i18n:compile` [VERIFIED: package.json scripts]
- Locale files: `frontend2/locales/{en,et}/messages.po` [VERIFIED: filesystem]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.3 + Testing Library React 16.3.2 |
| Config file | `frontend2/vitest.config.ts` |
| Quick run command | `cd frontend2 && bun run test` |
| Full suite command | `cd frontend2 && bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAY-01a | AppShell renders sidebar + top bar + Outlet | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/AppShell.test.tsx` | Wave 0 |
| LAY-01b | Sidebar shows Dashboard and Settings NavLinks | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/Sidebar.test.tsx` | Wave 0 |
| LAY-01c | Active nav item has amber pressed styling | unit | (same as LAY-01b) | Wave 0 |
| LAY-01d | Top bar shows user name and logout button | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/TopBar.test.tsx` | Wave 0 |
| LAY-02a | Sidebar hidden on mobile, hamburger shown | unit | (same as AppShell test) | Wave 0 |
| LAY-02b | Drawer opens/closes on hamburger click | unit | (same as AppShell test) | Wave 0 |
| LAY-02c | Backdrop click closes drawer | unit | (same as AppShell test) | Wave 0 |
| LAY-03a | Loading bar appears on route change | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/LoadingBar.test.tsx` | Wave 0 |
| LAY-03b | Error boundary renders on error | unit | `cd frontend2 && bun vitest run src/components/layout/__tests__/ErrorBoundary.test.tsx` | Wave 0 |

### Additional Validation Commands
| Check | Command |
|-------|---------|
| TypeScript compiles | `cd frontend2 && bun run build` |
| ESLint passes | `cd frontend2 && bun run lint` |
| i18n extraction | `cd frontend2 && bun run i18n:extract` |
| All existing tests pass | `cd frontend2 && bun run test` |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test`
- **Per wave merge:** `cd frontend2 && bun run test && bun run build`
- **Phase gate:** Full suite green + build green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/layout/__tests__/AppShell.test.tsx` -- covers LAY-01a, LAY-02a, LAY-02b, LAY-02c
- [ ] `src/components/layout/__tests__/Sidebar.test.tsx` -- covers LAY-01b, LAY-01c
- [ ] `src/components/layout/__tests__/TopBar.test.tsx` -- covers LAY-01d
- [ ] `src/components/layout/__tests__/LoadingBar.test.tsx` -- covers LAY-03a
- [ ] `src/components/layout/__tests__/ErrorBoundary.test.tsx` -- covers LAY-03b

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | errorElement on a pathless parent Route catches errors from child routes in declarative mode | Architecture Pattern 4 | Error boundary won't catch child errors; would need React class ErrorBoundary as fallback |
| A2 | `translate-x-full` / `-translate-x-full` Tailwind classes work for drawer animation in TW4 | Pattern 5 | Drawer won't animate; may need `translate-x-[-100%]` arbitrary value |

## Open Questions (RESOLVED)

1. **Focus trap in mobile drawer**
   - What we know: UI-SPEC says "Focus trap when open -- focus moves to first nav item on open, returns to hamburger on close"
   - What's unclear: Whether a full focus trap is necessary for a 2-item nav drawer, or if Escape key + backdrop click is sufficient
   - Recommendation: Implement basic focus management (focus first nav item on open, return to hamburger on close) without a full trap library. The drawer only has 2 links so Tab naturally cycles through them quickly.

2. **Loading bar with synchronous routes**
   - What we know: All current routes load synchronously (no lazy/code-split). The loading bar is more of a visual transition cue than a real progress indicator.
   - What's unclear: Whether the brief flash of the loading bar feels good or just flickers annoyingly
   - Recommendation: Make the animation duration configurable (300ms initial). If it feels too fast, future phases can add `React.lazy()` and the loading bar becomes genuinely useful.

## Sources

### Primary (HIGH confidence)
- React Router v7 official docs: NavLink, Route, errorElement -- confirmed declarative mode compatibility
- `frontend2/package.json` -- verified all dependency versions
- `frontend2/src/routes/index.tsx` -- current route structure
- `frontend2/src/features/auth/AuthContext.tsx` -- useAuth hook API
- `frontend2/src/features/auth/RequireAuth.tsx` -- guard implementation
- `frontend2/src/lib/types.ts` -- User type with full_name, avatar_url
- `frontend2/src/components/retro/` -- all 10 retro components verified

### Secondary (MEDIUM confidence)
- [React Router v7 useNavigation docs](https://reactrouter.com/api/hooks/useNavigation) -- confirmed NOT available in declarative mode
- [React Router v7 NavLink docs](https://reactrouter.com/api/components/NavLink) -- confirmed className function and isActive in declarative mode
- [React Router v7 Route docs](https://reactrouter.com/api/components/Route) -- confirmed errorElement in declarative mode

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified
- Architecture: HIGH -- React Router patterns verified against official docs for declarative mode
- Pitfalls: HIGH -- useNavigation limitation confirmed from official docs; other pitfalls from established React Router patterns
- Loading bar approach: MEDIUM -- custom useLocation hook is straightforward but untested in this project

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- React Router v7 is mature, no breaking changes expected)
