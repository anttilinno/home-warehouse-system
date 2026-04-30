# Architecture Research — v3.0 Premium-Terminal Frontend (frontend2 rebuild)

**Domain:** SPA frontend rebuild reaching parity with `/frontend` AND sketch 005 fidelity
**Researched:** 2026-04-30
**Confidence:** HIGH (verified against live frontend1 patterns, sketch 005 source HTML, predecessor frontend2 v2.1 architecture, backend API surface)

## Executive Summary

v3.0 is a **clean-slate rebuild of `/frontend2`** preserving the v2.1 architectural shape that was already proven (Vite + React Router v7 library mode + TanStack Query + cookie-JWT auth + workspace-scoped REST + features/* folders) and grafting onto it the **premium-terminal layout primitives validated in sketches 001–005**: a 2-column × 3-row CSS grid (topbar / sidebar+main / sidebar+bottombar), context-aware function-key bottombar, sidebar with `// GROUP` labels and 60px collapse, slim brand topbar with workspace + ONLINE status pill, and HUD-row dashboard. The function-key shortcut state is **already shipped on `/frontend`** as a register-by-id Context (`shortcuts-context.tsx`) — port verbatim. SSE matches `/frontend`'s `SSEProvider` pattern with one global EventSource and a subscribe API, feeding both the topbar ONLINE indicator and per-feature cache invalidation.

**Two prompt assumptions to challenge before locking the roadmap:**

1. **"Page-header `// LAST SYNC` meta should reflect SSE last-event time."** This is doable, but the legacy `/frontend` doesn't actually wire it — the bottombar shows `SESSION` + `LOCAL` clocks (mount-relative + wall-clock), not last-sync. For sketch-005 fidelity, expose a small `useSSEStatus()` hook from the SSE provider that returns `{ connected, lastEventAt }` and let the page-header component subscribe to that for the `LAST SYNC` meta. Don't conflate it with the bottombar clocks.

2. **"Routing structure: same as predecessor or different?"** Stay in **React Router v7 library mode** (declarative `<Routes>/<Route>`), not framework mode. Framework mode (file-based routes + loader/action data flow) is a major architectural shift that conflicts with the established TanStack Query + cookie-JWT auth pattern, would force an HMR/build-config rewrite, and brings SSR machinery this app doesn't need (it's an authenticated SPA behind cookie auth — there's nothing to render server-side). Stick with the predecessor's `routes/index.tsx` shape, but break it into route module files (`routes/items.tsx`, `routes/loans.tsx`) so the route tree doesn't accrete into a 200-line file again.

**Build order is not the predecessor's order.** The predecessor built tokens + retro atoms (Phase 48–55) → features (Phase 56–63), and it shipped, but for this rebuild the **layout primitives must come before retro atoms** because the bottombar / sidebar groups / topbar workspace pill have shape constraints that drive what the atoms need (e.g., `RetroBadge` needs to render at sidebar-collapse 60px width as just a dot; `RetroPanel` needs `// HEADER` slot semantics; `RetroButton` needs the function-key chip variant). Building atoms first means rebuilding them after the layout reveals constraints. Recommended order in §11.

**SSE integration is preserved from `/frontend` verbatim** (single EventSource, subscribe API, JWT in query param because EventSource can't send Authorization header). The topbar ONLINE indicator binds to `useSSEStatus().connected`. This is unchanged from frontend1 and is the only correct shape — don't reinvent.

**i18n: do NOT keep Lingui.** The predecessor used Lingui macros which require a Babel transform incompatible with Vite 8's pure-Rolldown pipeline (the predecessor worked around it with `@lingui/swc-plugin`). For 2026, native `Intl.MessageFormat` proposal is too early; **react-intl (FormatJS) without macros** is the lowest-friction port — runtime API, no build plugin, ~30 kB gzipped, three-language catalog (en/et/ru) ports cleanly from `frontend2/src/locales/`. See STACK.md §i18n for the version pin.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser SPA (frontend2)                                             │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ App.tsx — Provider stack                                    │     │
│  │  IntlProvider > QueryClientProvider > AuthProvider          │     │
│  │  > SSEProvider > ToastProvider > ShortcutsProvider          │     │
│  │  > BrowserRouter                                            │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Layout shell (AppShell, components/layout/)                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ TopBar (brand + ws pill + ONLINE dot)                   │ │   │
│  │  ├──────────┬──────────────────────────────────────────────┤ │   │
│  │  │ Sidebar  │ <Outlet /> (route module renders into main)  │ │   │
│  │  │ // GRP   │   page-header (// ROUTE breadcrumb + meta)   │ │   │
│  │  │  items   │   page body (HUD row, tables, forms…)        │ │   │
│  │  │ user-mn  ├──────────────────────────────────────────────┤ │   │
│  │  │          │ Bottombar (F-key chips + SESSION/LOCAL)      │ │   │
│  │  └──────────┴──────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Feature modules (features/*)                                 │   │
│  │  auth · dashboard · items · loans · borrowers ·              │   │
│  │  taxonomy · scan · settings                                  │   │
│  │  Each feature: <pages>.tsx · <forms>.tsx · hooks/ · *_test   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Data layer (lib/api/)                                        │   │
│  │  api.ts (fetch + 401 single-flight refresh + HttpError)      │   │
│  │  items.ts · loans.ts · borrowers.ts · taxonomy.ts · …        │   │
│  │  Each entity exports: <entity>Api + <entity>Keys factory     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                               │ HTTPS (cookie JWT) + SSE (token in URL)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Backend (Go monolith) — UNCHANGED                                   │
│  Chi router · JWT middleware · /api/auth/* + /api/workspaces/{ws}/*  │
│  · /api/sse · sqlc-typed queries · Postgres                          │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `AppShell` | Owns the 2×3 CSS grid, mounts TopBar/Sidebar/Bottombar, renders `<Outlet />` for the route content | `components/layout/AppShell.tsx`, **CSS Grid with `grid-template-areas`** verbatim from sketch 005 |
| `TopBar` | Brand mark, brand text, workspace pill, ONLINE indicator | `components/layout/TopBar.tsx`. `ONLINE` dot reads `useSSEStatus().connected` |
| `Sidebar` | Three groups (`// OVERVIEW` / `// INVENTORY` / `// SYSTEM`), nav items, badge counts, user menu in footer, collapse toggle | `components/layout/Sidebar.tsx`. Collapse driven by single `data-collapsed` attribute on root grid + CSS custom property `--sidebar-w` |
| `Bottombar` | Function-key chips for current route + global F1/ESC + SESSION/LOCAL clocks | `components/layout/Bottombar.tsx`. Reads from `ShortcutsContext` |
| `ShortcutsProvider` | Register-by-id store for per-route shortcuts; derives flat array for keyboard dispatcher | `components/layout/shortcuts-context.tsx` (PORT VERBATIM from `/frontend`) |
| `PageHeader` | `// ROUTE` breadcrumb + h1 title + system meta (`SESSION ... // LAST SYNC ...`) | `components/layout/PageHeader.tsx`. New component — frontend1 doesn't have one in this exact shape |
| `useShortcuts(id, shortcuts)` | Per-route hook: registers shortcuts on mount, unregisters on unmount | `hooks/useShortcuts.ts` |
| `useSSEStatus()` | Returns `{ connected, lastEventAt }` for ONLINE indicator + LAST SYNC meta | Selector on existing SSEContext |
| `RetroPanel`, `RetroButton`, `RetroBadge`, `RetroInput`, `RetroFormField`, `RetroSelect`, `RetroTable`, `RetroPagination`, `RetroDialog`, `RetroToast`, `RetroEmptyState`, `RetroConfirmDialog` | Generic UI atoms with retro chrome | `components/retro/*`. Re-derive from sketch 005 visual language; **predecessor's atoms are a useful starting point but every one must be visually re-validated** |
| Feature pages | Route entry points. Compose atoms + page-header + feature components. Register page-specific shortcuts via `useShortcuts()` | `features/<entity>/*Page.tsx` |
| Feature hooks | TanStack Query wrappers. Read `useAuth().workspaceId`, gate with `enabled: !!workspaceId` | `features/<entity>/hooks/*.ts` |
| `api.ts` | Shared fetch wrapper, `HttpError` class, multipart helper, **single-flight 401 refresh** | `lib/api.ts` (port verbatim from predecessor; pattern is correct) |

## Recommended Project Structure

```
frontend2/
├── public/                              # static assets (SVG brand mark, fonts, favicon)
│
├── src/
│   ├── App.tsx                          # provider stack (10 lines)
│   ├── main.tsx                         # ReactDOM.createRoot + <App />
│   │
│   ├── routes/                          # ROUTE TREE — split by feature, not one fat file
│   │   ├── index.tsx                    # <Routes> declaration: imports route modules
│   │   ├── auth.tsx                     # /auth /auth/callback /auth/oauth/{provider}
│   │   ├── dashboard.tsx                # /
│   │   ├── items.tsx                    # /items /items/:id /items/new
│   │   ├── loans.tsx                    # /loans /loans/new /loans/:id
│   │   ├── borrowers.tsx                # /borrowers /borrowers/:id
│   │   ├── taxonomy.tsx                 # /taxonomy
│   │   ├── scan.tsx                     # /scan
│   │   └── settings.tsx                 # /settings/* (8 subpages)
│   │
│   ├── components/
│   │   ├── layout/                      # SHELL — depends on retro/, drives the grid
│   │   │   ├── AppShell.tsx             # 2×3 grid + <Outlet />
│   │   │   ├── TopBar.tsx               # brand + ws pill + ONLINE dot
│   │   │   ├── Sidebar.tsx              # grouped nav + user menu
│   │   │   ├── SidebarGroup.tsx         # // GROUP label + items
│   │   │   ├── SidebarItem.tsx          # icon + label + badge + active rail
│   │   │   ├── UserMenu.tsx             # sidebar-footer dropdown
│   │   │   ├── Bottombar.tsx            # F-key chips + clocks
│   │   │   ├── ShortcutChip.tsx         # [N] LABEL key cap
│   │   │   ├── PageHeader.tsx           # // ROUTE breadcrumb + meta
│   │   │   ├── shortcuts-context.tsx    # ShortcutsProvider + useShortcutsContext
│   │   │   ├── ErrorBoundaryPage.tsx    # caught crashes — full-screen retro panel
│   │   │   ├── LoadingBar.tsx           # top-of-page progress on route-load
│   │   │   └── useRouteLoading.ts       # bind LoadingBar to react-router navigation state
│   │   │
│   │   └── retro/                       # GENERIC UI ATOMS — depend on tokens only
│   │       ├── RetroPanel.tsx           # box with optional `// HEADER` + hazard stripe
│   │       ├── RetroButton.tsx          # default + danger + key-chip variants
│   │       ├── RetroBadge.tsx           # pending counts, status tags
│   │       ├── RetroInput.tsx           # text input
│   │       ├── RetroSelect.tsx          # native <select> styled
│   │       ├── RetroCombobox.tsx        # search-as-you-type single-select
│   │       ├── RetroTextarea.tsx        # multiline
│   │       ├── RetroCheckbox.tsx        # checkbox + radio
│   │       ├── RetroFileInput.tsx       # photo + file uploads
│   │       ├── RetroFormField.tsx       # label + helper + error wrapping rhf field
│   │       ├── RetroTable.tsx           # head/body/row/cell + density modifier
│   │       ├── RetroTabs.tsx            # tab bar (loans active/overdue/history)
│   │       ├── RetroDialog.tsx          # modal — NOT full-screen (camera surfaces use page route, not dialog)
│   │       ├── RetroConfirmDialog.tsx   # OK/cancel destructive
│   │       ├── RetroToast.tsx           # ToastProvider + useToast
│   │       ├── RetroEmptyState.tsx      # empty-list panel
│   │       ├── RetroPagination.tsx      # page controls
│   │       ├── RetroStatusDot.tsx       # green/amber/red dot with optional pulse
│   │       ├── RetroHUD.tsx             # 3-tile dashboard row (gauge / sparkline / counts)
│   │       └── index.ts                 # barrel
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx          # PORT — workspaceId in context, 401/403 token clear
│   │   │   ├── RequireAuth.tsx          # PORT — redirect to /auth on no auth
│   │   │   ├── LoginPage.tsx            # email/password + OAuth buttons (Google + GitHub)
│   │   │   ├── RegisterPage.tsx         # signup
│   │   │   ├── AuthCallbackPage.tsx     # OAuth code exchange handoff
│   │   │   └── hooks/
│   │   │       └── useAuthMutations.ts  # login/logout/register
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.tsx        # HUD row + activity table + alerts/approvals rail
│   │   │   ├── HUDCapacityGauge.tsx     # SVG semicircle (no chart lib)
│   │   │   ├── HUDActivitySparkline.tsx # SVG <rect> bars
│   │   │   ├── HUDInventoryCounts.tsx   # 3-tile counts
│   │   │   ├── ActivityTable.tsx        # TUI-density data table
│   │   │   └── PendingAlertsRail.tsx    # right rail
│   │   ├── items/
│   │   │   ├── ItemsListPage.tsx
│   │   │   ├── ItemDetailPage.tsx
│   │   │   ├── ItemForm.tsx             # rhf + zod
│   │   │   ├── ItemPhotoGallery.tsx
│   │   │   ├── ItemPhotoUploader.tsx
│   │   │   ├── filters/
│   │   │   └── hooks/
│   │   │       ├── useItemsList.ts
│   │   │       ├── useItem.ts
│   │   │       └── useItemMutations.ts
│   │   ├── loans/
│   │   │   ├── LoansListPage.tsx        # tabs: Active / Overdue / History
│   │   │   ├── LoanForm.tsx
│   │   │   ├── LoanReturnDialog.tsx
│   │   │   └── hooks/
│   │   ├── borrowers/
│   │   ├── taxonomy/
│   │   ├── scan/
│   │   ├── settings/
│   │   │   ├── SettingsLandingPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── SecurityPage.tsx
│   │   │   ├── AppearancePage.tsx
│   │   │   ├── LanguagePage.tsx
│   │   │   ├── FormatsPage.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   ├── ConnectedAccountsPage.tsx
│   │   │   └── DataStoragePage.tsx
│   │   └── setup/                       # workspace bootstrap for first-login
│   │
│   ├── hooks/                           # cross-feature hooks
│   │   ├── useShortcuts.ts              # register/unregister page-shortcuts
│   │   ├── useDateFormat.ts             # user-format-aware date string
│   │   ├── useTimeFormat.ts
│   │   ├── useNumberFormat.ts
│   │   └── useTheme.ts                  # reads/writes dark/light/system
│   │
│   ├── lib/
│   │   ├── api.ts                       # fetch + 401 refresh + HttpError + postMultipart
│   │   ├── api/
│   │   │   ├── index.ts                 # barrel
│   │   │   ├── items.ts                 # itemsApi + itemKeys
│   │   │   ├── itemPhotos.ts
│   │   │   ├── loans.ts
│   │   │   ├── borrowers.ts
│   │   │   ├── taxonomy.ts              # combined: categories, locations, containers
│   │   │   ├── scan.ts                  # if /scan ships in v3.0
│   │   │   └── auth.ts
│   │   ├── sse/
│   │   │   ├── SSEContext.tsx           # PORT shape from /frontend with adjustments
│   │   │   ├── useSSESubscription.ts    # subscribe to event types
│   │   │   └── useSSEStatus.ts          # { connected, lastEventAt }
│   │   ├── i18n/
│   │   │   ├── IntlProvider.tsx         # FormatJS IntlProvider wrapper
│   │   │   ├── locales/
│   │   │   │   ├── en.json
│   │   │   │   ├── et.json
│   │   │   │   └── ru.json
│   │   │   └── useLocale.ts
│   │   ├── format/                      # date/time/number formatters (port from frontend2 v2.1)
│   │   └── types.ts                     # User, Session, Workspace, ApiError
│   │
│   └── styles/
│       ├── globals.css                  # @import tokens.css; body resets; scanline overlay
│       ├── tokens.css                   # CSS custom properties (PORT from sketch themes/default.css)
│       └── grid.css                     # .app grid-template-areas + collapse selector
│
├── e2e/                                 # Playwright specs (port the v2.2 G-65-01 spec)
├── tests/                               # Vitest setup
├── playwright.config.ts
├── vite.config.ts
├── tailwind.config.ts                   # Tailwind v4: @theme directive references CSS vars
├── tsconfig.json
└── package.json
```

### Structure Rationale

- **`routes/` is split by feature, not one `routes/index.tsx` file.** The predecessor's `routes/index.tsx` shipped at 17 routes and was already over 100 LOC; v3.0 with parity adds 8 settings subpages on top. Splitting per-feature keeps each route module under 30 LOC and makes feature ownership obvious.
- **`components/layout/` depends on `components/retro/` but never the reverse.** The shell consumes atoms; atoms know nothing about the shell. This means the shell can be rebuilt from sketch fidelity without invalidating atoms, and atoms can be unit-tested in isolation.
- **`features/` are not vertical slices that own their own atoms.** A feature can't define a `RetroButton` variant; if it needs new chrome, it's promoted to `components/retro/`. This avoids the v2.0/v2.1 trap where each feature sprouted bespoke "almost-RetroPanel" wrappers.
- **`hooks/` is for cross-feature hooks ONLY.** Feature-internal hooks live in `features/<entity>/hooks/`. Predecessor v2.1 had an empty `src/hooks/` that should now actually be populated with `useShortcuts`, `useDateFormat`, etc.
- **`lib/api/` mirrors backend resources.** One file per backend resource path segment (`items.ts` ↔ `/api/workspaces/{ws}/items`). Each exports `<entity>Api` (CRUD methods) and `<entity>Keys` (TanStack Query key factory). This pattern shipped in v2.1 and worked — keep it.
- **`lib/sse/` is its own folder, not under `features/`.** SSE is cross-cutting infrastructure: dashboard subscribes for activity, items subscribes for cache invalidation, topbar subscribes for connection status. Putting it under one feature mis-models it.
- **`styles/` is small.** Three files: tokens (CSS vars), grid (the `.app` rules), globals (resets + scanlines). Per-feature CSS goes in CSS modules adjacent to components OR (preferred) Tailwind utility classes that read the CSS vars (`bg-[var(--bg-panel)]`).

## Architectural Patterns

### Pattern 1: Layout grid via CSS `grid-template-areas`

**What:** A single CSS rule expresses the entire app shell. Sidebar collapse is a single attribute toggle on the grid root. No JavaScript layout work, no measure phase.

**When to use:** Whenever the shell has a fixed structural pattern (topbar / sidebar / main / bottombar) — which is the entire premium-terminal aesthetic, not optional.

**Trade-offs:**
- ✅ Performant. Layout invalidation is one CSS recalculation, not an array of refs measured in `useLayoutEffect`.
- ✅ Sidebar collapse is `[data-collapsed="true"]` selector swap; no width-prop-drilling.
- ✅ Idiomatic CSS — no library needed.
- ❌ Less flexible than runtime layout (e.g., a user-resizable sidebar via drag handle). Not in scope; sketch 005 has only collapsed/expanded.

**Example:**

```css
/* styles/grid.css — port from sketch 005 verbatim */
.app {
  display: grid;
  grid-template-columns: var(--sidebar-w, 248px) 1fr;
  grid-template-rows: 48px 1fr 36px; /* topbar / main / bottombar */
  grid-template-areas:
    "topbar    topbar"
    "sidebar   main"
    "sidebar   bottombar";
  min-height: 100vh;
  transition: grid-template-columns 200ms ease;
}
.app[data-collapsed="true"] { --sidebar-w: 60px; }

.topbar    { grid-area: topbar; }
.sidebar   { grid-area: sidebar; }
.main      { grid-area: main; overflow-y: auto; }
.bottombar { grid-area: bottombar; }
```

```tsx
// components/layout/AppShell.tsx
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app" data-collapsed={collapsed}>
      <TopBar />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="main">
        <Outlet />
      </main>
      <Bottombar />
    </div>
  );
}
```

**Mobile note:** at narrow viewports (<768px), the grid collapses to single-column with the sidebar hidden behind a sheet. Express this with a media query that overrides `grid-template-areas` to `"topbar" "main" "bottombar"` and toggles sidebar `display: none` (with mobile drawer opening it on demand). Bottombar is hidden on mobile (`md:hidden`) per `/frontend` precedent.

### Pattern 2: Function-key shortcut state via register-by-id Context

**What:** Every page that has shortcuts calls `useShortcuts("page-id", [...])` on mount. Shortcuts live in a Context indexed by id; the Bottombar renders `Object.values(groups).flat()`; the keyboard dispatcher matches `event.key.toUpperCase()` against the same flat array. One source of truth — bar render and key dispatch agree by construction.

**When to use:** Always for the function-key bottombar. This is THE shape sketch 005 specifies and `/frontend` already ships it correctly.

**Trade-offs vs alternatives:**

- ✅ vs **Zustand global store:** Context is fine here because shortcut registration is **per-route** and rerender blast radius is bounded to the Bottombar (the only consumer). Zustand would shave a few rerenders, not worth the dependency.
- ✅ vs **per-page hooks that mount a hidden `<KeyHandler>`:** would require event-dispatching coordination across siblings. Register-by-id is simpler.
- ✅ vs **a single shortcuts object pinned to the page-loader's data:** that's the React Router framework-mode shape — good if we were using framework mode, but we're not.
- ❌ Multiple concurrent registrations (e.g., a page registers shortcuts AND opens a dialog that registers more) require careful unmount ordering. Solved by `register(id, shortcuts)` + `unregister(id)` keyed by stable string id (already in `/frontend`'s shape).

**Example (port verbatim from `/frontend/components/layout/shortcuts-context.tsx`):**

```ts
// components/layout/shortcuts-context.tsx
export interface Shortcut { key: string; label: string; action: () => void; danger?: boolean }
interface ShortcutsContextValue {
  shortcuts: Shortcut[];
  register: (id: string, shortcuts: Shortcut[]) => void;
  unregister: (id: string) => void;
}

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Record<string, Shortcut[]>>({});
  const register   = useCallback((id, s) => setGroups(p => ({ ...p, [id]: s })), []);
  const unregister = useCallback((id)    => setGroups(p => { const n = {...p}; delete n[id]; return n; }), []);
  const shortcuts  = useMemo(() => Object.values(groups).flat(), [groups]);
  const value      = useMemo(() => ({ shortcuts, register, unregister }), [shortcuts, register, unregister]);
  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}
```

```ts
// hooks/useShortcuts.ts — convenience wrapper
export function useShortcuts(id: string, shortcuts: Shortcut[]) {
  const { register, unregister } = useShortcutsContext();
  useEffect(() => {
    register(id, shortcuts);
    return () => unregister(id);
  }, [id, register, unregister, shortcuts]);
}

// features/dashboard/DashboardPage.tsx — usage
useShortcuts("dashboard", [
  { key: "N", label: "Add Item",      action: () => navigate("/items?new=1") },
  { key: "S", label: "Scan",          action: () => navigate("/scan") },
  { key: "L", label: "Loans",         action: () => navigate("/loans") },
  { key: "Q", label: "Quick Capture", action: () => navigate("/items?capture=1") },
]);
```

`Bottombar` appends `{ key: "F1", label: "Help", ... }` and `{ key: "ESC", label: "Logout", danger: true, ... }` itself — globals never go through the provider.

### Pattern 3: Auth via cookie-JWT + RequireAuth wrapper + TanStack Query (no loaders)

**What:** Backend sets `access_token` HTTP cookie on login. `AuthContext` exposes `{ isAuthenticated, workspaceId, user }`. `RequireAuth` wraps all protected route trees and redirects to `/auth` on no auth. Per-feature data is fetched via TanStack Query in components, **not** via React Router v7 loaders.

**When to use:** This shape. For 2026, library-mode v7 with TanStack Query remains the lowest-friction stack for a cookie-auth SPA.

**Trade-offs vs framework-mode loaders:**

- ✅ Existing pattern proven in v2.1. No migration cost.
- ✅ Cookie-JWT already works with `fetch` + `credentials: "include"`; no change required.
- ✅ TanStack Query gives caching, optimistic updates, background refetch, mutation invalidation — all of which loaders don't.
- ✅ SSE invalidation happens by `qc.invalidateQueries(itemKeys.all)` on a subscription event; loaders would need imperative re-fetch via `revalidate()` and lose the cached state.
- ❌ Would need a refactor if the project ever wanted SSR, but it doesn't (auth is cookie-bound and the app is feature-rich, not SEO content).

**Why NOT switch to framework mode:**

1. Framework mode revalidates loaders after every navigation by default — wastes bandwidth on cached data. TanStack Query stale-while-revalidate is smarter.
2. Framework mode wants a Vite plugin that controls module resolution; this conflicts with the existing TanStack Query devtools, react-intl runtime API, and the CI grep guard tooling.
3. The data-flow benefit of loaders (data ready before component renders) is moot when cached data renders instantly anyway.
4. Migration cost: every feature page would need `clientLoader` extracted, `useLoaderData()` adopted, and `useQuery` either dropped or layered on top — net negative for a feature-complete codebase.

**Example:**

```tsx
// features/auth/RequireAuth.tsx — PORT
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <RetroLoading />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// routes/index.tsx
<Routes>
  <Route path="/auth" element={<LoginPage />} />
  <Route path="/auth/callback" element={<AuthCallbackPage />} />
  <Route element={<RequireAuth><AppShell /></RequireAuth>} errorElement={<ErrorBoundaryPage />}>
    <Route index element={<DashboardPage />} />
    <Route path="items/*" element={<ItemsRoutes />} />
    <Route path="loans/*" element={<LoansRoutes />} />
    {/* … */}
  </Route>
</Routes>
```

### Pattern 4: SSE provider with `{ connected, lastEventAt }` selector

**What:** Single `EventSource` opened once at provider mount, owns the connection lifecycle (open/error/reconnect with exponential backoff). Subscribers register event handlers via `useSSESubscription(handler)`. Status selector `useSSEStatus()` returns connection metadata for chrome bindings.

**When to use:** Always. This is shipped and correct on `/frontend`; reuse the shape.

**Trade-offs:**

- ✅ Single connection — backend rate-limits per-user and the browser also caps EventSource per origin.
- ✅ Auto-reconnect with exponential backoff handled inside the provider; consumers never see a flaky connection.
- ✅ JWT goes in URL query param (EventSource API limitation — can't set `Authorization` header). Backend already accepts this on `/api/sse`.
- ❌ JWT in URL appears in server access logs; mitigated by short token TTL + refresh.

**Two consumer shapes:**

```tsx
// 1. CHROME — topbar ONLINE indicator
function TopBar() {
  const { connected, lastEventAt } = useSSEStatus();
  return (
    <header className="topbar">
      <Brand />
      <WorkspacePill />
      <RetroStatusDot active={connected} pulse={connected} />
      <span className="meta">{connected ? "ONLINE" : "OFFLINE"}</span>
    </header>
  );
}

// 2. FEATURE — items page invalidates on item.* events
function ItemsListPage() {
  const qc = useQueryClient();
  useSSESubscription(event => {
    if (event.type === "item.created" || event.type === "item.updated" || event.type === "item.deleted") {
      qc.invalidateQueries({ queryKey: itemKeys.all });
    }
  });
  // …
}
```

`useSSEStatus()` returns the same `connected` flag the page-header uses for its `// LAST SYNC` meta:

```tsx
// components/layout/PageHeader.tsx
function PageHeader({ route, title }: { route: string; title: string }) {
  const { lastEventAt } = useSSEStatus();
  const sessionStart = useSessionStart();
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <div className="breadcrumb">
        <span>// {route}</span>
        <span className="sep">|</span>
        <span>SESSION <b>{formatHHMMSS(now - sessionStart)}</b></span>
        <span className="sep">|</span>
        <span>LAST SYNC <b>{lastEventAt ? formatHHMMSS(lastEventAt) : "—"}</b></span>
      </div>
    </header>
  );
}
```

### Pattern 5: Data tables — custom over TanStack Table

**What:** A `RetroTable` family (`RetroTable`, `RetroTableHead`, `RetroTableRow`, `RetroTableCell`) that renders a `<table>` with retro chrome. Sort/filter logic lives in feature hooks (`useItemsList`), not in a table library. Pagination is server-driven (existing `RetroPagination`).

**When to use:** Default for ALL data tables — items list, loans tabs, activity feed, borrowers list.

**Trade-offs vs TanStack Table:**

- ✅ TUI density needs precise control over row height (24–28px), cell padding (4–8px), border style (single 1px line not borders both sides) — TanStack Table doesn't impede this but every customization fights default styling.
- ✅ Sort + filter state already lives in `useItemsList` (URL params for shareable views). TanStack Table's headless model adds an abstraction that doesn't help here.
- ✅ Bundle: zero added dependencies vs ~12 KB for TanStack Table.
- ✅ Activity feed is a TUI table with **truncation**, **status pills inline**, and **fixed-width timestamp column** — closer to a chess-clock display than a typical data grid. A custom render path is clearer.
- ❌ If we needed virtualization for >10k rows, custom would force adopting `@tanstack/react-virtual`; defer until rows >2k are observed.
- ❌ Column resize, column reorder, column pinning — would have to build. Sketch 005 doesn't show any of these; defer.

**Example:**

```tsx
// components/retro/RetroTable.tsx
export function RetroTable({ children, dense = true, ...props }: TableProps) {
  return <table className={`retro-table ${dense ? "dense" : ""}`} {...props}>{children}</table>;
}
// .retro-table.dense td { padding: 4px 8px; line-height: 1.2; font-size: 12px; }
// .retro-table tr { border-bottom: 1px solid var(--fg-dim); }

// features/items/ItemsListPage.tsx
<RetroTable>
  <RetroTableHead>
    <RetroTableRow>
      <RetroTableCell role="columnheader" onClick={() => setSort("name")}>Name {sort==="name" && "▼"}</RetroTableCell>
      <RetroTableCell>SKU</RetroTableCell>
      <RetroTableCell>Location</RetroTableCell>
      <RetroTableCell>Status</RetroTableCell>
    </RetroTableRow>
  </RetroTableHead>
  <tbody>
    {items.map(item => (
      <RetroTableRow key={item.id} onClick={() => navigate(`/items/${item.id}`)}>
        <RetroTableCell>{item.name}</RetroTableCell>
        <RetroTableCell mono>{item.sku}</RetroTableCell>
        <RetroTableCell>{item.location?.name ?? "—"}</RetroTableCell>
        <RetroTableCell><RetroBadge status={item.status} /></RetroTableCell>
      </RetroTableRow>
    ))}
  </tbody>
</RetroTable>
```

### Pattern 6: Forms via react-hook-form + RetroFormField

**What:** Forms use `react-hook-form` for state + `zod` for schema validation. Each field is wrapped in `RetroFormField` (label + helper + error) with the actual control inside (`RetroInput`, `RetroSelect`, etc.). The wrapping shape ports verbatim from v2.1 and worked.

**When to use:** All forms — login, register, item create/edit, loan create, settings panels.

**Trade-offs:**

- ✅ rhf is mature, hookable, and the v2.1 shape is proven.
- ✅ `RetroFormField` keeps spacing + label + error consistent across all forms; no per-form layout drift.
- ✅ Resolver pattern: `resolver: zodResolver(itemSchema)` gives both runtime validation and TypeScript inference of the form values.
- ❌ Async validation (e.g., "is this SKU unique") needs custom logic — rhf supports it via `validate` async functions; not a blocker.

**Example:**

```tsx
// features/items/ItemForm.tsx
const itemSchema = z.object({
  name: z.string().min(1, "Required"),
  sku: z.string().regex(/^[A-Z0-9-]+$/, "Uppercase letters, numbers, dashes only"),
  // …
});
type ItemInput = z.infer<typeof itemSchema>;

export function ItemForm({ defaultValues, onSubmit }: Props) {
  const form = useForm<ItemInput>({ resolver: zodResolver(itemSchema), defaultValues });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <RetroFormField label="NAME" error={form.formState.errors.name?.message}>
        <RetroInput {...form.register("name")} />
      </RetroFormField>
      <RetroFormField label="SKU" error={form.formState.errors.sku?.message}>
        <RetroInput {...form.register("sku")} />
      </RetroFormField>
      {/* … */}
      <RetroButton type="submit" disabled={form.formState.isSubmitting}>SAVE</RetroButton>
    </form>
  );
}
```

### Pattern 7: Theme tokens — CSS custom properties + Tailwind v4 `@theme`

**What:** Lock the premium-terminal palette as CSS custom properties in `styles/tokens.css`. Tailwind v4's `@theme` directive references those vars so utility classes like `bg-bg-panel` Just Work. Components prefer Tailwind utilities; custom components that need exact pixel control (the grid, the topbar bevels) use raw CSS rules in `styles/grid.css` or component-scoped `<style>`.

**When to use:** Always. The dual-hue (amber labels, green data) IS the design — tokens encode it, every component reads them.

**Trade-offs:**

- ✅ One source of truth: tokens.css. Re-skinning later is one file.
- ✅ Tailwind utilities work with `bg-[var(--bg-panel)]` syntax even without `@theme`; `@theme` just gives nicer class names.
- ✅ Dark/light theming (sketch 005 is dark-only, but accessibility may force a light variant) is tractable: `:root.light { --bg-base: …; }`.
- ❌ Tailwind v4 is new (released 2025). Caveats around `@theme` are still being documented; pin Tailwind version and budget time for one or two upgrade adjustments.

**Example:**

```css
/* styles/tokens.css */
:root {
  --bg-base: #0a0e0a;
  --bg-panel: #0d130f;
  --bg-panel-2: #11181a;
  --bg-elevated: #161e20;
  --bg-active: #1d2628;
  --bg-hover: #141d1f;
  --fg-dim: #4a5650;
  --fg-base: #8eb09a;
  --fg-mid: #ffd07a;        /* amber labels */
  --fg-bright: #ffe0a0;     /* amber accents */
  --fg-glow: #d6ffdc;       /* green data */
  --amber: #ffd07a;
  --amber-bright: #ffe0a0;
  --accent-warn: #f5b35e;
  --accent-danger: #d96a6a;
  --accent-info: #6a9fd9;
  --border-thin: 1px solid var(--fg-dim);
  --border-thick: 1px solid var(--fg-mid);
  --sidebar-w: 248px;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 24px; --sp-6: 32px;
}
```

```css
/* tailwind.config.ts via @theme directive (v4) */
@theme {
  --color-bg-base: var(--bg-base);
  --color-bg-panel: var(--bg-panel);
  --color-fg-amber: var(--amber);
  --color-fg-glow: var(--fg-glow);
  /* … */
}
/* now `bg-bg-panel` and `text-fg-glow` are valid Tailwind utilities */
```

### Pattern 8: i18n — react-intl runtime API, no macros

**What:** `IntlProvider` at the root of the provider stack. Components use `useIntl()` hook + `<FormattedMessage id="..." defaultMessage="..." />`. Locale catalogs live in `lib/i18n/locales/{en,et,ru}.json`. No build-time macros; messages are extracted via FormatJS CLI to a separate JSON used as the en-base, then translated into et/ru.

**When to use:** All user-facing strings.

**Trade-offs vs Lingui (predecessor):**

- ✅ No Babel/SWC plugin → works with Vite 8's pure-Rolldown pipeline out of the box.
- ✅ Mature, stable, ~30 KB gzipped (Format.js core).
- ✅ Locale switching at runtime: `<IntlProvider locale={locale} messages={messages[locale]}>`.
- ❌ Slightly more verbose than Lingui macros (`t\`Hello\`` vs `<FormattedMessage id="hello" defaultMessage="Hello" />`).

**Why not Lingui in v3.0:** the predecessor's Lingui SWC plugin shipped, but it pinned the build to a specific SWC version and made future Vite upgrades fragile. Native runtime API is the safer bet.

**Why not native `Intl.MessageFormat`:** the proposal is at TC39 stage 2 in early 2026 — too early to ship to production browsers without polyfill. Revisit at stage 3+.

**Example:**

```tsx
// App.tsx
<IntlProvider locale={locale} messages={messages[locale]}>
  {children}
</IntlProvider>

// features/items/ItemsListPage.tsx
import { FormattedMessage, useIntl } from "react-intl";
const intl = useIntl();
const placeholder = intl.formatMessage({ id: "items.search.placeholder", defaultMessage: "Search items…" });

// JSX usage
<RetroEmptyState title={<FormattedMessage id="items.empty.title" defaultMessage="No items yet" />} />
```

## Data Flow

### Request Flow

```
[User clicks /items in sidebar]
    ↓
React Router NavLink → navigate("/items")
    ↓
ItemsListPage mounts → useItemsList(filters) — TanStack Query
    ↓
itemsApi.list(workspaceId, filters) → fetch /api/workspaces/{ws}/items?…
    ↓ (cookie JWT auto-included via credentials: "include")
Backend: JWTAuth → Workspace middleware → ItemHandler.List → sqlc query
    ↓
Response { items, total, … } → ItemListResponse type
    ↓
TanStack Query caches under itemKeys.list(workspaceId, filters)
    ↓
ItemsListPage re-renders with data → RetroTable rows
```

### State Management

```
                     ┌─────────────────────────────────────┐
                     │  Provider stack (App.tsx)           │
                     ├─────────────────────────────────────┤
                     │  IntlProvider                       │  i18n locale
                     │  QueryClientProvider                │  server cache
                     │  AuthContext                        │  user, workspace
                     │  SSEContext                         │  EventSource + status
                     │  ToastProvider                      │  toast queue
                     │  ShortcutsProvider                  │  per-route shortcuts
                     │  ThemeProvider                      │  dark/light + tokens
                     └────────────┬────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
   ┌──────────────┐     ┌──────────────────┐    ┌──────────────────┐
   │  Layout      │     │  Feature pages   │    │  lib/api/        │
   │  (chrome)    │     │  (routes)        │    │  (data fetchers) │
   └──────────────┘     └──────────────────┘    └──────────────────┘
            │                     │                     │
            │ reads               │ reads               │ owned by
            │ AuthContext         │ AuthContext         │ QueryClient
            │ ShortcutsContext    │ TanStack Query      │
            │ SSEContext          │ rhf form state      │
            │                     │ local UI state      │
```

### Key Data Flows

1. **Login flow:** User submits `LoginPage` form → `useAuthMutations().login(creds)` → `POST /api/auth/login` → backend sets `access_token` cookie + returns `{ user, workspaceId }` → `AuthContext` stores user/workspaceId → `RequireAuth` no-longer redirects → `useNavigate("/")` lands on dashboard.

2. **OAuth flow:** User clicks "Sign in with Google" → `GET /api/auth/oauth/google` → backend redirects to Google → user consents → Google redirects to `/api/auth/oauth/google/callback` → backend exchanges code, sets cookie, redirects to frontend `/auth/callback?code=xxx` → `AuthCallbackPage` calls `POST /api/auth/oauth/exchange { code }` → cookie set → navigate to dashboard.

3. **Read flow (item list):** `ItemsListPage` mounts → `useItemsList()` → `useQuery({ queryKey: itemKeys.list(ws, filters), queryFn: () => itemsApi.list(ws, filters), enabled: !!ws })` → fetch fires → response cached → component renders.

4. **Mutation flow (create item):** User submits `ItemForm` → `useCreateItem().mutate(input)` → `POST /api/workspaces/{ws}/items` → on success: `qc.invalidateQueries(itemKeys.all)` → list refetches → toast "Item created" → navigate to detail.

5. **SSE flow (item updated by another user):** Backend emits `item.updated` SSE event → `SSEProvider` event listener invokes all subscribers → `ItemsListPage`'s subscriber calls `qc.invalidateQueries(itemKeys.all)` → list refetches with new data. Topbar `RetroStatusDot` flashes via `lastEventAt` timestamp.

6. **Shortcut flow:** `DashboardPage` mounts → `useShortcuts("dashboard", [...])` → `register("dashboard", […])` updates `ShortcutsProvider` state → `Bottombar` flat-array re-derives → renders `[N] ADD ITEM` chip. User presses `N` → `Bottombar` keyboard listener matches → `action()` fires → `navigate("/items?new=1")`. On unmount: `unregister("dashboard")` removes the entries.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user | Current shape works. No tuning needed. |
| 10–100 users (typical) | TanStack Query default `staleTime` of 0 may cause excessive refetches as users navigate; bump to 30s for read-heavy queries. SSE one connection per browser tab — fine. |
| 100–1k users | Backend SSE connection pool is the first bottleneck (one EventSource per logged-in tab). Add per-user connection cap server-side. Frontend route-level lazy loading (`React.lazy` for settings subpages, scan page) keeps main bundle <200 KB gzipped. |
| 1k–10k users | Items list with >2k rows in a single workspace → adopt `@tanstack/react-virtual` for `RetroTable`. Photo gallery with >100 photos per item → adopt intersection-observer lazy loading. Move locale catalogs to lazy `import()` per locale (load only the active one). |
| 10k+ users | Out of scope for this milestone but: migrate to React Server Components or framework-mode v7 for initial-paint critical paths; introduce a CDN-cached read replica for items list. |

### Scaling Priorities

1. **First bottleneck:** Render time on >2k row item lists. Fix: virtualize `RetroTable` rows. Cost: ~10 KB for `@tanstack/react-virtual`, one component change.
2. **Second bottleneck:** Bundle size if all features eagerly imported. Fix: route-level `React.lazy` for settings/* and scan/*. Cost: zero — already supported.
3. **Third bottleneck:** SSE event storm during bulk operations (e.g., admin imports 500 items). Fix: backend should batch into a single `bulk.items.created` event; frontend listens once and invalidates. Backend change.

## Anti-Patterns

### Anti-Pattern 1: Switching to React Router v7 framework mode

**What people do:** Migrate to file-based routes + `clientLoader` + `useLoaderData()` because "loaders are the new pattern."

**Why it's wrong:** The cookie-JWT + TanStack Query + library mode shape works and is feature-complete. Framework mode revalidates on every navigation by default (worse than stale-while-revalidate), forces a Vite plugin that conflicts with existing tooling, and discards the cache benefits TanStack Query provides. There is no SSR benefit for an authenticated SPA.

**Do this instead:** Stay in library mode (declarative `<Routes>`). Split `routes/index.tsx` per-feature so it doesn't bloat. If file-based routing is desired for ergonomics later, evaluate `vite-plugin-pages` first — it adds file-based routing without the rest of framework mode's machinery.

### Anti-Pattern 2: `RetroPanel` variants per feature

**What people do:** `features/items/ItemPanel.tsx` defines a near-clone of `RetroPanel` with item-specific styling because "the standard panel doesn't quite fit."

**Why it's wrong:** Drift. After three features each define their "almost-RetroPanel," the design has four panels — and re-skinning becomes a four-place edit. This was the exact failure mode of v1 and v2.0 component libraries.

**Do this instead:** Extend `RetroPanel` with props (`tone="warning"`, `header={<>…</>}`, `dense`). If the new variant is genuinely incompatible, it joins `components/retro/` as a sibling (e.g., `RetroHazardPanel`) — not as a feature-folder one-off.

### Anti-Pattern 3: Putting page-state in URL search params for everything

**What people do:** `?sort=name&filter=archived&page=2&modal=add&tab=overdue&search=screwdriver…` — every UI toggle becomes a URL param "for shareability."

**Why it's wrong:** URL bloat, browser history pollution (back button steps through every filter change), and component re-renders on every URL update. URL state should reflect what's worth bookmarking.

**Do this instead:** Use URL params for **list filters** (sort, search, page, tab) — they're shareable. Use local component state for **transient UI** (modal open, expand/collapse, hover state). Use TanStack Query state for **server data**. Use `ShortcutsContext` for **register-by-id** ephemeral state.

### Anti-Pattern 4: Mounting the Bottombar per-page instead of in `AppShell`

**What people do:** Each route component renders its own `<Bottombar shortcuts={[…]} />`.

**Why it's wrong:** Duplication, inconsistency (one page forgets to include globals), and the bottombar needs to persist across route transitions to keep the SESSION clock continuous.

**Do this instead:** `Bottombar` mounts once in `AppShell`. Pages register shortcuts via `useShortcuts(id, [...])`. The Bottombar reads from `ShortcutsContext` and never accepts shortcuts as props.

### Anti-Pattern 5: SSE subscription leaks (no cleanup)

**What people do:** `useEffect(() => { sseProvider.on("item.updated", handler); }, [])` — no return value, no off-handler.

**Why it's wrong:** On every remount (including StrictMode's dev double-mount), subscribers stack up and the same event fires N times.

**Do this instead:** `useSSESubscription(handler)` (the existing helper) returns the cleanup automatically. Always use the hook, never call the provider's `on/off` API directly from components.

### Anti-Pattern 6: Fetching workspaceId from URL params

**What people do:** Read `useParams().workspaceId` in API client functions because "the URL has the path `/workspaces/{wsId}/...`."

**Why it's wrong:** API functions then can't be called from components above the route (e.g., `TopBar` showing the workspace name needs to fetch from the same workspaceId before any feature mounts). Also a refresh on `/items` would have no `wsId` in URL since the URL is `/items`, not `/workspaces/abc/items` (the URL prefix is on the API, not the frontend).

**Do this instead:** `useAuth().workspaceId` is the single source of truth; `RequireAuth` ensures it's set before any feature mounts. API functions take `workspaceId` as the first arg; consumers read it from `useAuth()`.

### Anti-Pattern 7: Lingui macros in v3.0

**What people do:** Adopt Lingui because the predecessor used it.

**Why it's wrong:** Lingui's macro system requires a Babel/SWC plugin. With Vite 8 moving to pure Rolldown for production, plugin compatibility is a moving target. The predecessor worked around this with `@lingui/swc-plugin` pinned to a specific version.

**Do this instead:** `react-intl` (FormatJS) — runtime API only, no build plugin, ~30 KB gzipped. Migration: locale catalogs port 1:1 (Lingui's `.po` files convert to FormatJS JSON via `lingui extract` + script).

### Anti-Pattern 8: Page-state Context per feature

**What people do:** `ItemsContext`, `LoansContext`, `BorrowersContext` — each feature gets its own provider for filter state.

**Why it's wrong:** Provider stack bloat, hard to navigate, and TanStack Query already manages most of what these contexts hold (filters end up duplicated between context state and query keys).

**Do this instead:** Filters live in URL params (`useSearchParams()`) + TanStack Query keys. Local component state (`useState`) for transient UI. No feature-level providers unless genuinely cross-route (none in this app).

### Anti-Pattern 9: Page-header "// LAST SYNC" reading from `Date.now()` on render

**What people do:** Page-header inlines a `setInterval` that updates "LAST SYNC" every second.

**Why it's wrong:** Every page-header tick re-renders the entire page tree below the header (because the header is at the top of the route subtree). Frame-rate degradation on the dashboard which already has its own animations.

**Do this instead:** Memoize `lastEventAt` from `useSSEStatus()` (which only updates on real SSE events, not every tick). The displayed format string can be re-derived in a `useMemo` keyed on `lastEventAt` rounded to the minute. The bottombar's SESSION clock IS allowed to tick every second because the bottombar is a sibling of `<Outlet />`, not a parent.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Backend REST API | `lib/api.ts` fetch wrapper with `credentials: "include"` (cookie JWT) and single-flight 401 refresh | All endpoints workspace-scoped under `/api/workspaces/{wsId}/*`. Auth + barcode-external are global. |
| Backend SSE | `lib/sse/SSEContext.tsx` → `EventSource("/api/sse?token=…")` | Token in URL because EventSource API can't set headers. Backend accepts both cookie + URL token on /sse. |
| Google OAuth | `GET /api/auth/oauth/google` redirect | Backend handles PKCE, code exchange, cookie set. Frontend just navigates. |
| GitHub OAuth | `GET /api/auth/oauth/github` redirect | Same shape as Google. |
| External barcode lookup | `GET /api/barcode/{code}` (proxied through backend) | Public, no auth. Length-gated `/^\d{8,14}$/`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `components/layout/` ↔ `components/retro/` | Direct import (one-way) | Layout depends on retro; retro must not depend on layout. |
| `features/*` ↔ `components/retro/` | Direct import | Features compose retro atoms. |
| `features/*` ↔ `components/layout/` | `useShortcuts` hook + `useSSESubscription` hook + `<Outlet />` slot | Features register their shortcuts, subscribe to SSE; never render layout pieces. |
| `features/*` ↔ `lib/api/` | Feature hooks call entity APIs directly | One feature owns its own queries; no cross-feature API calls (a feature reaches into another only by navigating to its route). |
| `features/*` ↔ `features/*` | URL params + navigate | E.g., scan → `/items/:id?from=scan`. Never direct cross-feature import. |
| Route → AppShell | React Router `<Outlet />` | AppShell renders `<Outlet />` in main grid area; route content slots in. |
| AppShell → Page | None | AppShell is route-agnostic. |
| Page → AppShell chrome | `useShortcuts(id, …)` (Bottombar), `usePageHeader({ route, title })` (PageHeader if exposed as a hook) | Page declares its chrome contributions; chrome reads them. |

## Build Order — Recommended

Confirmed and **adjusted** from the prompt's proposed order. Key change: **layout primitives BEFORE retro atoms** because the layout reveals atom constraints that the predecessor learned the hard way (RetroBadge needing dot-mode at 60px sidebar collapse, RetroPanel needing `// HEADER` slot, RetroButton needing key-chip variant).

**Phase 0 — Scaffold**
- Vite + React 19 + TypeScript + Tailwind v4 + React Router v7 (library mode) + ESLint + Vitest + Playwright.
- Reproduce the predecessor's `package.json` minus Lingui (replace with react-intl), minus `IndexedDB`/`Serwist`, plus `react-intl@^7`.
- CI grep guard for `idb|serwist|offline|sync` substring imports — ported verbatim from `scripts/check-forbidden-imports.mjs`.
- Empty App.tsx with provider skeleton.
- **Acceptance:** `bun run dev` shows a blank page; `bun run build` produces an empty bundle; CI grep guard runs green.

**Phase 1 — Tokens + Tailwind theme**
- `styles/tokens.css` with all CSS custom properties from sketch 005's `themes/default.css`.
- `tailwind.config.ts` with `@theme` directive mapping tokens to color utilities.
- `styles/globals.css` with body resets + monospace font + scanline overlay.
- A demo page (`/styleguide`) renders raw color swatches + spacing scale + type ramp for visual validation.
- **Acceptance:** Colors match sketch 005 in browser DevTools color picker; AAA contrast holds on amber labels.

**Phase 2 — Layout primitives (THE GRID + CHROME)**
- `AppShell` with the 2×3 grid + collapse attribute.
- `TopBar` with brand mark, brand text, workspace pill (static for now), placeholder ONLINE dot.
- `Sidebar` with hardcoded nav items + groups + user menu placeholder + collapse toggle.
- `Bottombar` with hardcoded shortcut chips (no provider yet) + SESSION/LOCAL clocks.
- `PageHeader` with hardcoded route + title + meta.
- A demo page renders a sample dashboard inside the shell to confirm grid behavior at all viewports.
- **Acceptance:** Visual diff against sketch 005 PNG within 5%; sidebar collapse animates smoothly; bottombar shortcuts render correctly.

**Phase 3 — Retro atoms (informed by layout constraints)**
- All 19+ atoms from the predecessor, **re-validated against sketch 005 visual language**.
- New atoms surfaced by layout work: `RetroStatusDot`, `RetroHUD` (semicircle gauge + sparkline + counts).
- A `/styleguide` page renders every atom in default + variant + edge states.
- **Acceptance:** Each atom has a Vitest render test + a `/styleguide` entry. No feature imports atoms outside the barrel.

**Phase 4 — Auth (login + OAuth + RequireAuth)**
- `lib/api.ts` with fetch + 401 single-flight refresh + HttpError.
- `AuthContext` + `RequireAuth` ported from predecessor.
- `LoginPage`, `RegisterPage`, `AuthCallbackPage`.
- Routes wired with `RequireAuth` wrapping the AppShell tree.
- The Bottombar's ESC shortcut now actually logs out.
- **Acceptance:** E2E spec — login → land on dashboard → logout → back to /auth. OAuth happy-path manually verified against backend.

**Phase 5 — SSE provider + ShortcutsProvider + ToastProvider + IntlProvider**
- `SSEContext` ported from `/frontend` with `useSSEStatus` selector added.
- `ShortcutsProvider` ported from `/frontend` verbatim.
- `IntlProvider` (react-intl) wrapping app, en-base catalog only.
- Topbar's ONLINE dot now reads `useSSEStatus().connected`.
- Bottombar reads from `ShortcutsContext`.
- **Acceptance:** Open app → ONLINE dot turns green within 2s. Close backend → dot turns amber. Restart → reconnect.

**Phase 6 — Items entity (CRUD + Photos)**
- `lib/api/items.ts` + `itemPhotos.ts` with `itemKeys` factory.
- `useItemsList`, `useItem`, `useItemMutations` hooks.
- `ItemsListPage` (RetroTable + RetroPagination + filters), `ItemDetailPage`, `ItemForm`.
- `useShortcuts("items", [...])` registered on each items page.
- SSE subscription invalidates item queries.
- Photo upload via `postMultipart`.
- **Acceptance:** Create / edit / archive item end-to-end. Photo upload works. SSE updates list when another tab edits.

**Phase 7 — Loans entity**
- `lib/api/loans.ts` + `borrowers.ts` (since loans need borrower picker).
- `LoansListPage` with tabs (Active / Overdue / History) — `RetroTabs`.
- `LoanForm` + `LoanReturnDialog`.
- Reads `?itemId=` URL param to preselect (forward-compat with scan flow).

**Phase 8 — Borrowers entity**
- `BorrowersListPage`, `BorrowerDetailPage` (with active + historical loan panels).

**Phase 9 — Taxonomy (categories + locations + containers)**
- Single `TaxonomyPage` with three sub-sections (matches v2.1 shape).
- Hierarchical tree rendering with archive/delete + usage warnings.

**Phase 10 — Scan**
- Port v2.2-archive plan: `lib/scanner/` modules, `components/scan/BarcodeScanner.tsx`, `features/scan/ScanPage.tsx`, action menu.
- Single-route flow at `/scan`.
- Lookup via `itemsApi.lookupByBarcode` (helper added in Phase 6).
- **Defer FAB to Phase 12** (or skip if v3.0 declares scope).

**Phase 11 — Quick Capture (if in scope)**
- `QuickCapturePage` with embedded `BarcodeScanner`, multi-photo strip, batch context.
- Photos stored locally in browser memory only (no IndexedDB — online-only).

**Phase 12 — Settings hub**
- `SettingsLandingPage` with iOS-style row links.
- 8 subpages: Profile, Security, Appearance, Language, Formats, Notifications, Connected Accounts, Data Storage.
- Format hooks (`useDateFormat`, etc.) ported from v1.6.

**Phase 13 — Dashboard (HUD row + activity table + alerts/approvals rail)**
- `DashboardPage` composition.
- HUD primitives: gauge (SVG semicircle), sparkline (SVG `<rect>`), counts.
- Activity table reads from a new `/api/workspaces/{ws}/activity` endpoint OR derives from existing audit-log endpoint (verify backend; if not present, defer dashboard to v3.1).
- **Note:** moved late in build order because dashboard depends on most other features (it shows item counts, recent loans, pending approvals from elsewhere).

**Phase 14 — i18n catalog gap-fill (et + ru)**
- Extract en messages via FormatJS CLI.
- Translate to et + ru catalogs.
- Locale switcher in Settings → Language.

**Phase 15 — Polish**
- Tab/keyboard navigation (every action keyboard-reachable).
- Loading bar on route transitions.
- Page transition animations (subtle).
- Final visual diff vs sketch 005 PNG.
- Accessibility pass: axe-core CI integration.

**Critical path:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 12 → 13. Phases 10, 11, 14, 15 parallelize after Phase 5.

**Why this order vs the prompt's:**
- Prompt: "scaffold → tokens → layout primitives → auth → entity CRUD → scan → quick capture → settings → polish."
- This research: same sequence except **explicit retro-atoms phase between layout and auth** (predecessor missed this and atoms got revised twice).
- Dashboard is **late** because it composes most features. Predecessor built it early and stubbed the data; that worked but resulted in a dashboard rebuild after each feature shipped.
- SSE/shortcuts/i18n are **bundled into one provider phase (5)** instead of trickling in per-feature. Otherwise each feature reinvents its own SSE subscription pattern.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — v3.0 scope, target features, predecessor decisions
- `.planning/research/v2.2-archive/ARCHITECTURE.md` — predecessor architecture (Vite + React Router v7 library mode, TanStack Query, AuthContext shape, lib/api/ pattern)
- `.planning/research/v2.2-archive/SUMMARY.md` — predecessor stack, integration points, anti-patterns (still applicable to v3.0 minus offline machinery)
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — locked design direction (dual-hue, monospace, scanlines, sketch 001 canonical)
- `.claude/skills/sketch-findings-home-warehouse-system/references/layout.md` — layout grid spec, sidebar grouping, bottombar function-key shape, anti-patterns
- `.claude/skills/sketch-findings-home-warehouse-system/sources/005-interactive-nav/index.html` — verbatim grid CSS, PAGES registry shape, GLOBAL_SHORTCUTS shape
- `frontend/components/dashboard/dashboard-shell.tsx` — provider stack ordering reference (OfflineProvider > SSEProvider > ShortcutsProvider > ConflictResolutionProvider)
- `frontend/components/layout/bottombar.tsx` — bottombar render + keyboard dispatcher + clock effect (port shape, drop next/* and ui/* deps)
- `frontend/components/layout/shortcuts-context.tsx` — register-by-id Context shape (port verbatim with type rename)
- `frontend/lib/contexts/sse-context.tsx` — SSE provider pattern (single EventSource, useSSESubscription, JWT in URL query param)
- `backend/internal/api/router.go` — confirmed Chi router with JWT middleware, workspace-scoped routes under `/api/workspaces/{wsId}/`, OAuth on `/api/auth/oauth/{provider}`

### Secondary (MEDIUM confidence)
- React Router v7 docs — modes overview, library vs framework mode tradeoffs (https://reactrouter.com/start/modes)
- LogRocket — "Choosing the right React Router v7 mode for your project" (https://blog.logrocket.com/react-router-v7-modes/)
- TanStack Query v5 — invalidation API, `enabled` gating
- FormatJS / react-intl docs — runtime IntlProvider API, `useIntl` hook
- Tailwind CSS v4 — `@theme` directive (CSS-first config)

### Tertiary (LOW confidence — flagged for validation during build)
- Tailwind v4 + Vite 8 + React 19 compatibility — pin specific versions and verify in Phase 0; check for known issues in `@theme` directive parsing
- react-intl bundle size estimate (~30 KB gzipped) — verify with `vite build --analyze` in Phase 5

---
*Architecture research for: v3.0 Premium-Terminal Frontend rebuild of `/frontend2`*
*Researched: 2026-04-30*

Sources used:
- [React Router — Picking a Mode](https://reactrouter.com/start/modes)
- [React Router v7 framework vs library mode discussion](https://github.com/remix-run/react-router/discussions/12423)
- [LogRocket — Choosing the right React Router v7 mode](https://blog.logrocket.com/react-router-v7-modes/)
