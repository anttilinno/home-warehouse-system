# Phase 14 Plan 01: Database Schema for Declutter Feature Summary

**Completed:** 2026-01-25
**Duration:** ~3 minutes
**Status:** Complete

## One-liner

Added last_used_at column to inventory table with partial index and sqlc queries for declutter feature.

## What Was Built

### Database Schema Changes
- Added `last_used_at TIMESTAMPTZ` column to `warehouse.inventory` table
- Existing records backfilled with `created_at` as conservative default
- Created partial index `ix_inventory_last_used` on `(workspace_id, last_used_at)` filtered by `is_archived = false`

### sqlc Queries (backend/db/queries/declutter.sql)
1. **ListUnusedInventory** - Query unused items with category/location grouping support, includes JOINs for item name, SKU, location, category
2. **CountUnusedInventory** - Pagination count for unused items by threshold
3. **MarkInventoryUsed** - Atomically update last_used_at to current time
4. **GetUnusedInventoryCounts** - Summary counts for 90/180/365 day thresholds with value totals
5. **GetMaxInventoryValue** - Max purchase price for percentile calculation

## Commits

| Hash | Type | Description |
|------|------|-------------|
| fe0767d | feat | add last_used_at column to inventory table |
| a9b2edd | feat | add sqlc queries for declutter operations |

## Files Changed

### Created
- `backend/db/migrations/006_declutter_last_used.sql` - Migration adding column and index
- `backend/db/queries/declutter.sql` - sqlc query definitions
- `backend/internal/infra/queries/declutter.sql.go` - Generated Go query code

## Verification Results

- [x] Migration 006 applied successfully (in schema_migrations)
- [x] last_used_at column exists with TIMESTAMPTZ type
- [x] Partial index ix_inventory_last_used created
- [x] sqlc generated all 5 query methods
- [x] Go compiles without errors
- [x] All unit tests pass (no regressions)

## Deviations from Plan

None - plan executed exactly as written.

## Dependencies Provided

For Plan 14-02 (Domain Layer):
- `ListUnusedInventoryParams` and `ListUnusedInventoryRow` types available
- `MarkInventoryUsed` returns full `WarehouseInventory` row
- `GetUnusedInventoryCountsRow` provides threshold summary data

## Technical Notes

1. **Index Strategy**: Partial index on `(workspace_id, last_used_at)` where `is_archived = false` optimizes the common query pattern of listing non-archived unused items per workspace.

2. **COALESCE Pattern**: Queries use `COALESCE(inv.last_used_at, inv.created_at)` to handle NULL gracefully - though migration backfills all existing records, future code paths could still result in NULL.

3. **GroupBy Implementation**: Uses CASE expressions in ORDER BY to enable dynamic grouping without separate queries.

4. **CGO Note**: Production build with `CGO_ENABLED=0` has a webp library issue (unrelated to this change). Development builds with CGO enabled work fine.
