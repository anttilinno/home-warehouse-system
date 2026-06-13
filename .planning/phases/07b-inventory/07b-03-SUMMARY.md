---
phase: 07b-inventory
plan: 03
subsystem: inventory
tags: [react, react-hook-form, zod, tanstack-query, msw, vitest, inventory, move]

# Dependency graph
requires:
  - phase: 07b-inventory
    plan: 01
    provides: "inventoryApi (create/update/move) + Inventory type + CONDITIONS/STATUSES + *_LABEL maps + MSW inventory routes"
  - phase: 07-items
    provides: "ItemFormPage / schema / useItemFormMutations RHF+zod+dirty-PATCH pattern to mirror; RetroSelect/RetroDialog/RetroConfirmDialog atoms"
provides:
  - "inventoryFormSchema (zod create/edit incl. quantity>=1 + expiry>=acquired refinement) + InventoryFormValues/Input types"
  - "useInventoryFormMutations (buildCreateBody with status+RFC3339 dates; buildPatchBody never-status, location+qty+condition bundle)"
  - "usePickerOptions ({id,label}[] for items/locations/containers at limit=100)"
  - "InventoryFormPage (create + edit one page; Status create-only; ?item= prefill+lock; empty-picker disable+hint; dirty-guard)"
  - "MoveDialog (whole-entry relocate, location-only body, dual inventory+movements invalidation)"
affects: [07b-04 route registration (/inventory/new + /:id/edit), 07b list-page MOVE/EDIT row actions, item-detail INV-08 panel move action]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-entry inventory GET fetched via generic get<Inventory> in the page (not inventoryApi.get) to stay disjoint from Plan 01's owned lib/api/inventory.ts during parallel execution"
    - "Picker MSW routes (/locations, /containers, /items override) registered per-test via server.use() — shared handlers.ts left untouched to avoid a merge conflict with the parallel Plan 02"
    - "Full-PATCH bundle: location_id+quantity+condition emitted together when ANY is dirty (backend requires the whole bundle); status NEVER emitted (dedicated /status route — Pitfall 6)"

key-files:
  created:
    - frontend2/src/features/inventory/schema.ts
    - frontend2/src/features/inventory/schema.test.ts
    - frontend2/src/features/inventory/hooks/useInventoryFormMutations.ts
    - frontend2/src/features/inventory/hooks/useInventoryFormMutations.test.tsx
    - frontend2/src/features/inventory/hooks/usePickerOptions.ts
    - frontend2/src/features/inventory/InventoryFormPage.tsx
    - frontend2/src/features/inventory/InventoryFormPage.test.tsx
    - frontend2/src/features/inventory/components/MoveDialog.tsx
    - frontend2/src/features/inventory/components/MoveDialog.test.tsx
  modified: []

key-decisions:
  - "Edit-mode entry load uses get<Inventory>(/workspaces/{wsId}/inventory/{id}) directly (the plan-sanctioned disjoint path) since inventoryApi exposes no single-entry get and its module is owned by Plan 01's wave"
  - "Date refinement uses lexical >= compare on zero-padded YYYY-MM-DD (safe) and attaches the error to expiration_date so the field flips to the danger treatment"
  - "MoveDialog receives location/container options as props (caller passes usePickerOptions output) rather than calling the hook itself — keeps the dialog cache-agnostic and testable with plain option arrays"

patterns-established:
  - "buildCreateBody / buildPatchBody mirror the item-form dirty-fields builder but add the RFC3339 toRfc3339 date serializer and the never-status / required-bundle rules"

requirements-completed: [INV-02, INV-03, INV-04]

# Metrics
duration: ~10min
completed: 2026-06-13
---

# Phase 07b Plan 03: Create/Edit Entry Form + Whole-Entry MoveDialog Summary

**The inventory authoring surfaces: a single RHF+zod create/edit form (Status create-only, RFC3339 date serialization, expiry>=acquired refinement, empty-picker disable+hint, dirty-form discard guard) plus a whole-entry blue MoveDialog that posts a location-only body and manually invalidates both the inventory and movements caches.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 3 (all TDD: RED test → GREEN impl per task)
- **Files:** 9 created (5 source + 4 test), 0 modified

## Accomplishments
- `inventoryFormSchema` validates required item/location/condition/status, coerces quantity to a whole number >= 1, and rejects an expiry earlier than the acquired date with the spec copy attached to the expiry field.
- `useInventoryFormMutations` builds a create body that carries `status` + RFC3339-serialized dates (empty optionals omitted — no zero-injection), and a PATCH body that NEVER carries `status`, bundles `location_id+quantity+condition`, and serializes only dirty dates. Both mutations invalidate the `["inventory", wsId]` prefix; update also nukes the explicit detail key.
- `usePickerOptions` fetches items/locations/containers once at `limit=100` and maps each to `{ id, label }[]` (items append the SKU).
- `InventoryFormPage` renders ADD ENTRY / EDIT ENTRY in a blue Window, shows Status only on create, prefills+locks the item from `?item=`, disables an empty picker with the add-one-first hint, surfaces required-field errors in-window, guards a dirty form with the butter DISCARD CHANGES? confirm, and navigates to `/items/{item_id}` on success.
- `MoveDialog` (blue titlebar) shows the current-placement context line, blocks a no-op move, posts `{location_id, container_id?}` with no quantity key, invalidates BOTH `["inventory", wsId]` and `["movements", wsId]` on success, and keeps the dialog open with an error banner + toast on failure.

## Task Commits

1. **Task 1: schema + mutations + picker hooks** — `77449761` (feat)
2. **Task 2: InventoryFormPage create/edit** — `268ccad5` (feat)
3. **Task 3: MoveDialog whole-entry relocate** — `b38a6eca` (feat)

## Deviations from Plan

None of substance. Two plan-sanctioned choices were exercised:
- **Single-entry get** in edit mode goes through the generic `get<Inventory>` boundary rather than `inventoryApi.get` (which does not exist), exactly as the plan's `<action>` directed, to avoid touching Plan-01-owned `lib/api/inventory.ts`.
- **Picker MSW routes** (`/locations`, `/containers`, `/items` override) are registered per-test via `server.use()` rather than added to the shared `src/test/msw/handlers.ts`. `handlers.ts` is not in this plan's `files_modified`, is owned by Plan 01's wave, and is at risk of a conflict with the concurrent Plan 02 — keeping the picker mocks test-local preserves disjointness.

(`bun install --frozen-lockfile` was run to populate the absent `node_modules` per the parallel-execution note — environment setup, zero new packages.)

## Issues Encountered
- Two MoveDialog test assertions initially over-matched: the current-location label appears both in the context line and as a `<select>` option, and the error copy appears in both the in-dialog banner and the toast. Tightened to a scoped `toHaveTextContent` on the context paragraph and a `findAllByText` length check on the error copy. Component behavior was correct throughout.

## Known Stubs
None. All three pickers are wired to real read endpoints; the form and dialog submit real bodies. (The container list is the full workspace list — location-scoped container filtering was flagged as optional in UI-SPEC §4 and is not required this phase.)

## Threat Flags
None. No new network surface beyond the three picker reads (which the backend scopes to the workspace) and the create/update/move writes already typed by Plan 01. Threat register dispositions T-07b-06/07/08 are satisfied: zod validates quantity>=1 + expiry>=acquired client-side, the move body is location-only by design, and target ids come exclusively from workspace-scoped picker lists (the backend re-validates cross-tenant).

## Next Phase Readiness
- Plan 04 can register the `/inventory/new` and `/inventory/:id/edit` routes pointing at `InventoryFormPage` (no further wiring needed — the page reads `useParams().id` and `?item=` itself).
- The list page (Plan 02) and the item-detail INV-08 panel can mount `MoveDialog` by passing the entry + `usePickerOptions()` location/container arrays through the modal stack.
- No STATE.md / ROADMAP.md / vite.config.ts / api.ts / backend changes were made (orchestrator owns those writes).

## Self-Check: PASSED

All 9 created files present on disk; all 3 task commits (77449761, 268ccad5, b38a6eca) found in git log. Full vitest suite green (75 files / 530 tests), `tsc -b --noEmit` clean, `lint:imports` clean, MoveDialog quantity grep gate = 0 (only comment-doc references).

---
*Phase: 07b-inventory*
*Completed: 2026-06-13*
