# Phase 14 Plan 02: Declutter Domain & API Summary

**Completed:** 2026-01-25
**Duration:** ~8 minutes
**Status:** Complete

## One-liner

Created declutter domain with entity, service, repository, and HTTP handlers for listing unused items, getting counts, and marking items as used.

## What Was Built

### Domain Entity (entity.go)
- `DeclutterItem` type with enriched fields from joins (item_name, location_name, category_name)
- `DeclutterCounts` for 90/180/365 day threshold summaries with value totals
- `ListParams` with pagination helpers (Offset, Limit)
- `CalculateScore` function combining age factor (0-100) and value factor (0-50)
- `GroupBy` enum supporting category, location, or none

### Repository Layer
- Interface with FindUnused, CountUnused, GetCounts, GetMaxValue, MarkUsed methods
- PostgreSQL implementation using generated sqlc queries
- Proper NULL handling for ContainerID, CategoryID, Condition, Status fields

### Service Layer
- `ListUnused` fetches items, gets max value, calculates scores for each item
- `GetCounts` returns summary counts at all thresholds
- `MarkUsed` updates last_used_at timestamp

### HTTP Handlers
- `GET /workspaces/{id}/declutter` - List unused items with pagination, threshold, grouping
- `GET /workspaces/{id}/declutter/counts` - Summary counts for 90/180/365 days
- `POST /workspaces/{id}/inventory/{id}/mark-used` - Mark item as recently used
- SSE event broadcasting for real-time updates

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 58e3947 | feat | create declutter domain entity and types |
| 1c548c8 | feat | add declutter repository interface and PostgreSQL implementation |
| 7c37bdb | feat | create declutter service and HTTP handlers |

## Files Changed

### Created
- `backend/internal/domain/warehouse/declutter/entity.go`
- `backend/internal/domain/warehouse/declutter/repository.go`
- `backend/internal/domain/warehouse/declutter/service.go`
- `backend/internal/domain/warehouse/declutter/handler.go`
- `backend/internal/infra/postgres/declutter_repository.go`

### Modified
- `backend/internal/api/router.go` - Added declutter import, repo, service, and route registration

## Verification Results

- [x] `go build ./cmd/server/main.go` compiles without errors
- [x] `mise run test-unit` passes without regressions
- [x] Routes registered: `declutter.RegisterRoutes` found in router.go
- [x] Service calculates scores using CalculateScore function

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

1. **Score Calculation**: The declutter score is calculated server-side to ensure consistency. Formula combines age (days_unused / threshold * 100, capped at 100) with inverse value percentile (lower value = higher score, 0-50 range). Total score ranges from 0-150.

2. **CGO Build Note**: Production build with `CGO_ENABLED=0` has a webp library issue (unrelated to this change). Development builds with CGO enabled work fine.

3. **Nullable Fields**: Used pgtype.UUID.Bytes pattern for nullable UUID fields (ContainerID, CategoryID) matching existing codebase conventions.

4. **SSE Events**: Mark-used action broadcasts `inventory.marked_used` event for real-time UI updates.

## Dependencies Provided

For Plan 14-03 (Frontend):
- API endpoints ready: GET /declutter, GET /declutter/counts, POST /inventory/{id}/mark-used
- Response types include score field for sorting/display
- GroupBy parameter supports category and location grouping
