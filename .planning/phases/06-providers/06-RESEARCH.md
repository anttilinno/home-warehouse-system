# Phase 6: Providers - Research

**Researched:** 2026-06-13
**Domain:** React 19 SSE provider + TanStack Query invalidation + provider composition (frontend2, retro-os)
**Confidence:** HIGH (backend SSE contract + Vite-proxy streaming verified end-to-end against the live stack)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- ONE EventSource app-wide; reconnect with capped exponential backoff (legacy `frontend/lib/contexts/sse-context.tsx` is the structure reference); close + reopen on wsId change; clean close on logout (`auth-expired` / unmount).
- Invalidation dispatcher: generic — `event.entity_type` → invalidate registered key prefixes (workspace-scoped). The contract doc is the SSOT; feature phases (7-10) append rows / register keys only.
- StatusDot: props-driven Phase 4 atom (`RetroStatusDot`) consumes `useSSEStatus` — NO SSE import inside the atom (preserves the Phase 4 test guarantee at `RetroStatusDot.test.tsx:68` which asserts the source contains no `useSSE|sseStatus|EventSource`).
- No new deps.

### Claude's Discretion
- Backoff parameters, `lastEventAt` tick granularity, contract-doc location/format, how `useSSE` consumers unsubscribe (cleanup contract).

### Phase Boundary (in scope)
1. **SSEProvider (PROV-02):** single EventSource per app to the workspace SSE endpoint (wsId from `useWorkspace`/D-12), auto-reconnect with backoff, `useSSEStatus()` → `{connected, lastEventAt}`, `useSSE({onEvent})` subscribe API. Re-opens on workspace switch.
2. **Event→query-invalidation contract DOC** + the generic dispatcher in SSEProvider.
3. **Chrome wiring:** TopBar ONLINE dot ← `useSSEStatus().connected`; TopBar `sse-slot` ← `RetroStatusDot` fed live state; PageHeader LAST SYNC ← `lastEventAt`.
4. **Provider stack order (PROV-01):** canonical mount order — resolved below against reality.
5. **PROV-03/PROV-04 reconciliation:** `ShortcutsProvider` ALREADY SHIPPED (Plan 03-01); `RetroToaster`/`retroToast` ALREADY SHIPPED (Plan 04-05). Phase 6 = MOUNT `RetroToaster` app-wide + verify `retroToast.promise` ergonomics + verify `ShortcutsProvider` position. Do NOT rebuild either.

### Deferred Ideas (OUT OF SCOPE)
- Notifications bell + unread badge (Phase 13, NOTIF-01..03).
- Per-entity invalidation registrations (Phases 7-10 register keys against the contract).
- HUD (Phase 13).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|------------------------------|------------------|
| PROV-01 | Provider stack mounts in an exact order (prose: `IntlProvider > QueryClientProvider > AuthProvider > SSEProvider > ToastProvider > ShortcutsProvider > BrowserRouter`). | **Stale prose — corrected below.** No `AuthProvider` exists (auth = cookie-JWT in `api.ts` + `RequireAuth`). `SSEProvider` needs wsId so it CANNOT sit above the router; it mounts inside the authed `WorkspaceProvider` (AppShell). Canonical order resolved in *Resolved Stale-Spec Questions* §1. |
| PROV-02 | SSEProvider opens a single EventSource (prose: "JWT in URL query param"), exposes `useSSEStatus()` → `{connected, lastEventAt}` and `useSSE({onEvent})`. | **Stale prose — corrected below.** Backend accepts the HttpOnly `access_token` **cookie** (verified). NO JWT-in-URL. EventSource URL = `/api/workspaces/{wsId}/sse` with `withCredentials: true`. Wire contract captured live. |
| PROV-03 | ShortcutsProvider ports from legacy `shortcuts-context.tsx`; register-by-id; unregister-on-unmount. | ALREADY SHIPPED (`src/components/shortcuts/ShortcutsContext.tsx`, Plan 03-01). Phase 6 = verify position in the canonical stack only. |
| PROV-04 | ToastProvider mounts sonner retro-skinned. | ALREADY SHIPPED as `RetroToaster` (sonner@2.0.7, Plan 04-05). Phase 6 = MOUNT it app-wide + verify `retroToast.promise`. |
</phase_requirements>

## Summary

Phase 6 is a **wiring + one-new-component** phase, not a from-scratch build. The single genuinely new artifact is `SSEProvider` — a React-19 provider holding one `EventSource` to the backend workspace SSE endpoint, exposing a coarse status selector and an event-subscribe API, plus a generic `entity_type → query-key-prefix` invalidation dispatcher. Everything else (ShortcutsProvider, RetroToaster/retroToast, RetroStatusDot, the TopBar/PageHeader slots) already exists and only needs mounting/binding.

Both CONTEXT stale-spec questions are now **VERIFIED against the running stack**, not assumed:
1. **Auth transport = cookie, NOT query-token.** The backend `JWTAuth` middleware reads the token from (1) `Authorization: Bearer`, (2) `access_token` cookie, (3) `?token=` query — in that priority. `curl -N` to `http://localhost:5173/api/workspaces/{wsId}/sse` carrying only the `access_token` cookie streamed `event: connected` and stayed open; the same request without the cookie returned **401**. Use the cookie. Never put the JWT in the URL.
2. **Vite proxy streams SSE correctly.** The existing `/api → :8080` proxy (`changeOrigin:true`, `rewrite: /^\/api/ → ''`) passed the live stream through unbuffered — a real `category.created` event triggered by a concurrent POST arrived on the open stream within ~1s. No proxy change needed (and the file is read-only per the brief).

**Primary recommendation:** Build `SSEProvider` modeled on the legacy `sse-context.tsx` structure (cookie auth, capped-exponential backoff, single connection, subscriber fan-out) but **split the context** so `useSSEStatus` consumers (chrome) never re-render on event traffic. Mount it inside `WorkspaceProvider` in `AppShell` (where wsId is available + auth is guaranteed). Drive invalidation off a static `entity_type → key-prefix[]` map documented in `frontend2/docs/sse-invalidation-contract.md`. Mount `RetroToaster` once at the `App.tsx` root (above the router so toasts survive route changes).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SSE connection lifecycle | Browser (React provider) | — | EventSource is a browser API; one connection owned by `SSEProvider` |
| SSE authentication | API / Backend | Browser (cookie attach) | Backend `JWTAuth` validates the `access_token` cookie the browser auto-sends same-origin |
| Event → cache invalidation | Browser (TanStack Query) | — | Server emits the event; the client maps `entity_type` → query keys and invalidates |
| Workspace scoping of the stream | API / Backend | Browser (wsId in URL) | Backend `Broadcaster` fans events only to clients registered under that `workspace_id` |
| Connection-status display | Browser (chrome) | — | TopBar dot / PageHeader LAST SYNC read a coarse status context |
| Reconnect/backoff | Browser | — | EventSource auto-reconnects, but we add capped-exponential backoff + auth-aware close |
| Stream transport through dev proxy | CDN/Proxy (Vite dev) | — | Vite's http-proxy passes `text/event-stream` through unbuffered (verified) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `EventSource` | Browser built-in | SSE client | No dep needed; `package.json` carries no SSE lib `[VERIFIED: grep package.json]`. Legacy used native `EventSource` too. |
| `@tanstack/react-query` | ^5.100.7 (installed) | Cache invalidation via `queryClient.invalidateQueries({ queryKey })` | Already the app's data layer; `queryClient` singleton in `src/lib/queryClient.ts` `[VERIFIED: package.json + queryClient.ts]` |
| `sonner` | 2.0.7 (pinned) | Toast engine behind `RetroToaster`/`retroToast` | Already shipped Plan 04-05; `.promise` ergonomics already forwarded in `retroToast.ts` `[VERIFIED: package.json + retroToast.ts]` |
| `react` / `react-dom` | ^19.2.5 | Provider + context-split + StrictMode | Already installed `[VERIFIED: package.json]` |

### Supporting (all already present — Phase 6 consumes, does not add)
| Item | Location | Purpose |
|------|----------|---------|
| `WorkspaceProvider` / `useWorkspace` | `src/features/workspace/` | wsId SSOT (D-12) — `currentWorkspaceId` drives the SSE URL + reopen-on-switch |
| `RetroStatusDot` | `src/components/retro/feedback/RetroStatusDot.tsx` | Props-driven `state: "live"\|"idle"\|"error"` dot for the TopBar `sse-slot` |
| `RetroToaster` / `retroToast` | `src/components/retro/feedback/RetroToast.tsx` + `retroToast.ts` | Toast region + `.promise`/`.error` surface |
| `ShortcutsProvider` | `src/components/shortcuts/ShortcutsContext.tsx` | Already mounted in `App.tsx` (Plan 03-01) |
| `auth-expired` window event | emitted by `src/lib/api.ts:73`; consumed by `RequireAuth.tsx` | SSEProvider should also listen → close stream on session loss |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `EventSource` | `@microsoft/fetch-event-source` | Adds a dep (violates "no new deps"); only needed if you must send custom headers — but cookie auth removes that need. **Rejected.** |
| Single merged context | Status context + subscribe context split | Merged context re-renders every `useSSEStatus` consumer (TopBar, PageHeader) on every event. Split is required (CONTEXT §specifics). **Use split.** |

**Installation:** None. No new packages (locked constraint; verified nothing missing).

## Package Legitimacy Audit

> Phase installs **zero** external packages (locked: "No new deps"; `grep package.json` confirms native EventSource, no SSE lib). slopcheck N/A.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No installs this phase |

**Packages removed due to slopcheck [SLOP]:** none.
**Packages flagged [SUS]:** none.

## Backend SSE Contract (VERIFIED against live stack 2026-06-13)

**Source:** `backend/internal/domain/events/handler.go`, `backend/internal/infra/events/broadcaster.go`, `backend/internal/api/router.go:446-456`, `backend/internal/api/middleware/auth.go`.

| Property | Value | Provenance |
|----------|-------|------------|
| Path (frontend) | `GET /api/workspaces/{workspace_id}/sse` | `[VERIFIED: live curl through :5173 proxy]` |
| Path (backend, post-rewrite) | `GET /workspaces/{workspace_id}/sse` | `[VERIFIED: router.go:446 + handler.go:28]` |
| Auth | `access_token` **cookie** (HttpOnly, SameSite=Lax). Middleware priority: Bearer header → cookie → `?token=` query | `[VERIFIED: auth.go:37-67 + live curl with/without cookie]` |
| No-auth response | `401` | `[VERIFIED: live curl without cookie → 401]` |
| Response headers | `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` | `[VERIFIED: handler.go:49-52]` |
| On open | `event: connected\ndata: {"client_id":"<uuid>"}\n\n` | `[VERIFIED: handler.go:66 + live]` |
| Domain event frame | `event: <type>\ndata: <full event JSON>\n\n` where `<type>` = e.g. `category.created` | `[VERIFIED: handler.go:94 + live category.created]` |
| Keepalive | `: keepalive\n\n` comment every 30s (ignored by EventSource) | `[VERIFIED: handler.go:97-100]` |
| Per-workspace scoping | `Broadcaster` fans events only to clients registered under that `workspace_id` | `[VERIFIED: broadcaster.go:82-108]` |
| Timeout exemption | Global 60s request timeout skips `/sse` (`TimeoutWithSkip(60s, "/sse")`) so the long-lived stream isn't killed | `[VERIFIED: router.go:107]` |

### Event JSON shape (the `data:` payload)
```jsonc
// Source: backend/internal/infra/events/events.go (struct) + live capture
{
  "type": "category.created",        // "<entity>.<action>"
  "entity_id": "019ebe36-...",        // omitempty
  "entity_type": "category",          // the invalidation key — see contract
  "workspace_id": "1021170e-...",
  "user_id": "94987c25-...",
  "timestamp": "2026-06-12T23:41:27.914Z",
  "data": { "id": "...", "name": "...", "user_name": "Test Seeder" }  // omitempty, entity-shaped
}
```

### Full enumerated `entity_type` values published by the backend (grep, non-test)
`attachment, borrower, category, company, container, favorite, inventory, item, item_photo, label, loan, location, maintenance, pendingchange, repairattachment, repairlog, repair_photo, wishlist`
`[VERIFIED: grep backend/internal/domain]`

> ⚠️ **Data-quality flag:** one publish site emits `EntityType: "ITEM"` (uppercase) — `grep` shows both `item` and `ITEM`. The dispatcher **must normalize `entity_type` to lowercase** before map lookup, or normalize at registration time. `[VERIFIED: grep — single uppercase outlier]`

### Full enumerated `type` values (event names on the SSE `event:` line)
`attachment.{created,updated,deleted}`, `borrower.{archived,created,deleted,restored,updated}`, `category.{created,updated,deleted}`, `company.{created,updated,deleted}`, `container.{created,updated,deleted}`, `inventory.{created,updated,deleted,marked_used}`, `item.{created,updated,deleted}`, `item_photo.{created,updated,deleted,reordered}`, `item_photos.{bulk_deleted,bulk_updated}`, `label.{created,updated,deleted}`, `loan.{created,updated,returned}`, `location.{created,updated,deleted}`, `maintenance.deleted`, `pendingchange.{created,approved,rejected}`, `repairattachment.{created,deleted}`, `repairlog.{created,started,completed,updated,deleted}`, `repair_photo.{created,updated,deleted}`, `wishlist.deleted`
`[VERIFIED: grep backend/internal/domain, non-test]`

## Resolved Stale-Spec Questions

### §1 — Provider order (PROV-01) — RESOLVED

**Reality today** `[VERIFIED: App.tsx + AppRoutes + AppShell]`:
```
App.tsx:   I18nProvider > BrowserRouter > QueryClientProvider
             > ShortcutsProvider > ModalStackProvider > AppRoutes
AppRoutes: /login, /register, /auth/callback  (PUBLIC)
           RequireAuth > AppShell (LAYOUT route)
AppShell:  WorkspaceProvider > [shell chrome + <Outlet/>]
```

Notes that contradict the literal PROV-01 prose:
- **No `AuthProvider` exists.** Auth = cookie-JWT in `api.ts` + the `RequireAuth` guard. Do NOT invent one.
- **`QueryClientProvider` is mounted UNDER `BrowserRouter`**, not above it (prose has Query before Router). This is the shipped Phase 3 structure and works (router itself does no data fetching).
- **`WorkspaceProvider` lives inside the authed `AppShell`**, below `RequireAuth`. SSE needs wsId → SSEProvider MUST be a descendant of `WorkspaceProvider`.

**Canonical order to record in the contract doc (final):**
```
I18nProvider (lingui)
└─ BrowserRouter
   └─ QueryClientProvider
      ├─ RetroToaster              ← NEW mount this phase (root-level, survives route changes)
      └─ ShortcutsProvider
         └─ ModalStackProvider
            └─ <Routes>
               ├─ /login /register /auth/callback   (public)
               └─ RequireAuth
                  └─ AppShell
                     └─ WorkspaceProvider
                        └─ SSEProvider   ← NEW this phase (needs wsId; authed-only)
                           └─ [shell chrome + <Outlet/>]
```

**Decisions for the planner:**
- `SSEProvider` mounts **inside `WorkspaceProvider`** in `AppShell.tsx` (wrap the existing `<div className="app-shell">` subtree, or wrap the children passed under `WorkspaceProvider`). This guarantees a valid wsId and an authenticated session.
- `RetroToaster` mounts **once at `App.tsx`**, as a sibling of the router subtree under `QueryClientProvider` (toasts must persist across navigation and be reachable from both public and authed pages). Placing it at the App root — NOT inside AppShell — is the correct call so a toast fired from `/login` (e.g. a failed login) still renders.
- `ShortcutsProvider` position is already correct (inside router, above the shell) — **verify only, do not move.**
- Preserve the existing relative order of `I18n > Router > Query > Shortcuts > ModalStack`. Phase 6 only **appends** `RetroToaster` (App root) + `SSEProvider` (AppShell). This matches the Plan 03-06 / 05-03 "append without reordering" contract.

### §2 — SSE auth transport (PROV-02) — RESOLVED

**Use the cookie. No JWT in the URL.** `[VERIFIED: auth.go + live curl]`

The legacy `frontend/lib/contexts/sse-context.tsx:111-118` already does exactly this:
```ts
const url = `${getApiBase()}/workspaces/${currentWorkspace.id}/sse`;
const eventSource = new EventSource(url, { withCredentials: true });
```
In frontend2 the equivalent is `new EventSource(`/api/workspaces/${wsId}/sse`, { withCredentials: true })` — same-origin via the proxy (`BASE_URL = "/api"`, `api.ts:20`). `withCredentials: true` is correct and harmless; it ensures cookies attach. The query-token path in `auth.go` remains as a backend fallback but the frontend MUST NOT use it (token in URL leaks via access logs / Referer — the legacy comment at `sse-context.tsx:111-114` says exactly this).

## Architecture Patterns

### System Architecture Diagram
```
                         ┌─────────────────────────────────────────┐
  domain handler          │ backend :8080                            │
  (POST /categories) ───► │  service → Broadcaster.Publish(wsId, ev) │
                          │     └─► per-workspace client channels     │
                          └───────────────┬──────────────────────────┘
                                          │ text/event-stream (cookie-auth)
                                          │ event: category.created
                          ┌───────────────▼─────────────────┐
   browser                │ Vite dev proxy :5173 (/api→root) │  (prod: same-origin)
                          └───────────────┬─────────────────┘
                                          │ unbuffered stream (verified)
        ┌─────────────────────────────────▼──────────────────────────────┐
        │ SSEProvider (one EventSource, under WorkspaceProvider)           │
        │  ┌─────────────┐   ┌──────────────────┐   ┌────────────────────┐ │
        │  │ named-event  │──►│ subscriber fan-out│  │ invalidation        │ │
        │  │ listeners    │   │ (useSSE consumers)│  │ dispatcher          │ │
        │  └──────┬───────┘   └──────────────────┘  │ entity_type→keys[]  │ │
        │         │                                  │ queryClient.invalid │ │
        │         ▼ (coarse, ≥1s)                    └─────────┬───────────┘ │
        │  ┌──────────────────┐                                │             │
        │  │ STATUS context   │  connected, lastEventAt        │             │
        │  │ (split — no event│◄───────────────────────────────┘             │
        │  │  re-renders)     │                                              │
        └──────────┬─────────────────────────────────────────────────────────┘
                   │ useSSEStatus()
        ┌──────────▼──────────┐   ┌──────────────────┐   ┌─────────────────┐
        │ TopBar ONLINE dot   │   │ TopBar sse-slot   │   │ PageHeader      │
        │ (online prop)       │   │ (RetroStatusDot)  │   │ LAST SYNC prop  │
        └─────────────────────┘   └──────────────────┘   └─────────────────┘
```

### Recommended file structure (additive)
```
frontend2/src/features/sse/            # NEW
├── SSEProvider.tsx                     # connection + status context + subscribe context + dispatcher wiring
├── useSSEStatus.ts                     # selector hook → { connected, lastEventAt }
├── useSSE.ts                           # subscribe hook → useSSE({ onEvent })
├── invalidationMap.ts                  # entity_type → query-key-prefix[] (the static contract, code form)
└── SSEProvider.test.tsx               # Vitest (EventSource stub + fake timers)
frontend2/docs/
└── sse-invalidation-contract.md        # NEW — SSOT doc (the human-readable contract)
```

### Pattern 1: Split context (status vs subscribe) — REQUIRED
**What:** Two separate React contexts (or one context whose *value* never changes for status while events flow through refs). `useSSEStatus` reads `{connected, lastEventAt}`; `useSSE` registers an `onEvent` callback into a `Set` held in a ref (no state update on event → no re-render of status consumers).
**Why:** TopBar + PageHeader call `useSSEStatus`. If status and event-fanout share one context value, every event re-renders the entire chrome. CONTEXT §specifics mandates this split.
**Pattern (legacy reference, `sse-context.tsx:51,58-66,69-74`):** subscribers in `useRef<Set<handler>>`; `broadcastEvent` iterates the set; `subscribe` adds/removes from the set and returns a cleanup. Status (`connected`) is the only `useState`. Add `lastEventAt` as a **coarsely-updated** state — only call `setLastEventAt` when ≥1s elapsed since the last update (Claude's discretion: 1s granularity) so a burst of events doesn't thrash the header.

### Pattern 2: Named-event listeners, NOT `onmessage`
**What:** The backend sends `event: <type>` (named SSE events), never `event: message`. The default `EventSource.onmessage` / `addEventListener("message")` handler **will never fire**.
**How:** Register one listener per known type, OR — cleaner — listen for the union of types from the invalidation map keys plus `connected`. The legacy code registers an explicit `eventTypes` array (`sse-context.tsx:149-201`) AND a dead `message` listener (lines 139-146) — **drop the dead `message` listener** in the port. Drive the listener list off the invalidation-map entity types so it stays in sync.
**Example:**
```ts
// Source: derived from backend handler.go:94 (event: %s) + legacy sse-context.tsx:192-201
es.addEventListener("connected", (e) => {/* client_id, mark open */});
for (const type of KNOWN_EVENT_TYPES) {       // e.g. "category.created", ...
  es.addEventListener(type, (e: MessageEvent) => {
    const event: SSEEvent = JSON.parse(e.data);
    setLastEventAtCoarse();
    dispatchInvalidation(event);               // entity_type → invalidateQueries
    broadcastToSubscribers(event);             // useSSE fan-out
  });
}
```
> Alternative: register listeners by **entity_type prefix is impossible** (EventSource matches exact event names). You must enumerate full `type` strings, or rely on the open `error`/`open` events plus a per-type loop. Enumerate from the contract.

### Pattern 3: Generic invalidation dispatcher driven by a static map
**What:** `entity_type` (lowercased) → array of TanStack query-key prefixes to invalidate, scoped by wsId.
```ts
// Source: invalidationMap.ts (the code form of the contract doc)
// Keys MUST be lowercase (backend emits one "ITEM" outlier — normalize).
export const INVALIDATION_MAP: Record<string, readonly (readonly unknown[])[]> = {
  category:  [["categories"]],
  location:  [["locations"]],
  container: [["containers"]],
  item:      [["items"]],
  inventory: [["inventory"]],
  loan:      [["loans"]],
  borrower:  [["borrowers"]],
  // Phases 7-10 APPEND rows here (and document in sse-invalidation-contract.md).
};

function dispatchInvalidation(ev: SSEEvent, wsId: string) {
  const prefixes = INVALIDATION_MAP[ev.entity_type.toLowerCase()];
  if (!prefixes) return; // unknown entity_type → no-op (forward-compatible)
  for (const prefix of prefixes) {
    queryClient.invalidateQueries({ queryKey: [...prefix, wsId] }); // workspace-scoped
  }
}
```
**Decision for planner — static map vs runtime registration:** **Recommend the STATIC map** (`invalidationMap.ts` + the doc). Rationale: (a) feature phases 7-10 only need to *append a row* — a static map is the simplest, most reviewable diff; (b) a runtime `registerInvalidation(entityType, keys)` API adds lifecycle/ordering complexity (when does a feature register? on mount? what if two features register the same type?) for no benefit here; (c) the CONTEXT locks "Contract doc is the SSOT; feature phases append rows" — a static map IS that contract in code. Keep the markdown doc as the human SSOT and the `.ts` map as its executable mirror; the doc lists the row, the planner of phases 7-10 adds both.

> **Query-key scoping note:** existing workspace-scoped hooks key as `[entity, wsId, ...]` (the `WorkspaceProvider` invalidate-all on switch + `useWorkspace` "include wsId in query key" contract — `WorkspaceProvider.tsx:74` and the 05-03 summary). Confirm the EXACT key shape each Phase 7-10 hook uses when those phases land; for Phase 6, document the convention `[entityPlural, wsId]` and invalidate by the `[entityPlural, wsId]` prefix. TanStack `invalidateQueries({ queryKey })` does **prefix matching** by default, so `["items", wsId]` invalidates `["items", wsId, {filters}]` too. `[VERIFIED: TanStack Query v5 default exact:false]`

### Pattern 4: React 19 StrictMode double-mount + single connection
**What:** `main.tsx` wraps `<App/>` in `<StrictMode>` `[VERIFIED: main.tsx]`. In dev, StrictMode mounts → unmounts → remounts effects, so a naive `useEffect(() => new EventSource(...))` opens TWO connections briefly.
**How:** The cleanup function MUST `es.close()` (legacy does this, `sse-context.tsx:269-280`). With proper cleanup, StrictMode's first mount opens+closes and the second mount opens the live one — correct single steady-state connection. Verify in a test that unmount closes. Do not guard StrictMode away; rely on cleanup.

### Pattern 5: Reconnect / backoff / auth-close
Port the legacy structure (`sse-context.tsx`):
- Capped exponential backoff: `min(base * 1.5^(attempt-1), 30_000)` (legacy `reconnectDelay=2000`, cap 30s, `maxReconnectAttempts=10`). Backoff params are Claude's discretion — these defaults are sane.
- Reset attempt counter on successful `open` and on wsId change.
- **Close + reopen on wsId change:** the connection effect depends on `currentWorkspaceId`; cleanup closes the old stream, the new render opens the new one.
- **Close on logout:** listen for the `auth-expired` window event (`api.ts:73`) → close the stream and stop reconnecting. (Legacy instead calls `authApi.getMe()` before each reconnect and `logout()` on failure — frontend2 already has the `auth-expired` event as the single session-loss signal, so prefer listening to it over an extra `getMe` probe.)
- Optional (legacy has it): reconnect on `visibilitychange`→visible and `online`. Nice-to-have; not required by the phase. Recommend including the `online`/visibility reconnect — cheap, improves UX, matches legacy.

### Anti-Patterns to Avoid
- **`onmessage`/`addEventListener("message")`** — dead code; backend never emits `event: message`. (Legacy carries this dead listener; drop it.)
- **JWT in the SSE URL** — leaks via logs/Referer; cookie works (verified).
- **Putting `lastEventAt` in the same context value as the subscribe API** — re-renders all chrome per event.
- **Mounting `SSEProvider` above the router / above `WorkspaceProvider`** — no wsId, no auth → 401 / null URL.
- **Mounting `RetroToaster` inside `AppShell`** — toasts then can't render on `/login`. Mount at App root.
- **Calling `setState` on every event** — thrash; coarsen `lastEventAt`, keep events in a ref-held subscriber set.
- **Forgetting `es.close()` in cleanup** — StrictMode + wsId-switch leak connections.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE reconnect | Custom WebSocket / polling loop | Native `EventSource` (auto-reconnects) + a thin backoff wrapper | EventSource already reconnects; you only add cap + auth-close |
| Toast engine | New toast component | `RetroToaster` + `retroToast` (sonner@2.0.7, shipped) | Already built + skinned + `.promise` forwarded (Plan 04-05) |
| Status dot visual | New indicator | `RetroStatusDot` (props-driven, shipped Plan 04-03) | Atom is dumb-by-design; feed it `state` |
| wsId source | Read localStorage directly | `useWorkspace().currentWorkspaceId` | D-12 SSOT; handles heal + switch invalidation |
| Cache invalidation | Manual refetch calls | `queryClient.invalidateQueries({ queryKey })` | Prefix-matching; respects staleTime/in-flight dedupe |

**Key insight:** This phase is ~80% mounting existing atoms and ~20% one new provider. The new code surface is small; the risk is in *composition* (where things mount) and the *event-name/auth details* — all of which are now verified.

## Runtime State Inventory

> Phase 6 is greenfield-additive (new provider + mounting existing components + a doc). No rename/refactor/migration. Inventory categories:
- **Stored data:** None — verified (no schema/key changes; `localStorage["workspace_id"]` is read via `useWorkspace`, not written by this phase).
- **Live service config:** None — verified (no backend change; SSE endpoint already exists and runs).
- **OS-registered state:** None.
- **Secrets/env vars:** None — verified (cookie auth uses the existing `access_token`; no new env).
- **Build artifacts:** None — no new deps, no package rename.

## Common Pitfalls

### Pitfall 1: jsdom has no `EventSource`
**What goes wrong:** Unit tests throw `EventSource is not defined`.
**Why:** Vitest runs in `jsdom` (`vitest.config.ts:16`); `jsdom`'s `window.EventSource` is `undefined` `[VERIFIED: node JSDOM probe → undefined]`.
**How to avoid:** Install a class stub on `global.EventSource` in the test (or in `src/test/setup.ts` for reuse). The stub must expose `addEventListener`, `close`, `readyState`, `withCredentials`, and a way for the test to push events (`instance.emit("category.created", data)`). Combine with `vi.useFakeTimers()` to drive backoff.
**Warning signs:** `ReferenceError: EventSource is not defined` in `SSEProvider.test.tsx`.

### Pitfall 2: Named events vs `onmessage` (already covered)
**What goes wrong:** Events arrive on the wire but no handler fires; ONLINE dot stays connected but nothing invalidates.
**Why:** Backend emits `event: category.created`, not `event: message`.
**How to avoid:** Register per-type listeners (Pattern 2). Test asserts a pushed `category.created` triggers invalidation.

### Pitfall 3: `entity_type` case mismatch (`ITEM`)
**What goes wrong:** An `item`-type event whose `entity_type` arrives as `"ITEM"` misses the map → no invalidation.
**Why:** One backend publish site emits uppercase `[VERIFIED: grep]`.
**How to avoid:** `ev.entity_type.toLowerCase()` before lookup. Add a test for the uppercase case.

### Pitfall 4: StrictMode double connection (already covered) — fix is `es.close()` in cleanup.

### Pitfall 5: Status context re-render storm
**What goes wrong:** TopBar/PageHeader re-render on every event → jank.
**Why:** Status + event fan-out share one context value.
**How to avoid:** Split context; keep subscribers in a ref; coarsen `lastEventAt`. Test: rapid events do not re-render a `useSSEStatus` consumer (spy on render count).

### Pitfall 6: RetroStatusDot coupling regression
**What goes wrong:** Importing `useSSE`/`useSSEStatus` *inside* `RetroStatusDot.tsx` breaks the Phase 4 guard test (`RetroStatusDot.test.tsx:68` asserts source has no `useSSE|sseStatus|EventSource`).
**Why:** The atom is contractually dumb.
**How to avoid:** The *TopBar* (or a small wrapper in the shell) calls `useSSEStatus` and passes `state` into `RetroStatusDot`. Never import SSE in the atom.

### Pitfall 7: Vite proxy SSE buffering (verified NOT an issue here)
**What could go wrong elsewhere:** `http-proxy` buffering or response compression stalls SSE flush.
**Why it's fine here:** Verified live — a real event arrived on the open stream within ~1s through the `:5173` proxy. The backend also sets `X-Accel-Buffering: no`. No proxy change needed (and the file is read-only per the brief). Just don't introduce response compression on the SSE route.

## Code Examples

### Forming the EventSource (frontend2)
```ts
// Source: api.ts:20 (BASE_URL="/api") + legacy sse-context.tsx:115-118 + verified live
const es = new EventSource(`/api/workspaces/${wsId}/sse`, { withCredentials: true });
```

### Coarse lastEventAt
```ts
// Claude's discretion: 1s granularity so event bursts don't thrash the header
const lastTickRef = useRef(0);
function markEvent() {
  const now = Date.now();
  if (now - lastTickRef.current >= 1000) {
    lastTickRef.current = now;
    setLastEventAt(new Date(now)); // only this triggers a status re-render
  }
}
```

### Chrome binding (TopBar)
```tsx
// TopBar already accepts `online?: boolean` (TopBar.tsx:21). Feed it + the sse-slot.
const { connected, lastEventAt } = useSSEStatus();
// <TopBar online={connected} ... />  → drives the ONLINE/OFFLINE dot (TopBar.tsx:86-96)
// sse-slot (TopBar.tsx:110-119): replace the static "● live" with
//   <RetroStatusDot state={connected ? "live" : "idle"} />
// PageHeader already accepts `lastSync?: string` (PageHeader.tsx:18) → pass formatted lastEventAt.
```

### Subscribe hook contract (useSSE)
```ts
// Source: legacy use-sse.ts:45-84 (port; callbacks in refs to avoid re-subscribe churn)
export function useSSE({ onEvent }: { onEvent: (e: SSEEvent) => void }) {
  const cb = useRef(onEvent); useEffect(() => { cb.current = onEvent; });
  useEffect(() => subscribe((e) => cb.current?.(e)), []); // subscribe returns cleanup
}
```

## State of the Art

| Old Approach (legacy frontend) | Current Approach (frontend2) | Why |
|--------------------------------|------------------------------|-----|
| `useAuth()` context for `currentWorkspace`/`isAuthenticated`/`logout` | `useWorkspace()` for wsId + `RequireAuth`/`auth-expired` for session | No AuthProvider in frontend2 (cookie-JWT + guard) |
| Pre-reconnect `authApi.getMe()` probe + `logout()` | Listen to the `auth-expired` window event (single session-loss signal) | frontend2 centralizes session loss in `api.ts` |
| Dead `addEventListener("message")` + explicit type array | Per-type listeners only, derived from the invalidation-map keys | Backend uses named events; drop dead code |
| `getApiBase()` | `BASE_URL = "/api"` (same-origin proxy) | Same-origin removes cross-origin token-in-URL need |

**Deprecated/outdated:** `frontend/` (legacy Next.js app) is a STRUCTURE reference only — do not import from it; frontend2 is a clean re-implementation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phases 7-10 entity hooks will key queries as `[entityPlural, wsId, ...]` | Pattern 3 scoping note | Low — invalidation prefix wouldn't match; resolved when those phases land + confirm key shape. Phase 6 documents the convention only. |
| A2 | Reconnecting on `visibilitychange`/`online` is desirable (legacy has it; phase doesn't require it) | Pattern 5 | Low — UX nicety; omit if planner prefers minimal surface. |

*(Backend contract, auth transport, proxy streaming, provider tree, jsdom EventSource absence, event names/entity_types, and component props are all VERIFIED — not assumed.)*

## Open Questions (RESOLVED)

<!-- RESOLVED 2026-06-13 (orchestrator): Phase 6 locks the [entityPlural, wsId] PREFIX convention in the invalidation contract doc; TanStack prefix matching tolerates trailing filter segments, so Phases 7-10 hooks MUST key as [entityPlural, wsId, ...rest] — recorded as a contract-doc rule, enforced by each feature phase's plan. -->

1. **Exact query-key shape for invalidation (forward-looking).**
   - What we know: `WorkspaceProvider` invalidates ALL queries on switch; `useWorkspace` contract says each entity hook includes wsId in its key.
   - What's unclear: the precise key tuple each Phase 7-10 hook will use (e.g. `["items", wsId]` vs `["items", wsId, filters]`).
   - Recommendation: Phase 6 documents the `[entityPlural, wsId]` prefix convention + provides the dispatcher; Phases 7-10 add their row AND confirm their hook keys match. TanStack prefix-matching tolerates trailing filter segments.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Backend SSE endpoint | SSEProvider stream | ✓ | live :8080 | — |
| Vite dev proxy SSE pass-through | dev streaming | ✓ | :5173, verified | prod is same-origin (no proxy) |
| Native `EventSource` (browser) | SSE client | ✓ | built-in | none needed |
| Seeder login | E2E + live verify | ✓ | seeder@test.local | — |
| `jsdom` `EventSource` | unit tests | ✗ | — | **Stub `global.EventSource` in tests (required)** |

**Missing with no fallback:** none blocking.
**Missing with fallback:** `jsdom` lacks `EventSource` → test stub (standard practice).

## Validation Architecture

> `workflow.nyquist_validation` not set to false → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom) + @testing-library/react + MSW; Playwright for E2E |
| Config file | `frontend2/vitest.config.ts` (unit), `frontend2/playwright.config.ts` (E2E) |
| Quick run command | `cd frontend2 && bun run test -- src/features/sse` (or `vitest run src/features/sse`) |
| Full suite command | `cd frontend2 && bun run test` (unit); `bun run test:e2e` (E2E, live stack) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-02 | Opens one EventSource to `/api/workspaces/{wsId}/sse` with `withCredentials`; closes on unmount | unit | `vitest run src/features/sse/SSEProvider.test.tsx` | ❌ Wave 0 |
| PROV-02 | `connected` true on `open`/`connected` event; `lastEventAt` updates coarsely | unit | same | ❌ Wave 0 |
| PROV-02 | wsId change closes old + opens new stream | unit (fake timers) | same | ❌ Wave 0 |
| PROV-02 | Reconnect with capped backoff on `error`; stops + closes on `auth-expired` | unit (fake timers) | same | ❌ Wave 0 |
| PROV-02 | `category.created` (and uppercase `ITEM`) → `invalidateQueries` with `[entity, wsId]` | unit | same | ❌ Wave 0 |
| PROV-02 | `useSSE({onEvent})` receives events; cleanup unsubscribes; status consumers DON'T re-render on events | unit | same | ❌ Wave 0 |
| PROV-01 | Canonical provider order mounts; `RetroToaster` at root, `SSEProvider` under `WorkspaceProvider` | unit | `vitest run src/components/layout/AppShell.test.tsx` (extend) | ⚠️ extend existing |
| PROV-04 | `RetroToaster` mounted app-wide; `retroToast.promise` resolves loading→success | unit | `vitest run` (new mount test) | ❌ Wave 0 |
| PROV-03 | `ShortcutsProvider` present in stack (position verified) | unit | existing shortcuts tests + App composition assert | ⚠️ verify |
| Chrome | TopBar ONLINE dot binds `connected`; `RetroStatusDot` in sse-slot; PageHeader LAST SYNC binds `lastEventAt` | unit | `vitest run src/components/layout/TopBar.test.tsx PageHeader.test.tsx` (extend) | ⚠️ extend |
| E2E | After login, ONLINE dot shows connected within timeout against live stack | e2e (manual-trigger) | `cd frontend2 && bun run test:e2e` | ❌ Wave 0 (new spec) |

### Sampling Rate
- **Per task commit:** `vitest run src/features/sse` (+ the touched layout test).
- **Per wave merge:** `cd frontend2 && bun run test` (full unit suite).
- **Phase gate:** Full unit suite green + the new SSE E2E spec green against the live stack, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/features/sse/SSEProvider.test.tsx` — covers PROV-02 (lifecycle, reconnect, invalidation, fan-out)
- [ ] `global.EventSource` stub — in `src/test/setup.ts` (shared) or inline in the SSE test
- [ ] `frontend2/e2e/sse-online.spec.ts` — ONLINE dot connected post-login (live stack)
- [ ] Extend `AppShell.test.tsx` / `TopBar.test.tsx` / `PageHeader.test.tsx` for the new bindings
- [ ] `retroToast.promise` + RetroToaster-mounted test

## Security Domain

> `security_enforcement` absent = enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | SSE authenticates via the existing HttpOnly `access_token` cookie (no new auth surface) |
| V3 Session Management | yes | Stream closes on `auth-expired`; cookie is HttpOnly + SameSite=Lax `[VERIFIED: login Set-Cookie]` |
| V4 Access Control | yes | Backend scopes the stream to the caller's `workspace_id` via `Broadcaster` + `Workspace` middleware (member check) — client cannot read another workspace's events |
| V5 Input Validation | yes | `JSON.parse` SSE `data` inside try/catch; unknown `entity_type` → no-op (no eval, no DOM injection from event data) |
| V6 Cryptography | no | No crypto in this phase (JWT validation is backend) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT leakage via URL (token in query) | Information Disclosure | Use the cookie; NEVER put the token in the SSE URL (verified cookie works) |
| Cross-workspace event leakage | Information Disclosure / Elevation | Backend per-workspace broadcaster + member middleware (already enforced) |
| Malformed event payload | Tampering / DoS | try/catch around `JSON.parse`; unknown entity_type is a no-op; don't render raw `data` as HTML |
| Reconnect storm on auth loss | DoS (self) | Stop reconnecting + close on `auth-expired`; capped backoff |

## Sources

### Primary (HIGH confidence — verified this session)
- `backend/internal/domain/events/handler.go`, `infra/events/broadcaster.go`, `infra/events/events.go` — SSE handler + event shape
- `backend/internal/api/router.go:107,446-456` — route mount + timeout skip
- `backend/internal/api/middleware/auth.go:37-67` — token-source priority (cookie works)
- **Live stack curl** (`:5173` proxy + `:8080`): login → cookie → SSE stream `event: connected` + live `category.created`; no-cookie → 401
- `frontend2/src/{App.tsx, main.tsx, routes/index.tsx, components/layout/{AppShell,TopBar,PageHeader}.tsx, features/workspace/*, components/retro/feedback/*, lib/{api,queryClient}.ts, vite.config.ts, vitest.config.ts}`
- `frontend/lib/contexts/sse-context.tsx` + `lib/hooks/use-sse.ts` — legacy structure reference
- jsdom `EventSource` probe → `undefined`
- TanStack Query v5 default invalidation is prefix-match (`exact:false`)

### Secondary (MEDIUM)
- `.planning/phases/{03-04,03-06,04-05,05-02,05-03}-SUMMARY.md` — shipped-state context

### Tertiary (LOW)
- (none — all load-bearing claims verified)

## Metadata

**Confidence breakdown:**
- Backend SSE contract / auth / proxy streaming: HIGH — verified end-to-end against the running stack.
- Provider order / mount points: HIGH — read from the actual shipped files.
- Invalidation map / key scoping: MEDIUM — dispatcher is solid; exact Phase 7-10 key tuples confirmed when those phases land (A1).
- Pitfalls / testing: HIGH — jsdom EventSource absence + named-event + case-outlier all verified.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable — backend SSE contract is long-lived; re-verify only if the events handler or router auth changes)
