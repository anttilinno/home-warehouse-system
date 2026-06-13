# Phase 07b — Deferred Items

## [07b-06] InventoryListPage item-name join requests limit=200 but backend caps item-list limit at 100
- **Found during:** 07b-06 Task 1 (live E2E first run)
- **Symptom:** The /inventory list joins item names via `["items", wsId, {limit:200, page:1}]`; the backend `ListItems` endpoint enforces `limit maximum:"100"`, so the over-limit request does not resolve and the Item column renders a muted `—` for entries whose item is not otherwise cached.
- **Scope:** Out of scope for the E2E plan (which only needed a reliable row locator). Not fixed. Tracked for a future InventoryListPage fix (clamp the join limit to ≤100, or paginate the join).
- **File:** frontend2/src/features/inventory/InventoryListPage.tsx (itemsQuery queryFn `itemsApi.list(wsId, { limit: 200, page: 1 })`)
