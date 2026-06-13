---
phase: 07b-inventory
plan: 05
subsystem: frontend2 / items + inventory
tags: [INV-08, INV-07, react-query, retro-os, inventory-panel, movements]
requires:
  - "inventoryApi.byItem (Plan 01, bare { items } unwrap)"
  - "movementsApi.byInventory (Plan 01)"
  - "inventoryEnums STATUS_VARIANT/CONDITION_VARIANT + *_LABEL (Plan 01)"
  - "MoveDialog (Plan 03)"
  - "MovementsPanel (Plan 02)"
  - "usePickerOptions (Plan 03)"
provides:
  - "InventoryPanel — real per-item inventory side-rail panel (INV-08)"
  - "useItemMovements — per-item movement aggregation hook (INV-07 item scope)"
  - "ItemDetailPage HISTORY MOVEMENTS section"
affects:
  - "frontend2/src/features/items/ItemDetailPage.tsx (single-writer this wave)"
tech-stack:
  added: []
  patterns:
    - "useQueries fan-out for per-entry movement aggregation"
    - "shared by-item cache key between InventoryPanel and useItemMovements (no double fetch)"
    - "bevel-styled <Link> for navigational affordances (BevelButton is button-only)"
key-files:
  created:
    - frontend2/src/features/items/components/InventoryPanel.tsx
    - frontend2/src/features/items/components/InventoryPanel.test.tsx
    - frontend2/src/features/items/hooks/useItemMovements.ts
  modified:
    - frontend2/src/features/items/ItemDetailPage.tsx
    - frontend2/src/features/items/ItemDetailPage.test.tsx
decisions:
  - "BevelButton has no polymorphic `as` prop (plain <button>), so ADD/EDIT navigational affordances render as bevel-styled <Link> anchors (real links, role=link) while MOVE stays a <button> opening the dialog."
  - "Window atom has no bg-bg-panel-2 titlebar variant; the panel renders as a <section> matching the side-rail treatment (consistent with ActiveLoanPanel) rather than a Window, preserving the recessed empty-state visual the stub shipped."
  - "Per-item movements aggregated client-side (no by-item movements endpoint exists): fetch entries via the shared by-item cache key, then useQueries one byInventory read per entry, merge + sort created_at desc."
  - "InventoryPanelStub.tsx left in place (not deleted) per plan scope — only its import was removed."
metrics:
  duration: ~11m
  completed: 2026-06-13
  tasks: 2
  files: 5
---

# Phase 07b Plan 05: Per-Item Inventory Panel + Movements Summary

Replaced the Phase 7 `InventoryPanelStub` with a real, data-backed `InventoryPanel`
at the exact item-detail side-rail slot (INV-08) and surfaced per-item movements on
the item-detail HISTORY tab (INV-07 item scope), aggregated across the item's
inventory entries.

## What shipped

- **`InventoryPanel`** (`frontend2/src/features/items/components/InventoryPanel.tsx`):
  - `useQuery(["inventory", wsId, "by-item", itemId])` → `inventoryApi.byItem` (bare unwrap).
  - `IN STOCK {total}` summary (client-summed entry quantities).
  - One row per entry: `×{qty}` + Status pill + Condition pill (STATUS_VARIANT/CONDITION_VARIANT + Title-Case labels), location/container path (link to `/locations/{id}` when resolved, muted `—` when not), conditional days-ahead expiry chip (UI-SPEC §5 near/past: butter `in {n}d` vs danger `⚠ −{n}d`), and MOVE + EDIT actions.
  - MOVE opens the Plan 03 `MoveDialog` (location-only relocate, no new write path); EDIT links to `/inventory/{id}/edit`; titlebar `⊕ ADD` links to `/inventory/new?item={itemId}`.
  - Empty state preserves the stub's recessed `bg-bg-panel-2 bevel-sunken` visual with a new `⊕ ADD ENTRY` CTA. Loading shows a quiet recessed strip (no flash of `IN STOCK 0`).
- **`useItemMovements`** hook: shares the by-item cache key (no double fetch), fans out `movementsApi.byInventory` per entry via `useQueries`, merges + sorts `created_at` desc.
- **`ItemDetailPage`**: dropped the `InventoryPanelStub` import, rendered `<InventoryPanel wsId itemId>` in the side rail (no grid relayout — same `grid-cols-[minmax(0,1fr)_320px]` region), and added a MOVEMENTS section beneath `LoanHistoryList` in the HISTORY tab fed by `MovementsPanel` (NO MOVEMENTS empty state intact).

## Verification

- `bun run test` — full suite green: **81 files, 564 tests**.
- `InventoryPanel.test.tsx` — 7 tests (total sum, rows+pills+path, MOVE dialog, EDIT link, ⊕ ADD href, recessed empty + CTA, unresolved-location dash).
- `ItemDetailPage.test.tsx` — 10 tests (live panel total replaces stub copy, HISTORY movements aggregation, NO MOVEMENTS empty, all prior detail tests green).
- `bunx tsc -b --noEmit` clean; `bun run lint:imports` OK.
- Grep gates: `InventoryPanelStub` refs in ItemDetailPage = **0**; `<InventoryPanel` = **1**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BevelButton is not polymorphic**
- **Found during:** Task 1
- **Issue:** The plan's UI implies bevel-styled navigational buttons (ADD/EDIT) as links, but `BevelButton` is a plain `<button>` with no `as`/`to` prop, so `<BevelButton as={Link}>` does not type-check.
- **Fix:** Defined a local `BEVEL_LINK` className mirroring BevelButton's bevel chrome and applied it to react-router `<Link>` for ADD/EDIT (real anchors, `role=link`, openable in a new tab). MOVE stays a `<button>` (it opens the dialog, not a navigation).
- **Files modified:** frontend2/src/features/items/components/InventoryPanel.tsx
- **Commit:** af596489

**2. [Rule 1 - Bug] Empty/loading flash**
- **Found during:** Task 1 (test RED→GREEN)
- **Issue:** Initial guard `!isLoading && length===0` fell through to the populated header during the loading phase, briefly rendering `IN STOCK 0` + empty list.
- **Fix:** Added an explicit loading branch (recessed strip) before the empty/populated branches so the panel never flashes a zero total.
- **Files modified:** frontend2/src/features/items/components/InventoryPanel.tsx
- **Commit:** af596489

## Threat Flags

None. Both reads (byItem / byInventory) embed `wsId` and are gated by the
workspace-scoped item load (cross-tenant item 404s); MOVE reuses the Plan 03
dialog with no new write path (T-07b-11 / T-07b-12 mitigations intact).

## Known Stubs

None. The populated panel is fully data-wired (byItem entries + resolved
location/container names + aggregated movements). `InventoryPanelStub.tsx`
remains on disk but is no longer imported anywhere in the item-detail surface
(left intentionally per plan scope; its own test still passes).

## Self-Check: PASSED

- All 4 created/modified source files present on disk.
- Both task commits present in git history (af596489, 84bf7373).
- Stub import removed (0 references in ItemDetailPage).
