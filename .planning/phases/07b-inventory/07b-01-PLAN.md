---
phase: 07b-inventory
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend2/src/lib/types.ts
  - frontend2/src/lib/api/inventory.ts
  - frontend2/src/lib/api/inventory.test.ts
  - frontend2/src/lib/api/movements.ts
  - frontend2/src/lib/api/movements.test.ts
  - frontend2/src/features/inventory/inventoryEnums.ts
  - frontend2/src/features/inventory/inventoryEnums.test.ts
  - frontend2/src/test/msw/handlers.ts
autonomous: true
requirements: [INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08]
must_haves:
  truths:
    - "inventoryApi exposes list/byItem/expiring/create/update/updateQuantity/updateStatus/move/archive/restore with correct URL shapes"
    - "movementsApi exposes workspace/byInventory/byLocation returning bare items[] (no pagination envelope)"
    - "Condition (7) and InventoryStatus (7) enums map to StatusPill ok/info/warn/danger variants and Title-Case display labels"
    - "MSW handlers serve inventory + movement routes so all downstream component tests have a backend"
  artifacts:
    - path: "frontend2/src/lib/api/inventory.ts"
      provides: "Typed inventory API boundary over lib/api.ts helpers"
      exports: ["inventoryApi", "InventoryListParams"]
    - path: "frontend2/src/lib/api/movements.ts"
      provides: "Typed movements API boundary (bare {items} envelope)"
      exports: ["movementsApi"]
    - path: "frontend2/src/features/inventory/inventoryEnums.ts"
      provides: "Enum → StatusPill variant + display-label maps"
      exports: ["CONDITION_VARIANT", "STATUS_VARIANT", "CONDITION_LABEL", "STATUS_LABEL", "CONDITIONS", "STATUSES"]
    - path: "frontend2/src/lib/types.ts"
      provides: "Inventory/InventoryListResponse/Movement/ExpiringEntry/Condition/InventoryStatus types"
      contains: "export interface Inventory"
  key_links:
    - from: "frontend2/src/lib/api/inventory.ts"
      to: "frontend2/src/lib/api.ts"
      via: "get/post/patch helpers (credentials:include)"
      pattern: "import.*from \"@/lib/api\""
    - from: "frontend2/src/lib/api/movements.ts"
      to: "GET /workspaces/{wsId}/movements"
      via: "bare {items} unwrap .then(r => r.items)"
      pattern: "\\.then\\(\\(r\\)? => r\\.items\\)"
---

<objective>
Build the typed API + type + enum-map foundation for the whole Inventory phase. This is Wave 0 (per 07b-VALIDATION): the API boundary, the enum→pill maps, and the MSW fixtures land FIRST so every downstream page/dialog/hook plan has a tested contract and a mock backend to render against.

Purpose: Mirror the shipped `lib/api/items.ts` boundary so feature plans never hand-roll fetch and never confuse the two response envelope shapes (GET /inventory = full envelope; the scoped/movements endpoints = bare {items}).
Output: `inventory.ts`, `movements.ts`, new types in `lib/types.ts`, `inventoryEnums.ts`, and MSW handlers — all unit-tested.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07b-inventory/07b-RESEARCH.md
@.planning/phases/07b-inventory/07b-UI-SPEC.md

<interfaces>
<!-- Mirror these shipped patterns exactly. Extracted from codebase — no exploration needed. -->

From frontend2/src/lib/api/items.ts (the boundary to mirror):
```typescript
import { del, get, HttpError, patch, post } from "@/lib/api";
// buildQuery uses URLSearchParams, omits undefined/empty values.
export const itemsApi = {
  list(wsId, params): Promise<ItemListResponse> { return get<ItemListResponse>(`/workspaces/${wsId}/items${suffix}`); },
  create(wsId, data): Promise<Item> { return post<Item>(`/workspaces/${wsId}/items`, data); },
  update(wsId, id, data): Promise<Item> { return patch<Item>(`/workspaces/${wsId}/items/${id}`, data); },
  archive(wsId, id): Promise<void> { return post<void>(`/workspaces/${wsId}/items/${id}/archive`); },
};
```
NOTE: inventory/movement responses carry NO absolute URLs — do NOT import or use `toProxyUrl` (unlike items.ts). No mapItem-style mapper needed.

From frontend2/src/lib/types.ts (existing list-envelope shape to mirror; Huma injects `$schema` — do NOT model it):
```typescript
export interface ItemListResponse { items: Item[]; total: number; page: number; total_pages: number; }
```

From frontend2/src/components/retro/feedback/StatusPill.tsx (the variant union the enum maps must target):
```typescript
export type StatusPillVariant = "ok" | "warn" | "info" | "danger";
```

From frontend2/src/test/msw/handlers.ts (existing structure; api.ts prepends BASE_URL "/api"):
- handlers match `/api/workspaces/ws-1/...`
- `WORKSPACES` fixture id is `"ws-1"`; default handlers return contract-shaped happy-path JSON; tests override per-case with `server.use(...)`.
</interfaces>

Backend endpoint table + enum/field shapes are in 07b-RESEARCH.md "Full Backend Endpoint Enumeration" and "Code Examples" — copy the type definitions verbatim.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Inventory + Movement types and enum→pill maps</name>
  <files>frontend2/src/lib/types.ts, frontend2/src/features/inventory/inventoryEnums.ts, frontend2/src/features/inventory/inventoryEnums.test.ts</files>
  <behavior>
    - CONDITION_VARIANT maps all 7 conditions: NEW/EXCELLENT→ok, GOOD→info, FAIR/POOR→warn, DAMAGED/FOR_REPAIR→danger.
    - STATUS_VARIANT maps all 7 statuses: AVAILABLE→ok, IN_USE/RESERVED/ON_LOAN→info, IN_TRANSIT→warn, DISPOSED/MISSING→danger.
    - CONDITION_LABEL / STATUS_LABEL return Title-Case display strings (e.g. FOR_REPAIR→"For repair", ON_LOAN→"On loan", IN_TRANSIT→"In transit").
    - CONDITIONS and STATUSES are ordered arrays of all enum values (for form select options), matching the entity.go order in 07b-RESEARCH.
    - Every Condition and InventoryStatus union member has an entry in all four maps (no undefined lookups).
  </behavior>
  <action>Add to `lib/types.ts` (do NOT model Huma's injected `$schema`): the `Condition` 7-member union, `InventoryStatus` 7-member union, `Inventory` interface, `InventoryListResponse` (full envelope: items/total/page/total_pages), `ExpiringEntry` (inventory_id, item_id, item_name, quantity, kind: "expiration"|"warranty", date YYYY-MM-DD), and `Movement` interface — copy the exact field sets from 07b-RESEARCH "Inventory enum unions" code block. Create `inventoryEnums.ts` exporting `CONDITION_VARIANT`/`STATUS_VARIANT` (Record<enum, StatusPillVariant>) per the UI-SPEC §Color variant-mapping tables (R6), `CONDITION_LABEL`/`STATUS_LABEL` (Record<enum, string> Title-Case per the Copywriting display rows), and the `CONDITIONS`/`STATUSES` ordered arrays. Import `StatusPillVariant` from `@/components/retro/feedback/StatusPill` (or the barrel). Type the maps with the union keys so a missing key is a compile error.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/inventoryEnums.test.ts && bunx tsc -b --noEmit</automated>
  </verify>
  <done>All 7+7 enum values map to a variant and a Title-Case label; arrays are complete and ordered; typecheck clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: inventoryApi + movementsApi typed boundaries</name>
  <files>frontend2/src/lib/api/inventory.ts, frontend2/src/lib/api/inventory.test.ts, frontend2/src/lib/api/movements.ts, frontend2/src/lib/api/movements.test.ts</files>
  <behavior>
    - inventoryApi.list builds `/workspaces/{wsId}/inventory?page=&limit=` and returns the full {items,total,page,total_pages} envelope.
    - inventoryApi.byItem calls `/inventory/by-item/{itemId}` and returns Inventory[] (unwraps bare {items} — NOT an envelope; reading .total off it must be impossible by type).
    - inventoryApi.expiring calls `/inventory/expiring?days=` and returns {items: ExpiringEntry[]; total}.
    - inventoryApi.create POSTs `/inventory`; update PATCHes `/inventory/{id}` (NO status field allowed in the body type — condition rides here); updateQuantity PATCHes `/inventory/{id}/quantity` with {quantity} (min 0); updateStatus PATCHes `/inventory/{id}/status` with {status}; move POSTs `/inventory/{id}/move` with {location_id, container_id?} ONLY (no quantity); archive/restore POST and return void.
    - movementsApi.workspace/byInventory/byLocation each return Movement[] unwrapped from a bare {items} (no envelope).
    - Tests mock global.fetch (mirror items.test.ts) and assert exact URL shapes + that scoped/movements responses are typed/handled as bare {items}.
  </behavior>
  <action>Create `inventory.ts` mirroring `items.ts` structure: import `{ get, post, patch }` from `@/lib/api` (NO `toProxyUrl`, NO mapItem — inventory responses carry no absolute URLs). Export `InventoryListParams { page?; limit? }` and `inventoryApi` with the methods from 07b-RESEARCH "Typed API module" code block — copy the URL shapes verbatim. byItem unwraps with `.then((r) => r.items)` typed as `get<{ items: Inventory[] }>` so the bare-envelope shape (Pitfall 1) is structurally distinct from `list`'s envelope. move accepts `(wsId, id, location_id, container_id?)` and POSTs `{ location_id, container_id }` — never a quantity (Pitfall 2). updateQuantity sends `{ quantity }` (allows 0 — Pitfall 5); the full `update` body type must NOT include `status` (Pitfall 6). Create `movements.ts` with `movementsApi` (workspace/byInventory/byLocation) each `get<{ items: Movement[] }>(...).then((r) => r.items)`. Write both test files mocking `global.fetch` per the items.test.ts pattern: assert the URL path each method hits, assert byItem/movements return arrays (bare unwrap), assert move body has no quantity key.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/lib/api/inventory.test.ts src/lib/api/movements.test.ts && bun run lint:imports</automated>
  </verify>
  <done>Both API modules pass their tests; URL shapes verified; bare-{items} unwrap proven distinct from the envelope; import-lint clean.</done>
</task>

<task type="auto">
  <name>Task 3: MSW handlers + fixtures for inventory and movements</name>
  <files>frontend2/src/test/msw/handlers.ts</files>
  <action>Add MSW handlers (matching the `/api/workspaces/ws-1/...` prefix convention already in the file) for: GET `/inventory` (returns a small envelope — ~3 entries with distinct status/condition values, total/page/total_pages set), GET `/inventory/by-item/:itemId` (bare `{ items: [...] }` — at least one entry, used by INV-08), GET `/inventory/expiring` (returns `{ items: [one kind:"expiration", one kind:"warranty"], total }` — one near-future date and one PAST date so the expiring view's near/past split is exercisable), POST `/inventory` (echoes a created Inventory), PATCH `/inventory/:id`, PATCH `/inventory/:id/quantity`, PATCH `/inventory/:id/status` (each echoes the updated entry), POST `/inventory/:id/move` (echoes the moved entry), POST `/inventory/:id/archive|restore` (204), GET `/movements` + `/inventory/:id/movements` + `/locations/:id/movements` (bare `{ items: [] }` by default so the empty-state is the default — Pitfall 3; individual tests override with `server.use` to add rows). Fixtures use `ws-1` and item id matching the existing items fixtures so client-side name joins resolve in tests. Do NOT model `$schema`.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/lib/api/inventory.test.ts && bunx tsc -b --noEmit</automated>
  </verify>
  <done>MSW serves all inventory + movement routes; default movements list is empty (empty-state default); inventory/movement api tests that hit MSW (if any) green; typecheck clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api proxy → Go backend | All inventory/movement reads+writes cross here; tenancy is authoritative server-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07b-01 | Information disclosure | inventoryApi / movementsApi URLs | mitigate | All paths embed `wsId` from `useWorkspace` (caller-supplied); backend `RequireWorkspaceID` + per-resource cross-tenant validation is authoritative. Client wsId is convenience, not the boundary. No token ever in URL (cookie-JWT via lib/api.ts, inherited). |
| T-07b-02 | Tampering | move/quantity request bodies | mitigate | move body is `{location_id, container_id?}` ONLY (no quantity split that could over/under-count); quantity route is server-validated `>= 0`. Typed bodies prevent injecting unexpected fields. |
| T-07b-SC | Tampering | npm/pip/cargo installs | accept | Zero new runtime deps this phase (07b-RESEARCH Package Legitimacy Audit; @tanstack/react-virtual explicitly NOT adopted). No install step → no supply-chain surface. |
</threat_model>

<verification>
- `bun run test src/lib/api/ src/features/inventory/inventoryEnums.test.ts` green.
- `bunx tsc -b --noEmit` and `bun run lint:imports` clean.
- Grep gate: `grep -v '^//' frontend2/src/lib/api/inventory.ts | grep -c 'toProxyUrl'` returns 0 (no proxy-URL mapping for inventory).
</verification>

<success_criteria>
inventoryApi + movementsApi exist with verified URL shapes and the bare-{items} vs envelope distinction enforced by types; the 7+7 enum→variant+label maps are complete; MSW serves the full route set with an empty-by-default movements list. Downstream plans can import and render without exploration.
</success_criteria>

<output>
Create `.planning/phases/07b-inventory/07b-01-SUMMARY.md` when done
</output>
