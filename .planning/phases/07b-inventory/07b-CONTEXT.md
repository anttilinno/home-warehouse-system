# Phase 7b: Inventory - Context

**Gathered:** 2026-06-13 (synthesized by orchestrator — autonomous run)
**Status:** Ready for planning
**Source:** ROADMAP Phase 7b (parity gap G-1, the largest unplanned chunk) + parity plan §5 G-1 + Phase 7 carry-forward

<domain>
## Phase Boundary

Inventory entries UI (INV-01..08) — the item×location×qty×condition×status×expiry×warranty layer:

1. **Inventory list** (INV-01) — filterable RetroTable showing item / location / container / quantity / status / condition; virtualize via `@tanstack/react-virtual` ONLY when entry count warrants (research: confirm count thresholds; the lib may be a NEW dep — verify + legitimacy-gate).
2. **Create entry** (INV-02/03) — item / location / container pickers (SIMPLE SELECTS until Phase 10 type-ahead; the search endpoints exist but type-ahead pickers are Phase 10), plus expiry + warranty date fields.
3. **Move + inline edit** (INV-04/05) — move dialog (entry → new location), inline edit quantity/status/condition on a row.
4. **Expiring view** (INV-06) — `/inventory/expiring` route listing entries past/near expiry/warranty (backend `/inventory/expiring` endpoint).
5. **Movements panel** (INV-07) — history backed by `/movements` (global + per-location + per-inventory).
6. **Per-item inventory panel** (INV-08) — replaces the Phase 7 `InventoryPanelStub` on item detail; each entry links to its location/container.

**Carry-forward from Phase 7 (the reason this phase matters for the items list too):** the `Item` wire type carries NO category-name/location/quantity/derived-status — Phase 7's items list renders "—" placeholders for category/location/qty (07-03 Known Stubs). Inventory entries are where location + quantity actually live. RESEARCH MUST determine whether the items LIST should now derive qty/location from aggregated inventory (a list-enrichment query) or whether that stays out of scope (INV-08 only wires the DETAIL panel). Default: INV-08 detail panel is in-scope; items-list cell enrichment is a SEPARATE concern — only fold it in if cheap and backend supports an aggregate; else leave "—" with a note (revisit when a backend aggregate exists). Do NOT silently expand scope.

NOT in phase: taxonomy CRUD / type-ahead pickers (Phase 10 — simple selects here), repairs/maintenance (10b), loans (8). Container/location/category come from existing read endpoints (simple selects).

</domain>

<decisions>
## Implementation Decisions

### Locked
- Query keys: `["inventory", wsId, ...]`, `["movements", wsId, ...]` per Phase 6 contract. RESEARCH MUST check the SSE invalidation map (frontend2/docs/sse-invalidation-contract.md) — add inventory/movement entity_type rows to the map IF the backend emits those SSE events (this is the one place a feature phase legitimately appends to the contract doc per Phase 6's design). If backend emits no inventory SSE events, note it; manual invalidation on mutation suffices.
- All UI from shipped Phase 4 atoms + Phase 7 patterns (RetroTable, FilterBar, Dialog, FormField, Select, Pagination, StatusPill, useTableSelection). Pickers = RetroSelect (native) populated from location/container/item read endpoints.
- `@tanstack/react-virtual`: ONLY if research confirms it's warranted AND verifies the package (registry legitimacy gate, exact pin). If entry counts are modest, prefer pagination (already have RetroPagination) and DEFER virtualization — don't add a dep speculatively. Decide in research.
- INV-08 panel replaces InventoryPanelStub at the exact slot Phase 7 left (07-06 ItemDetailPage side rail).
- Inline edit: optimistic with revert-on-error (Phase 7 photo-reorder pattern).
- Move dialog through modal stack.
- Routes: /inventory, /inventory/expiring under AppShell; Sidebar INVENTORY group gets Inventory entry enabled.

### Claude's Discretion
- List columns exact set + density (sketch 008), inline-edit affordance (click-to-edit cell vs edit mode), movements panel placement (tab vs drawer on inventory detail or item detail), expiring thresholds display, virtualization threshold value if adopted.

</decisions>

<canonical_refs>
## Canonical References

- Backend REAL contracts (research enumerates): `backend/internal/domain/warehouse/inventory/` (list/by-item/by-location/by-container/available/total-quantity/expiring/CRUD/quantity/status/move/archive), `movements/` endpoints
- frontend2/docs/sse-invalidation-contract.md (key prefix rule + append inventory rows if SSE-backed)
- Phase 7 artifacts: 07-UI-SPEC.md (table/form/dialog language), 07-06-SUMMARY (InventoryPanelStub slot + ItemDetailPage), 07-03 (list page pattern to mirror), lib/api/ (api client patterns, toProxyUrl)
- Legacy STRUCTURE: frontend/app/.../inventory/** (virtualized table, inline edit, move dialog, expiry), frontend/lib/api/inventory.ts + movements.ts
- sketch 008 + sketch-findings SKILL (BINDING)
- 15 backend endpoints serve this (parity plan §5 G-1)

</canonical_refs>

<specifics>
- Inventory entry shape: item_id, location_id, container_id?, quantity, condition, status, expiry_date?, warranty_expiry?, notes? — research confirms exact fields + enums (condition/status values).
- Move dialog: pick target location (+ container?), optional quantity (partial move?) — research confirms whether moves are whole-entry or quantity-split.
- Expiring: backend `/inventory/expiring` likely takes a days-ahead param — confirm.
- E2E (live stack): create inventory entry → appears in list → move to another location → movements panel shows the move. Item detail inventory panel renders entries.

</specifics>

<deferred>
- Type-ahead pickers (Phase 10 — simple selects now)
- Items-list qty/location cell enrichment (only if cheap + backend aggregate exists; else stays "—")
- Repairs/maintenance drawer on inventory rows (Phase 10b)
</deferred>

---

*Phase: 07b-inventory (lettered phase, parity gap G-1)*

---

## Scope delta (recorded 2026-06-13, checker warning #3)

**INV-07 partial:** REQUIREMENTS/ROADMAP text names movements at three scopes (global + per-location + per-inventory). This phase delivers **per-inventory** (row drawer on /inventory) + **per-item** (item-detail HISTORY). **Global workspace-wide and per-location movements views are DEFERRED** — `movementsApi.workspace`/`byLocation` are scaffolded (Plan 01) but get no UI surface this phase. Per research resolution 2026-06-13: a global movements feed is a thin add when a use-case appears (e.g. an audit/activity surface in Phase 14). Not a silent omission — the per-inventory + per-item surfaces satisfy the practical inventory-tracking need; global is an audit convenience.
