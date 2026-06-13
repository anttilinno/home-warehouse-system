---
phase: 10b-repairs-maintenance
plan: 02
type: execute
wave: 2
depends_on: [10b-01]
files_modified:
  - frontend2/src/features/repairs/hooks/useRepairsQuery.ts
  - frontend2/src/features/repairs/hooks/useRepairMutations.ts
  - frontend2/src/features/repairs/hooks/useRepairMutations.test.tsx
  - frontend2/src/features/repairs/components/RepairsDrawer.tsx
  - frontend2/src/features/repairs/components/RepairsDrawer.test.tsx
  - frontend2/src/features/repairs/components/RepairForm.tsx
  - frontend2/src/features/repairs/components/CompleteRepairDialog.tsx
  - frontend2/src/features/inventory/InventoryListPage.tsx
otmf_note: "InventoryListPage.tsx is a SINGLE-WRITER file — this plan (W2) adds the REPAIRS row trigger + RepairsDrawer mount ONLY. Plan 10b-04 (W3, later wave) adds the MAINTENANCE trigger + MaintenanceDrawer mount. Serial waves; never two parallel worktrees on this file."
autonomous: true
requirements: [RPR-01, RPR-02]
must_haves:
  truths:
    - "User opens a Repairs drawer from a per-inventory-row REPAIRS action on InventoryListPage"
    - "User can create, edit, start, and complete repairs from the drawer"
    - "Drawer header shows the cost rollup grouped by currency (never summed across currencies)"
    - "EDIT/START/COMPLETE are hidden on COMPLETED rows; only DELETE remains"
    - "complete-with-condition invalidates the inventory cache too"
  artifacts:
    - path: "frontend2/src/features/repairs/components/RepairsDrawer.tsx"
      provides: "blue RetroDialog drawer mirroring MovementsDrawer; cost rollup header + repair list + actions"
      min_lines: 60
      contains: "RepairsDrawer"
    - path: "frontend2/src/features/repairs/components/RepairForm.tsx"
      provides: "RHF+zod create/edit dialog nested in the drawer"
      contains: "RepairForm"
    - path: "frontend2/src/features/repairs/components/CompleteRepairDialog.tsx"
      provides: "blue complete dialog with optional new_condition"
      contains: "CompleteRepairDialog"
    - path: "frontend2/src/features/repairs/hooks/useRepairMutations.ts"
      provides: "optimistic prefix-invalidate mutations mirroring useLoanMutations"
      contains: "useRepairMutations"
    - path: "frontend2/src/features/repairs/hooks/useRepairsQuery.ts"
      provides: "useRepairsByInventoryQuery + useRepairCostQuery"
      contains: "useRepairsByInventoryQuery"
  key_links:
    - from: "frontend2/src/features/inventory/InventoryListPage.tsx"
      to: "RepairsDrawer (repairsId state + per-row trigger)"
      via: "useState repairsId + BevelButton onClick setRepairsId + <RepairsDrawer invId={repairsId}>"
      pattern: "RepairsDrawer"
    - from: "frontend2/src/features/repairs/hooks/useRepairMutations.ts"
      to: "queryClient invalidate [repairs,wsId] and [inventory,wsId] on complete"
      via: "invalidateQueries"
      pattern: "\\[\"inventory\", wsId\\]|inventory.*wsId"
    - from: "frontend2/src/features/repairs/components/RepairsDrawer.tsx"
      to: "repairsApi.cost grouped by currency_code"
      via: "useRepairCostQuery → formatCents per summary"
      pattern: "formatCents|repair_count"
---

<objective>
The Repairs drawer (RPR-01 + RPR-02): a per-inventory-row blue RetroDialog (sibling of MovementsDrawer) listing repair records with a per-currency cost rollup header, create/edit dialogs, start/complete lifecycle, and delete. This plan OWNS the InventoryListPage.tsx single-writer edit for the REPAIRS row trigger + drawer mount.

Purpose: RPR-01 (CRUD + lifecycle) and RPR-02 (cost rollup) are the core of the phase. Photos/attachments (RPR-03/04) nest into this drawer's record sub-view in Plan 10b-03.
Output: query + mutation hooks, RepairsDrawer, RepairForm, CompleteRepairDialog, and the InventoryListPage REPAIRS trigger.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/10b-repairs-maintenance/10b-RESEARCH.md
@.planning/phases/10b-repairs-maintenance/10b-UI-SPEC.md
@.planning/phases/10b-repairs-maintenance/10b-01-SUMMARY.md

# Templates to mirror EXACTLY:
@frontend2/src/features/inventory/components/MovementsDrawer.tsx
@frontend2/src/features/loans/hooks/useLoanMutations.ts
@frontend2/src/features/loans/components/LoanRowActions.tsx
@frontend2/src/features/loans/components/ReturnLoanDialog.tsx
@frontend2/src/features/inventory/InventoryFormPage.tsx
@frontend2/src/features/loans/LoansListPage.test.tsx
@frontend2/src/features/inventory/InventoryListPage.tsx

<interfaces>
<!-- From 10b-01 (Wave 0). Import, do not re-derive. -->
repairsApi (lib/api/repairs.ts): byInventory, cost, get, create, update, start, complete, del
repairStatus (features/repairs/repairStatus.ts): (r) => { variant, label }
formatCents (lib/utils/money.ts): (cents, currency?) => string
repairSchema + inferred type (features/repairs/schema.ts) — cost transforms major→cents int
Types (lib/types.ts): Repair, RepairCostSummary

Query keys (RESEARCH §Query keys — LOCKED):
  ["repairs", wsId, "by-inventory", invId]
  ["repairs", wsId, "cost", invId]
  ["repairs", wsId, id]
All under prefix ["repairs", wsId] so prefix-invalidate covers everything.

InventoryListPage single-writer edit (RESEARCH OQ1 — EXACT):
  ~line 109: add `const [repairsId, setRepairsId] = useState<string | null>(null);` beside movementsId.
  ~line 487 (actions cluster, non-archived rows only): add a `🔧`/REPAIRS BevelButton
    onClick={() => setRepairsId(entry.id)} aria-label REPAIRS, beside the existing ↧ movements button.
  ~line 527 (after MovementsDrawer): mount <RepairsDrawer invId={repairsId}
    itemName={repairsId ? itemName(entries.find((e)=>e.id===repairsId)?.item_id ?? "") : undefined}
    onClose={() => setRepairsId(null)} />.
  DO NOT add the MAINTENANCE trigger here — that is Plan 10b-04's serial edit of this file.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useRepairsQuery + useRepairMutations</name>
  <files>frontend2/src/features/repairs/hooks/useRepairsQuery.ts, frontend2/src/features/repairs/hooks/useRepairMutations.ts, frontend2/src/features/repairs/hooks/useRepairMutations.test.tsx</files>
  <behavior>
    useRepairMutations.test.tsx (MSW via server.use(...repairHandlers); mirror useLoanMutations.test.tsx):
    - startRepair optimistically flips a PENDING repair's status to IN_PROGRESS, then settles to the server value
    - completeRepair flips IN_PROGRESS → COMPLETED
    - completeRepair WITH new_condition invalidates the ["inventory", wsId] prefix (assert invalidateQueries called with that key)
    - createRepair / updateRepair / deleteRepair resolve and invalidate ["repairs", wsId]
    - on error the optimistic patch is reverted (snapshot restored) and retroToast.error fires
  </behavior>
  <action>
    useRepairsQuery.ts: export `useRepairsByInventoryQuery(invId)` keyed ["repairs", wsId, "by-inventory", invId] calling repairsApi.byInventory; and `useRepairCostQuery(invId)` keyed ["repairs", wsId, "cost", invId] calling repairsApi.cost. Both gated on invId !== null (enabled). Read wsId from the shipped workspace context hook used by useLoansQuery.
    useRepairMutations.ts: mirror useLoanMutations.ts EXACTLY — prefix `["repairs", wsId]`; optimisticPatch (cancelQueries → getQueriesData snapshots → setQueriesData mapping items by id, with the BARE-{items} guard `if (!old || !Array.isArray(old.items)) return old`); onError restore + retroToast.error; onSettled invalidate the prefix. Expose start, complete, update, create, del. completeRepair calls repairsApi.complete(ws,id,new_condition) and, when new_condition is provided, ALSO invalidates ["inventory", wsId] (CONTEXT §7 / Pitfall 8). Render-loop guard: read useLingui().t through a ref where used in stable closures (Pitfall 6); depend on stable .mutate identities.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/repairs/hooks/useRepairMutations.test.tsx</automated>
  </verify>
  <done>Mutation test green incl. the inventory-invalidate-on-complete-with-condition assertion and the optimistic-revert path.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RepairsDrawer + RepairForm + CompleteRepairDialog</name>
  <files>frontend2/src/features/repairs/components/RepairsDrawer.tsx, frontend2/src/features/repairs/components/RepairForm.tsx, frontend2/src/features/repairs/components/CompleteRepairDialog.tsx, frontend2/src/features/repairs/components/RepairsDrawer.test.tsx</files>
  <behavior>
    RepairsDrawer.test.tsx (server.use(...repairHandlers)):
    - opens when invId is non-null; titled "REPAIRS — {item}"
    - renders the cost-rollup header: single-currency fixture → one formatCents line + "· N completed"; assert NO cross-currency sum
    - renders one record-row per repair with the correct StatusPill (Pending/In progress/Completed)
    - a PENDING row shows START + EDIT + DELETE; an IN_PROGRESS row shows COMPLETE + EDIT + DELETE; a COMPLETED row shows DELETE ONLY (no EDIT/START/COMPLETE)
    - clicking START calls repairsApi.start (status flips); clicking ADD REPAIR opens RepairForm; clicking COMPLETE opens CompleteRepairDialog
    - empty fixture → RepairEmptyState ("NO REPAIRS")
  </behavior>
  <action>
    RepairsDrawer.tsx: blue RetroDialog (open={invId !== null}, titlebarVariant="blue", title `REPAIRS — {itemName}`) mirroring MovementsDrawer. Body top→bottom (UI-SPEC §1): (1) cost-rollup header — recessed bg-bg-panel-2 strip; for each RepairCostSummary render `{formatCents(total_cost_cents, currency_code)} · {repair_count} completed`; one line for single currency, stacked lines for multi-currency (OQ5 — NEVER sum across currencies); empty/zero → "No completed repairs yet." (2) `⊕ ADD REPAIR` mint BevelButton opening RepairForm in create mode. (3) repair record list (bg-bg-panel-2 rows): line1 description + StatusPill via repairStatus; line2 mono `{repair_date or —} · {formatCents(cost) or —} · {service_provider}` + warranty badge + completed_at when COMPLETED; actions gated by status per LoanRowActions discipline (PENDING: START/EDIT/DELETE; IN_PROGRESS: COMPLETE/EDIT/DELETE; COMPLETED: DELETE only — UI-SPEC §1, override #4). Leave a `PHOTOS (n)` / `FILES (n)` slot placeholder hook point for Plan 10b-03 (render the buttons but they may no-op until 10b-03 wires the sub-view — declare the seam clearly; do NOT build the sub-view here). Loading/error rows verbatim MovementsPanel. Wire all writes through useRepairMutations.
    RepairForm.tsx: blue RetroDialog nested over the drawer (NOT a route — OQ1); RHF+zod via repairSchema; fields Description* (textarea), Repair date (date), Cost (currency input, cents transform), Service provider, Warranty checkbox, Reminder date — copy from UI-SPEC §2 verbatim. inventory_id is implicit (passed from the open drawer), never a form field. Dirty-close → butter DISCARD CHANGES? confirm. Submit create → repairsApi.create / edit → repairsApi.update (dirty fields, NO status). Per-field ✕ errors + form-level danger banner.
    CompleteRepairDialog.tsx: blue RetroDialog title COMPLETE REPAIR, body `Mark "{description}" completed?`, optional New condition RetroSelect (default "— Keep current condition" + the 7 condition labels), CANCEL + COMPLETE. Submit → completeRepair(id, new_condition?) (the hook handles the inventory invalidate). Copy verbatim from UI-SPEC §2.
    Compose only @/components/retro atoms; all strings via <Trans>/t.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/repairs/components/RepairsDrawer.test.tsx</automated>
  </verify>
  <done>Drawer test green: cost rollup per-currency (no sum), correct pills, status-gated actions (COMPLETED = DELETE only), form + complete dialog open.</done>
</task>

<task type="auto">
  <name>Task 3: wire the REPAIRS row trigger into InventoryListPage (single-writer)</name>
  <files>frontend2/src/features/inventory/InventoryListPage.tsx</files>
  <action>
    SINGLE-WRITER edit (this plan is the sole W2 writer of this file). Apply EXACTLY the three edits in the <interfaces> block: add `repairsId` state beside movementsId; add a `🔧` REPAIRS BevelButton in the actions cluster (non-archived rows only) next to the existing ↧ movements button, onClick setRepairsId(entry.id), aria-label REPAIRS; mount <RepairsDrawer> after <MovementsDrawer> driven by repairsId, resolving itemName from entries. Import RepairsDrawer. DO NOT add a MAINTENANCE trigger or MaintenanceDrawer mount (Plan 10b-04 owns that serial edit). Keep diff minimal — no refactor of unrelated code.
  </action>
  <verify>
    <automated>cd frontend2 && bunx tsc --noEmit && bun run test src/features/inventory/InventoryListPage.test.tsx 2>/dev/null; grep -c "RepairsDrawer" src/features/inventory/InventoryListPage.tsx</automated>
  </verify>
  <done>tsc clean; InventoryListPage imports + mounts RepairsDrawer and renders the REPAIRS trigger; existing inventory tests still green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| frontend → backend API | repair CRUD + lifecycle writes cross here; status transitions server-enforced |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-03 | Tampering | invalid status transition (complete on PENDING) | mitigate | actions gated on server status (PENDING→START, IN_PROGRESS→COMPLETE); backend rejects with 400 as defense-in-depth (Pitfall 3) |
| T-10b-04 | Information disclosure | stale inventory condition after complete-with-condition | mitigate | useRepairMutations invalidates ["inventory", wsId] on complete-with-condition (Pitfall 8) |
| T-10b-01 | Tampering | float cost sent to API | mitigate | repairSchema transforms major-unit → cents int; no float reaches repairsApi.create/update |
| T-10b-SC | Tampering | npm/pip/cargo installs | mitigate | none — no packages installed (RESEARCH audit: nothing to vet) |
</threat_model>

<verification>
- tsc clean; full `bun run test src/features/repairs` green.
- InventoryListPage renders the REPAIRS trigger + mounts RepairsDrawer; existing inventory tests green.
- Cost rollup never sums across currencies (asserted in test).
</verification>

<success_criteria>
- RPR-01: create/edit/start/complete/delete a repair from the drawer; COMPLETED rows are read-only except DELETE.
- RPR-02: per-currency cost rollup renders in the drawer header.
- InventoryListPage REPAIRS trigger opens the drawer (single-writer edit applied).
</success_criteria>

<output>
Create `.planning/phases/10b-repairs-maintenance/10b-02-SUMMARY.md` when done.
</output>
