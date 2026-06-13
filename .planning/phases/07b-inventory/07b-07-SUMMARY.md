---
phase: 07b
plan: 07b-07
subsystem: frontend2/inventory
tags: [gap-closure, inventory, react-query, bugfix]
requires:
  - frontend2/src/features/inventory/InventoryListPage.tsx (07b-02)
  - backend item-list endpoint cap (maximum:"100")
provides:
  - Inventory list Item column renders joined item names (INV-01 restored)
affects:
  - frontend2 /inventory list surface
tech-stack:
  added: []
  patterns:
    - "Join-query page size must respect the backend's list-limit cap"
key-files:
  created: []
  modified:
    - frontend2/src/features/inventory/InventoryListPage.tsx
    - frontend2/src/features/inventory/InventoryListPage.test.tsx
    - .planning/phases/07b-inventory/deferred-items.md
decisions:
  - "Clamp the item-name join to limit=100 (the backend cap) rather than paginating the join now — seeded ~45/49 items fit under the cap, so v3.0 parity is fully resolved; the >100-item case stays deferred."
metrics:
  duration: ~10m
  completed: 2026-06-13
  tasks: 1
  files: 3
---

# Phase 07b Plan 07: Inventory Item-Name Join Limit Clamp Summary

Clamped the `/inventory` item-name join query from `limit: 200` to `limit: 100` so it no longer 422s against the backend item-list cap (`maximum:"100"`); the Item column now renders joined names for every row instead of a muted "—", restoring INV-01.

## What Changed

D-07b-A: `InventoryListPage` resolves item names via a side query keyed `["items", wsId, {limit:200, page:1}]`. The backend `ListItems` handler enforces `limit maximum:"100"` (`backend/internal/domain/warehouse/item/handler.go:685`), so the over-cap request returned **422**, the join never resolved, and `itemName()` returned `undefined` for every entry — rendering `—` in the Item column across all rows and workspaces.

The fix changes both the React Query `queryKey` and the `queryFn` call to `limit: 100`, with an inline comment documenting the cap dependency and the residual >100-item limitation.

## Verification

- **Unit/component tests:** `bun run test src/features/inventory/` → 11 files, **72 tests pass**, including a new regression test ("the item-name join requests limit ≤ 100") that captures the actual outgoing request `limit` param via an MSW handler and asserts `≤ 100`. The prior `seedItems` catch-all ignored query params and could not have caught this — the new test reads the real URL.
- **Types:** `bun run lint:tsc` → clean (`tsc -b --noEmit`).
- **Build:** `bun run build` → built in 724ms (the >500kB chunk-size warning is pre-existing and unrelated).
- **Live smoke (seeder@test.local):** logged in via the vite `/api` proxy, then hit the real items endpoint for the seeded workspace:
  - `GET …/items?limit=200&page=1` → **422** (reproduces the bug)
  - `GET …/items?limit=100&page=1` → **200**, `"total":49` (fix resolves; 49 < 100 cap so every name resolves for parity)

## Deviations from Plan

None — plan executed exactly as written. (Task 3's optional "update existing limit assertion" was a no-op: no existing test asserted the limit value, so a new guarding test was added instead, as the plan's fallback specified.)

## Known Stubs

None introduced. The Location column in this list already renders a static `—` (no list endpoint this phase, R7 — pre-existing and out of scope for D-07b-A).

## Residual / Deferred

The join now fetches only the **first 100 items by name**. A workspace with >100 items will still show `—` for entries whose owning item falls beyond that page. Proper fix (batch per-id name resolution or a backend items-by-ids endpoint) remains deferred — see `.planning/phases/07b-inventory/deferred-items.md`. Not a v3.0 parity blocker (49 seeded items < cap).

## Self-Check: PASSED
- FOUND: frontend2/src/features/inventory/InventoryListPage.tsx (modified, limit=100)
- FOUND: frontend2/src/features/inventory/InventoryListPage.test.tsx (modified, regression test)
- FOUND: .planning/phases/07b-inventory/deferred-items.md (modified, residual note)
- FOUND commit: c45a4369
