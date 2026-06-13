# Phase 7b: Inventory - Research

**Researched:** 2026-06-13
**Domain:** Frontend2 (Vite + React 19 + TanStack Query v5) inventory-entry UI over an existing Go/huma backend
**Confidence:** HIGH (backend contracts read from source AND verified live against the running stack)

## Summary

Phase 7b wires the inventory-entry layer (item × location × container × quantity × condition × status × expiry × warranty) into frontend2. The backend is **fully built and stable** — all ~17 routes exist, were read from source, and verified live (seeder `seeder@test.local`, workspace `1021170e-…`). No backend work is required. This is a pure frontend-consumption phase mirroring the shipped Phase 7 items patterns (typed API module → URL-driven list query → RetroTable + FilterBar + RetroPagination, optimistic mutations with revert, RetroDialog through the modal stack, RetroSelect native pickers).

Three of the priority unknowns are now resolved with VERIFIED facts: (1) **virtualization is NOT warranted** — the live workspace holds **45 inventory entries** (= 45 items, 1:1), which fit on a single default page; ship `RetroPagination` and **DEFER** `@tanstack/react-virtual`. (2) **The items-list "—" cells stay deferred** — `ItemResponse` carries NO quantity/location/condition/derived-status fields and there is no list-level aggregate; only per-item endpoints exist (N+1 on a list), so INV-08 wires only the DETAIL panel. (3) **SSE: `inventory` is already a registered invalidation row and all three event names (`inventory.created/updated/deleted`) are already in `KNOWN_EVENT_TYPES`** — no contract-doc append is needed for inventory; **movements emit NO SSE events at all**, so the movements panel relies on manual invalidation after a move mutation.

Two semantic facts shape the UX: **Move is whole-entry relocation, NOT a quantity split** (`POST /inventory/{id}/move` takes only `location_id` + optional `container_id`), and a **movement record is created ONLY by a move action** (not on create/quantity-change/status-change), with `moved_by` always `null` (no user attribution wired backend-side yet).

**Primary recommendation:** Build a `lib/api/inventory.ts` + `lib/api/movements.ts` typed boundary mirroring `items.ts`/`loans.ts`, a URL-driven `useInventoryQuery` keyed `["inventory", wsId, params]`, an `InventoryListPage` cloned from `ItemsListPage`, a move/create RetroDialog through the modal stack, inline-edit mutations (optimistic, revert-on-error) hitting the dedicated `/quantity` and `/status` PATCH routes, an expiring route, a movements panel, and a real `InventoryPanel` replacing `InventoryPanelStub` at the existing ItemDetailPage side-rail slot. **Do not add a virtualization dependency.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Inventory list + filter/paginate | Frontend (React) | API (read) | Backend paginates server-side (`page`/`limit`); FE owns URL state + render |
| Create entry (item/loc/container pickers) | Frontend (RetroSelect) | API (POST + cross-tenant validation) | Backend validates item/location/container all belong to workspace |
| Move entry | API (whole-entry relocate + movement record) | Frontend (dialog) | Move logic + movement audit row are backend-owned; FE only POSTs target loc |
| Inline edit qty/status/condition | API (dedicated PATCH routes) | Frontend (optimistic) | Backend has separate `/quantity` + `/status` routes; condition rides full PATCH |
| Expiring report | API (`FindExpiring` SQL window) | Frontend (route) | Backend computes the days-window + warranty/expiration union server-side |
| Movements history | API (read, 3 scopes) | Frontend (panel) | Movement records are backend-created (move-triggered); FE is read-only |
| Per-item inventory panel | Frontend (detail) | API (`by-item`) | FE replaces the stub; data from `/inventory/by-item/{item_id}` |
| Real-time invalidation | Frontend (SSE dispatcher) | API (broadcaster) | `inventory.*` SSE already emitted + mapped; movements have NO SSE |

## Standard Stack

### Core (all already installed — NO new runtime deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.100.7 | Server-state, query keys, invalidation | Phase 6 SSE contract built on it `[VERIFIED: package.json]` |
| `react-hook-form` | ^7.74.0 | Create/edit form state | Phase 7 form pattern (`ItemFormPage`) `[VERIFIED: package.json]` |
| `zod` | ^4.4.1 | Form schema validation | Phase 7 `schema.ts` pattern `[VERIFIED: package.json]` |
| `react-router` | (Phase 48) | Routes + URL-param list state | `useSearchParams` SSOT pattern `[VERIFIED: ItemsListPage.tsx]` |
| `@lingui/react` | (Phase 48) | i18n `<Trans>`/`t` | Every shipped page uses it `[VERIFIED: source]` |

### Supporting (shipped retro atoms — reuse verbatim)
| Component | Path | Purpose |
|-----------|------|---------|
| `RetroTable` | `components/retro/RetroTable.tsx` | List table `[VERIFIED]` |
| `FilterBar` / `FilterPopover` / `BulkActionBar` / `SavedFilters` | `components/retro/filters/` | Filter chrome `[VERIFIED]` |
| `RetroPagination` | `components/retro/data/RetroPagination.tsx` | Pager — **use this instead of virtualization** `[VERIFIED]` |
| `useTableSelection` | `components/retro/data/useTableSelection.ts` | Row multi-select `[VERIFIED]` |
| `RetroTabs` | `components/retro/data/RetroTabs.tsx` | Movements-panel tabs (if tabbed) `[VERIFIED]` |
| `RetroSelect` | `components/retro/form/RetroSelect.tsx` | **Native skinned `<select>`** for item/location/container pickers `[VERIFIED]` |
| `RetroFormField` / `RetroInput` / `RetroTextarea` | `components/retro/form/` | Create/edit form fields (date inputs, qty, notes) `[VERIFIED]` |
| `RetroDialog` | `components/retro/overlay/RetroDialog.tsx` | Move dialog + create dialog (uses `useModalStack`) `[VERIFIED]` |
| `RetroConfirmDialog` | `components/retro/overlay/` | Archive/delete confirm `[VERIFIED]` |
| `StatusPill` / `RetroBadge` | `components/retro/feedback/` + root | status/condition rendering `[VERIFIED]` |
| `RetroEmptyState` | `components/retro/feedback/` | Empty list/expiring/movements `[VERIFIED]` |
| `retroToast` | `components/retro/feedback/retroToast.ts` | Mutation error toasts `[VERIFIED]` |
| `useModalStack` | `components/modal/useModalStack.ts` | ESC/stack discipline for dialogs `[VERIFIED]` |
| `useShortcuts` | `components/shortcuts` | Route key bindings (N=new, /=search) `[VERIFIED]` |

### API helpers (already in `src/lib/api.ts` — reuse, do NOT re-add)
`get` / `post` / `patch` / `put` / `del` / `postMultipart` / `downloadBlob`, all carrying `credentials: "include"` + 401 single-flight refresh. `toProxyUrl` in `lib/api/url.ts` (NOT needed for inventory — no absolute URLs in inventory/movement responses). `[VERIFIED: src/lib/api.ts, src/lib/api/url.ts]`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `RetroPagination` | `@tanstack/react-virtual` | Virtualization only pays off at thousands of rows; 45 entries make it pure overhead + a new dep. **Rejected for this phase.** |
| `RetroSelect` (native) | `RetroCombobox` (type-ahead) | Combobox is the Phase 10 type-ahead picker; CONTEXT locks simple selects now. |
| Full `PATCH /inventory/{id}` for inline qty/status | Dedicated `/quantity` + `/status` routes | Dedicated routes are narrower (less clobber risk) and SSE-publish the changed field; prefer them for inline edits. |

**Installation:** None. No `npm install` for this phase.

## Package Legitimacy Audit

> The phase adds **zero** runtime dependencies. The only candidate considered and **rejected** is documented for the record.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tanstack/react-virtual` | npm | v3.14.2, modified 2026-06-02 | high (TanStack org) | github.com/TanStack/virtual | unavailable | **NOT ADOPTED — deferred** |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

> slopcheck was **not available** at research time. `@tanstack/react-virtual` is tagged `[ASSUMED]` per the package-name provenance rule (discovered via training/CONTEXT, registry-existence alone does not confer VERIFIED). It is **not being installed** this phase, so no checkpoint gate is required. If a future phase adopts it once entry counts grow, that phase must run the legitimacy gate (slopcheck + Context7/official-docs confirmation) before install.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
   User actions     │              frontend2 (browser)            │
   (list/create/    │                                             │
    move/edit/      │  Route /inventory ─► InventoryListPage      │
    expiring)       │     │                  ├─ FilterBar          │
                    │     │                  ├─ RetroTable rows    │
                    │     ▼                  └─ RetroPagination    │
                    │  useInventoryQuery  ["inventory",wsId,params]│
                    │     │                                        │
                    │     │  create/move/edit ─► RetroDialog       │
                    │     │       │             (modal stack)      │
                    │     ▼       ▼                                │
                    │  inventory.ts / movements.ts  (typed API)    │
                    │     │  get/post/patch  credentials:include   │
                    └─────┼───────────────────────────────────────┘
                          │  /api/* ──(Vite proxy REWRITE strips /api)──►
                          ▼
        ┌───────────────────────────────────────────────────────────┐
        │  Go backend (huma) under /workspaces/{wsId}                 │
        │                                                             │
        │  GET  /inventory?page&limit         (paginated envelope)    │
        │  GET  /inventory/by-item/{item_id}  (flat items[], no page) │
        │  GET  /inventory/expiring?days      (kind+date projection)  │
        │  POST /inventory                    ─► broadcaster ─┐       │
        │  PATCH /inventory/{id}/quantity     ─► broadcaster ─┤       │
        │  PATCH /inventory/{id}/status       ─► broadcaster ─┤       │
        │  POST /inventory/{id}/move ──┐      ─► broadcaster ─┤       │
        │                              │  creates movement     │      │
        │                              ▼  record (no SSE)      ▼      │
        │  GET /movements (3 scopes)   InventoryMovement   inventory.*│
        │     (read-only, no SSE)          row              SSE event │
        └──────────────────────────────────┼──────────────────┼──────┘
                                            │                  │
                          (movements: NO SSE; manual           ▼
                           invalidate after move)     SSE ─► dispatcher ─►
                                              invalidateQueries(["inventory",wsId])
```

### Recommended Project Structure (mirrors `features/items/`)
```
src/lib/api/
├── inventory.ts          # inventoryApi: list, byItem, expiring, create, update,
│                         #   updateQuantity, updateStatus, move, archive, restore
└── movements.ts          # movementsApi: listWorkspace, byInventory, byLocation
src/lib/types.ts          # ADD: Inventory, InventoryListResponse, Movement,
│                         #   ExpiringEntry, Condition/Status union types
src/features/inventory/
├── InventoryListPage.tsx       # clone of ItemsListPage
├── ExpiringPage.tsx            # /inventory/expiring
├── schema.ts                   # zod create/edit schema
├── hooks/
│   ├── useInventoryQuery.ts    # ["inventory", wsId, params] URL-driven
│   ├── useInventoryMutations.ts# create/move/qty/status/archive (optimistic)
│   └── useMovementsQuery.ts    # ["movements", wsId, scope]
└── components/
    ├── InventoryFormDialog.tsx # create/edit via RetroDialog + RetroSelect pickers
    ├── MoveDialog.tsx          # whole-entry relocate
    ├── InlineEditCell.tsx      # qty/status/condition inline
    └── MovementsPanel.tsx      # read-only history
src/features/items/components/
└── InventoryPanel.tsx          # REPLACES InventoryPanelStub at the side-rail slot
```

### Pattern 1: URL-driven list query (mirror `useItemsQuery`)
**What:** All list state (page, filters) lives in `useSearchParams`; the query keys `["inventory", wsId, params]` so Phase 6 prefix-invalidation hits without `exact:true`.
**When:** The `InventoryListPage`.
```ts
// Mirror: src/features/items/hooks/useItemsQuery.ts (VERIFIED pattern)
const query = useQuery({
  queryKey: ["inventory", wsId, params],   // Phase 6 contract prefix
  queryFn: () => inventoryApi.list(wsId, params),
  enabled: !!wsId,
  retry: false,
});
```
Note: the backend `GET /inventory` accepts **only** `page` + `limit` (no server-side item/location/status filter). Any list facet beyond pagination must filter **client-side** on the current page, OR use the scoped read endpoints (`by-item`/`by-location`/`by-container`) as filter shortcuts. `[VERIFIED: inventory/handler.go ListInventoryInput]`

### Pattern 2: Optimistic inline edit with revert (mirror photo-reorder)
**What:** Inline qty/status edits apply optimistically, revert on error. Use the **dedicated** routes (`/quantity`, `/status`) which only touch one field and SSE-publish it.
```ts
// Mirror: src/features/items/hooks/usePhotoMutations.ts reorder (VERIFIED)
const updateQuantity = useMutation({
  mutationFn: ({ id, quantity }) => inventoryApi.updateQuantity(wsId, id, quantity),
  onMutate: async ({ id, quantity }) => { /* snapshot + optimistic patch */ },
  onError: (_e, _v, ctx) => { /* restore ctx.previous */ retroToast.error(...); },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["inventory", wsId] }),
});
```
**Condition** has no dedicated route — it rides the full `PATCH /inventory/{id}` (which requires `location_id`, `quantity`, `condition` as a bundle). For inline condition edit, send the row's current `location_id`+`quantity` alongside the new `condition`. `[VERIFIED: inventory/handler.go UpdateInventoryInput]`

### Pattern 3: Native-select pickers (no type-ahead)
**What:** `RetroSelect` wraps a native `<select>`; populate `<option>`s from the list endpoints. RHF-compatible via `ComponentPropsWithRef<"select">`.
```tsx
// Pickers populated from /locations, /containers, /items (all paginated, limit≤100)
<RetroSelect label={<Trans>Location</Trans>} {...register("location_id")}>
  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
</RetroSelect>
```
With 45 items / a handful of locations, a single `limit=100` fetch per picker is sufficient (no pagination loop). `[VERIFIED: RetroSelect.tsx; location/container/item list inputs]`

### Pattern 4: Dialogs through the modal stack
`RetroDialog` calls `useModalStack(open, onClose)` internally — ESC handling is automatic. Render `<MoveDialog open={…} onClose={…}>` / `<InventoryFormDialog>` as siblings (mirror `PhotoUpload` usage in ItemDetailPage). `[VERIFIED: RetroDialog.tsx, PhotoUpload.tsx]`

### Anti-Patterns to Avoid
- **Do NOT add `@tanstack/react-virtual`** — 45 rows; pagination is shipped. Adding it is a speculative dep (CONTEXT explicitly forbids speculative adoption).
- **Do NOT append an `inventory` row to the SSE contract doc** — it is already registered (bootstrap row, Phase 6). Re-adding it would create a duplicate map key.
- **Do NOT expect `movement.*` SSE events** — there are none. After a move, manually `invalidateQueries(["movements", wsId])` (and `["inventory", wsId]`).
- **Do NOT model "move" as a quantity split** — the backend `/move` route relocates the whole entry; there is no partial-move API.
- **Do NOT try to enrich the items-list "—" cells** — `ItemResponse` has no qty/location; the only aggregate is per-item `total-quantity` (N+1). Leave deferred per CONTEXT.
- **Do NOT hand-roll fetch** — go through `lib/api.ts` helpers (cookie-JWT + refresh).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth/refresh on requests | A new fetch wrapper | `lib/api.ts` `get/post/patch/del` | Cookie-JWT + 401 single-flight already correct |
| Cache invalidation on writes | Manual refetch lists | TanStack `invalidateQueries(["inventory",wsId])` prefix | Phase 6 prefix contract; SSE already wired |
| ESC/modal layering | Custom keydown listeners | `RetroDialog` (`useModalStack`) | Capture-phase stack discipline shipped |
| Row selection | Custom `Set` state | `useTableSelection` | Shift/meta semantics shipped + tested |
| Pagination control | Custom pager | `RetroPagination` | Shipped + styled |
| Filter chrome | Custom bar | `FilterBar`/`FilterPopover`/`SavedFilters` | Shipped; matches sketch-008 |
| Date/qty form fields | Raw inputs | `RetroFormField`+RHF+zod | Phase 7 `ItemFormPage` pattern |

**Key insight:** This phase is ~90% composition of shipped Phase 4 atoms + Phase 7 patterns. Net-new logic is narrow: the inventory/movement typed API modules, the move/inline-edit semantics, and the expiring projection rendering.

## Common Pitfalls

### Pitfall 1: Treating `by-item`/`by-location`/`by-container` like the paginated list
**What goes wrong:** Reading `.total`/`.total_pages` off these responses → `undefined`.
**Why:** The scoped endpoints return a **bare `{ items: [...] }`** with NO `total`/`page`/`total_pages` (verified — `InventoryListResponse` is reused but only `Items` is populated). The movements endpoints likewise return only `{ items: [...] }`.
**How to avoid:** Type these as `{ items: T[] }` and never read pagination off them. Only `GET /inventory` (the top-level list) carries the full envelope. `[VERIFIED: handler.go lines 80, 94, 108, 122; movement/handler.go MovementListResponse]`

### Pitfall 2: Sending a quantity-split on Move
**What goes wrong:** Building a move dialog with a "quantity to move" field; backend ignores it.
**Why:** `MoveInventoryInput.Body` is `{ location_id, container_id? }` only. Move relocates the entire entry. `[VERIFIED: handler.go MoveInventoryInput]`
**How to avoid:** Move dialog = target location (+ optional container) picker only. To split stock, the user creates a second entry and decrements the first via the quantity route (document this as the intended workflow, not a single API call).

### Pitfall 3: Expecting movement rows to appear without a move
**What goes wrong:** Movements panel renders empty and looks broken; live workspace returns **0 movements**.
**Why:** A movement record is created ONLY by `POST /inventory/{id}/move` (verified: `service.Move` → `movementSvc.RecordMovement`). Create, quantity-change, and status-change do NOT create movements. `moved_by` is always `null` (audit-trail user attribution not wired). `[VERIFIED: live curl returned 0; service.go Move]`
**How to avoid:** Empty-state the movements panel ("No movements yet — moving an entry between locations records history here"). The E2E must perform a move before asserting a movement appears.

### Pitfall 4: Date fields are `time.Time` (RFC3339), expiring `date` is `YYYY-MM-DD`
**What goes wrong:** Mixing the two date encodings.
**Why:** `InventoryResponse.expiration_date`/`warranty_expires`/`date_acquired` are full RFC3339 timestamps (omitted when nil). The **expiring** projection returns `date` as a plain `"2006-01-02"` string + a `kind: "expiration" | "warranty"` discriminator. `[VERIFIED: handler.go ExpiringInventoryResponse, live curl]`
**How to avoid:** Two distinct types. Form date `<input type="date">` values are `YYYY-MM-DD`; serialize to RFC3339 (`T00:00:00Z`) when POSTing create/update, since the backend binds `*time.Time`.

### Pitfall 5: `quantity` create-min is 1, but the quantity route allows 0
**What goes wrong:** Inline-editing quantity to 0 via the create/update validation assumptions fails or surprises.
**Why:** Create + full-PATCH enforce `quantity ≥ 1` (`ErrInsufficientQuantity` on `<= 0`); the dedicated `PATCH /quantity` allows `quantity ≥ 0` (`minimum:0`, domain rejects `< 0`). `[VERIFIED: entity.go NewInventory/Update vs UpdateQuantity; handler.go UpdateQuantityInput minimum:0]`
**How to avoid:** Inline qty editor min=0; create/edit form min=1.

### Pitfall 6: Status is NOT editable via the full PATCH
**What goes wrong:** Trying to change status through `PATCH /inventory/{id}`.
**Why:** `UpdateInventoryInput.Body` has NO `status` field — status changes go exclusively through `PATCH /inventory/{id}/status`. Condition, conversely, is ONLY on the full PATCH (no dedicated route). `[VERIFIED: handler.go UpdateInventoryInput vs UpdateStatusInput]`
**How to avoid:** Route inline edits per field: quantity→`/quantity`, status→`/status`, condition→full PATCH (with current loc+qty bundled).

### Pitfall 7: Archive/restore return 204 (no body) and emit deleted/created SSE
**What goes wrong:** Parsing a body off archive/restore.
**Why:** Both return `*struct{}` (empty). Archive publishes `inventory.deleted`; restore publishes `inventory.created`. `parseResponse` already returns `undefined` for non-JSON. `[VERIFIED: handler.go registerActionRoutes]`

## Runtime State Inventory

> Not a rename/refactor/migration phase — greenfield frontend feature. Section omitted (no stored-data/OS-registration concerns).

## Code Examples

### Inventory enum unions (NEW types for `lib/types.ts`)
```ts
// Source: backend/internal/domain/warehouse/inventory/entity.go (VERIFIED)
export type Condition =
  | "NEW" | "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "DAMAGED" | "FOR_REPAIR";
export type InventoryStatus =
  | "AVAILABLE" | "IN_USE" | "RESERVED" | "ON_LOAN"
  | "IN_TRANSIT" | "DISPOSED" | "MISSING";

export interface Inventory {
  id: string; workspace_id: string; item_id: string;
  location_id: string; container_id?: string;
  quantity: number; condition: Condition; status: InventoryStatus;
  date_acquired?: string;        // RFC3339
  purchase_price?: number;       // cents
  currency_code?: string;        // ISO, ≤3 chars
  warranty_expires?: string;     // RFC3339
  expiration_date?: string;      // RFC3339
  notes?: string;
  is_archived: boolean;
  created_at: string; updated_at: string;
}
export interface InventoryListResponse {  // ONLY the top-level GET /inventory
  items: Inventory[]; total: number; page: number; total_pages: number;
}
export interface ExpiringEntry {           // GET /inventory/expiring
  inventory_id: string; item_id: string; item_name: string;
  quantity: number; kind: "expiration" | "warranty"; date: string; // YYYY-MM-DD
}
export interface Movement {                // GET /movements (3 scopes)
  id: string; workspace_id: string; inventory_id: string;
  from_location_id?: string; from_container_id?: string;
  to_location_id?: string; to_container_id?: string;
  quantity: number; moved_by?: string; reason?: string; created_at: string;
}
```

### Typed API module (mirror `items.ts`)
```ts
// Source pattern: src/lib/api/items.ts + loans.ts (VERIFIED). NO toProxyUrl needed.
export const inventoryApi = {
  list: (wsId, p: { page?: number; limit?: number }) =>
    get<InventoryListResponse>(`/workspaces/${wsId}/inventory${qs(p)}`),
  byItem: (wsId, itemId) =>
    get<{ items: Inventory[] }>(`/workspaces/${wsId}/inventory/by-item/${itemId}`)
      .then(r => r.items),                          // bare envelope (Pitfall 1)
  expiring: (wsId, days = 30) =>
    get<{ items: ExpiringEntry[]; total: number }>(
      `/workspaces/${wsId}/inventory/expiring?days=${days}`),
  create: (wsId, body) => post<Inventory>(`/workspaces/${wsId}/inventory`, body),
  update: (wsId, id, body) => patch<Inventory>(`/workspaces/${wsId}/inventory/${id}`, body),
  updateQuantity: (wsId, id, quantity) =>
    patch<Inventory>(`/workspaces/${wsId}/inventory/${id}/quantity`, { quantity }),
  updateStatus: (wsId, id, status) =>
    patch<Inventory>(`/workspaces/${wsId}/inventory/${id}/status`, { status }),
  move: (wsId, id, location_id, container_id?) =>
    post<Inventory>(`/workspaces/${wsId}/inventory/${id}/move`, { location_id, container_id }),
  archive: (wsId, id) => post<void>(`/workspaces/${wsId}/inventory/${id}/archive`),
  restore: (wsId, id) => post<void>(`/workspaces/${wsId}/inventory/${id}/restore`),
};
export const movementsApi = {
  workspace: (wsId, p?) =>
    get<{ items: Movement[] }>(`/workspaces/${wsId}/movements${qs(p)}`).then(r => r.items),
  byInventory: (wsId, invId, p?) =>
    get<{ items: Movement[] }>(`/workspaces/${wsId}/inventory/${invId}/movements${qs(p)}`).then(r => r.items),
  byLocation: (wsId, locId, p?) =>
    get<{ items: Movement[] }>(`/workspaces/${wsId}/locations/${locId}/movements${qs(p)}`).then(r => r.items),
};
```

## Full Backend Endpoint Enumeration (VERIFIED — read from source + live)

All paths are workspace-scoped: frontend calls `/api/workspaces/{wsId}{path}`; the Vite `/api` rewrite strips `/api`, and the backend mounts these under `/workspaces/{workspace_id}`.

| # | Method | Path | Request | Response | SSE emitted |
|---|--------|------|---------|----------|-------------|
| 1 | GET | `/inventory?page&limit` | `page≥1` (def 1), `limit 1..100` (def 50) | `{items,total,page,total_pages}` | — |
| 2 | GET | `/inventory/{id}` | path id | `Inventory` | — |
| 3 | GET | `/inventory/by-item/{item_id}` | path | `{items}` (no page) | — |
| 4 | GET | `/inventory/by-location/{location_id}` | path | `{items}` (no page) | — |
| 5 | GET | `/inventory/by-container/{container_id}` | path | `{items}` (no page) | — |
| 6 | GET | `/inventory/available/{item_id}` | path | `{items}` (no page) | — |
| 7 | GET | `/inventory/total-quantity/{item_id}` | path | `{item_id,total_quantity}` | — |
| 8 | GET | `/inventory/expiring?days` | `days 1..365` (def 30) | `{items:[{inventory_id,item_id,item_name,quantity,kind,date}],total}` | — |
| 9 | POST | `/inventory` | item_id, location_id, container_id?, quantity≥1, condition, status, date_acquired?, purchase_price?, currency_code?, warranty_expires?, expiration_date?, notes? | `Inventory` | `inventory.created` |
| 10 | PATCH | `/inventory/{id}` | location_id, container_id?, quantity≥1, condition, date_acquired?, purchase_price?, currency_code?, warranty_expires?, expiration_date?, notes? (**NO status**) | `Inventory` | `inventory.updated` |
| 11 | PATCH | `/inventory/{id}/status` | `{status}` | `Inventory` | `inventory.updated` |
| 12 | PATCH | `/inventory/{id}/quantity` | `{quantity≥0}` | `Inventory` | `inventory.updated` |
| 13 | POST | `/inventory/{id}/move` | `{location_id, container_id?}` (**whole-entry**) | `Inventory` | `inventory.updated` + creates a movement row |
| 14 | POST | `/inventory/{id}/archive` | path | 204 empty | `inventory.deleted` |
| 15 | POST | `/inventory/{id}/restore` | path | 204 empty | `inventory.created` |
| 16 | GET | `/movements?page&limit` | page/limit | `{items}` (no page envelope) | — (none, ever) |
| 17 | GET | `/inventory/{inventory_id}/movements?page&limit` | path+page | `{items}` | — |
| 18 | GET | `/locations/{location_id}/movements?page&limit` | path+page | `{items}` | — |

**Condition enum:** `NEW, EXCELLENT, GOOD, FAIR, POOR, DAMAGED, FOR_REPAIR`.
**Status enum:** `AVAILABLE, IN_USE, RESERVED, ON_LOAN, IN_TRANSIT, DISPOSED, MISSING`.
**Cross-tenant validation:** create + move validate that item/location/container all belong to the workspace (404 `*_id not found in this workspace`). `[VERIFIED: service.go]`

### Picker source endpoints (VERIFIED)
| Picker | Endpoint | Input | Response envelope | Field for option |
|--------|----------|-------|-------------------|------------------|
| Item | `GET /items?limit=100` | page/limit/search/category_id/sort | `{items,total,page,total_pages}` | `name` (+ `sku`) |
| Location | `GET /locations?limit=100` | page/limit | `{items,total,page,total_pages}` | `name` |
| Container | `GET /containers?limit=100` | page/limit | `{items,total,page,total_pages}` | (ContainerResponse) |

## Items-List Enrichment Question — RESOLVED (stays deferred)

**Finding (VERIFIED):** `ItemResponse` has NO `quantity`, `location`, `condition`, or derived stock-status field (it carries `min_stock_level` only). There is **no list-level aggregate** that joins items to inventory. The only per-item aggregate is `GET /inventory/total-quantity/{item_id}` (one HTTP call per item → N+1 on a 45-row list). `GET /inventory/by-item/{item_id}` gives entries+locations per item, also per-item.

**Decision:** The items-list `Location`/`Qty`/`Status` "—" cells **stay deferred** (CONTEXT default). INV-08 wires only the item-DETAIL inventory panel (one `by-item` call per detail view — cheap and correct). Folding enrichment into the list would require either a backend aggregate (does not exist) or N+1 fetches (rejected). **Note for a future backend phase:** an `items` list-decoration that joins `SUM(inventory.quantity)` + primary location would let the list cells fill — track as a backend enhancement, out of scope for 7b.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Legacy `/frontend` `inventory.ts` (apiClient + `Inventory` types in `types/inventory.ts`) | New `frontend2/lib/api/inventory.ts` over `lib/api.ts` helpers | Same wire contract; the legacy file is a useful STRUCTURE reference (method names line up 1:1) but uses the old apiClient — do not import it |
| Virtualized legacy table | `RetroPagination` (45 rows) | Simpler; defer virtualization |

**Deprecated/outdated:** none relevant — backend contract is current and live-verified.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tanstack/react-virtual@3.14.2` is the legitimate TanStack package | Package Audit | LOW — not being installed this phase; tagged ASSUMED, gated if ever adopted |
| A2 | 45 inventory entries reflects realistic production scale (virtualization not needed) | Summary/Stack | MEDIUM — if a real workspace grows to thousands, revisit virtualization in a later phase. Pagination is correct regardless. |
| A3 | Movements panel placement (tab vs drawer) | (Claude's discretion per CONTEXT) | LOW — CONTEXT explicitly leaves this to discretion |

## Open Questions (RESOLVED)

<!-- RESOLVED 2026-06-13 (orchestrator): per-inventory movements = row DRAWER on /inventory list (researcher rec, tight scope — no inventory-detail route this phase). Item-scoped movements ALSO surface on item-detail HISTORY (per UI-SPEC). Global /movements feed = NOT a dedicated route this phase; INV-07 satisfied by per-inventory drawer + per-item HISTORY (same endpoint, scoped). If a global view is wanted later it's a thin add. -->

1. **Movements panel scope on the inventory list page**
   - What we know: 3 read scopes exist (workspace/by-inventory/by-location); INV-07 says "global + per-location + per-inventory".
   - What's unclear: whether the global movements panel lives on `/inventory` (a tab/drawer) or its own route; per-inventory belongs on an inventory-detail surface (none exists yet — inventory has no dedicated detail route in scope).
   - Recommendation: Global movements as a panel/drawer on `/inventory`; per-inventory movements inside the move-history affordance on a row; per-location deferred unless a location-detail view exists. Planner + CONTEXT discretion decide placement.

2. **Inventory detail surface**
   - What we know: backend has `GET /inventory/{id}`; no inventory-detail route is in the CONTEXT phase boundary.
   - What's unclear: whether per-inventory movements need a detail page or can live in a row drawer.
   - Recommendation: Use a row-level drawer/dialog for per-entry movements rather than a new route, keeping scope tight.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Go backend (`:8080`) | live E2E + contract verification | ✓ | running, login OK | — |
| Postgres (`warehouse_dev`) | backend | ✓ | seeded (45 inv, 8 expiring) | — |
| seeder user | E2E auth | ✓ | seeder@test.local | — |
| Vite dev (`:5173`, `/api` proxy) | E2E baseURL | ✓ (per CLAUDE.md) | — | — |
| vitest + MSW | unit/component tests | ✓ | vitest ^4.1.5, msw ^2.14.2 | — |
| Playwright | E2E | ✓ | e2e/ specs present | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 + @testing-library/react ^16.3.2 + MSW ^2.14.2 (unit/component); Playwright (E2E) |
| Config file | `frontend2/vitest.config.ts`, `frontend2/playwright.config.ts` |
| MSW handlers | `frontend2/src/test/msw/handlers.ts` + `server.ts` (extend with inventory/movement routes) |
| Quick run command | `cd frontend2 && bun run test` (vitest run) |
| Full suite command | `cd frontend2 && bun run test` then `E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | List renders rows from `["inventory",wsId]` query; pagination | component (MSW) | `bun run test src/features/inventory/InventoryListPage.test.tsx` | ❌ Wave 0 |
| INV-02 | Create dialog posts with item/loc/container selects | component (MSW) | `bun run test src/features/inventory/components/InventoryFormDialog.test.tsx` | ❌ Wave 0 |
| INV-03 | Expiry+warranty date fields serialize to RFC3339 | component | (same form test) | ❌ Wave 0 |
| INV-04 | Move dialog posts `{location_id}` only (whole-entry) | component (MSW) | `bun run test src/features/inventory/components/MoveDialog.test.tsx` | ❌ Wave 0 |
| INV-05 | Inline qty→`/quantity`, status→`/status`, condition→full PATCH; optimistic revert | component (MSW) | `bun run test src/features/inventory/hooks/useInventoryMutations.test.tsx` | ❌ Wave 0 |
| INV-06 | `/inventory/expiring?days` renders kind+date | component (MSW) | `bun run test src/features/inventory/ExpiringPage.test.tsx` | ❌ Wave 0 |
| INV-07 | Movements panel reads 3 scopes; empty-state when none | component (MSW) | `bun run test src/features/inventory/components/MovementsPanel.test.tsx` | ❌ Wave 0 |
| INV-08 | ItemDetail renders real InventoryPanel (by-item) replacing stub | component (MSW) | `bun run test src/features/items/components/InventoryPanel.test.tsx` | ❌ Wave 0 |
| INV-01/04/07 | Live: create entry → list → move → movement appears | E2E (live) | `bun run test:e2e e2e/inventory.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test <touched file>` (vitest, < 30s)
- **Per wave merge:** `cd frontend2 && bun run test` (full vitest run)
- **Phase gate:** Full vitest green + the live `e2e/inventory.spec.ts` green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/api/inventory.ts` + `inventory.test.ts` — API boundary unit tests (covers INV-01..06,08 wire shapes)
- [ ] `src/lib/api/movements.ts` + test — bare-envelope handling (Pitfall 1)
- [ ] `src/test/msw/handlers.ts` — ADD inventory + movement route handlers + fixtures (45-ish rows; one expiring of each `kind`; an empty movements list to exercise the empty-state)
- [ ] `src/features/inventory/*.test.tsx` — page/dialog/hook component tests (all 8 INV reqs)
- [ ] `frontend2/e2e/inventory.spec.ts` — live create→list→move→movements lifecycle (must perform a move before asserting a movement; movements seed is empty)
- [ ] `src/lib/types.ts` — ADD Inventory/Movement/ExpiringEntry/Condition/InventoryStatus (no test, type-only)

## Security Domain

> `security_enforcement` key absent from config → treat as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Cookie-JWT via `lib/api.ts` `credentials:"include"` + refresh — DO NOT regress |
| V3 Session Management | yes (inherited) | Same; SSE uses cookie (never `?token=`) |
| V4 Access Control | yes | Workspace-scoped routes; backend enforces tenant on every inventory/movement read+write (item/location/container cross-tenant validation in `service.go`) |
| V5 Input Validation | yes | zod schema on create/edit form; backend re-validates enums + `quantity≥1` + UUIDs |
| V6 Cryptography | no | No crypto in this phase |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant inventory read/write (IDOR) | Tampering / Info disclosure | Backend `RequireWorkspaceID` + per-resource workspace validation (VERIFIED in handler+service); FE always sends `wsId` from `useWorkspace` |
| Token leak via URL | Info disclosure | Cookie-JWT only; never put tokens in inventory/movement URLs (inherited invariant) |
| Open redirect via response URL | Tampering | N/A — inventory/movement responses carry no absolute URLs (no `toProxyUrl` needed) |
| Stale-page write race | Tampering | Optimistic mutation + `invalidateQueries` re-sync; SSE `inventory.*` corrects concurrent edits |

## Sources

### Primary (HIGH confidence)
- `backend/internal/domain/warehouse/inventory/{entity,handler,service}.go` — full route + enum + semantics enumeration
- `backend/internal/domain/warehouse/movement/{entity,handler}.go` — 3 scopes, bare envelope, no SSE
- `backend/internal/api/router.go` — workspace-scoped mount, broadcaster wiring
- `backend/internal/domain/warehouse/item/handler.go` (ItemResponse) — enrichment-question resolution
- `backend/internal/domain/warehouse/{location,container,category}/handler.go` — picker list shapes
- Live curl against `:8080` (seeder@test.local, ws `1021170e-…`) — 45 inventory, 0 movements, 8 expiring, exact JSON shapes
- `frontend2/src/lib/api.ts`, `lib/api/{items,photos,loans,url}.ts` — API patterns
- `frontend2/src/features/items/**` — list/form/detail/mutation patterns + InventoryPanelStub slot
- `frontend2/src/features/sse/invalidationMap.ts` + `docs/sse-invalidation-contract.md` — inventory already mapped; event names present
- `frontend2/src/components/retro/**` — atom inventory + signatures
- `frontend2/package.json` — dependency confirmation (react-virtual NOT present)

### Secondary (MEDIUM confidence)
- `frontend/lib/api/inventory.ts` (legacy) — structural reference only (old apiClient)

### Tertiary (LOW confidence)
- npm registry `@tanstack/react-virtual@3.14.2` — existence only; tagged ASSUMED (not installed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every atom + helper read from shipped source
- Backend contracts: HIGH — read from source AND verified live (counts, shapes, enums)
- Architecture: HIGH — direct mirror of shipped Phase 7 patterns
- Pitfalls: HIGH — each derived from source + live behavior
- Virtualization/SSE/enrichment decisions: HIGH — resolved with verified facts

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable backend; re-verify counts if seeder data changes materially)
