---
phase: 07b-inventory
plan: 02
type: execute
wave: 2
depends_on: ["07b-01"]
files_modified:
  - frontend2/src/features/inventory/InventoryListPage.tsx
  - frontend2/src/features/inventory/InventoryListPage.test.tsx
  - frontend2/src/features/inventory/hooks/useInventoryQuery.ts
  - frontend2/src/features/inventory/hooks/useInventoryQuery.test.tsx
  - frontend2/src/features/inventory/hooks/useInventoryMutations.ts
  - frontend2/src/features/inventory/hooks/useInventoryMutations.test.tsx
  - frontend2/src/features/inventory/hooks/useMovementsQuery.ts
  - frontend2/src/features/inventory/components/InlineEditCell.tsx
  - frontend2/src/features/inventory/components/InlineEditCell.test.tsx
  - frontend2/src/features/inventory/components/MovementsDrawer.tsx
  - frontend2/src/features/inventory/components/MovementsPanel.tsx
  - frontend2/src/features/inventory/components/MovementsPanel.test.tsx
  - frontend2/src/components/layout/Sidebar.tsx
  - frontend2/src/routes/index.tsx
autonomous: true
requirements: [INV-01, INV-05, INV-07]
must_haves:
  truths:
    - "Visiting /inventory renders a paginated, client-filterable RetroTable of entries with status + condition StatusPills"
    - "User can click a Qty/Status/Condition cell to edit it inline; the change is optimistic and reverts on a 4xx"
    - "User can open a per-entry movements drawer from a row; an empty entry shows the NO MOVEMENTS empty state"
    - "Sidebar INVENTORY group exposes an enabled Inventory entry routing to /inventory"
  artifacts:
    - path: "frontend2/src/features/inventory/InventoryListPage.tsx"
      provides: "The /inventory list page (filter/sort/paginate/inline-edit/drawer)"
      min_lines: 120
    - path: "frontend2/src/features/inventory/hooks/useInventoryMutations.ts"
      provides: "Optimistic qty/status/condition + archive/restore mutations with revert"
      exports: ["useInventoryMutations"]
    - path: "frontend2/src/features/inventory/components/InlineEditCell.tsx"
      provides: "Click-to-edit cell (qty input / status+condition selects), ESC field-local cancel"
  key_links:
    - from: "frontend2/src/features/inventory/hooks/useInventoryQuery.ts"
      to: "inventoryApi.list"
      via: 'useQuery keyed ["inventory", wsId, params]'
      pattern: "\\[\"inventory\", wsId"
    - from: "frontend2/src/features/inventory/hooks/useInventoryMutations.ts"
      to: 'invalidateQueries(["inventory", wsId])'
      via: "onSettled prefix invalidation"
      pattern: "\\[\"inventory\""
    - from: "frontend2/src/routes/index.tsx"
      to: "InventoryListPage"
      via: 'Route path="inventory"'
      pattern: "path=\"inventory\""
---

<objective>
Build the inventory list surface (INV-01), inline-edit cells (INV-05), and the per-entry movements drawer (INV-07 inventory-scope), plus the route + Sidebar wiring. Mirrors the shipped `ItemsListPage` density and URL-driven list pattern, with inventory's twist: filters are CLIENT-side (GET /inventory has no filter params), and inline edits route per-field to dedicated endpoints.

Purpose: the primary inventory management screen — see/filter/sort entries, edit qty/status/condition in place, and inspect an entry's move history.
Output: list page, query/mutation/movements hooks, InlineEditCell, MovementsDrawer/Panel, Sidebar entry enabled, `/inventory` route registered.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/07b-inventory/07b-RESEARCH.md
@.planning/phases/07b-inventory/07b-UI-SPEC.md
@frontend2/src/features/items/ItemsListPage.tsx
@frontend2/src/features/items/hooks/useItemsQuery.ts
@frontend2/src/features/items/hooks/usePhotoMutations.ts
@frontend2/src/lib/api/inventory.ts
@frontend2/src/lib/api/movements.ts
@frontend2/src/features/inventory/inventoryEnums.ts

<interfaces>
<!-- From Plan 01 (already shipped this phase). Use directly. -->
inventoryApi: list(wsId, {page,limit}) → InventoryListResponse; byItem(wsId,itemId) → Inventory[]; updateQuantity(wsId,id,quantity) → Inventory; updateStatus(wsId,id,status) → Inventory; update(wsId,id,body) → Inventory (condition rides full PATCH WITH current location_id+quantity bundled — NO status); archive(wsId,id)/restore(wsId,id) → void.
movementsApi: byInventory(wsId, invId) → Movement[].
inventoryEnums: CONDITION_VARIANT, STATUS_VARIANT, CONDITION_LABEL, STATUS_LABEL, CONDITIONS, STATUSES.

<!-- Atoms via @/components/retro barrel -->
Window(title,titlebarVariant,bodyClassName,actions); RetroTable; RetroPagination(page,pageCount,perPage,onPageChange); FilterBar(searchValue,onSearchChange,searchPlaceholder,itemCount,facets,filterChips,onRemoveFilter,onClearAll,primaryAction); FilterPopover(label,options,selected,onChange); StatusPill(variant,children); RetroBadge(variant); RetroEmptyState(eyebrow,glyph?,heading,body,action); RetroInput; RetroSelect(label,error,...selectProps); useTableSelection(rows); BulkActionBar; retroToast; BevelButton(variant,onClick); RetroDialog(open,onClose,title,titlebarVariant,footer).
useShortcuts(scope, bindings[]) — bindings must depend on STABLE values only (see render-loop warning below).
useWorkspace() → { currentWorkspaceId, workspaces }.

<!-- RENDER-LOOP WARNING (hit 3x in Phase 7). useLingui()'s `t` is NOT stable. -->
Read `t` through `const tRef = useRef(t); tRef.current = t;` inside any useShortcuts/useMemo/useCallback closure. Destructure stable `.mutate` from RQ mutation objects (the wrapper object is fresh each render; `.mutate` identity is stable). NEVER put a mutation wrapper object, a fresh object literal, or `t` itself in a deps array feeding useShortcuts.
</interfaces>

The InlineEditCell ESC is a FIELD-LOCAL cancel (a local onKeyDown on the input/select) — it does NOT route through useModalStack and does NOT pop the modal stack (UI-SPEC §3, R9). The cell is not a modal surface.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useInventoryQuery + useInventoryMutations + useMovementsQuery hooks</name>
  <files>frontend2/src/features/inventory/hooks/useInventoryQuery.ts, frontend2/src/features/inventory/hooks/useInventoryQuery.test.tsx, frontend2/src/features/inventory/hooks/useInventoryMutations.ts, frontend2/src/features/inventory/hooks/useInventoryMutations.test.tsx, frontend2/src/features/inventory/hooks/useMovementsQuery.ts</files>
  <behavior>
    - useInventoryQuery reads page from URL (?page), defaults page 1, limit 25, keys `["inventory", wsId, params]`, enabled only when wsId set, retry:false.
    - useInventoryMutations.updateQuantity is optimistic: onMutate snapshots the cached list, patches the entry's quantity, onError restores the snapshot + fires retroToast.error, onSettled invalidates `["inventory", wsId]`.
    - updateStatus and updateCondition follow the same optimistic+revert shape (condition uses inventoryApi.update with the entry's current location_id+quantity bundled).
    - archive/restore invalidate `["inventory", wsId]` on success.
    - A 4xx on updateQuantity reverts the cached quantity to the prior value (assert the cache value before/after).
  </behavior>
  <action>Create `useInventoryQuery.ts` mirroring `useItemsQuery.ts`: export `INVENTORY_LIMIT = 25`, a URL-state reader (page only — inventory has no server filter params; filters live in component state, R1), `toListParams`, and the `useQuery` keyed `["inventory", wsId, params]`. Create `useInventoryMutations.ts` mirroring `usePhotoMutations.ts` reorder optimism: `updateQuantity`/`updateStatus`/`updateCondition` each with `onMutate` (cancelQueries + snapshot every `["inventory", wsId]` query via getQueriesData, optimistic setQueriesData patch of the matching entry), `onError` (restore snapshot, `retroToast.error(t\`Couldn't update {field}.\`)`), `onSettled` (invalidate `["inventory", wsId]` prefix). updateCondition calls `inventoryApi.update(wsId, id, { location_id, quantity, condition })` — caller passes the current location_id+quantity (Pitfall 6). Add `archive`/`restore` (invalidate on success, toast on error). Create `useMovementsQuery.ts`: `useQuery` keyed `["movements", wsId, "inventory", invId]` calling `movementsApi.byInventory`, enabled when both ids present. Read `t` via a ref where needed. Write the two test files with a QueryClientProvider wrapper (mirror useItemMutations.test.tsx), asserting the optimistic patch and the revert-on-error.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/hooks/ && bunx tsc -b --noEmit</automated>
  </verify>
  <done>Query keyed correctly; optimistic update + revert proven for quantity; archive/restore invalidate; movements hook keyed `["movements", wsId, ...]`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: InlineEditCell + MovementsPanel/Drawer</name>
  <files>frontend2/src/features/inventory/components/InlineEditCell.tsx, frontend2/src/features/inventory/components/InlineEditCell.test.tsx, frontend2/src/features/inventory/components/MovementsPanel.tsx, frontend2/src/features/inventory/components/MovementsPanel.test.tsx, frontend2/src/features/inventory/components/MovementsDrawer.tsx</files>
  <behavior>
    - InlineEditCell rest state renders the value (qty = mono text; status/condition = StatusPill via the enum maps). Click (or Enter/Space when focused) enters edit mode.
    - Qty edit renders RetroInput type=number min=0; Status/Condition edit render RetroSelect with all 7 options (Title-Case labels).
    - Blur OR Enter commits (calls the supplied onCommit); ESC cancels back to the prior value WITHOUT calling onCommit and WITHOUT touching any modal stack.
    - Qty empty or <0 does not commit (blur with invalid cancels).
    - aria-label names the field + item ("Edit quantity for {item name}").
    - MovementsPanel renders a list of Movement rows (timestamp, from→to path, ×qty, who) in mono; null from_* renders "— → {to}"; an empty list renders the NO MOVEMENTS empty state.
  </behavior>
  <action>Create `InlineEditCell.tsx`: props `{ field: "quantity"|"status"|"condition"; value; itemName; onCommit(next) }`. Local `editing` state; rest state shows the value (StatusPill for status/condition using `STATUS_VARIANT`/`CONDITION_VARIANT` + `*_LABEL`, mono span for qty). Edit state swaps in RetroInput (qty, min=0, auto-select on focus) or RetroSelect (status/condition, options from `STATUSES`/`CONDITIONS`). `onKeyDown`: Enter → commit + exit; Escape → `e.stopPropagation()` + revert + exit (field-local — never modal stack, R9). `onBlur` → commit (qty: only if valid, else revert). Never `outline:none`. Create `MovementsPanel.tsx` per UI-SPEC §6: recessed `bg-bg-panel-2` rows, mono columns, RetroEmptyState (glyph ◇, heading NO MOVEMENTS, body per Copywriting) when empty; resolve `moved_by` to a member name if a member list is passed else "Unknown". Create `MovementsDrawer.tsx`: a RetroDialog (blue) titled e.g. `MOVEMENTS` that renders MovementsPanel fed by `useMovementsQuery` for the row's inventory id. Write tests: InlineEditCell click→edit→Enter commits, ESC reverts (and does not call onCommit), invalid qty does not commit; MovementsPanel renders rows and the empty state.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/components/InlineEditCell.test.tsx src/features/inventory/components/MovementsPanel.test.tsx</automated>
  </verify>
  <done>Inline edit commit-on-Enter/blur + ESC field-local revert proven; invalid qty blocked; movements panel renders rows + empty state.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: InventoryListPage + Sidebar entry + /inventory route</name>
  <files>frontend2/src/features/inventory/InventoryListPage.tsx, frontend2/src/features/inventory/InventoryListPage.test.tsx, frontend2/src/components/layout/Sidebar.tsx, frontend2/src/routes/index.tsx</files>
  <behavior>
    - /inventory renders a mint Window titled `INVENTORY — {workspace}` with a FilterBar, a RetroTable (Item, Location, Qty, Status, Condition, Expiry, actions), and RetroPagination.
    - Item/Location names are client-joined from the `["items", wsId]` and `["locations", wsId]` caches/queries; an unresolved label renders muted "—".
    - Search + status/condition/location facets filter CLIENT-side over the loaded page (no server round-trip).
    - Qty/Status/Condition cells are InlineEditCell instances wired to useInventoryMutations.
    - Each row exposes MOVE/EDIT plus a movements affordance opening the MovementsDrawer for that entry.
    - Empty (no entries) and filtered-empty states render inside the table body per Copywriting.
    - Sidebar INVENTORY group "Inventory" NavItem has `to="/inventory"` (enabled, not disabled).
  </behavior>
  <action>Create `InventoryListPage.tsx` mirroring `ItemsListPage.tsx` structure but: use `useInventoryQuery`; filters are CLIENT-side React state (status[], condition[], location[], search) applied to `data.items` before render (R1 — no setSearchParams for facets; only `?page` round-trips); columns per UI-SPEC §1 column table (NO thumbnail column, R7); Qty/Status/Condition rendered via InlineEditCell wired to the mutation `.mutate` fns (destructure stable mutates); row click → `/items/{item_id}` (entry has no detail route, UI-SPEC §1); client-side sort on the loaded page. Add a MOVE row action (opens the move dialog — import `MoveDialog` lazily? NO: MoveDialog is Plan 03; to keep this plan independent, render the MOVE button to navigate/no-op WITH a TODO-free seam: accept that the move dialog wiring lands in Plan 04's route/integration step — instead this plan wires the row's `↧`/drawer + EDIT(`/inventory/{id}/edit`) + the inline edits, and the MOVE button opens the MovementsDrawer's sibling: actually render MOVE as a button that sets a `moveTargetId` state consumed by Plan 04). To avoid a cross-plan import, this plan ships the list with EDIT + inline-edit + the movements drawer fully working, and exposes an `onMove(entry)` prop seam left as a local state setter that Plan 04 connects to MoveDialog. Use `useShortcuts("inventory", [{key:"N",...go /inventory/new}, {key:"/",...focus search}])` with tRef + stable callbacks. Register the route in `routes/index.tsx`: `<Route path="inventory" element={<InventoryListPage />} />` placed with the other authenticated child routes (literal before any param route). Enable the Sidebar entry: in the INVENTORY NavGroup add `<NavItem glyph="▦" label={<Trans>Inventory</Trans>} to="/inventory" />` (pick a glyph not already used in that group; ▦ is taken by Dashboard — use a free one like "⬚" consistent with the unicode placeholder set). Write `InventoryListPage.test.tsx` rendering with MSW + QueryClient + MemoryRouter: assert rows render with pills, a client filter narrows the visible rows, an inline qty edit calls the mutation, the drawer opens.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/InventoryListPage.test.tsx && bunx tsc -b --noEmit && bun run lint:imports</automated>
  </verify>
  <done>/inventory renders rows with StatusPills + inline edit + drawer; client filters work; Sidebar Inventory entry enabled; route registered; typecheck + import-lint clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api → backend | inline-edit + archive writes cross here; tenancy authoritative server-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07b-03 | Tampering | optimistic inline-edit cache | mitigate | onMutate snapshots, onError restores from snapshot — no client-trusted state survives a 4xx; onSettled re-invalidates so the server value is authoritative. Qty client-validated min 0 but server re-validates. |
| T-07b-04 | Information disclosure | client-side filter over loaded page | accept | Filtering only what the workspace-scoped query already returned; no cross-tenant data is fetched (wsId in the key). Client filter is a view convenience, not an access control. |
| T-07b-05 | Denial of service | useShortcuts re-register loop | mitigate | t-via-ref + stable `.mutate` destructure in all shortcut/memo deps (render-loop guard hit 3x in Phase 7). |
</threat_model>

<verification>
- `bun run test src/features/inventory/` green.
- `bunx tsc -b --noEmit` + `bun run lint:imports` clean.
- Grep gate: `grep -c 'to="/inventory"' frontend2/src/components/layout/Sidebar.tsx` returns ≥1 (entry enabled).
</verification>

<success_criteria>
The /inventory page lists entries with status/condition pills, client-side filters, pagination, fully working inline qty/status/condition editing with optimistic revert, and a per-entry movements drawer; the Sidebar Inventory entry is live; the route is registered. (The MOVE dialog and the create/edit form pages are wired in Plans 03/04.)
</success_criteria>

<output>
Create `.planning/phases/07b-inventory/07b-02-SUMMARY.md` when done
</output>
