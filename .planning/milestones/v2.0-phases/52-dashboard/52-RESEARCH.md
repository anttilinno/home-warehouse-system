# Phase 52: Dashboard - Research

**Researched:** 2026-04-11
**Domain:** React dashboard page, AuthContext extension, SSE (EventSource), analytics API integration
**Confidence:** HIGH

## Summary

Phase 52 builds the real dashboard page inside the Phase 51 AppShell. The work has four distinct areas: (1) extending AuthContext with workspace resolution, (2) building the HUD stat panels, (3) building the SSE-driven activity feed, and (4) creating quick-action cards plus stub routes/sidebar updates.

All required backend endpoints are implemented and verified. The analytics API at `GET /workspaces/{id}/analytics/dashboard` returns `DashboardStats` with exactly the three fields needed (`total_items`, `total_categories`, `total_locations`). The activity API at `GET /workspaces/{id}/analytics/activity` returns `[]RecentActivity` with the `action`, `entity_type`, `entity_name`, and `created_at` fields matching the log-line format from D-06. The SSE endpoint at `GET /workspaces/{id}/sse` uses the native browser `EventSource` API — no library needed.

The route file at `frontend2/src/routes/index.tsx` is still using inline stub pages with the old `PageShell` pattern. Phase 51 was planned (AppShell, Sidebar, etc.) but the layout components do not yet exist in the filesystem — `frontend2/src/components/layout/` has no files. Phase 52 plans must assume Phase 51 is complete and the AppShell nested route structure is in place. The plans are ordered: Wave 1 handles AuthContext + workspace resolution (foundational), Wave 2 builds the dashboard page components, Wave 3 adds stubs and sidebar updates.

**Primary recommendation:** Implement in three waves ordered by dependency: workspace context → stat panels + activity feed → stub routes + sidebar. Each wave can be a separate plan since they have clear handoff points.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: After successful login, call `GET /workspaces` to resolve the user's default workspace. Store `workspaceId` in `AuthContext` alongside `user`. All workspace-scoped API calls read `workspaceId` from `useAuth()`. Update happens in `AuthContext.tsx`.
- D-02: If `GET /workspaces` returns an empty list, redirect to a stub `/setup` route. Actual workspace creation is a future phase. Guard lives in AuthContext or a post-login redirect check.
- D-03: Show exactly 3 HUD stat panels: **Items** (`total_items`), **Categories** (`total_categories`), **Locations** (`total_locations`). Do NOT show other fields.
- D-04: Each panel: large bold monospace number + small uppercase label below. No icons. Uses `RetroPanel` with HazardStripe header bar. Number uses `font-mono`.
- D-05: Stats fetched once on mount from `GET /workspaces/{id}/analytics/dashboard`. No auto-refresh for stats.
- D-06: Activity log line format: `[HH:MM] ACTION entity_type: entity_name`. Time is local 24-hour. Action is UPPERCASED. If `entity_name` is null: `[HH:MM] ACTION entity_type`. Feed uses `font-mono` in a dark terminal-style `RetroPanel`.
- D-07: Show last 10 entries from `GET /workspaces/{id}/analytics/activity`. Initial fetch on mount. Re-fetched (not updated incrementally) on any SSE event.
- D-08: SSE connection: open `EventSource` to `GET /workspaces/{id}/sse` on dashboard mount; close on unmount. On any SSE message, re-call activity API. Dashboard-scoped only — no global SSE.
- D-09: Three quick-access cards: "ADD ITEM" → `/items`, "SCAN BARCODE" → `/scan`, "VIEW LOANS" → `/loans`. Use `RetroCard` or `RetroPanel` with bold uppercase label and `RetroButton`. Fully clickable via React Router `<Link>` or `navigate()`.
- D-10: Create stub routes for `/items`, `/loans`, `/scan` — minimal placeholder pages with `RetroPanel` HazardStripe header and "COMING SOON" message. Stubs live in `features/items/`, `features/loans/`, `features/scan/`.
- D-11: Update Sidebar to add Items and Loans nav links. Ordering: Dashboard, Items, Loans, Settings.

### Claude's Discretion
- Exact layout of the dashboard page (grid vs flex, column widths, stat panel sizing)
- Loading skeleton style for stat panels (HazardStripe pattern or simple spinner)
- Whether activity feed shows "No activity yet" empty state or just an empty list
- SSE error handling (if EventSource fails, feed stays static — no error banner)
- i18n string keys for new UI strings (follow Lingui t macro pattern)
- Whether `/setup` stub is a full page or shows a retro error panel
- Whether Scan stub navigates to `/scan` or `/capture`

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | User sees a dashboard with retro HUD panels displaying total items, categories, and locations counts from the API | `GET /workspaces/{id}/analytics/dashboard` returns `DashboardStats` with `total_items`, `total_categories`, `total_locations` [VERIFIED: analytics/types.go]. `RetroPanel` + `font-mono` for the panel rendering [VERIFIED: RetroPanel.tsx]. |
| DASH-02 | A retro terminal-styled activity feed shows the most recent inventory actions (adds, edits, loans) | `GET /workspaces/{id}/analytics/activity` returns `[]RecentActivity` with `action`, `entity_type`, `entity_name`, `created_at` fields [VERIFIED: analytics/types.go, handler.go]. SSE at `GET /workspaces/{id}/sse` triggers re-fetch [VERIFIED: events/handler.go]. |
| DASH-03 | Quick-access cards for "Add Item", "Scan Barcode", and "View Loans" are visible and navigate to their respective routes | `RetroCard` + `RetroButton` components available [VERIFIED: components/retro/]. React Router `<Link>` or `navigate()` to `/items`, `/scan`, `/loans` [VERIFIED: react-router library mode]. |

</phase_requirements>

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router | 7.14.0 | Link, useNavigate, NavLink for stub route navigation | Already installed; library mode [VERIFIED: package.json] |
| tailwindcss | 4.2.2 | All styling via utility classes | Project convention [VERIFIED: package.json] |
| @lingui/react | 5.9.5 | t macro for all user-visible strings | Project convention [VERIFIED: package.json] |

### No New Dependencies Needed

EventSource is a native browser API — no library required. All retro components are built. The API client (`get<T>()`) handles auth transparently.

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure
```
src/
  features/
    dashboard/
      DashboardPage.tsx       # Main dashboard page component
      StatPanel.tsx           # Single HUD stat panel (number + label)
      ActivityFeed.tsx        # Terminal-style activity feed with SSE
      QuickActionCards.tsx    # Three quick-access cards grid
      useWorkspaceStats.ts    # Hook: fetch analytics/dashboard
      useActivityFeed.ts      # Hook: fetch + SSE-refresh activity
    items/
      ItemsPage.tsx           # COMING SOON stub
    loans/
      LoansPage.tsx           # COMING SOON stub
    scan/
      ScanPage.tsx            # COMING SOON stub
  features/auth/
    AuthContext.tsx           # Extend with workspaceId + workspace resolution
  components/layout/
    Sidebar.tsx               # Add Items + Loans NavLinks (Phase 51 output)
  routes/
    index.tsx                 # Add /items, /loans, /scan, /setup routes
```

### Pattern 1: AuthContext Workspace Extension

**What:** Add `workspaceId: string | null` to `AuthContextValue`. After `loadUser()` succeeds, call `GET /workspaces`, pick the first workspace's `id` as default. If empty list, set a `hasNoWorkspace: boolean` flag that consumers can check for redirect.

**When to use:** Every workspace-scoped API call reads `workspaceId` from `useAuth()`.

**Example:**
```tsx
// Source: AuthContext.tsx — extend existing shape
interface AuthContextValue {
  user: User | null;
  workspaceId: string | null;     // NEW
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Inside AuthProvider — add alongside user state
const [workspaceId, setWorkspaceId] = useState<string | null>(null);

const loadUser = useCallback(async () => {
  try {
    const me = await get<User>("/users/me");
    setUser(me);
    // Resolve workspace
    const wsRes = await get<{ items: Workspace[] }>("/workspaces");
    if (wsRes.items.length > 0) {
      setWorkspaceId(wsRes.items[0].id);
    } else {
      setWorkspaceId(null);  // Signals "no workspace" to consumers
    }
  } catch {
    setUser(null);
    setWorkspaceId(null);
    setRefreshToken(null);
  }
}, []);
```

**Important:** The `Workspace` type needs to be added to `frontend2/src/lib/types.ts` matching the backend `WorkspaceResponse` shape (`id`, `name`, `slug`, `description`, `is_personal`, `role`, `created_at`, `updated_at`). [VERIFIED: backend/internal/domain/auth/workspace/handler.go — WorkspaceResponse struct]

**Empty workspace guard (D-02):** The guard belongs in the dashboard route or a dedicated wrapper — not inside `AppShell` itself, since the setup page also needs to render within the shell. The simplest approach is a `RequireWorkspace` guard component or a `useEffect` in `DashboardPage` that calls `navigate("/setup")` if `workspaceId === null && !isLoading`.

### Pattern 2: Stat Panel Components

**What:** Reusable `StatPanel` component wrapping `RetroPanel` with HazardStripe header, large monospace number, uppercase label.

**Example:**
```tsx
// Source: D-03, D-04 decisions + RetroPanel API [VERIFIED: RetroPanel.tsx]
interface StatPanelProps {
  label: string;   // e.g., "ITEMS"
  value: number | null;  // null = loading state
  className?: string;
}

function StatPanel({ label, value, className }: StatPanelProps) {
  return (
    <RetroPanel showHazardStripe className={className}>
      <div className="text-center py-md">
        <div className="font-mono text-[48px] font-bold text-retro-ink leading-none">
          {value === null ? "—" : value}
        </div>
        <div className="font-mono text-[12px] font-bold uppercase text-retro-gray mt-xs tracking-widest">
          {label}
        </div>
      </div>
    </RetroPanel>
  );
}
```

Three panels in a row: `grid grid-cols-3 gap-md` on desktop, `grid-cols-1` on mobile (or `sm:grid-cols-3`).

### Pattern 3: Activity Feed with SSE

**What:** `ActivityFeed` component that fetches initial data then re-fetches on SSE events.

**Important: EventSource does not send cookies by default.** The backend SSE endpoint is behind JWT auth middleware. The existing `api.ts` `get()` function uses `credentials: "include"` (cookies). The access token is stored as an httpOnly cookie, so EventSource with `withCredentials: true` should work.

**Example:**
```tsx
// Source: D-06, D-07, D-08 + events/handler.go [VERIFIED: events/handler.go]
function useActivityFeed(workspaceId: string) {
  const [entries, setEntries] = useState<RecentActivity[]>([]);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await get<RecentActivity[]>(
        `/workspaces/${workspaceId}/analytics/activity?limit=10`
      );
      setEntries(data);
    } catch {
      // Silent fail per D-07 — feed stays as-is
    }
  }, [workspaceId]);

  // Initial fetch
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`/api/workspaces/${workspaceId}/sse`, {
      withCredentials: true,
    });
    es.onmessage = () => {
      fetchActivity();
    };
    es.onerror = () => {
      // Per D-08: silent fail, no error banner
    };
    return () => es.close();
  }, [workspaceId, fetchActivity]);

  return entries;
}
```

**Activity log line formatter:**
```tsx
// Source: D-06
function formatActivityLine(entry: RecentActivity): string {
  const time = new Date(entry.created_at).toLocaleTimeString("default", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const action = entry.action.toUpperCase();
  if (entry.entity_name) {
    return `[${time}] ${action} ${entry.entity_type}: ${entry.entity_name}`;
  }
  return `[${time}] ${action} ${entry.entity_type}`;
}
```

**Activity feed render:**
```tsx
<RetroPanel showHazardStripe title="ACTIVITY LOG" className="bg-retro-charcoal">
  <div className="font-mono text-[13px] leading-tight space-y-xs">
    {entries.length === 0 ? (
      <span className="text-retro-gray">{">"} NO ACTIVITY YET</span>
    ) : (
      entries.map((e) => (
        <div key={e.id} className="text-retro-cream">
          {formatActivityLine(e)}
        </div>
      ))
    )}
  </div>
</RetroPanel>
```

Note: `RetroPanel` has `bg-retro-cream` by default. For the dark terminal look, either pass a `className` that overrides the background, or accept that the panel will be cream-colored with monospace text. The `bg-retro-charcoal` would need to override the panel's default `bg-retro-cream` — check that Tailwind class order allows override, or add an optional `dark` variant to `RetroPanel`. [ASSUMED — RetroPanel className merging may not override bg-retro-cream if it is defined inline; may need a `variant` prop or explicit override]

### Pattern 4: Quick-Action Cards

**What:** Three `RetroCard` components in a grid, each with a label and a full-width `RetroButton` inside, wrapped in a React Router `<Link>`.

**Example:**
```tsx
// Source: D-09 + RetroCard.tsx, RetroButton.tsx [VERIFIED: components/retro/]
import { Link } from "react-router";

function QuickActionCard({ label, to }: { label: string; to: string }) {
  return (
    <Link to={to} className="block">
      <RetroCard className="flex flex-col items-center gap-md p-lg">
        <span className="font-bold uppercase text-[16px] text-retro-ink">{label}</span>
        <RetroButton variant="primary" className="w-full">
          {label}
        </RetroButton>
      </RetroCard>
    </Link>
  );
}

// Usage:
<div className="grid grid-cols-3 gap-md">
  <QuickActionCard label={t`ADD ITEM`} to="/items" />
  <QuickActionCard label={t`SCAN BARCODE`} to="/scan" />
  <QuickActionCard label={t`VIEW LOANS`} to="/loans" />
</div>
```

### Pattern 5: Stub Routes

**What:** Minimal placeholder pages for `/items`, `/loans`, `/scan`, `/setup` using `RetroPanel`.

**Example:**
```tsx
// Source: D-10 — features/items/ItemsPage.tsx
export function ItemsPage() {
  const { t } = useLingui();
  return (
    <RetroPanel showHazardStripe title={t`ITEMS`}>
      <p className="font-mono text-retro-ink">{">"} {t`PAGE UNDER CONSTRUCTION`}</p>
    </RetroPanel>
  );
}
```

The `/setup` stub (D-02) follows the same pattern — retro panel with a message about no workspace being found.

### Pattern 6: Sidebar NavLink Addition

**What:** Add Items and Loans `NavLink` entries to `Sidebar.tsx` following the exact same pattern as the existing Dashboard and Settings links.

**Sidebar ordering:** Dashboard → Items → Loans → Settings (D-11).

The existing NavLink pattern from Phase 51 research:
```tsx
// Source: 51-RESEARCH.md Pattern 2 — same active state pattern applies
<NavLink to="/items" className={({ isActive }) => `${navItemBase} ${isActive ? navItemActive : navItemDefault}`}>
  {t`ITEMS`}
</NavLink>
<NavLink to="/loans" className={({ isActive }) => `${navItemBase} ${isActive ? navItemActive : navItemDefault}`}>
  {t`LOANS`}
</NavLink>
```

### Pattern 7: Route Registration

**What:** Add `/items`, `/loans`, `/scan`, `/setup` as nested children of the AppShell layout route in `routes/index.tsx`.

**Example:**
```tsx
// Inside the authenticated layout Route (AppShell)
<Route index element={<DashboardPage />} />
<Route path="items" element={<ItemsPage />} />
<Route path="loans" element={<LoansPage />} />
<Route path="scan" element={<ScanPage />} />
<Route path="settings" element={<SettingsPage />} />

// Outside AppShell — setup has no workspace, may not want full shell
<Route path="setup" element={<RequireAuth><SetupPage /></RequireAuth>} />
```

Note: `/setup` could be inside or outside the AppShell. If outside, it avoids the workspace check guard. If inside, it inherits the top bar (useful for showing logout). Given D-02 says it's a stub, keeping it outside the shell simplifies the guard logic. [ASSUMED — placement left to discretion, consistent with D-02 wording]

### Anti-Patterns to Avoid

- **Global SSE connection:** D-08 explicitly scopes SSE to dashboard mount/unmount. Do not move EventSource to a context or global store.
- **Incremental activity updates:** D-07 says re-fetch the whole list, not splice new entries in. Keep it simple.
- **EventSource without `withCredentials: true`:** The backend uses httpOnly cookie auth — without credentials, the SSE connection will get a 401.
- **Calling `GET /workspaces` on every render:** Call it once during `loadUser()` flow, not inside the dashboard component. The workspaceId lives in AuthContext.
- **Putting workspaceId in localStorage:** It derives from the server on each session restore. Do not persist it separately.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE connection | Custom WebSocket or polling | Native `EventSource` API | Built into all modern browsers; handles reconnect automatically |
| Active nav link detection | pathname comparison | React Router `<NavLink>` isActive | Already used in Phase 51 Sidebar — same pattern |
| Time formatting | Custom date formatter | `Date.toLocaleTimeString()` with `hour12: false` | Native, handles locale; no library needed for simple HH:MM |
| JWT cookie attachment | Manual auth header on EventSource | `EventSource` with `withCredentials: true` | EventSource does not support headers; cookie-based auth is the right approach |

**Key insight:** The backend is already fully implemented. This phase is entirely frontend work consuming existing APIs.

## Common Pitfalls

### Pitfall 1: EventSource Not Sending Auth Cookie
**What goes wrong:** SSE connection gets a 401 response from the backend; feed never populates.
**Why it happens:** `new EventSource(url)` without options does not send cookies by default.
**How to avoid:** Always instantiate as `new EventSource(url, { withCredentials: true })`.
**Warning signs:** Browser DevTools shows a 401 on the `/api/workspaces/{id}/sse` request.

### Pitfall 2: EventSource URL Must Include `/api` Prefix
**What goes wrong:** EventSource connects to `/workspaces/{id}/sse` instead of `/api/workspaces/{id}/sse`, gets 404 or hits the frontend router.
**Why it happens:** The `api.ts` `get()` function prepends `/api` automatically. EventSource is a raw `new EventSource(url)` call — it does not go through `api.ts`.
**How to avoid:** Hardcode `/api/workspaces/${workspaceId}/sse` in the EventSource constructor (same BASE_URL pattern as `api.ts`).
**Warning signs:** EventSource fires `onerror` immediately; network tab shows 404 to the frontend router.

### Pitfall 3: RetroPanel Background Override
**What goes wrong:** Activity feed `RetroPanel` has `bg-retro-cream` baked into the component class string; passing `className="bg-retro-charcoal"` has no effect because Tailwind's generated class order may not override.
**Why it happens:** `RetroPanel` concatenates `bg-retro-cream ... ${className}` — Tailwind utility conflict resolution depends on class order in the generated stylesheet, not DOM order.
**How to avoid:** Either (a) add a `dark` boolean prop to `RetroPanel` that switches to charcoal background, or (b) use a plain `<div>` for the activity feed container and apply styling directly, or (c) use `!bg-retro-charcoal` (Tailwind important modifier). [VERIFIED: RetroPanel.tsx — bg-retro-cream is in the base className string]
**Warning signs:** Activity feed panel is cream-colored instead of dark charcoal.

### Pitfall 4: workspaceId Race Condition
**What goes wrong:** `DashboardPage` mounts before `AuthContext` finishes loading user + workspace, reads `workspaceId` as `null`, fires API calls to `/workspaces/null/...`, gets 404.
**Why it happens:** `isLoading` covers user loading but the workspace fetch is sequential (loadUser then GET /workspaces). If DashboardPage renders while `isLoading` is still true — or if `workspaceId` becomes available after a brief null state — API calls fire prematurely.
**How to avoid:** In `DashboardPage`, gate all API calls behind `workspaceId !== null`. Use `if (!workspaceId) return;` inside `useEffect` dependency-guarded fetches.
**Warning signs:** Network errors for `/api/workspaces/null/analytics/dashboard` in browser console.

### Pitfall 5: SSE Memory Leak on Navigation
**What goes wrong:** `EventSource` is not closed when user navigates away from dashboard; it continues firing `onmessage` events and calling `fetchActivity()` on an unmounted component.
**Why it happens:** Missing cleanup in `useEffect` return.
**How to avoid:** Always return `() => es.close()` from the SSE `useEffect`.
**Warning signs:** React "update on unmounted component" console warnings; excessive network requests after leaving dashboard.

### Pitfall 6: Huma wraps response body under `body` key
**What goes wrong:** `get<RecentActivity[]>(...)` returns the full Huma response object `{ body: [...] }` instead of the array directly; code crashes trying to map over an object.
**Why it happens:** The Huma framework wraps all response bodies under a `body` key in the JSON. Looking at analytics handler: `RecentActivityResponse { Body []RecentActivity }` — Huma serializes this as `{ "body": [...] }` (lowercase from Go JSON). [VERIFIED: analytics/handler.go — RecentActivityResponse struct has Body field; DashboardStatsResponse has Body DashboardStats]
**How to avoid:** Define frontend types that match the actual API response shape. For `GET /workspaces/{id}/analytics/dashboard`: response is `{ body: DashboardStats }`. For activity: response is `{ body: RecentActivity[] }`. Access via `.body` field.

Actually — need to verify Huma's actual serialization. Huma uses Go struct field names with JSON tags. `Body` field in Go structs uses `json:"body"` by default (lowercase). Verify by checking existing API test or Huma docs. [ASSUMED — needs verification against actual API response during implementation; existing auth API responses use different patterns]

## Code Examples

### WorkspaceId Gated API Call
```tsx
// Source: Pattern from existing useEffect in AuthContext.tsx [VERIFIED]
useEffect(() => {
  if (!workspaceId) return;
  let cancelled = false;

  get<{ body: DashboardStats }>(`/workspaces/${workspaceId}/analytics/dashboard`)
    .then((res) => {
      if (!cancelled) setStats(res.body);
    })
    .catch(() => {
      if (!cancelled) setStats(null);
    });

  return () => { cancelled = true; };
}, [workspaceId]);
```

### Lingui i18n Pattern (established)
```tsx
// Source: AuthContext.test.tsx pattern [VERIFIED]
import { useLingui } from "@lingui/react/macro";

function DashboardPage() {
  const { t } = useLingui();
  return <h1>{t`DASHBOARD`}</h1>;
}
```

### Types to Add to lib/types.ts
```typescript
// Source: backend/internal/domain/auth/workspace/handler.go [VERIFIED]
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_personal: boolean;
  role?: string;
  created_at: string;
  updated_at: string;
}

// Source: backend/internal/domain/analytics/types.go [VERIFIED]
export interface DashboardStats {
  total_items: number;
  total_inventory: number;
  total_locations: number;
  total_containers: number;
  active_loans: number;
  overdue_loans: number;
  low_stock_items: number;
  total_categories: number;
  total_borrowers: number;
}

export interface RecentActivity {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  created_at: string;
}
```

## Huma API Response Shape — Critical Clarification

The backend uses Huma v2. Huma wraps handler output structs directly. For `DashboardStatsResponse { Body DashboardStats }`, Huma serializes the struct fields at the top level of the JSON response body — NOT nested under a "body" key. The `Body` field in Huma output structs is the HTTP response body itself, not a JSON key named "body". [ASSUMED — requires verification against actual network response; Huma documentation shows `Body` is the response body container, meaning the JSON payload IS the DashboardStats directly]

**Safe approach:** The frontend type for the analytics dashboard response is likely just `DashboardStats` directly (not wrapped). Verify during Wave 2 implementation by inspecting the actual network response. Use `get<DashboardStats>("/workspaces/...")` and if it returns a wrapped object, adjust.

For the workspaces list: `WorkspaceListResponse { Items []WorkspaceResponse }` → the JSON is likely `{ "items": [...] }`. Confirmed by handler code: `ListWorkspacesOutput { Body WorkspaceListResponse }`. So `get<WorkspaceListResponse>("/workspaces")` returns `{ items: [...] }`. [VERIFIED: workspace/handler.go — WorkspaceListResponse has Items field with json tag items]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for live updates | SSE (EventSource) | Already implemented in backend | No polling needed; EventSource is the right tool here |
| React class ErrorBoundary | React Router errorElement | Phase 51 | Error boundary already handled at shell level |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Huma serializes DashboardStats directly (not nested under a "body" JSON key) | Code Examples, Huma API Response | Frontend types wrong; all analytics API calls would get undefined fields. Fix: wrap in `{ body: DashboardStats }`. Verify at Wave 2 start. |
| A2 | `/setup` stub route should live outside the AppShell layout route (no sidebar) | Pattern 7 | Aesthetic mismatch; if the design expects a full shell even on setup, route must move inside. Low risk given it's a stub. |
| A3 | RetroPanel `className` bg-retro-charcoal will conflict with hardcoded bg-retro-cream | Pitfall 3 | Activity feed panel won't have dark background; requires component modification or workaround. Check at Wave 2 implementation. |
| A4 | Phase 51 AppShell layout components (Sidebar.tsx, AppShell.tsx, TopBar.tsx) are complete before Phase 52 executes | All patterns | Phase 52 plans would fail at import stage; must run Phase 51 plans first. Not a research gap — it's an execution dependency. |

## Open Questions

1. **Huma response body shape**
   - What we know: Huma's `Body` field in output structs is the HTTP body container
   - What's unclear: Whether the JSON payload is flat (DashboardStats fields at root) or nested under a key
   - Recommendation: First task of Wave 2 should verify by checking actual API response with curl or browser DevTools. Design frontend types based on actual response, not assumed shape. If Huma is flat, use `get<DashboardStats>(...)`. If wrapped, use `get<{ body: DashboardStats }>(...)`.

2. **RetroPanel dark variant**
   - What we know: RetroPanel has `bg-retro-cream` hardcoded; activity feed needs dark terminal look
   - What's unclear: Whether className override works or needs a prop
   - Recommendation: Test className override first. If it fails, add `variant?: "default" | "dark"` prop to RetroPanel in the same task that builds the activity feed. The Phase 50 component library is still mutable.

3. **workspaceId: first workspace vs. personal workspace**
   - What we know: D-01 says "user's default workspace"; WorkspaceResponse has `is_personal: bool` and `role: string`
   - What's unclear: Should we pick the first in the list, or the one with `is_personal: true`?
   - Recommendation: Pick the workspace where `is_personal === true` as the default, falling back to `items[0]` if none are personal. Most users will have exactly one workspace. This is a Claude's discretion call — document the choice in the AuthContext code.

## Environment Availability

Step 2.6: SKIPPED — Phase 52 is frontend-only code changes consuming an existing running backend. No new external dependencies beyond what is already installed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `bun run test`) + Testing Library React |
| Config file | `frontend2/vitest.config.ts` |
| Quick run command | `cd frontend2 && bun run test` |
| Full suite command | `cd frontend2 && bun run test && bun run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01a | AuthContext exposes workspaceId after login | unit | `cd frontend2 && bun vitest run src/features/auth/__tests__/AuthContext.test.tsx` | YES (extend existing) |
| DASH-01b | DashboardPage renders 3 stat panels with API data | unit | `cd frontend2 && bun vitest run src/features/dashboard/__tests__/DashboardPage.test.tsx` | Wave 0 |
| DASH-01c | StatPanel renders correct number and label | unit | `cd frontend2 && bun vitest run src/features/dashboard/__tests__/StatPanel.test.tsx` | Wave 0 |
| DASH-02a | ActivityFeed renders formatted log lines | unit | `cd frontend2 && bun vitest run src/features/dashboard/__tests__/ActivityFeed.test.tsx` | Wave 0 |
| DASH-02b | SSE onmessage triggers activity re-fetch | unit | (same as ActivityFeed test — mock EventSource) | Wave 0 |
| DASH-03a | QuickActionCards render 3 cards with correct routes | unit | `cd frontend2 && bun vitest run src/features/dashboard/__tests__/QuickActionCards.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test`
- **Per wave merge:** `cd frontend2 && bun run test && bun run build`
- **Phase gate:** Full suite green + build green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/features/dashboard/__tests__/DashboardPage.test.tsx` — covers DASH-01b
- [ ] `src/features/dashboard/__tests__/StatPanel.test.tsx` — covers DASH-01c
- [ ] `src/features/dashboard/__tests__/ActivityFeed.test.tsx` — covers DASH-02a, DASH-02b
- [ ] `src/features/dashboard/__tests__/QuickActionCards.test.tsx` — covers DASH-03a

Note: Existing `AuthContext.test.tsx` must be extended to cover the new `workspaceId` behavior (DASH-01a). It already exists and tests the login flow — add workspace resolution assertions.

### EventSource Mocking in Tests
EventSource is not available in jsdom (Vitest's test environment). It must be mocked:
```typescript
// In test setup or individual test files
global.EventSource = vi.fn().mockImplementation(() => ({
  onmessage: null,
  onerror: null,
  close: vi.fn(),
}));
```
[ASSUMED — standard pattern for mocking EventSource in jsdom; verify it works with Vitest's vi.fn()]

## Security Domain

The dashboard consumes workspace-scoped analytics data. SSE connection uses cookie-based auth (`withCredentials: true`). No new auth vectors introduced. Input validation is not applicable (read-only data display). ASVS categories V5 (input validation) and V3 (session) are handled by the existing API client and backend middleware. No new security concerns introduced by this phase.

## Sources

### Primary (HIGH confidence)
- `backend/internal/domain/analytics/types.go` — DashboardStats, RecentActivity type definitions [VERIFIED]
- `backend/internal/domain/analytics/handler.go` — Route handlers: analytics/dashboard, analytics/activity [VERIFIED]
- `backend/internal/domain/events/handler.go` — SSE route: /workspaces/{id}/sse, SSE protocol details [VERIFIED]
- `backend/internal/domain/auth/workspace/handler.go` — GET /workspaces response shape: WorkspaceListResponse with Items, WorkspaceResponse struct [VERIFIED]
- `frontend2/src/features/auth/AuthContext.tsx` — Current AuthContext shape to extend [VERIFIED]
- `frontend2/src/lib/api.ts` — get() function signature, BASE_URL = "/api" [VERIFIED]
- `frontend2/src/lib/types.ts` — Current types to extend with Workspace, DashboardStats, RecentActivity [VERIFIED]
- `frontend2/src/components/retro/RetroPanel.tsx` — RetroPanel API: showHazardStripe, title, className, bg-retro-cream base [VERIFIED]
- `frontend2/src/components/retro/RetroCard.tsx` — RetroCard API [VERIFIED]
- `frontend2/src/components/retro/RetroButton.tsx` — RetroButton variants [VERIFIED]
- `frontend2/src/components/retro/index.ts` — All 10 retro components available [VERIFIED]
- `frontend2/src/routes/index.tsx` — Current route structure (stub pages, needs full replacement per Phase 51) [VERIFIED]
- `frontend2/src/styles/globals.css` — All design tokens: colors, spacing, fonts [VERIFIED]
- `.planning/phases/51-app-layout/51-RESEARCH.md` — NavLink pattern, AppShell structure, z-index scale [VERIFIED]

### Secondary (MEDIUM confidence)
- MDN EventSource documentation — withCredentials option for cookie auth [ASSUMED standard behavior]
- Huma v2 output struct behavior — Body field is HTTP response body container [ASSUMED — verify against actual API response]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new dependencies
- Architecture: HIGH — all backend endpoints verified, frontend patterns established by prior phases
- API shapes: HIGH for workspaces (WorkspaceListResponse verified), MEDIUM for analytics (Huma output shape assumed flat)
- Pitfalls: HIGH — EventSource auth and URL prefix are concrete, verified gotchas; RetroPanel override is a likely issue given component code
- SSE mocking in tests: MEDIUM — standard pattern but not verified against this project's Vitest setup

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable — all dependencies are already installed, backend is complete)
