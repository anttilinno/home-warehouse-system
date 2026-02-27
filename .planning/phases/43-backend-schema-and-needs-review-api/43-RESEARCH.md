# Phase 43: Backend Schema and Needs Review API - Research

**Researched:** 2026-02-27
**Domain:** PostgreSQL schema migration, Go domain entity extension, sqlc query generation, Huma REST API
**Confidence:** HIGH

## Summary

Phase 43 adds a single boolean column (`needs_review`) to the existing `warehouse.items` table and threads it through the full Go backend stack: migration, sqlc queries, domain entity, service layer, HTTP handler, and sync endpoint. This is a well-understood pattern that has been executed many times in this codebase (e.g., `is_insured`, `is_archived`, `lifetime_warranty` are all boolean columns on the same table with identical plumbing).

The scope is narrow and self-contained. There are no new dependencies, no new tables, and no new packages. Every layer that needs modification has clear precedent in the existing code. The only subtlety is ensuring the new field propagates to ALL places that serialize items: the item handler responses, the sync delta endpoint (`ItemSyncData`), and the import worker (which creates items via `item.CreateInput`).

**Primary recommendation:** Follow the exact pattern of existing boolean fields (`is_insured`, `is_archived`) across all layers. Add a new `ListItemsNeedingReview` sqlc query rather than parameterizing the existing `ListItems` query, to keep sqlc generation simple.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | Quick-captured items are flagged as "needs details" in the database | Migration adds `needs_review BOOLEAN DEFAULT false` to `warehouse.items`. Entity, service, handler, and repository all accept and persist the field. Create API accepts `needs_review: true`. |
| COMP-02 | User can filter item list to show only "needs details" items | New sqlc query `ListItemsNeedingReview` filters by `needs_review = true`. New handler endpoint or query parameter on existing list endpoint exposes this. |
| COMP-03 | User can mark an item as complete (remove "needs details" flag) | Existing PATCH `/items/{id}` endpoint accepts `needs_review: false` via `UpdateInput`. The `NeedsReview` field is added to `UpdateInput` and `UpdateItemParams`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go | 1.25 | Backend language | Project standard |
| sqlc | latest | SQL-to-Go code generation | Project standard for all queries |
| dbmate | latest | Database migrations | Project standard, `-- migrate:up/down` format |
| Huma v2 | latest | HTTP API framework | Project standard, all handlers use `huma.Get/Post/Patch` |
| pgx/v5 | latest | PostgreSQL driver | Project standard via sqlc config |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| testify | latest | Assertions + mock | Unit tests for handler and service |
| gofakeit | v7 | Test data generation | Factory `WithItemNeedsReview` option |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate `ListItemsNeedingReview` query | Parameterized `ListItems` with optional `needs_review` filter | Parameterized queries in sqlc require `sqlc.narg()` or CASE/COALESCE tricks; separate query is simpler and matches the existing `ListItemsByCategory` pattern |
| `needs_review` column on items | Separate `item_flags` table | Over-engineering for a single boolean; the column approach matches `is_insured`, `is_archived`, `lifetime_warranty` precedent |

**Installation:**
```bash
# No new packages needed. All tools already installed.
```

## Architecture Patterns

### Recommended Change Map
```
backend/
  db/migrations/
    002_add_needs_review.sql           # NEW: dbmate migration
  db/queries/
    items.sql                          # MODIFY: Add needs_review to Create/Update, add filter query
  internal/infra/queries/              # REGENERATED: sqlc generate
  internal/domain/warehouse/item/
    entity.go                          # MODIFY: Add needsReview field + getter + setter
    service.go                         # MODIFY: Add NeedsReview to CreateInput/UpdateInput
    handler.go                         # MODIFY: Add to request/response types, add filter param
    repository.go                      # MODIFY: Add FindNeedingReview to interface
  internal/infra/postgres/
    item_repository.go                 # MODIFY: Implement FindNeedingReview, update Save/rowToItem
  internal/domain/sync/
    types.go                           # MODIFY: Add NeedsReview to ItemSyncData
    service.go                         # MODIFY: Add needs_review to mapItems
  internal/testutil/factory/
    item.go                            # MODIFY: Add WithItemNeedsReview option
  internal/domain/warehouse/item/
    handler_test.go                    # MODIFY: Update mock, add tests for filter + field
    service_test.go                    # MODIFY: Add tests for NeedsReview field
    entity_test.go                     # MODIFY: Add tests for SetNeedsReview
```

### Pattern 1: Boolean Column Addition (established pattern)
**What:** Add a boolean column with default value, thread through all layers
**When to use:** Every time a new boolean flag is added to an entity
**Example:**
```go
// entity.go - Follow is_insured/is_archived pattern exactly
type Item struct {
    // ... existing fields ...
    needsReview *bool
}

func NewItem(workspaceID uuid.UUID, name, sku string, minStockLevel int) (*Item, error) {
    falseVal := false
    return &Item{
        // ... existing defaults ...
        needsReview: &falseVal,
    }, nil
}

func (i *Item) NeedsReview() *bool { return i.needsReview }

func (i *Item) SetNeedsReview(v bool) {
    i.needsReview = &v
    i.updatedAt = time.Now()
}
```

### Pattern 2: sqlc Query for Filtered List (established pattern)
**What:** Separate named query for filtered list, matching `ListItemsByCategory` pattern
**When to use:** When adding a new filter dimension to an entity list
**Example:**
```sql
-- name: ListItemsNeedingReview :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1 AND needs_review = true AND is_archived = false
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3;

-- name: CountItemsNeedingReview :one
SELECT COUNT(*) FROM warehouse.items
WHERE workspace_id = $1 AND needs_review = true AND is_archived = false;
```

### Pattern 3: Handler Query Parameter Filter (established pattern)
**What:** Add optional query parameter to list endpoint for filtering
**When to use:** When the list endpoint needs a new filter dimension
**Example:**
```go
type ListItemsInput struct {
    Page        int  `query:"page" default:"1" minimum:"1"`
    Limit       int  `query:"limit" default:"50" minimum:"1" maximum:"100"`
    NeedsReview *bool `query:"needs_review,omitempty" doc:"Filter by needs_review status"`
}
```

### Anti-Patterns to Avoid
- **Skipping the Reconstruct function:** The `Reconstruct` function is the only way to hydrate an `Item` from database rows. Missing `needsReview` there means all reads return nil for the field.
- **Forgetting the sync endpoint:** The `mapItems` function in `sync/service.go` manually maps every field. Missing `needs_review` there means the PWA offline cache never gets the field value.
- **Not updating the import worker:** The import worker in `internal/worker/import_worker.go` calls `item.CreateInput` directly. While imported items should default to `needs_review: false` (the column default), the `CreateInput` struct must still include the field or it won't compile if the field is required.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL query generation | Hand-written Go SQL mapping | `sqlc generate` | sqlc handles type mapping, null handling, pgx/v5 integration automatically |
| Migration versioning | Manual schema changes | dbmate with `-- migrate:up/down` format | dbmate tracks applied migrations, supports rollback |
| Request validation | Manual input validation | Huma struct tags (`query`, `default`, `minimum`) | Huma validates and documents automatically |

**Key insight:** sqlc is the single source of truth for database-to-Go type mapping. After changing the SQL schema and queries, `sqlc generate` regenerates the `queries` package. All repository code uses the generated types.

## Common Pitfalls

### Pitfall 1: Forgetting to Regenerate sqlc After Migration
**What goes wrong:** Schema migration adds column, queries reference it, but `sqlc generate` is not run. Build fails with missing field errors.
**Why it happens:** The sqlc generation step is manual and easy to forget.
**How to avoid:** Run `sqlc generate` immediately after modifying any `.sql` file in `db/queries/` or `db/migrations/`.
**Warning signs:** Compile errors referencing `queries.WarehouseItem` fields.

### Pitfall 2: Inconsistent Null Handling for Boolean
**What goes wrong:** Using `*bool` in some places and `bool` in others, leading to nil pointer dereferences or wrong defaults.
**Why it happens:** The existing codebase uses `*bool` for optional booleans in the entity (to distinguish "not set" from "false").
**How to avoid:** Follow the exact `is_insured` pattern: `*bool` in entity, `*bool` in handler request/response, `DEFAULT false` in SQL. The sqlc config with `emit_pointers_for_null_types: true` handles the mapping.
**Warning signs:** Nil pointer panics when accessing the field, or items always showing `needs_review: null` in API responses.

### Pitfall 3: Missing Field in Save (Upsert) Path
**What goes wrong:** The `Save` method in `item_repository.go` has separate paths for create vs update. If `needs_review` is added to `CreateItem` params but not `UpdateItem` params (or vice versa), updates silently drop the field.
**Why it happens:** The `Save` method checks for existing records and branches. Both branches must include the new field.
**How to avoid:** Update BOTH `CreateItem` and `UpdateItem` sqlc queries, and both corresponding param mappings in `Save`.
**Warning signs:** Field persists on create but resets on update, or vice versa.

### Pitfall 4: Forgetting CountItemsNeedingReview for Pagination
**What goes wrong:** The list endpoint returns items but total count is wrong because it uses the unfiltered count.
**Why it happens:** The existing `FindByWorkspace` returns total count from `len(rows)` which is already wrong (capped by LIMIT). The `ListItemsNeedingReview` query needs its own count query.
**How to avoid:** Add a `CountItemsNeedingReview` query and use it in the repository method. Note: the existing `FindByWorkspace` has this same bug (returns `len(items)` as total, not a real COUNT). Don't replicate it.
**Warning signs:** Pagination shows wrong total pages.

## Code Examples

Verified patterns from the existing codebase:

### Migration File (dbmate format)
```sql
-- migrate:up
ALTER TABLE warehouse.items ADD COLUMN needs_review boolean DEFAULT false;

-- migrate:down
ALTER TABLE warehouse.items DROP COLUMN needs_review;
```

### sqlc Query: CreateItem with needs_review
```sql
-- name: CreateItem :one
INSERT INTO warehouse.items (
    id, workspace_id, sku, name, description, category_id, brand, model,
    image_url, serial_number, manufacturer, barcode, is_insured,
    lifetime_warranty, warranty_details, purchased_from, min_stock_level,
    short_code, obsidian_vault_path, obsidian_note_path, needs_review
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
RETURNING *;
```

### sqlc Query: UpdateItem with needs_review
```sql
-- name: UpdateItem :one
UPDATE warehouse.items
SET name = $2, description = $3, category_id = $4, brand = $5, model = $6,
    image_url = $7, serial_number = $8, manufacturer = $9, barcode = $10,
    is_insured = $11, lifetime_warranty = $12, warranty_details = $13,
    purchased_from = $14, min_stock_level = $15, obsidian_vault_path = $16,
    obsidian_note_path = $17, needs_review = $18, updated_at = now()
WHERE id = $1
RETURNING *;
```

### Entity Reconstruct (add needsReview parameter)
```go
func Reconstruct(
    id, workspaceID uuid.UUID,
    sku string,
    name string,
    description *string,
    categoryID *uuid.UUID,
    brand, model, imageURL, serialNumber, manufacturer, barcode *string,
    isInsured, isArchived, lifetimeWarranty *bool,
    warrantyDetails *string,
    purchasedFrom *uuid.UUID,
    minStockLevel int,
    shortCode string,
    obsidianVaultPath, obsidianNotePath *string,
    needsReview *bool,
    createdAt, updatedAt time.Time,
) *Item {
    return &Item{
        // ... all existing fields ...
        needsReview: needsReview,
    }
}
```

### Repository rowToItem Update
```go
func (r *ItemRepository) rowToItem(row queries.WarehouseItem) *item.Item {
    // ... existing categoryID/purchasedFrom pgtype handling ...
    return item.Reconstruct(
        // ... all existing params ...
        row.NeedsReview,       // new field from sqlc-generated struct
        row.CreatedAt.Time,
        row.UpdatedAt.Time,
    )
}
```

### Handler Filter Logic
```go
// In the List handler:
if input.NeedsReview != nil && *input.NeedsReview {
    items, total, err = svc.ListNeedingReview(ctx, workspaceID, pagination)
} else {
    items, total, err = svc.List(ctx, workspaceID, pagination)
}
```

### Sync Types Update
```go
type ItemSyncData struct {
    // ... existing fields ...
    NeedsReview  bool      `json:"needs_review"`
    IsArchived   bool      `json:"is_archived"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

// In mapItems:
result[i] = ItemSyncData{
    // ... existing fields ...
    NeedsReview:  boolPtrToBool(item.NeedsReview),
    // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | N/A | N/A | This is a straightforward column addition with no paradigm shift |

**Deprecated/outdated:** Nothing. The project's stack (Go 1.25, sqlc, dbmate, Huma v2, pgx/v5) is current.

## Open Questions

1. **Should `needs_review` filter be a query parameter on existing `/items` or a separate endpoint?**
   - What we know: The existing codebase has both patterns -- `ListItems` with pagination params AND `ListItemsByCategory` as a separate path `/items/by-category/{id}`.
   - What's unclear: Which pattern the frontend will prefer for the filter chip in Phase 47.
   - Recommendation: Use a query parameter (`?needs_review=true`) on the existing `/items` endpoint. This is more flexible for the frontend and avoids a new route. The separate query approach is used when there's a path parameter (category ID), but `needs_review` is a simple boolean filter that belongs as a query param.

2. **Should the import worker set `needs_review` for imported items with missing fields?**
   - What we know: REQUIREMENTS.md lists `IMP-01` as a future requirement: "CSV-imported items with missing fields flagged as needs details."
   - What's unclear: Whether to implement this in Phase 43 or defer.
   - Recommendation: Defer. `IMP-01` is explicitly listed under "Future Requirements" and is not mapped to any v1.9 phase. In Phase 43, the import worker should pass `nil` for `NeedsReview` in `CreateInput` (letting the column default to `false`), and `IMP-01` can be trivially added later by setting it to `true` when required fields are missing.

## Comprehensive Touch Points

All files that serialize, deserialize, or process `warehouse.items` data and must include `needs_review`:

| File | What to Change | Priority |
|------|---------------|----------|
| `db/migrations/002_add_needs_review.sql` | New migration file | Required |
| `db/queries/items.sql` | Add to CreateItem, UpdateItem, add ListItemsNeedingReview + CountItemsNeedingReview | Required |
| `internal/infra/queries/*` (regenerated) | Run `sqlc generate` | Required |
| `internal/domain/warehouse/item/entity.go` | Add field, getter, setter, to NewItem, Reconstruct, Update | Required |
| `internal/domain/warehouse/item/service.go` | Add to CreateInput, UpdateInput, ListNeedingReview method | Required |
| `internal/domain/warehouse/item/handler.go` | Add to request/response types, filter logic, toItemResponse | Required |
| `internal/domain/warehouse/item/repository.go` | Add FindNeedingReview to interface | Required |
| `internal/infra/postgres/item_repository.go` | Update Save (both branches), rowToItem, implement FindNeedingReview | Required |
| `internal/domain/sync/types.go` | Add NeedsReview to ItemSyncData | Required |
| `internal/domain/sync/service.go` | Add to mapItems function | Required |
| `internal/testutil/factory/item.go` | Add WithItemNeedsReview factory option | Required |
| `internal/domain/warehouse/item/handler_test.go` | Update MockService, add filter test | Required |
| `internal/domain/warehouse/item/service_test.go` | Test NeedsReview in create/update | Required |
| `internal/domain/warehouse/item/entity_test.go` | Test SetNeedsReview, Update with NeedsReview | Required |
| `db/schema.sql` | Regenerated by dbmate after migration | Auto |
| `internal/worker/import_worker.go` | Compiles fine if NeedsReview is `*bool` (nil = column default false) | Verify only |
| `internal/domain/importexport/workspace_backup.go` | Uses raw SQL queries, not item entity | Verify only |

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/internal/domain/warehouse/item/` (entity, service, handler, repository)
- Codebase analysis: `backend/db/queries/items.sql` (existing sqlc queries)
- Codebase analysis: `backend/db/migrations/001_initial_schema.sql` (dbmate format, schema structure)
- Codebase analysis: `backend/internal/infra/postgres/item_repository.go` (repository pattern, rowToItem mapping)
- Codebase analysis: `backend/internal/domain/sync/` (types.go, service.go -- sync data mapping)
- Codebase analysis: `backend/sqlc.yaml` (sqlc configuration with pgx/v5, emit_pointers_for_null_types)
- Codebase analysis: `.mise.toml` (dbmate migration commands)
- Project research: `.planning/research/ARCHITECTURE.md` (needs_review architecture decisions from v1.9 research)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` -- Decision: "needs_review is a simple boolean column with default false"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing tools
- Architecture: HIGH - exact pattern exists for every change (is_insured, is_archived precedent)
- Pitfalls: HIGH - all pitfalls identified from direct codebase analysis of existing patterns

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (stable domain, no external dependency risk)
