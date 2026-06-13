# Phase 07b — Deferred Items

## [07b-06] InventoryListPage item-name join requests limit=200 but backend caps item-list limit at 100
- **Found during:** 07b-06 Task 1 (live E2E first run)
- **Symptom:** The /inventory list joins item names via `["items", wsId, {limit:200, page:1}]`; the backend `ListItems` endpoint enforces `limit maximum:"100"`, so the over-limit request does not resolve and the Item column renders a muted `—` for entries whose item is not otherwise cached.
- **Scope:** Out of scope for the E2E plan (which only needed a reliable row locator). Not fixed. Tracked for a future InventoryListPage fix (clamp the join limit to ≤100, or paginate the join).
- **File:** frontend2/src/features/inventory/InventoryListPage.tsx (itemsQuery queryFn `itemsApi.list(wsId, { limit: 200, page: 1 })`)
- **Status (07b-07):** CLAMPED to `limit: 100` (D-07b-A gap closure). The over-cap
  422 is resolved and item names now render. A regression test in
  `InventoryListPage.test.tsx` asserts the join request uses `limit ≤ 100`.
- **Residual (still deferred — post-parity or when item counts grow):** the join
  now fetches only the FIRST 100 items by name; a workspace with >100 items will
  still show "—" for items whose owning item falls beyond that first page. The
  proper fix is batch per-id name resolution or a backend items-by-ids endpoint.
  For v3.0 parity (seeded ~45 items) `limit=100` resolves every name, so this is
  not a parity blocker.
