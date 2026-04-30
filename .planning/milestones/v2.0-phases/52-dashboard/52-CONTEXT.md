# Phase 52: Dashboard - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the dashboard page at `/dashboard` inside the AppShell: three HUD-style stat panels (Items, Categories, Locations) pulling from the analytics API, a retro terminal activity feed with SSE-driven refresh, and three quick-access action cards (Add Item, Scan Barcode, View Loans) navigating to stub routes. Also: extend AuthContext with workspace ID resolution, create `/items`, `/loans`, `/scan` stub routes, and add Items + Loans to the sidebar navigation.

</domain>

<decisions>
## Implementation Decisions

### Workspace Context
- **D-01:** After successful login, call `GET /workspaces` to resolve the user's default workspace. Store the `workspaceId` in `AuthContext` alongside the `user` object. All workspace-scoped API calls (`/workspaces/{id}/...`) read `workspaceId` from `useAuth()`. The AuthContext update happens in `AuthContext.tsx` — extend the login flow there.
- **D-02:** If `GET /workspaces` returns an empty list (fresh account with no workspace), redirect to a stub `/setup` route — create a minimal placeholder page now. The actual workspace creation flow is a future phase. This guard lives in the AuthContext or a post-login redirect check.

### Stats Panels
- **D-03:** Show exactly 3 HUD stat panels: **Items** (`total_items`), **Categories** (`total_categories`), **Locations** (`total_locations`). These are the three fields specified in DASH-01. Do not show the other 6 fields from `DashboardStats` (active loans, overdue loans, containers, etc.) — those are future dashboard phases if needed.
- **D-04:** Each panel visual: large bold monospace number (e.g., `247`) with a small uppercase label below (e.g., `ITEMS`). No icons. Uses `RetroPanel` component with a HazardStripe header bar. Number uses `font-mono` (IBM Plex Mono / JetBrains Mono stack from Phase 48). Matches BAM data-display aesthetic.
- **D-05:** Stats are fetched once on mount from `GET /workspaces/{id}/analytics/dashboard`. No auto-refresh for stats (only the activity feed refreshes via SSE).

### Activity Feed
- **D-06:** Each activity entry is a monospace log line: `[HH:MM] ACTION entity_type: entity_name`. Example: `[14:32] CREATE item: Hammer`. Time is formatted as local time (HH:MM 24-hour). Action is UPPERCASED. If `entity_name` is null, show just `[HH:MM] ACTION entity_type`. Entire feed uses `font-mono` in a dark terminal-style `RetroPanel`.
- **D-07:** Show the last 10 entries from `GET /workspaces/{id}/analytics/activity`. Initial fetch on mount. The list is re-fetched (not updated incrementally) whenever an SSE event arrives from the workspace event stream.
- **D-08:** SSE connection: open `EventSource` to `GET /workspaces/{id}/sse` on dashboard component mount; close it on unmount. On any SSE message event, re-call the activity API and update the list. No persistent global SSE connection — dashboard-scoped only.

### Quick-Action Cards
- **D-09:** Three quick-access cards: "ADD ITEM" → `/items`, "SCAN BARCODE" → `/scan`, "VIEW LOANS" → `/loans`. Each card uses `RetroCard` or `RetroPanel` with a bold uppercase label and a `RetroButton`. Cards are fully clickable (React Router `<Link>` or `navigate()`).
- **D-10:** Create stub routes for `/items`, `/loans`, and `/scan` — minimal placeholder pages with a retro-styled "COMING SOON" panel (RetroPanel with HazardStripe header, "Page under construction" message). These stubs live in the respective feature directories per Phase 48 D-08: `features/items/`, `features/loans/`, `features/scan/` (or `features/barcode/`).
- **D-11:** Update the Sidebar component (from Phase 51) to add **Items** and **Loans** nav links alongside Dashboard and Settings. Sidebar ordering: Dashboard, Items, Loans, Settings. Scan/Barcode is accessible only via the dashboard card, not in the sidebar for now.

### Claude's Discretion
- Exact layout of the dashboard page (grid vs flex, column widths, stat panel sizing)
- Loading skeleton style for stat panels (can use HazardStripe pattern or simple spinner)
- Whether activity feed shows a "No activity yet" empty state or just an empty list
- SSE error handling (if EventSource fails, feed just stays static — no error banner needed)
- i18n string keys for new UI strings (follow Lingui t macro pattern)
- Whether `/setup` stub is a full page or just shows a retro error panel saying "No workspace found"
- Whether Scan stub navigates to `/scan` or `/capture` (pick whichever is consistent with future phases)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Design Reference (BAM aesthetic)
- `.planning/references/retro-ui/3.png` — BAM full app layout: card grid dashboard, cream panels, charcoal background — primary dashboard layout reference
- `.planning/references/retro-ui/2.png` — BAM UI components: button states, progress bars, badges — for quick-action cards

### Existing Retro Components (Phase 50)
- `frontend2/src/components/retro/index.ts` — Barrel export for all 10 retro components
- `frontend2/src/components/retro/RetroPanel.tsx` — Panel with optional HazardStripe header (use for stats and activity)
- `frontend2/src/components/retro/RetroCard.tsx` — Card component (use for quick-action cards)
- `frontend2/src/components/retro/RetroButton.tsx` — Button (neutral/primary/danger variants)
- `frontend2/src/components/retro/HazardStripe.tsx` — Hazard stripe divider

### Existing Layout & Auth (Phase 51 + 49)
- `frontend2/src/components/layout/AppShell.tsx` — App shell with Sidebar + TopBar + Outlet
- `frontend2/src/components/layout/Sidebar.tsx` — Sidebar nav (Phase 52 adds Items + Loans links here)
- `frontend2/src/features/auth/AuthContext.tsx` — AuthContext to extend with workspaceId (D-01)
- `frontend2/src/routes/index.tsx` — Route definitions to extend with /items, /loans, /scan, /setup

### API Client
- `frontend2/src/lib/api.ts` — Lightweight fetch wrapper with JWT + refresh token support
- `frontend2/src/lib/types.ts` — Existing types (extend with analytics types here)

### Backend Analytics Endpoints
- `backend/internal/domain/analytics/types.go` — DashboardStats, RecentActivity type definitions
- `backend/internal/domain/analytics/handler.go` — Route: `GET /workspaces/{id}/analytics/dashboard`, `GET /workspaces/{id}/analytics/activity`
- `backend/internal/domain/events/handler.go` — SSE route: `GET /workspaces/{id}/sse`

### Project Context
- `.planning/ROADMAP.md` — Phase 52 success criteria (DASH-01, DASH-02, DASH-03)
- `.planning/phases/48-project-scaffold/48-CONTEXT.md` — D-08 directory layout (features/dashboard/, features/items/, etc.)
- `.planning/phases/50-design-system/50-CONTEXT.md` — Component patterns (forwardRef, Tailwind-only, no CSS-in-JS)
- `.planning/phases/51-app-layout/51-CONTEXT.md` — D-04 sidebar nav decisions, D-11 route structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- All 10 retro components in `components/retro/` — panels, cards, buttons all ready to use
- `useAuth()` hook — provides `user`, `isAuthenticated`, `logout()`. Phase 52 extends it with `workspaceId`
- `frontend2/src/lib/api.ts` — `get<T>(endpoint)` function handles auth + refresh transparently
- `globals.css` tokens — `font-mono`, `bg-retro-charcoal`, `bg-retro-cream`, `text-retro-ink`, `shadow-retro-raised`, `bg-retro-amber`

### Established Patterns
- Tailwind CSS 4 utility classes only — no CSS-in-JS
- Feature-based directory: `features/dashboard/`, `features/items/`, `features/loans/`
- React Router v7 library mode — nested routes under AppShell
- Lingui v5 `t` macro for all user-visible strings
- `forwardRef` + `className` merge for composable components

### Integration Points
- `AuthContext.tsx` — add `workspaceId: string | null` to context shape and populate it post-login
- `routes/index.tsx` — add `/items`, `/loans`, `/scan`, `/setup` routes as children of AppShell route
- `Sidebar.tsx` — add Items and Loans `<NavLink>` entries (ordering: Dashboard, Items, Loans, Settings)
- Backend analytics API is workspace-scoped under `/api/workspaces/{id}/` — accessed via the existing `get()` wrapper

</code_context>

<specifics>
## Specific Ideas

- BAM reference image 3 shows a card-grid dashboard with chunky stat displays — the three HUD panels should sit in a row at the top, each as a `RetroPanel` with thick border and a large bold number
- The activity feed is explicitly "terminal-styled" in the requirements — dark `RetroPanel`, `font-mono`, tight line height, no bullet points or icons — pure text log lines
- Quick-action cards should feel like physical buttons to press — consider `RetroCard` with a bold uppercase label and a full-width `RetroButton` inside (or the card itself is the button)
- The `[HH:MM]` timestamp in activity entries should use the user's local time (not UTC), formatted in 24-hour style for the retro terminal aesthetic

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 52-dashboard*
*Context gathered: 2026-04-11 via /gsd-discuss-phase*
