---
phase: 07-items-photos
plan: 08
subsystem: ui
tags: [react, react-hook-form, zod, items, forms]

# Dependency graph
requires:
  - phase: 07-items-photos
    provides: item create/edit form (Plan 05), routes (Plan 06), live lifecycle E2E that surfaced the gap (Plan 07)
provides:
  - SKU field in the item create form (required, validated client-side)
  - SKU rendered read-only/immutable in edit mode (never PATCHed)
  - form-driven item create no longer 422s on the missing-sku contract
affects: [items, scan-capture, quick-capture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Always-on field validation with mode-conditional rendering: one zod schema; field is editable+required in create, read-only/disabled (prefilled) in edit"
    - "Immutable-field discipline: a value required at create but absent from the backend PATCH input is shown read-only and deliberately excluded from the PATCH builder"

key-files:
  created:
    - .planning/phases/07-items-photos/07-08-SUMMARY.md
  modified:
    - frontend2/src/features/items/schema.ts
    - frontend2/src/features/items/ItemFormPage.tsx
    - frontend2/src/features/items/hooks/useItemFormMutations.ts
    - frontend2/src/features/items/ItemFormPage.test.tsx
    - frontend2/src/features/items/hooks/useItemFormMutations.test.tsx
    - .planning/phases/07-items-photos/deferred-items.md

key-decisions:
  - "SKU validation is always on (single schema); edit mode keeps the resolver valid by prefilling sku from the loaded item rather than branching the schema"
  - "SKU is excluded from buildPatchBody unconditionally (immutable — backend UpdateItemInput has no sku), even if RHF marks it dirty"
  - "SKU uses RetroFormField (mono input) so the edit-mode immutability hint can sit below the disabled control, mirroring the Barcode field pattern"

patterns-established:
  - "Mode-conditional field: required+editable in create, read-only+hint in edit, prefilled from loaded entity"

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 07 Plan 08: Item Create-Form SKU Field Summary

**Added the backend-required `sku` field to the item create form (required + zod-validated), rendered it read-only/immutable in edit mode, and wired it into the create POST body — closing D-07-07-A so form-driven item create no longer 422s.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-13T09:08:00Z
- **Completed:** 2026-06-13T09:26:00Z
- **Tasks:** 6
- **Files modified:** 6

## Accomplishments
- `schema.ts`: `sku` is now a required, trimmed string (`.min(1, "SKU is required.")`, `.max(255)`), validation always on.
- `ItemFormPage`: SKU field rendered near Name — editable + required with error display in CREATE; read-only/disabled with an "SKU can't be changed after an item is created." hint in EDIT; prefilled from the loaded item.
- `useItemFormMutations`: `buildCreateBody` now includes `sku`; the PATCH builder still omits it (SKU is immutable — backend `UpdateItemInput` has no `sku` field).
- Tests: create body includes sku; missing-sku surfaces a zod error with no 422 round-trip; edit renders sku read-only and PATCH omits sku; all prior tests kept green.
- D-07-07-A marked RESOLVED in `deferred-items.md`.

## Task Commits

Implementation committed atomically (single cohesive change — schema/UI/mutation/tests/deferred-log):

1. **Tasks 1-4 + 6: SKU field, mutation wiring, tests, deferred-log** - `88257d7a` (fix)

**Plan metadata (this SUMMARY):** committed in the final docs commit.

## Files Created/Modified
- `frontend2/src/features/items/schema.ts` - Added required `sku` validation to the form schema.
- `frontend2/src/features/items/ItemFormPage.tsx` - Rendered SKU field (create: required/editable; edit: read-only with immutability hint); added sku to defaults + edit prefill.
- `frontend2/src/features/items/hooks/useItemFormMutations.ts` - `buildCreateBody` includes `sku`; documented that the PATCH builder omits it.
- `frontend2/src/features/items/ItemFormPage.test.tsx` - Create flow types a SKU; added create-body-includes-sku, missing-sku zod error, edit read-only, PATCH-omits-sku tests.
- `frontend2/src/features/items/hooks/useItemFormMutations.test.tsx` - Added schema sku rejection, create-body-includes-sku, PATCH-omits-sku tests; default sku in the `resolve` helper.
- `.planning/phases/07-items-photos/deferred-items.md` - Appended a RESOLVED line for D-07-07-A.

## Decisions Made
- Kept a single schema with always-on SKU validation; edit mode stays valid by prefilling `sku` from the loaded item (per the task's resolver-reuse note) rather than branching create/edit schemas.
- Excluded `sku` from `buildPatchBody` unconditionally — SKU is immutable (no `sku` on the backend PATCH input), so even a dirty sku is dropped. Added an explicit test asserting this.
- Used `RetroFormField` (mono input) for SKU rather than `RetroInput` so the edit-mode immutability hint renders below the disabled control, matching the existing Barcode field treatment.

## Deviations from Plan

None - plan executed exactly as written. The 07-UI-SPEC had no SKU-specific copy, so the field label ("SKU") and edit-mode hint copy were authored to match the existing form's voice and the immutable-field constraint.

## Issues Encountered
- The mutations test helper `resolve()` calls `itemFormSchema.parse`, which now throws on missing `sku`. Resolved by injecting a default `sku: "SKU-1"` (override-able via spread) so existing terse callers stay green while the new tests pass an explicit sku.

## User Setup Required
None - no external service configuration required.

## Verification
- `bun run test src/features/items/` → 11 files, 84 tests passed.
- `bun run lint:tsc` → exit 0.
- `bun run build` → built OK (pre-existing chunk-size warning only; out of scope).
- Live-stack smoke not run (tests are the gate per the task).

## Next Phase Readiness
- ITEM-03 ("create via /items/new") now works end-to-end through the form path.
- Quick Capture (future) may want a SKU auto-generate affordance (`QC-{timestamp}-{random}` convention noted in the deferred item) — out of scope here; the field is a plain required input for now.

## Self-Check: PASSED
- `frontend2/src/features/items/schema.ts` — FOUND
- `frontend2/src/features/items/ItemFormPage.tsx` — FOUND
- `frontend2/src/features/items/hooks/useItemFormMutations.ts` — FOUND
- `.planning/phases/07-items-photos/07-08-SUMMARY.md` — FOUND
- commit `88257d7a` — FOUND

---
*Phase: 07-items-photos*
*Completed: 2026-06-13*
