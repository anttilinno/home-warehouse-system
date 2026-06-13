---
phase: 07b-inventory
plan: 04
type: execute
wave: 3
depends_on: ["07b-02", "07b-03"]
files_modified:
  - frontend2/src/features/inventory/ExpiringPage.tsx
  - frontend2/src/features/inventory/ExpiringPage.test.tsx
  - frontend2/src/features/inventory/hooks/useExpiringQuery.ts
  - frontend2/src/features/inventory/InventoryListPage.tsx
  - frontend2/src/routes/index.tsx
autonomous: true
requirements: [INV-06]
must_haves:
  truths:
    - "/inventory/expiring renders a butter Window listing expiring entries with a days selector (7/30/90/365)"
    - "Each expiring row shows kind (WARRANTY/EXPIRY) + an in-{n}d (butter, future) vs ⚠ −{n}d (danger, past) chip, color not the sole signal"
    - "The list's MOVE row action opens the MoveDialog for that entry"
    - "/inventory/new, /inventory/:id/edit, /inventory/expiring routes are registered"
  artifacts:
    - path: "frontend2/src/features/inventory/ExpiringPage.tsx"
      provides: "The /inventory/expiring view"
      min_lines: 80
  key_links:
    - from: "frontend2/src/routes/index.tsx"
      to: "ExpiringPage / InventoryFormPage"
      via: "Route registrations (literal before param)"
      pattern: "path=\"inventory/expiring\""
    - from: "frontend2/src/features/inventory/InventoryListPage.tsx"
      to: "MoveDialog"
      via: "row MOVE action opens the dialog"
      pattern: "MoveDialog"
---

<objective>
Build the expiring view (INV-06), wire the create/edit/expiring routes, and connect the MoveDialog into the list's MOVE row action (the seam Plan 02 left). This is the integration wave for the list+form+dialog triad plus the standalone expiring surface.

Purpose: surface near/past expiry+warranty attention items, and make the move action live end-to-end on the list.
Output: ExpiringPage + useExpiringQuery, route registrations, MoveDialog wired into InventoryListPage.
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
@frontend2/src/features/inventory/InventoryListPage.tsx
@frontend2/src/features/inventory/components/MoveDialog.tsx
@frontend2/src/features/inventory/InventoryFormPage.tsx
@frontend2/src/routes/index.tsx
@frontend2/src/lib/api/inventory.ts

<interfaces>
<!-- From Plans 01/02/03 (shipped this phase). -->
inventoryApi.expiring(wsId, days=30) → { items: ExpiringEntry[]; total }.
ExpiringEntry: { inventory_id, item_id, item_name, quantity, kind: "expiration"|"warranty", date: "YYYY-MM-DD" }.
MoveDialog: { open; onClose; entry: Inventory; locationOptions; containerOptions } (Plan 03).
InventoryListPage (Plan 02) exposes a local move-target state seam (`moveTargetId`/`onMove(entry)`) intended to be connected to MoveDialog here.
InventoryFormPage (Plan 03): create at /inventory/new, edit at /inventory/:id/edit.

<!-- Atoms via @/components/retro -->
Window(titlebarVariant="butter"); RetroTable; RetroSelect; RetroBadge(variant="neutral"); RetroEmptyState; BevelButton.
useWorkspace() → { currentWorkspaceId }.

<!-- Existing route file shape (07b-02 added `<Route path="inventory" ...>`) -->
Authenticated child routes live under the AppShell layout route. LITERAL routes BEFORE param routes (AP-1): `inventory/new` and `inventory/expiring` MUST be registered before `inventory/:id/edit`.
</interfaces>

Near/past rule (UI-SPEC §5, R12): compute `daysDelta = date − today`. `daysDelta ≥ 0` → butter chip `in {n}d` (in 0d = today). `daysDelta < 0` → danger chip `⚠ −{n}d`. The `in`/`−`/`⚠` prefix carries the signal for color-blind users (color not sole). Single list sorted by date ascending. days selector drives `?days=`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useExpiringQuery + ExpiringPage</name>
  <files>frontend2/src/features/inventory/hooks/useExpiringQuery.ts, frontend2/src/features/inventory/ExpiringPage.tsx, frontend2/src/features/inventory/ExpiringPage.test.tsx</files>
  <behavior>
    - useExpiringQuery reads ?days (default 30) and queries inventoryApi.expiring keyed ["inventory", wsId, "expiring", days].
    - ExpiringPage renders a butter Window `EXPIRING SOON` with a days RetroSelect (7/30/90/365 → ?days) and a {n} expiring count.
    - Columns: Item (row click → /items/{item_id}), Qty, Kind (WARRANTY/EXPIRY neutral badge), Date (YYYY-MM-DD mono), When (the near/past chip).
    - A future entry shows a butter "in {n}d" chip; a past entry shows a danger "⚠ −{n}d" chip.
    - Rows sort by date ascending.
    - Empty → NOTHING EXPIRING empty state with the {days} window in the body.
  </behavior>
  <action>Create `useExpiringQuery.ts`: read days from useSearchParams (default 30), `useQuery` keyed `["inventory", wsId, "expiring", days]` (under the inventory prefix so SSE invalidation covers it) calling `inventoryApi.expiring(wsId, days)`, enabled when wsId. Create `ExpiringPage.tsx` per UI-SPEC §5: butter Window, header strip with the days RetroSelect (options 7/30/90/365, default 30) writing `?days`, mono `{n} expiring` count, a RetroTable with the 5 columns. Compute `daysDelta` per row against `new Date()` (date-only). Render the When chip: butter `in {n}d` when ≥0 (in 0d for today), danger `⚠ −{n}d` when <0. Sort rows by `date` asc. RetroEmptyState (glyph ◇, heading NOTHING EXPIRING, body with the {days} window, optional ← BACK TO INVENTORY). Write `ExpiringPage.test.tsx` (MSW serves one future + one past entry from Plan 01 fixtures): assert both rows render, assert the past row shows a ⚠ / − prefix and the future row shows "in", assert changing the days selector updates the query param.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/ExpiringPage.test.tsx && bunx tsc -b --noEmit</automated>
  </verify>
  <done>Expiring view renders kind + near/past chips with non-color signal, days selector drives the query, empty state shows.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire MoveDialog into the list + register routes</name>
  <files>frontend2/src/features/inventory/InventoryListPage.tsx, frontend2/src/routes/index.tsx</files>
  <behavior>
    - Clicking a row's MOVE action opens the MoveDialog for that entry; on move success the list re-syncs (invalidation handled by the dialog).
    - The list still passes its full INV-01/05/07 test (no regression).
    - /inventory/new, /inventory/:id/edit, /inventory/expiring routes resolve to the right pages, registered literal-before-param.
  </behavior>
  <action>In `InventoryListPage.tsx` connect the move seam left by Plan 02: hold `moveTarget: Inventory | null` state, the row MOVE button sets it, render `<MoveDialog open={!!moveTarget} entry={moveTarget} onClose={() => setMoveTarget(null)} locationOptions={...} containerOptions={...} />` (options from usePickerOptions, or passed through). Do NOT alter the inline-edit / drawer / filter behavior. In `routes/index.tsx` add, among the authenticated child routes and BEFORE `items/:id`-style param routes for inventory: `<Route path="inventory/new" element={<InventoryFormPage />} />`, `<Route path="inventory/expiring" element={<ExpiringPage />} />`, `<Route path="inventory/:id/edit" element={<InventoryFormPage />} />`. Import the three pages. Ensure `inventory/new` and `inventory/expiring` precede `inventory/:id/edit` (literal-before-param, AP-1). Re-run the Plan 02 list test to confirm no regression; extend it (or add a focused test) asserting the MOVE action opens the dialog.</action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/inventory/InventoryListPage.test.tsx && bunx tsc -b --noEmit && bun run lint:imports</automated>
  </verify>
  <done>MOVE opens the dialog; list tests still green; all four inventory routes registered literal-before-param.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api → backend | expiring read + move write cross here; tenancy server-authoritative |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07b-09 | Information disclosure | expiring query | mitigate | inventoryApi.expiring embeds wsId; backend FindExpiring window is workspace-scoped. days param clamped 1..365 server-side. |
| T-07b-10 | Tampering | route param :id (edit) | mitigate | The edit page loads the entry via a workspace-scoped get; a cross-tenant id 404s server-side. No client-trusted entry data. |
</threat_model>

<verification>
- `bun run test src/features/inventory/` green (full feature dir, no regression).
- `bunx tsc -b --noEmit` + `bun run lint:imports` clean.
- Grep gate: `grep -c 'path="inventory/expiring"' frontend2/src/routes/index.tsx` returns 1.
</verification>

<success_criteria>
The expiring view lists near/past expiry+warranty entries with correct, non-color-only chips and a working days selector; the MOVE action on the list opens a live MoveDialog; all create/edit/expiring routes are registered.
</success_criteria>

<output>
Create `.planning/phases/07b-inventory/07b-04-SUMMARY.md` when done
</output>
