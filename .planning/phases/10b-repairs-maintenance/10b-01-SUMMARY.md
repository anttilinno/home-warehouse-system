---
phase: 10b-repairs-maintenance
plan: 01
subsystem: api
tags: [repairs, maintenance, react-query, msw, zod, intl-numberformat, cents]

# Dependency graph
requires:
  - phase: 08-loans
    provides: loansApi / loanStatus / loanHandlers patterns mirrored here
  - phase: 07-photos
    provides: photos.ts + toProxyUrl mapper boundary forked for repairPhotos
provides:
  - formatCents (cents → currency display, single shared helper)
  - repairsApi / maintenanceApi / repairPhotosApi / repairAttachmentsApi
  - repairStatus server-flag pill helper
  - Repair/RepairCostSummary/RepairPhoto/RepairAttachment/MaintenanceSchedule/DueSchedule wire types
  - repairFormSchema / maintenanceFormSchema (RHF+zod)
  - repairHandlers / maintenanceHandlers MSW fixtures (per-test server.use)
affects: [10b-02, 10b-03, 10b-04, 10b-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cents-only money boundary: formatCents for display, schema Math.round(*100) for input"
    - "server-flag status derivation (no client date math) mirroring loanStatus"
    - "BARE {items}/{items,total} envelopes (huma $schema NOT modelled)"
    - "toProxyUrl rewrite at the repair-photo mapper boundary"

key-files:
  created:
    - frontend2/src/lib/utils/money.ts
    - frontend2/src/lib/utils/money.test.ts
    - frontend2/src/lib/api/repairs.ts
    - frontend2/src/lib/api/maintenance.ts
    - frontend2/src/lib/api/repairPhotos.ts
    - frontend2/src/lib/api/repairAttachments.ts
    - frontend2/src/features/repairs/repairStatus.ts
    - frontend2/src/features/repairs/repairStatus.test.ts
    - frontend2/src/features/repairs/schema.ts
    - frontend2/src/features/maintenance/schema.ts
    - frontend2/src/test/msw/repairHandlers.ts
    - frontend2/src/test/msw/maintenanceHandlers.ts
  modified:
    - frontend2/src/lib/types.ts

key-decisions:
  - "formatCents uses Intl.NumberFormat(undefined, {style:'currency'}) — display-only, default EUR; never round-trips to API"
  - "repairsApi.update PATCHes editable metadata only — status lifecycle is start/complete POSTs"
  - "repairAttachments is LINK-ONLY (file_id registration); no multipart byte path (backend stub, OQ3)"
  - "repairPhotosApi.list returns a bare RepairPhoto[] (mirrors photos.ts), attachments list returns {items,total}"
  - "cost rollup grouped per currency — fixtures provide single + multi-currency helper, NEVER summed"

patterns-established:
  - "Cents discipline: schema costToCents transform → Math.round(major*100); formatCents on the way out"
  - "MSW per-test convention: handler arrays exported, registered via server.use, NOT in global handlers.ts"

requirements-completed: [RPR-01, RPR-02, RPR-03, RPR-04, MNT-01, MNT-02, MNT-03]

# Metrics
duration: ~6min
completed: 2026-06-13
---

# Phase 10b Plan 01: Repairs + Maintenance Foundation Summary

**Wave-0 data contracts for Phase 10b: four api modules (repairs/maintenance/repairPhotos/repairAttachments), the shared cents→currency formatCents util, repairStatus server-flag pill helper, RHF+zod form schemas, and per-test MSW handler files — all type-checked and mirroring the loans/photos patterns.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 3 (Task 1 via TDD)
- **Files created:** 12
- **Files modified:** 1 (types.ts, append-only)

## Accomplishments
- `formatCents` — single shared cents→currency display helper (Intl.NumberFormat, default EUR), TDD-covered
- Four api modules mirroring `loans.ts` envelope discipline (BARE `{items}` / `{items,total}`); cost is cents end-to-end
- `repairStatus` pure helper mapping PENDING/IN_PROGRESS/COMPLETED → StatusPill variants by reading ONLY server status (no date math), TDD-covered
- Repair + maintenance wire types appended to `lib/types.ts`
- `repairFormSchema` with the load-bearing major-unit→cents transform; `maintenanceFormSchema`
- `repairHandlers` (all 3 statuses + single/multi-currency cost fixtures + photos/attachments lists) and `maintenanceHandlers` (overdue + upcoming due rows), per-test `server.use` convention

## Task Commits

1. **Task 1: money util + wire types + repairStatus (TDD)** - `e14a42e7` (feat; RED→GREEN single commit, tests written first then implementation)
2. **Task 2: four api modules** - `d6a3ab00` (feat)
3. **Task 3: RHF+zod schemas + MSW handler files** - `8ac19765` (feat)

## Files Created/Modified
- `frontend2/src/lib/utils/money.ts` - formatCents(cents, currency="EUR") via Intl.NumberFormat
- `frontend2/src/lib/utils/money.test.ts` - 4 formatCents cases (EUR/USD/zero/undefined fallback)
- `frontend2/src/lib/types.ts` - Repair, RepairStatus, RepairCostSummary, RepairPhoto(+Type), RepairAttachment(+AttachmentType), MaintenanceSchedule, DueSchedule
- `frontend2/src/lib/api/repairs.ts` - repairsApi (byInventory, cost, get, create, update, start, complete, del)
- `frontend2/src/lib/api/maintenance.ts` - maintenanceApi (list cap 100, byInventory, due, get, create, update, complete, del)
- `frontend2/src/lib/api/repairPhotos.ts` - repairPhotosApi (list, upload photo+photo_type multipart, updateCaption, del) + toProxyUrl mapper
- `frontend2/src/lib/api/repairAttachments.ts` - repairAttachmentsApi (list, create link-only, del)
- `frontend2/src/features/repairs/repairStatus.ts` - server-flag pill helper
- `frontend2/src/features/repairs/repairStatus.test.ts` - 3 status mapping cases
- `frontend2/src/features/repairs/schema.ts` - repairFormSchema (cost cents transform, description required)
- `frontend2/src/features/maintenance/schema.ts` - maintenanceFormSchema (title/interval_days>=1/next_due)
- `frontend2/src/test/msw/repairHandlers.ts` - repairHandlers + COST_MULTI_CURRENCY fixture
- `frontend2/src/test/msw/maintenanceHandlers.ts` - maintenanceHandlers

## Decisions Made
- `repairPhotosApi.list` returns a bare `RepairPhoto[]` (mirrors `photos.ts` list typing), while `repairAttachmentsApi.list` returns `{items,total}` per the attachment route's paginated envelope.
- `repairsApi.complete` posts `{ new_condition }` (typed `Condition`), reusing the existing inventory Condition union.
- Cost transform rejects non-numeric / negative input via a zod custom issue; empty cost → `undefined` (omitted), never zero-injected.

## Deviations from Plan
None - plan executed exactly as written. All files are within the plan's `files_modified` allow-list; no out-of-scope files touched.

## Issues Encountered
None. tsc clean on first full build; all tests green on first run.

## Verification Results
- `bun run lint:tsc` → exit 0 (full project `tsc -b --noEmit` clean)
- `bun run test src/lib/utils/money.test.ts src/features/repairs/ src/features/maintenance/ src/lib/api/` → **8 files, 65 tests passed** (includes 7 new: 4 money + 3 repairStatus)

## Next Phase Readiness
- All Wave-2/3 component plans (10b-02..05) can import the four api modules, formatCents, repairStatus, both schemas, and register the MSW handler arrays per-test without re-deriving any backend contract.
- No blockers. Backend byte-storage attachment path remains a stub (RPR-04 link-only by design, OQ3) — downstream plans must not assume byte upload.

## Self-Check: PASSED

All 12 created files exist on disk; all 3 task commits (e14a42e7, d6a3ab00, 8ac19765) present in `exec/10b-01` history.

---
*Phase: 10b-repairs-maintenance*
*Completed: 2026-06-13*
