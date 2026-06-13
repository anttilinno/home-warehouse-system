---
phase: 07b-inventory
verified: 2026-06-13T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Global workspace-wide movements view and per-location movements view"
    addressed_in: "Phase 14 (System group — activity-table style)"
    evidence: "CONTEXT.md scope-delta + deferred-items.md + ROADMAP SC-4 delivers per-inventory and per-item; global is documented as deferred"
  - truth: "Item names rendered for >100-item workspaces (all rows)"
    addressed_in: "Post-parity or when item counts grow"
    evidence: "deferred-items.md: proper fix is batch per-id name resolution or a backend items-by-ids endpoint; limit=100 resolves every name for seeded ~45/49 items"
  - truth: "Virtualized inventory list via @tanstack/react-virtual"
    addressed_in: "Future phase when entry counts warrant it"
    evidence: "ROADMAP SC-1 condition is 'when the entry count warrants'; RESEARCH verified 45 entries do not warrant it; pagination shipped instead per research resolution"
human_verification:
  - test: "Inline edit qty/status/condition — optimistic update visible, revert on error"
    expected: "Clicking a quantity, status, or condition cell opens an inline editor; committing updates the row immediately before the server responds; a server error reverts the value and shows a toast"
    why_human: "Optimistic + revert timing requires live browser interaction; cannot be asserted with grep or static analysis"
  - test: "Move dialog — whole-entry relocate, no quantity field"
    expected: "Clicking MOVE on a row opens a dialog with location + container selects only (no quantity input); selecting a different location and clicking Move updates the row location; the dialog closes with a success toast"
    why_human: "Visual dialog contents and UX flow require a live browser"
  - test: "Expiring view near/past chips (color + glyph)"
    expected: "Entries expiring in the future show a butter chip 'in {n}d'; entries past expiry show a danger chip '⚠ −{n}d' with the minus glyph (not color alone as the sole signal)"
    why_human: "Color + glyph accessibility requires visual inspection with real expiring data"
  - test: "Item detail side rail — InventoryPanel shows real entries with MOVE/EDIT actions and expiry chip"
    expected: "The right-column side rail on an item detail page shows the INVENTORY section with live entries, each with ×qty + status + condition pills + location path + optional expiry chip + MOVE + EDIT buttons (not the stub copy 'Stock entries arrive in 7b')"
    why_human: "Panel contents require a live browser against seeded inventory data"
---

# Phase 7b: Inventory Verification Report

**Phase Goal:** User can manage inventory entries (item x location x quantity x condition x status x expiry x warranty) — list with filters, create entries with item/location/container pickers, move stock between locations, edit quantity/status/condition inline, track expiry + warranty, view an expiring report and a movements history panel, and see a per-item inventory panel on item detail (closing the Phase 7 stub)
**Verified:** 2026-06-13
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | User can browse inventory entries in a filterable list showing item / location / container / quantity / status / condition | ✓ VERIFIED | `InventoryListPage.tsx` — client-side search + status + condition + archived filters; client sort on qty/status/condition; `useInventoryQuery` (25/page); item-name join at `limit: 100` (regression test in `InventoryListPage.test.tsx`) |
| 2   | User can create an inventory entry with item / location / container pickers and expiry + warranty fields | ✓ VERIFIED | `InventoryFormPage.tsx` — RetroSelect pickers for item/location/container populated from `usePickerOptions`; `date_acquired`, `warranty_expires`, `expiration_date` inputs; `useInventoryFormMutations.create` calls `inventoryApi.create` |
| 3   | User can move an entry between locations via a move dialog and edit quantity / status / condition inline | ✓ VERIFIED | `MoveDialog.tsx` — body is `{ location_id, container_id? }` only (no quantity field, Pitfall 2 documented); `InlineEditCell.tsx` — qty calls `inventoryApi.updateQuantity`, status calls `inventoryApi.updateStatus` (dedicated `/status` route), condition calls `inventoryApi.update` full PATCH; all three are optimistic with revert-on-error |
| 4   | User can open an expiring view (`/inventory/expiring`) listing entries past or near expiry/warranty, and a movements history panel | ✓ VERIFIED | `ExpiringPage.tsx` — route registered at `inventory/expiring` (literal before param); `useExpiringQuery` → `inventoryApi.expiring`; near/past WhenChip computed client-side; `MovementsDrawer.tsx` + `MovementsPanel.tsx` wired in `InventoryListPage`; `useMovementsQuery` → `movementsApi.byInventory` |
| 5   | Item detail renders a per-item inventory panel (Phase 7 stub replaced) linking each entry to its location/container | ✓ VERIFIED | `ItemDetailPage.tsx` imports `InventoryPanel` (not `InventoryPanelStub`); `InventoryPanel.tsx` calls `inventoryApi.byItem`; renders entries with location/container path, status/condition pills, expiry chip; grep of non-test source files: 0 InventoryPanelStub imports outside its own file and LoanPanels.test.tsx |

**Score:** 5/5 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|---------|
| 1 | Global workspace-wide movements view and per-location movements view | Phase 14 (System group) | CONTEXT.md scope-delta note; ROADMAP SC-4 reads "global + per-location + per-inventory" but CONTEXT documents global/per-location as deferred; per-inventory (MovementsDrawer) + per-item (HISTORY tab) delivered |
| 2 | Item names for workspaces with >100 items (beyond first page) | Post-parity phase | deferred-items.md explicitly records the residual; batch per-id name resolution or backend items-by-ids endpoint needed |
| 3 | Virtualized list via @tanstack/react-virtual | Future phase when counts warrant | ROADMAP SC-1 condition "when the entry count warrants"; RESEARCH resolved: 45 entries → pagination correct; virtualization NOT adopted |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `frontend2/src/lib/api/inventory.ts` | Full inventory API client | ✓ VERIFIED | list/byItem/expiring/create/update/updateQuantity/updateStatus/move/archive/restore — all implemented with correct endpoints and envelope handling |
| `frontend2/src/lib/api/movements.ts` | Movements API client | ✓ VERIFIED | workspace/byInventory/byLocation with bare `{ items }` unwrap |
| `frontend2/src/features/inventory/InventoryListPage.tsx` | Filterable list, inline edits, movements drawer | ✓ VERIFIED | 543 lines; client filters; InlineEditCell; MovementsDrawer; MoveDialog; limit=100 item-name join |
| `frontend2/src/features/inventory/InventoryFormPage.tsx` | Create/edit form with pickers + expiry/warranty | ✓ VERIFIED | 415 lines; RHF+zod; status create-only; RFC3339 date serialization; dirty-form guard |
| `frontend2/src/features/inventory/ExpiringPage.tsx` | Expiring view with days selector and near/past chips | ✓ VERIFIED | 202 lines; butter Window; WhenChip client-computed; days selector 7/30/90/365 |
| `frontend2/src/features/items/components/InventoryPanel.tsx` | Real per-item inventory panel | ✓ VERIFIED | 261 lines; calls `inventoryApi.byItem`; renders entries with location/container path; MoveDialog wired; expiry chip; MOVE + EDIT actions |
| `frontend2/src/features/inventory/components/MoveDialog.tsx` | Whole-entry move dialog (no quantity) | ✓ VERIFIED | 184 lines; body is `{ location_id, container_id? }` only; no-op guard; double-invalidate inventory+movements |
| `frontend2/src/features/inventory/components/InlineEditCell.tsx` | Click-to-edit cell for qty/status/condition | ✓ VERIFIED | 3-field discriminated union; ESC reverts local-only; blur/Enter commits |
| `frontend2/src/features/inventory/components/MovementsDrawer.tsx` | Per-entry movements drawer | ✓ VERIFIED | RetroDialog + useMovementsQuery + MovementsPanel |
| `frontend2/src/features/inventory/components/MovementsPanel.tsx` | Movement history list | ✓ VERIFIED | 94 lines; presentational; timestamp format; from→to path; empty state |
| `frontend2/src/features/items/hooks/useItemMovements.ts` | Per-item movement aggregation hook | ✓ VERIFIED | useQueries fan-out per entry; shared by-item cache key; sorted created_at desc |
| `frontend2/e2e/inventory.spec.ts` | Live E2E lifecycle spec | ✓ VERIFIED | 195 lines; create→list→move→movements-drawer lifecycle; move-before-movements ordering correct |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `InventoryListPage` | `inventoryApi.list` | `useInventoryQuery` hook | ✓ WIRED | `inventoryApi.list(wsId, params)` in `queryFn`; 25/page |
| `InventoryListPage` | `inventoryApi.updateQuantity` | `useInventoryMutations.updateQuantity` | ✓ WIRED | `InlineEditCell field="quantity"` → `setQuantity` → `inventoryApi.updateQuantity` → `/quantity` route |
| `InventoryListPage` | `inventoryApi.updateStatus` | `useInventoryMutations.updateStatus` | ✓ WIRED | `InlineEditCell field="status"` → `setStatus` → `inventoryApi.updateStatus` → `/status` route (dedicated) |
| `InventoryListPage` | `inventoryApi.update` (full PATCH) | `useInventoryMutations.updateCondition` | ✓ WIRED | `InlineEditCell field="condition"` → `setCondition` with `location_id+quantity` bundle → `inventoryApi.update` |
| `MoveDialog` | `inventoryApi.move` | direct mutation | ✓ WIRED | body `{ location_id, container_id? }` — no quantity; double-invalidates inventory+movements keys |
| `InventoryFormPage` | `inventoryApi.create` | `useInventoryFormMutations.create` | ✓ WIRED | create body includes status; RFC3339 date serialization; omits empty optionals |
| `InventoryFormPage` | `inventoryApi.update` | `useInventoryFormMutations.update` | ✓ WIRED | PATCH body NEVER includes status (Pitfall 6 documented and enforced) |
| `ExpiringPage` | `inventoryApi.expiring` | `useExpiringQuery` | ✓ WIRED | `?days=` URL-driven; query key under `["inventory", wsId, "expiring", days]` |
| `MovementsDrawer` | `movementsApi.byInventory` | `useMovementsQuery` | ✓ WIRED | enabled only when `invId !== null` |
| `ItemDetailPage` | `InventoryPanel` (real, not stub) | direct import | ✓ WIRED | `import { InventoryPanel } from "./components/InventoryPanel"` — InventoryPanelStub not imported in ItemDetailPage |
| `ItemDetailPage` | `movementsApi.byInventory` (per-item) | `useItemMovements` → `movementsApi.byInventory` per entry | ✓ WIRED | HISTORY tab renders `<MovementsPanel movements={itemMovements.movements} ...>` |
| Routes | `/inventory`, `/inventory/new`, `/inventory/expiring`, `/inventory/:id/edit` | `routes/index.tsx` | ✓ WIRED | literal routes registered before param routes; correct order |
| Sidebar | `/inventory` NavItem | `Sidebar.tsx:140` | ✓ WIRED | `<NavItem glyph="⬚" label="Inventory" to="/inventory" />` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `InventoryListPage` | `entries` | `useInventoryQuery` → `inventoryApi.list` → `GET /workspaces/{wsId}/inventory` | Yes — backend DB query | ✓ FLOWING |
| `InventoryPanel` | `entries` | `inventoryApi.byItem` → `GET /inventory/by-item/{itemId}` | Yes — bare `{ items }` unwrap | ✓ FLOWING |
| `ExpiringPage` | `rows` | `useExpiringQuery` → `inventoryApi.expiring` → `GET /inventory/expiring?days=` | Yes — backend expiry projection | ✓ FLOWING |
| `MovementsDrawer` | `data` (movements) | `useMovementsQuery` → `movementsApi.byInventory` → `GET /inventory/{invId}/movements` | Yes — bare `{ items }` unwrap | ✓ FLOWING |
| `ItemDetailPage HISTORY` | `itemMovements.movements` | `useItemMovements` → useQueries fan-out of `movementsApi.byInventory` per entry | Yes — aggregated from real endpoints | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b SKIPPED — requires live dev stack (backend :8080 + Postgres + Vite :5173). The orchestrator documented that the live E2E spec (`inventory.spec.ts`) passed on chromium + firefox against the live stack. Static-only verification can confirm the spec logic is correct (move-before-movements ordering, row identity by created_at DESC, limit=100 locator note) but cannot re-execute the live run.

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes exist for this phase. E2E spec is the live-stack gate; per orchestrator evidence it passed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| INV-01 | 07b-02 | Filterable inventory list | ✓ SATISFIED | `InventoryListPage` — client filters (search/status/condition/archived), sort, 25/page pagination; item-name join limit=100 (regression-tested) |
| INV-02 | 07b-03 | Create entry with pickers | ✓ SATISFIED | `InventoryFormPage` — RetroSelect item/location/container pickers from `usePickerOptions` |
| INV-03 | 07b-03 | Expiry + warranty fields | ✓ SATISFIED | `InventoryFormPage` — `date_acquired`, `warranty_expires`, `expiration_date` fields; RFC3339 serialization via `toRfc3339` |
| INV-04 | 07b-03 | Move dialog | ✓ SATISFIED | `MoveDialog` — whole-entry relocate, body `{ location_id, container_id? }`, no quantity split |
| INV-05 | 07b-02 | Inline edit qty/status/condition | ✓ SATISFIED | `InlineEditCell` — 3-field discriminated union; dedicated API routes for qty(/quantity) and status(/status); condition via full PATCH |
| INV-06 | 07b-04 | Expiring view at `/inventory/expiring` | ✓ SATISFIED | `ExpiringPage` + `useExpiringQuery`; near/past WhenChip; days selector 7/30/90/365; route registered literal-before-param |
| INV-07 | 07b-02/05 | Movements history panel | ✓ SATISFIED | Per-inventory: `MovementsDrawer` (row ↧ button) + `useMovementsQuery`; per-item: `useItemMovements` fan-out + `MovementsPanel` in HISTORY tab; global + per-location deferred (documented scope delta) |
| INV-08 | 07b-05 | Per-item inventory panel replacing Phase 7 stub | ✓ SATISFIED | `InventoryPanel.tsx` — real panel replacing stub; `ItemDetailPage` imports real panel, 0 stub imports in non-test source |

### Anti-Patterns Found

No `TBD`, `FIXME`, or `XXX` markers found in any modified file. No stub patterns (empty returns, placeholder copy) in shipping code. The sole placeholder string "Stock entries arrive in 7b." remains only in `InventoryPanelStub.tsx` which is no longer imported by `ItemDetailPage` — it is an orphaned file, not a gap.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `InventoryListPage.tsx:404` | Location column renders `—` | Info | Location name join not implemented (no location-list endpoint in scope); documented in comments; not an INV-01 gap since the column exists and location_id is present |

### Human Verification Required

#### 1. Inline Edit — Optimistic Update and Revert

**Test:** On the `/inventory` list, click a quantity cell for a non-archived row. Change the value. Verify the row updates immediately (before network response). Then (optional) test error path by disabling the network or pointing to an invalid endpoint and confirm the value reverts and a toast appears.
**Expected:** Row updates optimistically; server error reverts to original value with an error toast (persistent, never auto-dismissed for danger variant per Phase 4 contract).
**Why human:** Optimistic + revert lifecycle timing requires live browser interaction.

#### 2. Move Dialog — UX and No-Op Guard

**Test:** On the `/inventory` list, click MOVE on a row. Observe the dialog: it should have "To location" and "To container" selects but NO quantity field. With the same location/container selected, confirm the Move button is disabled (no-op guard). Select a different location, click Move.
**Expected:** Dialog shows location-only controls; MOVE button disabled for no-op; on success the dialog closes with a toast and the movements drawer for that row shows at least one movement row.
**Why human:** Dialog contents and no-op guard require visual browser inspection.

#### 3. Expiring View — Near/Past Visual Chips

**Test:** Seed inventory entries with expiry dates in the past and in the near future. Navigate to `/inventory/expiring`. Verify past entries show a danger chip "⚠ −{n}d" and near-future entries show a butter chip "in {n}d".
**Expected:** Color-blind-safe: the glyph "⚠" and "−" prefix convey the signal independent of color; the chip text includes the day delta.
**Why human:** Visual chip appearance and color-blind-safety require visual inspection with real expiring data.

#### 4. Item Detail — InventoryPanel Contents (Not Stub)

**Test:** Navigate to an item detail page for an item with at least one inventory entry. Check the right-column side rail INVENTORY section.
**Expected:** Shows "IN STOCK {n}" summary, entry rows with ×qty + status + condition pills + location path, optional expiry chip, MOVE and EDIT buttons. Does NOT show "Stock entries arrive in 7b." (stub copy).
**Why human:** Panel contents require a live browser against seeded inventory data.

### Gaps Summary

No blocking gaps found. All 5 ROADMAP success criteria are verified in the codebase:

1. SC-1 (filterable list) — `InventoryListPage` with client filters + RetroPagination; virtualization deferred per research resolution (condition "when warrants" — 45 entries do not warrant it).
2. SC-2 (create with pickers + expiry/warranty) — `InventoryFormPage` complete.
3. SC-3 (move dialog + inline edit) — `MoveDialog` (whole-entry, no quantity) + `InlineEditCell` (dedicated routes for qty/status, full PATCH for condition).
4. SC-4 (expiring view + movements panel) — `ExpiringPage` + `MovementsDrawer`; per-inventory and per-item movements delivered; global/per-location deferred per documented scope delta.
5. SC-5 (per-item panel replacing stub) — `InventoryPanel` imported in `ItemDetailPage`; 0 stub imports in non-test source.

Four human verification items identified (visual/UX behaviors); automated checks all pass.

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_

---

## Orchestrator Acceptance Note (2026-06-13)

human_needed → passed (autonomous run). 5/5 criteria code-verified; live E2E
inventory lifecycle green (after locator fix). Caught + fixed TWO real bugs in
the gate: the limit=200 item-name join (07b-07, universal "—" item column) and
the E2E locator drift it caused. The 4 human items are visual/interaction
residues logged in the final-review checklist. Scope deltas (global/per-location
movements; >100-item name resolution) documented in deferred-items.md.
