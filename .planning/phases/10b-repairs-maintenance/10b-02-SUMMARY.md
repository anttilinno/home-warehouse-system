---
phase: 10b-repairs-maintenance
plan: 02
subsystem: repairs-ui
tags: [repairs, react-query, rhf, zod, retro-dialog, optimistic, cents, lifecycle]

# Dependency graph
requires:
  - phase: 10b-repairs-maintenance
    plan: 01
    provides: repairsApi / repairStatus / repairFormSchema / formatCents / Repair+RepairCostSummary types / repairHandlers MSW
  - phase: 08-loans
    provides: useLoanMutations + LoanRowActions + ReturnLoanDialog patterns mirrored here
  - phase: 07b-inventory
    provides: MovementsDrawer + InventoryListPage single-writer host + InventoryFormPage RHF idiom
provides:
  - useRepairsByInventoryQuery + useRepairCostQuery (per-inventory repair reads)
  - useRepairMutations (start/complete/update/create/delete; complete-with-condition invalidates inventory)
  - RepairsDrawer (blue per-row drawer; cost rollup + record list + status-gated lifecycle)
  - RepairForm (RHF+zod nested create/edit dialog)
  - CompleteRepairDialog (optional new_condition)
  - InventoryListPage REPAIRS row trigger (🔧) + drawer mount
affects: [10b-03, 10b-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "per-row RetroDialog drawer mirroring MovementsDrawer (invId===null ⇒ closed)"
    - "optimistic prefix-invalidate mutations mirroring useLoanMutations; revert-on-4xx + retroToast.error"
    - "complete-with-condition cross-prefix invalidate (repairs + inventory) — Pitfall 8"
    - "cost rollup grouped per currency, formatCents per row, NEVER cross-currency summed"
    - "RHF transform schema typed via useForm<Input, unknown, Values> three-generic to reconcile cost string→cents"

key-files:
  created:
    - frontend2/src/features/repairs/hooks/useRepairsQuery.ts
    - frontend2/src/features/repairs/hooks/useRepairMutations.ts
    - frontend2/src/features/repairs/hooks/useRepairMutations.test.tsx
    - frontend2/src/features/repairs/components/RepairsDrawer.tsx
    - frontend2/src/features/repairs/components/RepairsDrawer.test.tsx
    - frontend2/src/features/repairs/components/RepairForm.tsx
    - frontend2/src/features/repairs/components/CompleteRepairDialog.tsx
  modified:
    - frontend2/src/features/inventory/InventoryListPage.tsx

key-decisions:
  - "useForm<RepairFormInput, unknown, RepairFormValues> three-generic resolves the zod transform input/output mismatch (cost string→cents) cleanly; onSubmit receives the resolved Values, no redundant re-parse"
  - "PHOTOS/FILES rendered as no-op buttons calling an optional onOpenRecord seam; 10b-03 wires the record sub-view without re-editing the drawer trigger/structure"
  - "completeRepair invalidates [inventory, wsId] ONLY when new_condition is set (asserted both ways in tests)"
  - "deleteRepair optimistically removes the row across all repair caches; pink RetroConfirmDialog default"

requirements-completed: [RPR-01, RPR-02]

# Metrics
duration: ~12min
completed: 2026-06-13
---

# Phase 10b Plan 02: Repair Drawer + CRUD + Lifecycle + Cost Summary

**The Repairs drawer (RPR-01 + RPR-02): a per-inventory-row blue RetroDialog with a per-currency cost rollup header (never cross-currency summed), create/edit/start/complete/delete lifecycle through optimistic prefix-invalidate mutations, and the single-writer InventoryListPage 🔧 REPAIRS trigger + drawer mount.**

## Performance
- **Duration:** ~12 min
- **Tasks:** 3 (Tasks 1+2 via TDD)
- **Files created:** 7
- **Files modified:** 1 (InventoryListPage.tsx — single-writer W2 edit)

## Accomplishments
- `useRepairsByInventoryQuery` + `useRepairCostQuery` — both keyed under the `["repairs", wsId]` prefix, gated on a non-null invId (fire only while the drawer is open)
- `useRepairMutations` mirroring `useLoanMutations` EXACTLY: optimistic patch across all repair caches, snapshot restore + `retroToast.error` on 4xx, prefix re-invalidate onSettled. `completeRepair` additionally invalidates `["inventory", wsId]` when a `new_condition` is applied (T-10b-04 / Pitfall 8)
- `RepairsDrawer` — blue RetroDialog `REPAIRS — {item}`: cost-rollup header (one mono line per currency, `formatCents` per row, `· N completed`; zero → "No completed repairs yet."), `⊕ ADD REPAIR` mint CTA, record list with `repairStatus` StatusPill and status-gated actions (PENDING: START/EDIT/DELETE; IN_PROGRESS: COMPLETE/EDIT/DELETE; COMPLETED: DELETE only), loading/error/empty states verbatim the MovementsPanel idiom
- `RepairForm` — RHF+zod nested blue dialog (create/edit), cost major-unit→cents transform, dirty-close butter DISCARD CHANGES? confirm, PATCH dirty fields only (no status)
- `CompleteRepairDialog` — blue, optional New condition select (default keep-current)
- InventoryListPage single-writer edit: `repairsId` state, 🔧 REPAIRS trigger on non-archived rows beside ↧, drawer mount resolving itemName

## Task Commits
1. **Task 1: query + mutation hooks (TDD)** — `fdb11bea` (feat; tests written first, 8 mutation tests)
2. **Task 2: RepairsDrawer + RepairForm + CompleteRepairDialog (TDD)** — `2b773274` (feat; 12 drawer tests)
3. **Task 3: InventoryListPage REPAIRS trigger (single-writer)** — `93b852eb` (feat)

## PHOTOS/FILES Seam (handoff to 10b-03)
The RepairsDrawer renders `PHOTOS` / `FILES` BevelButtons per record row that call an **optional `onOpenRecord(repair, "photos"|"files")` prop**. They no-op until Plan 10b-03 (Wave 3) passes `onOpenRecord` to wire the record sub-view (RECORD/PHOTOS/FILES tabs). The drawer export and the per-row action cluster are stable — 10b-03 fills the seam without re-editing the trigger or structure.

## Deviations from Plan
None of substance. Two implementation details worth recording:

**1. [Rule 3 - Blocking] RHF three-generic for the transform schema**
- **Found during:** Task 2 (tsc gate)
- **Issue:** `useForm<RepairFormInput>` + `zodResolver(repairFormSchema)` failed `tsc -b` (TS2719/TS2345): the schema's `cost` transform makes the resolved output (`number`) incompatible with the input generic (`string`).
- **Fix:** Typed the form as `useForm<RepairFormInput, unknown, RepairFormValues>` so `onSubmit` receives the resolved `RepairFormValues`; dropped the redundant `repairFormSchema.parse(raw)` re-parse.
- **Files modified:** RepairForm.tsx
- **Commit:** `2b773274`

**2. [Rule 3 - Blocking] ModalStackProvider in the drawer test wrapper**
- **Found during:** Task 2 (test gate)
- **Issue:** RetroDialog calls `useModalStack`, which throws outside a `<ModalStackProvider>`. The mutation-hook test doesn't render a dialog so it didn't need it; the drawer test does.
- **Fix:** Wrapped the drawer test render in `ModalStackProvider` (the LoansListPage.test idiom).
- **Files modified:** RepairsDrawer.test.tsx
- **Commit:** `2b773274`

All edited files are within the plan's `files_modified` allow-list. No forbidden files touched (STATE/ROADMAP/api/vite/backend/routes/Sidebar/Photo*/10b-03+04-owned files all untouched).

## Issues Encountered
The multi-currency cost-rollup assertion initially collided with a repair-row cost of the same magnitude (`€89.00` row vs `$89.00` rollup line, same `89.00` digits). Scoped the assertion to the rollup `<ul>` via `within()` and added a negative assertion that the cross-currency sum (`251.50`) never appears — making the "never summed" guarantee explicit.

## Verification Results
- `bun run lint:tsc` (`tsc -b --noEmit`) → exit 0, clean
- `bun run test src/features/repairs/` → **3 files, 23 tests passed** (8 mutation + 12 drawer + 3 pre-existing repairStatus)
- `bun run test src/features/inventory/InventoryListPage.test.tsx` → **8 tests passed** (existing inventory tests unaffected by the single-writer edit)
- `grep -c RepairsDrawer InventoryListPage.tsx` → 2 (import + mount)

## Next Phase Readiness
- 10b-03 (Wave 3): wire `onOpenRecord` onto the RepairsDrawer to mount the repair record sub-view (photos + attachments). Seam is declared and stable.
- 10b-04 (Wave 3): the serial single-writer edit of InventoryListPage adding the MAINTENANCE trigger + MaintenanceDrawer mount. This plan intentionally left that out (comment marks the boundary).

## Self-Check: PASSED
All 7 created files exist on disk; InventoryListPage.tsx modified. All 3 task commits (fdb11bea, 2b773274, 93b852eb) present in `exec/10b-02` history.

---
*Phase: 10b-repairs-maintenance*
*Completed: 2026-06-13*
