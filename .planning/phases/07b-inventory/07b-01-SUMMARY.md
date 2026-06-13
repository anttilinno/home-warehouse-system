---
phase: 07b-inventory
plan: 01
subsystem: api
tags: [react, tanstack-query, typescript, msw, vitest, inventory, movements]

# Dependency graph
requires:
  - phase: 07-items
    provides: lib/api.ts helpers (get/post/patch, cookie-JWT), itemsApi/photosApi boundary pattern, MSW handler structure, StatusPill variant union
provides:
  - "inventoryApi typed boundary (list envelope + scoped bare-{items} + create/update/updateQuantity/updateStatus/move/archive/restore)"
  - "movementsApi typed boundary (workspace/byInventory/byLocation, all bare {items})"
  - "Inventory/InventoryListResponse/ExpiringEntry/Movement types + Condition/InventoryStatus unions in lib/types.ts"
  - "CONDITION_VARIANT/STATUS_VARIANT/CONDITION_LABEL/STATUS_LABEL + CONDITIONS/STATUSES ordered arrays"
  - "MSW handlers + fixtures for the full inventory + movement route set"
affects: [07b-inventory list page, create/move dialogs, inline-edit hooks, expiring page, movements panel, item-detail InventoryPanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bare-{items} unwrap (.then(r => r.items)) for scoped/movement reads vs full envelope for top-level list — the two shapes are structurally distinct by type (Pitfall 1)"
    - "Record<enum, ...> maps so a missing enum member is a compile error (no undefined pill lookups)"

key-files:
  created:
    - frontend2/src/lib/api/inventory.ts
    - frontend2/src/lib/api/movements.ts
    - frontend2/src/features/inventory/inventoryEnums.ts
  modified:
    - frontend2/src/lib/types.ts
    - frontend2/src/test/msw/handlers.ts

key-decisions:
  - "move() spreads {location_id, container_id} — JSON.stringify drops an undefined container_id, so the wire body never carries a quantity key (Pitfall 2)"
  - "MSW movements default to empty {items} so the empty-state is the default render (Pitfall 3); tests override via server.use()"
  - "StatusPillVariant imported from the StatusPill module path (no barrel export exists for the type)"

patterns-established:
  - "Pattern 1: typed API boundary mirrors itemsApi but with NO toProxyUrl (inventory/movement responses carry no absolute URLs)"
  - "Pattern 2: scoped reads typed get<{items: T[]}>(...).then(r => r.items) to make pagination-field access impossible"

requirements-completed: [INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08]

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 07b Plan 01: Inventory API Layer Summary

**Typed inventoryApi + movementsApi boundaries over lib/api.ts, the 7+7 Condition/InventoryStatus → StatusPill variant+label maps, new Inventory/Movement/ExpiringEntry types, and the full MSW route set — all unit-tested, with the bare-{items} vs full-envelope distinction enforced by types.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-13T09:47Z
- **Completed:** 2026-06-13T09:52Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified) + 3 test files

## Accomplishments
- `inventoryApi` exposes list (full envelope) / byItem (bare {items}) / expiring / create / update / updateQuantity / updateStatus / move / archive / restore with the exact URL shapes from 07b-RESEARCH.
- `movementsApi` exposes workspace / byInventory / byLocation, each unwrapping a bare {items} to `Movement[]`.
- All 7 conditions + 7 statuses map to a StatusPill variant and a Title-Case label; `Record<enum,...>` keys make a missing entry a compile error.
- MSW serves the complete inventory + movement route set; movements default to an empty list (empty-state default).

## Task Commits

Each task was committed atomically (TDD tasks: test→feat captured in a single commit per task here):

1. **Task 1: types + enum→pill maps** - `bca51f5a` (feat) — RED enum test then GREEN module
2. **Task 2: inventoryApi + movementsApi** - `34a5cbda` (feat) — 17 RED tests then GREEN modules
3. **Task 3: MSW handlers + fixtures** - `aa1d7b6b` (test)

## Files Created/Modified
- `frontend2/src/lib/api/inventory.ts` - typed inventory boundary (no toProxyUrl; bare-{items} unwrap for byItem)
- `frontend2/src/lib/api/movements.ts` - typed movements boundary, all three scopes unwrap bare {items}
- `frontend2/src/features/inventory/inventoryEnums.ts` - CONDITION/STATUS variant + label maps + ordered arrays
- `frontend2/src/lib/types.ts` - added Condition/InventoryStatus unions, Inventory, InventoryListResponse, ExpiringEntry, Movement
- `frontend2/src/test/msw/handlers.ts` - inventory + movement handlers + fixtures (specific routes before /inventory/:id catch-all)

## Decisions Made
- `move()` spreads `{ location_id, container_id }`; an undefined `container_id` is dropped by `JSON.stringify`, so the body never carries a quantity field (Pitfall 2 enforced + test-asserted).
- Imported `StatusPillVariant` from `@/components/retro/feedback/StatusPill` directly — the retro barrel does not re-export the type.
- MSW movement routes return empty `{ items: [] }` by default to make the empty-state the default (Pitfall 3).

## Deviations from Plan

None - plan executed exactly as written. (`bun install --frozen-lockfile` was run to populate the absent node_modules per the parallel-execution note; this is environment setup, not a package-manager add, and introduced zero new packages.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Downstream Wave 1+ plans (list page, create/move dialogs, inline-edit hooks, expiring page, movements panel, item-detail InventoryPanel) can import `inventoryApi`/`movementsApi`, the enum maps, and render against MSW without further exploration.
- No STATE.md / ROADMAP.md / vite.config.ts / backend changes were made (orchestrator owns those writes).

## Self-Check: PASSED

All 7 created/modified source+test files present; all 3 task commits (bca51f5a, 34a5cbda, aa1d7b6b) found in git log. Full vitest suite green (71 files / 500 tests), tsc clean, lint:imports clean, toProxyUrl grep gate = 0.

---
*Phase: 07b-inventory*
*Completed: 2026-06-13*
