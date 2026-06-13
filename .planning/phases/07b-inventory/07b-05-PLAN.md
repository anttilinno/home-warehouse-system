---
phase: 07b-inventory
plan: 05
type: execute
wave: 3
depends_on: ["07b-01", "07b-02", "07b-03"]
files_modified:
  - frontend2/src/features/items/components/InventoryPanel.tsx
  - frontend2/src/features/items/components/InventoryPanel.test.tsx
  - frontend2/src/features/items/ItemDetailPage.tsx
  - frontend2/src/features/items/ItemDetailPage.test.tsx
autonomous: true
requirements: [INV-08, INV-07]
must_haves:
  truths:
    - "The item detail side rail renders a real InventoryPanel (by-item) in place of InventoryPanelStub at the exact 07-06 slot, no relayout"
    - "The panel shows an IN STOCK total and one row per inventory entry with status + condition pills, the location/container path, and MOVE/EDIT actions"
    - "An item with no entries shows the recessed empty state (kept from the stub) with an ⊕ ADD ENTRY CTA"
    - "The item-detail HISTORY surface shows per-item movements (aggregated across the item's entries)"
  artifacts:
    - path: "frontend2/src/features/items/components/InventoryPanel.tsx"
      provides: "Real per-item inventory panel (replaces stub)"
      min_lines: 90
  key_links:
    - from: "frontend2/src/features/items/ItemDetailPage.tsx"
      to: "InventoryPanel"
      via: "side-rail slot (was InventoryPanelStub)"
      pattern: "<InventoryPanel"
    - from: "frontend2/src/features/items/components/InventoryPanel.tsx"
      to: "inventoryApi.byItem"
      via: 'useQuery ["inventory", wsId, "by-item", itemId]'
      pattern: "byItem"
---

<objective>
Replace the Phase 7 `InventoryPanelStub` with a real `InventoryPanel` at the exact item-detail side-rail slot (INV-08), and surface per-item movements on the item-detail HISTORY tab (INV-07 item-scope). This is the ONLY plan in the phase that edits `ItemDetailPage.tsx` (single-writer rule).

Purpose: the item-detail page finally answers "how much stock, where, in what condition" and exposes per-item move history — the carry-forward gap Phase 7's stub flagged.
Output: InventoryPanel component (+ test), ItemDetailPage swap (stub → panel + movements in HISTORY).
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
@frontend2/src/features/items/ItemDetailPage.tsx
@frontend2/src/features/items/components/InventoryPanelStub.tsx
@frontend2/src/features/items/components/LoanPanels.tsx
@frontend2/src/lib/api/inventory.ts
@frontend2/src/lib/api/movements.ts
@frontend2/src/features/inventory/inventoryEnums.ts
@frontend2/src/features/inventory/components/MovementsPanel.tsx
@frontend2/src/features/inventory/components/MoveDialog.tsx

<interfaces>
<!-- From Plans 01/02/03. -->
inventoryApi.byItem(wsId, itemId) → Inventory[] (bare unwrap).
movementsApi.byInventory(wsId, invId) → Movement[].
inventoryEnums: STATUS_VARIANT/CONDITION_VARIANT + *_LABEL.
MovementsPanel (Plan 02): renders Movement[] rows + NO MOVEMENTS empty state.
MoveDialog (Plan 03): { open; onClose; entry: Inventory; locationOptions; containerOptions }.

<!-- The exact slot in ItemDetailPage.tsx (verbatim from the shipped file): -->
```tsx
{/* Right column — persistent side rail */}
<aside className="flex flex-col gap-sp-5">
  <ActiveLoanPanel active={activeLoans} />
  <InventoryPanelStub />
</aside>
```
Replace `<InventoryPanelStub />` with `<InventoryPanel wsId={wsId} itemId={item.id} />`. Drop the `InventoryPanelStub` import. Do NOT relayout the grid (`grid-cols-[minmax(0,1fr)_320px]`) — same named region, swapped contents (CONTEXT lock).

<!-- The HISTORY tab today (verbatim): -->
```tsx
{ id: "history", label: <Trans>HISTORY</Trans>, content: <LoanHistoryList history={historyLoans} /> },
```
Add a MOVEMENTS sub-section/sibling to the HISTORY tab content (R15): keep LoanHistoryList AND render per-item movements beneath/beside it. Per-item movements = aggregate `movementsApi.byInventory` across the item's inventory entries (one inventory id per entry), sorted created_at desc, fed into MovementsPanel.

<!-- Atoms via @/components/retro -->
Window(titlebarVariant); BevelButton; StatusPill; RetroEmptyState.

<!-- RENDER-LOOP WARNING: t-via-ref; destructure stable .mutate; no fresh objects in deps. -->
</interfaces>

INV-08 panel spec (UI-SPEC §7): Window titled INVENTORY (bg-bg-panel-2 titlebar), titlebar `⊕ ADD` → `/inventory/new?item={item_id}`; an `IN STOCK {total}` summary (sum of entry quantities or inventoryApi total — sum client-side is fine); one entry row per Inventory: line 1 `×{qty}` + Status pill + Condition pill, line 2 the location/container path (link to location when a surface exists, else plain text), line 3 the expiry chip if set, row actions MOVE (opens the §4 MoveDialog for that entry) + EDIT (`/inventory/{id}/edit`). Empty → keep the stub's recessed `bg-bg-panel-2 bevel-sunken` visual + ⊕ ADD ENTRY CTA → `/inventory/new?item={item_id}`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: InventoryPanel component</name>
  <files>frontend2/src/features/items/components/InventoryPanel.tsx, frontend2/src/features/items/components/InventoryPanel.test.tsx</files>
  <behavior>
    - With entries: renders an IN STOCK total (sum of quantities) and one row per entry with ×qty + Status pill + Condition pill + location/container path + MOVE + EDIT.
    - MOVE opens the MoveDialog for that entry; EDIT links to /inventory/{id}/edit.
    - The titlebar ⊕ ADD links to /inventory/new?item={itemId}.
    - With no entries: renders the recessed empty state (bg-bg-panel-2 bevel-sunken, ◇ glyph, "No stock entries yet.") with an ⊕ ADD ENTRY CTA to /inventory/new?item={itemId}.
    - Location/container labels are client-joined from the locations/containers caches; unresolved → muted "—".
  </behavior>
  <action>Create `InventoryPanel.tsx`: props `{ wsId; itemId }`. `useQuery` keyed `["inventory", wsId, "by-item", itemId]` calling `inventoryApi.byItem`. Resolve location/container names from `usePickerOptions` (Plan 03) or local locations/containers queries. Render the panel per UI-SPEC §7: a Window (or section matching the side-rail treatment) titled INVENTORY, titlebar actions `⊕ ADD` → navigate `/inventory/new?item=${itemId}`, an `IN STOCK` eyebrow + summed `{total}` value, entry rows (`bg-bg-panel border-2 border-border-ink p-sp-3` stacked `gap-sp-2`) with the pills (STATUS_VARIANT/CONDITION_VARIANT + labels), path line, optional expiry chip (reuse the §5 chip rule — near/past), and MOVE/EDIT actions. MOVE sets local move-target state → `<MoveDialog>`; EDIT navigates `/inventory/${entry.id}/edit`. Empty state: keep the stub's recessed `bg-bg-panel-2 bevel-sunken` visual (copy the stub's classNames) + the ⊕ ADD ENTRY CTA. Write `InventoryPanel.test.tsx` (MSW byItem returns ≥2 entries): assert the total = sum, rows show pills + path, MOVE opens the dialog, EDIT link target correct; a separate MSW override returning [] asserts the empty state + CTA.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/items/components/InventoryPanel.test.tsx && bunx tsc -b --noEmit</automated>
  </verify>
  <done>Populated panel shows total + entry rows with pills/path/actions; empty panel keeps the recessed visual + CTA; MOVE/EDIT wired.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Swap stub → panel + per-item movements in HISTORY</name>
  <files>frontend2/src/features/items/ItemDetailPage.tsx, frontend2/src/features/items/ItemDetailPage.test.tsx</files>
  <behavior>
    - The side rail renders <InventoryPanel> in place of <InventoryPanelStub> with no grid relayout.
    - The HISTORY tab shows loan history AND a MOVEMENTS section (per-item movements aggregated across the item's entries, created_at desc) with the NO MOVEMENTS empty state when none.
    - The existing item-detail tests (details/photos/loan/delete) still pass.
  </behavior>
  <action>In `ItemDetailPage.tsx`: remove the `InventoryPanelStub` import, import `InventoryPanel`, replace `<InventoryPanelStub />` in the side-rail `<aside>` with `<InventoryPanel wsId={wsId as string} itemId={item.id} />` (no other layout change). In the HISTORY tab content, render the existing `<LoanHistoryList history={historyLoans} />` AND a movements section: derive the item's inventory entries (a `useQuery` byItem — or reuse the panel's query via a small shared hook to avoid double-fetch; a second cached query under the same key is acceptable), then aggregate `movementsApi.byInventory` per entry id, merge + sort created_at desc, render `<MovementsPanel movements={...} />`. Keep t-via-ref + stable mutates. Update/extend `ItemDetailPage.test.tsx`: assert the real panel renders (e.g. IN STOCK total visible) instead of the stub copy, assert HISTORY shows the movements section; keep the existing assertions green. Delete `InventoryPanelStub.tsx`? NO — leave the file (its empty-state visual is reused by InventoryPanel via copied classNames; deleting it is out of scope and could break its own test). Simply stop importing it.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/items/ItemDetailPage.test.tsx && bunx tsc -b --noEmit && bun run lint:imports</automated>
  </verify>
  <done>Stub replaced by the live panel with no relayout; HISTORY shows per-item movements; all prior item-detail tests still green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api → backend | by-item inventory + per-entry movements reads cross here; workspace-scoped server-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07b-11 | Information disclosure | byItem / byInventory reads | mitigate | Both embed wsId; the item-detail route already gates on a workspace-scoped item load (404 cross-tenant). Movements/inventory for another tenant's item are unreachable because the item id itself 404s. |
| T-07b-12 | Tampering | MOVE from the panel | mitigate | Reuses the MoveDialog (Plan 03) — same location-only body + server cross-tenant validation; no new write path. |
</threat_model>

<verification>
- `bun run test src/features/items/ src/features/inventory/components/InventoryPanel.test.tsx` green.
- `bunx tsc -b --noEmit` + `bun run lint:imports` clean.
- Grep gate: `grep -c 'InventoryPanelStub' frontend2/src/features/items/ItemDetailPage.tsx` returns 0 (stub no longer referenced); `grep -c '<InventoryPanel' frontend2/src/features/items/ItemDetailPage.tsx` returns ≥1.
</verification>

<success_criteria>
The item-detail side rail shows a real, data-backed inventory panel (total + entries + pills + path + MOVE/EDIT) replacing the stub with no relayout, the empty state preserves the recessed visual with a CTA, and the HISTORY surface shows per-item movements. ItemDetailPage is touched only by this plan.
</success_criteria>

<output>
Create `.planning/phases/07b-inventory/07b-05-SUMMARY.md` when done
</output>
