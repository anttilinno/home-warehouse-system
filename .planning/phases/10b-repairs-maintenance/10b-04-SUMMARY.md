---
phase: 10b-repairs-maintenance
plan: 04
subsystem: maintenance
tags: [maintenance, react-query, msw, rhf, zod, server-flag, no-date-math, single-writer]

# Dependency graph
requires:
  - phase: 10b-repairs-maintenance
    plan: 01
    provides: maintenanceApi, MaintenanceSchedule/DueSchedule types, maintenanceFormSchema, maintenanceHandlers MSW
  - phase: 10b-repairs-maintenance
    plan: 02
    provides: RepairsDrawer + the InventoryListPage REPAIRS trigger (mirrored; left untouched)
provides:
  - useSchedulesByInventoryQuery + useMaintenanceDueQuery (the Phase-13 dashboard feed hook, MNT-03)
  - useMaintenanceMutations (create/update/delete/complete; complete dual-invalidates maintenance + repairs)
  - MaintenanceDrawer + MaintenanceForm + CompleteMaintenanceDialog
  - MaintenanceDuePage (/maintenance/due, server is_overdue 3-cue treatment)
  - /maintenance/due route + Sidebar Maintenance nav entry + InventoryListPage MAINTENANCE trigger
affects: [13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "server-flag overdue (is_overdue) — zero client date math (override #3)"
    - "complete-schedule dual cache invalidation: maintenance + repairs (override #7, server wrote a repair-log row)"
    - "per-row RetroDialog drawer sibling of MovementsDrawer/RepairsDrawer"

key-files:
  created:
    - frontend2/src/features/maintenance/hooks/useMaintenanceQuery.ts
    - frontend2/src/features/maintenance/hooks/useMaintenanceMutations.ts
    - frontend2/src/features/maintenance/hooks/useMaintenanceMutations.test.tsx
    - frontend2/src/features/maintenance/components/MaintenanceDrawer.tsx
    - frontend2/src/features/maintenance/components/MaintenanceDrawer.test.tsx
    - frontend2/src/features/maintenance/components/MaintenanceForm.tsx
    - frontend2/src/features/maintenance/components/CompleteMaintenanceDialog.tsx
    - frontend2/src/features/maintenance/MaintenanceDuePage.tsx
    - frontend2/src/features/maintenance/MaintenanceDuePage.test.tsx
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/features/inventory/InventoryListPage.tsx

key-decisions:
  - "completeSchedule sends no body; the server advances next_due + writes the repair-log row. One-tap confirm, no notes input (R16)."
  - "Drawer renders next_due as a NEUTRAL mono date (per-inventory endpoint has no is_overdue flag); overdue cue lives ONLY on /maintenance/due."
  - "MaintenanceForm interval_days registered with valueAsNumber:true so the zod number schema validates the raw numeric input."
  - "Complete success toast names the SERVER-returned next_due (sliced) — never a client-computed date."

requirements-completed: [MNT-01, MNT-02, MNT-03]

# Metrics
duration: ~12min
completed: 2026-06-13
---

# Phase 10b Plan 04: Maintenance Drawer + Due Page + Nav Summary

**The maintenance half of Phase 10b: the per-inventory-row Maintenance drawer (schedule CRUD + one-tap complete that advances next_due server-side), the standalone /maintenance/due page with a server-`is_overdue`-driven 3-cue overdue treatment (zero client date math), and the useMaintenanceDueQuery hook that Phase 13 mounts as the dashboard due-soon card — plus the single-writer route, sidebar nav, and InventoryListPage MAINTENANCE trigger edits.**

## Performance
- **Duration:** ~12 min
- **Tasks:** 3 (Tasks 1 + 2 via TDD)
- **Files created:** 9
- **Files modified:** 3 (all single-writer, declared in plan files_modified)

## Accomplishments
- `useMaintenanceQuery` — `useSchedulesByInventoryQuery` (drawer, keyed `["maintenance", wsId, "by-inventory", invId]`), `useMaintenanceDueQuery` (the MNT-03 Phase-13 feed, keyed `["maintenance", wsId, "due", days]`), and `useMaintenanceListQuery` (limit cap 100).
- `useMaintenanceMutations` — create/update/delete/complete mirroring useRepairMutations' optimistic snapshot+restore discipline. `completeSchedule` invalidates BOTH `["maintenance", wsId]` AND `["repairs", wsId]` (override #7 — the server wrote a repair-log row). No client date math anywhere.
- `MaintenanceDrawer` — blue RetroDialog `MAINTENANCE — {item}`, schedule rows (title · `every {n}d`; `Next due {date}` neutral mono · `Last done {date|never}`; COMPLETE/EDIT/DELETE), `NO SCHEDULES` empty state. No is_overdue in the drawer (override #3).
- `MaintenanceForm` — blue nested RHF+zod dialog (Title* / Interval days* / Next due* / Notes), butter DISCARD CHANGES? dirty guard.
- `CompleteMaintenanceDialog` — blue one-tap RetroConfirmDialog; success toast names the server-returned new next_due.
- `MaintenanceDuePage` — mint Window + RetroTable (Item/Schedule/Next due/Status + COMPLETE). Overdue rows carry the 3 cues (row tint + Overdue pill + ⚠ chip), driven ENTIRELY by the server `is_overdue` flag. `NOTHING DUE` empty state.
- Single-writer edits: `/maintenance/due` literal route, Sidebar `Maintenance` NavItem (Inventory group, ⊞ glyph), InventoryListPage `⟳` MAINTENANCE trigger + drawer mount alongside the untouched 10b-02 REPAIRS trigger.

## Task Commits
1. **Task 1: maintenance hooks + drawer + forms (TDD)** — `caddb7a7`
2. **Task 2: MaintenanceDuePage server is_overdue 3-cue (TDD)** — `67690105`
3. **Task 3: wire route + sidebar nav + InventoryListPage trigger** — `cbe7bea1`

## Deviations from Plan
None — plan executed exactly as written. All files within the plan's `files_modified` allow-list; the 10b-02 REPAIRS trigger and all 10b-03-owned files were left untouched. The only adjustment was removing an unused `waitFor` import flagged by the full-project `tsc -b` (committed within Task 3).

## Threat Surface
- T-10b-08 (client-derived overdue/next_due): mitigated — overdue = server `is_overdue` only; complete advances next_due server-side; a dedicated test flips ONLY `is_overdue` on two identically-dated rows and asserts the cue follows the flag.
- T-10b-09 (stale repair list after complete): mitigated — `completeSchedule` invalidates `["repairs", wsId]` too; asserted in the mutations test.
- T-10b-10 (list limit > 100): mitigated — `useMaintenanceListQuery` caps limit at 100 (maintenanceApi also caps server-side).
- No new threat surface introduced.

## Verification Results
- `bun run lint:tsc` → exit 0 (`tsc -b --noEmit` clean across the project).
- `bun run test src/features/maintenance/` → **3 files, 21 tests passed**.
- `bun run test src/features/inventory/InventoryListPage.test.tsx` → **8 tests passed**.

## Self-Check: PASSED
All 9 created files exist on disk; all 3 task commits (caddb7a7, 67690105, cbe7bea1) present in `exec/10b-04` history; `/maintenance/due` route and `MaintenanceDrawer` mount both grep-confirmed in their single-writer files.

---
*Phase: 10b-repairs-maintenance*
*Completed: 2026-06-13*
