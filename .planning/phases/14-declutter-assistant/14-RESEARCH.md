# Phase 14: Declutter Assistant - Research

**Researched:** 2026-01-25
**Domain:** Inventory usage tracking, analytics, and reporting
**Confidence:** HIGH

## Summary

The Declutter Assistant feature helps users identify and act on unused inventory items to reduce clutter. This requires:

1. **Usage tracking** - A new `last_used_at` timestamp on inventory records to track when items were last "used"
2. **Declutter scoring** - An algorithm combining days since last use with item value to prioritize declutter candidates
3. **Single-click usage marking** - API endpoint and UI to mark items as "used" with one action
4. **Grouping and filtering** - Server-side queries to group unused items by category or location
5. **CSV export** - Leverage existing export infrastructure for declutter lists
6. **Progress tracking** - Track items that have been "decluttered" (disposed/archived) over time

The existing codebase provides strong foundations: analytics service patterns, CSV export utilities, and a well-structured inventory domain. The main work is adding the `last_used_at` field, creating declutter-specific queries, and building a new dashboard page.

**Primary recommendation:** Add `last_used_at` column to `warehouse.inventory` table, create a new `declutter` domain package following existing patterns (repair_logs, analytics), and build a dedicated `/dashboard/declutter` page using existing filter/export components.

## Standard Stack

The established libraries/tools for this domain:

### Core (existing in codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chi router | v5 | HTTP routing | Already used throughout backend |
| sqlc | latest | Type-safe SQL queries | Existing pattern, generates Go code |
| pgx/v5 | v5.x | PostgreSQL driver | Already used, connection pooling |
| dbmate | latest | Migrations | Existing pattern for schema changes |
| next-intl | latest | i18n for frontend | Already used for translations |
| date-fns | latest | Date formatting | Already used in frontend |
| lucide-react | latest | Icons | Already used throughout UI |
| shadcn/ui | latest | UI components | ExportDialog, FilterPopover already exist |

### Supporting (already in project)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| tanstack/react-virtual | Virtual scrolling | Large declutter lists |
| sonner | Toast notifications | Success/error feedback |
| recharts (if needed) | Charts | Progress visualization |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side grouping | Client-side grouping | Server-side better for large datasets, consistent with analytics patterns |
| New status enum | `last_used_at` timestamp | Timestamp more flexible for configurable thresholds |
| Separate declutter table | Metadata on inventory | Using inventory directly simpler, avoids sync issues |

**Installation:**
No new dependencies needed - all required libraries already in project.

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── db/
│   ├── migrations/
│   │   └── 006_declutter_last_used.sql  # Add last_used_at column
│   └── queries/
│       └── declutter.sql                 # Declutter-specific queries
├── internal/
│   └── domain/
│       └── declutter/
│           ├── entity.go                 # DeclutterItem, DeclutterScore types
│           ├── service.go                # Business logic for scoring, marking used
│           ├── repository.go             # Repository interface
│           └── handler.go                # HTTP handlers
└── internal/infra/postgres/
    └── declutter_repository.go           # PostgreSQL implementation

frontend/
├── app/[locale]/(dashboard)/dashboard/declutter/
│   └── page.tsx                          # Declutter assistant page
├── lib/
│   ├── api/
│   │   └── declutter.ts                  # API client
│   └── types/
│       └── declutter.ts                  # TypeScript types
└── components/
    └── declutter/
        ├── declutter-list.tsx            # Main list component
        ├── declutter-filters.tsx         # Threshold/grouping controls
        └── declutter-score-badge.tsx     # Score visualization
```

### Pattern 1: Domain Service Pattern (existing pattern)
**What:** Separate domain logic from HTTP handling
**When to use:** All new features
**Example:**
```go
// Source: Matches existing analytics/service.go pattern
type DeclutterService struct {
    repo Repository
}

func (s *DeclutterService) ListUnusedItems(ctx context.Context, workspaceID uuid.UUID, thresholdDays int, groupBy string) ([]DeclutterItem, error) {
    // Business logic here
    return s.repo.FindUnusedItems(ctx, workspaceID, thresholdDays, groupBy)
}
```

### Pattern 2: Configurable Threshold (user preference)
**What:** Allow users to set their own "unused" threshold
**When to use:** Time-based filtering
**Example:**
```sql
-- Source: Analytics query pattern with parameterized threshold
SELECT inv.*,
    EXTRACT(DAY FROM (NOW() - inv.last_used_at))::int as days_unused,
    COALESCE(inv.purchase_price, 0) as value_cents
FROM warehouse.inventory inv
WHERE inv.workspace_id = $1
  AND inv.is_archived = false
  AND inv.last_used_at < NOW() - ($2 || ' days')::interval
ORDER BY days_unused DESC, value_cents DESC;
```

### Pattern 3: Score Calculation (server-side)
**What:** Calculate declutter priority score combining age and value
**When to use:** Ranking items for user action
**Example:**
```go
// Score = (days_unused / threshold) * 100 + (value_percentile * 50)
// Higher score = higher priority to declutter
func CalculateDeclutterScore(daysUnused int, threshold int, valueCents int, maxValueCents int) int {
    ageScore := float64(daysUnused) / float64(threshold) * 100
    if ageScore > 100 {
        ageScore = 100
    }

    valueScore := 0.0
    if maxValueCents > 0 {
        // Lower value items score higher (easier to declutter)
        valueScore = (1 - float64(valueCents)/float64(maxValueCents)) * 50
    }

    return int(ageScore + valueScore)
}
```

### Anti-Patterns to Avoid
- **Complex frontend scoring:** Keep score calculation server-side for consistency
- **Polling for updates:** Use existing SSE pattern if real-time updates needed
- **Separate "declutter" table:** Use inventory directly with last_used_at field
- **Auto-archiving:** Never automatically dispose items - always require user action

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV export | Custom CSV generator | `lib/utils/csv-export.ts` | Already handles escaping, BOM, downloads |
| Filtering UI | Custom filter components | `FilterPopover`, `FilterBar` | Already in inventory page |
| Date formatting | Manual date strings | `date-fns` with `format()` | Consistent with rest of app |
| Pagination | Custom scroll handling | `useInfiniteScroll` hook | Already handles loading states |
| Translations | Hardcoded strings | `next-intl` with `messages/` files | Already set up for i18n |
| Table sorting | Custom sort logic | `useTableSort` hook | Already in inventory page |

**Key insight:** The inventory page (`/dashboard/inventory/page.tsx`) is essentially a template for the declutter page - it has filtering, sorting, export, and bulk actions that can be adapted.

## Common Pitfalls

### Pitfall 1: Null last_used_at for existing inventory
**What goes wrong:** After migration, all existing inventory has NULL last_used_at
**Why it happens:** New column added to existing data
**How to avoid:**
- Migration should set `last_used_at = created_at` for existing records
- Treat NULL as "never used" OR use created_at as fallback in queries
**Warning signs:** All items showing as "never used" after deploy

### Pitfall 2: Performance with large inventory
**What goes wrong:** Slow queries when calculating scores for thousands of items
**Why it happens:** Full table scan for unused items
**How to avoid:**
- Add index on `last_used_at` column
- Use pagination (existing infinite scroll pattern)
- Pre-calculate or cache max_value for percentile calculation
**Warning signs:** Slow page load, timeout errors

### Pitfall 3: "Mark as used" race conditions
**What goes wrong:** Multiple users marking same item, inconsistent state
**Why it happens:** Optimistic updates without proper locking
**How to avoid:**
- Use `UPDATE ... SET last_used_at = NOW()` directly (atomic)
- Don't require full inventory object for update
- Accept that last writer wins (acceptable for timestamp)
**Warning signs:** Stale data in UI

### Pitfall 4: Unclear "usage" definition
**What goes wrong:** Users confused about what "using" an item means
**Why it happens:** Feature scope creep
**How to avoid:**
- Clear UI copy: "Mark as recently used"
- Single clear action, not multiple usage types
- Consider auto-marking on loan/movement (future enhancement)
**Warning signs:** User confusion, support requests

## Code Examples

Verified patterns from official sources and existing codebase:

### SQL Migration (database schema)
```sql
-- Source: Follows existing migration patterns in db/migrations/
-- migrate:up

-- Add last_used_at column to track item usage
ALTER TABLE warehouse.inventory
ADD COLUMN last_used_at TIMESTAMPTZ;

-- Set existing items to their created_at date (conservative default)
UPDATE warehouse.inventory
SET last_used_at = created_at
WHERE last_used_at IS NULL;

-- Create index for efficient unused item queries
CREATE INDEX ix_inventory_last_used ON warehouse.inventory(workspace_id, last_used_at)
WHERE is_archived = false;

COMMENT ON COLUMN warehouse.inventory.last_used_at IS
'Timestamp of when this inventory was last marked as "used". Used for declutter assistant feature.';

-- migrate:down
DROP INDEX IF EXISTS ix_inventory_last_used;
ALTER TABLE warehouse.inventory DROP COLUMN IF EXISTS last_used_at;
```

### sqlc Query for Unused Items
```sql
-- Source: Follows analytics.sql query patterns
-- name: ListUnusedInventory :many
SELECT
    inv.*,
    it.name as item_name,
    it.sku as item_sku,
    l.name as location_name,
    c.name as category_name,
    EXTRACT(DAY FROM (NOW() - COALESCE(inv.last_used_at, inv.created_at)))::int as days_unused,
    COALESCE(inv.purchase_price, 0) as value_cents
FROM warehouse.inventory inv
JOIN warehouse.items it ON inv.item_id = it.id
JOIN warehouse.locations l ON inv.location_id = l.id
LEFT JOIN warehouse.categories c ON it.category_id = c.id
WHERE inv.workspace_id = $1
  AND inv.is_archived = false
  AND COALESCE(inv.last_used_at, inv.created_at) < NOW() - make_interval(days => $2)
ORDER BY
    CASE WHEN sqlc.arg(group_by)::text = 'category' THEN c.name END,
    CASE WHEN sqlc.arg(group_by)::text = 'location' THEN l.name END,
    days_unused DESC
LIMIT $3 OFFSET $4;

-- name: MarkInventoryUsed :one
UPDATE warehouse.inventory
SET last_used_at = NOW(), updated_at = NOW()
WHERE id = $1 AND workspace_id = $2
RETURNING *;

-- name: GetUnusedInventoryCounts :one
SELECT
    COUNT(*) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '90 days')::int as unused_90,
    COUNT(*) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '180 days')::int as unused_180,
    COUNT(*) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '365 days')::int as unused_365,
    COALESCE(SUM(purchase_price) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '90 days'), 0)::bigint as value_90,
    COALESCE(SUM(purchase_price) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '180 days'), 0)::bigint as value_180,
    COALESCE(SUM(purchase_price) FILTER (WHERE COALESCE(last_used_at, created_at) < NOW() - interval '365 days'), 0)::bigint as value_365
FROM warehouse.inventory
WHERE workspace_id = $1 AND is_archived = false;
```

### Go Handler (follows existing patterns)
```go
// Source: Matches repair_log handler pattern
func (h *Handler) MarkAsUsed(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    workspaceID := middleware.WorkspaceIDFromContext(ctx)
    inventoryID, err := uuid.Parse(chi.URLParam(r, "inventoryID"))
    if err != nil {
        shared.WriteError(w, http.StatusBadRequest, "Invalid inventory ID")
        return
    }

    result, err := h.service.MarkAsUsed(ctx, workspaceID, inventoryID)
    if err != nil {
        if errors.Is(err, shared.ErrNotFound) {
            shared.WriteError(w, http.StatusNotFound, "Inventory not found")
            return
        }
        shared.WriteError(w, http.StatusInternalServerError, err.Error())
        return
    }

    // Emit SSE event
    h.events.Publish(ctx, events.Event{
        Type:       "inventory.used",
        EntityType: "inventory",
        EntityID:   inventoryID,
        Payload:    result,
    })

    shared.WriteJSON(w, http.StatusOK, map[string]interface{}{
        "inventory": result,
    })
}
```

### Frontend API Client
```typescript
// Source: Matches lib/api/repair-logs.ts pattern
export const declutterApi = {
  listUnused: async (
    workspaceId: string,
    params: {
      thresholdDays?: number;
      groupBy?: 'category' | 'location' | 'none';
      page?: number;
      limit?: number;
    }
  ): Promise<DeclutterListResponse> => {
    const queryParams = new URLSearchParams();
    if (params.thresholdDays) queryParams.append('threshold_days', params.thresholdDays.toString());
    if (params.groupBy) queryParams.append('group_by', params.groupBy);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    return apiClient.get<DeclutterListResponse>(
      `/workspaces/${workspaceId}/declutter?${queryParams.toString()}`
    );
  },

  getCounts: async (workspaceId: string): Promise<DeclutterCounts> => {
    return apiClient.get<DeclutterCounts>(
      `/workspaces/${workspaceId}/declutter/counts`
    );
  },

  markAsUsed: async (workspaceId: string, inventoryId: string): Promise<Inventory> => {
    const response = await apiClient.post<{ inventory: Inventory }>(
      `/workspaces/${workspaceId}/inventory/${inventoryId}/mark-used`
    );
    return response.inventory;
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No usage tracking | `last_used_at` timestamp | This phase | Enables declutter feature |
| Manual CSV creation | ExportDialog component | Existing | Reuse for declutter export |
| Full page refresh | SSE real-time updates | Existing | Instant feedback on mark-used |

**Deprecated/outdated:**
- None - this is a new feature

## Open Questions

Things that couldn't be fully resolved:

1. **Auto-marking on loan/movement**
   - What we know: Loans and movements are tracked in separate tables
   - What's unclear: Should creating a loan auto-update last_used_at?
   - Recommendation: Start with manual marking only; add auto-marking as enhancement if users request

2. **Declutter "action" options**
   - What we know: User needs to "act on" unused items
   - What's unclear: Should we provide "Sell", "Donate", "Dispose" actions with tracking?
   - Recommendation: Use existing archive functionality; defer complex disposal tracking

3. **Threshold persistence**
   - What we know: Users can choose 90/180/365 day thresholds
   - What's unclear: Should we save user's preferred threshold?
   - Recommendation: Use URL query params initially; consider user preferences later

## Sources

### Primary (HIGH confidence)
- `/home/antti/Repos/Misc/home-warehouse-system/backend/db/migrations/001_initial_schema.sql` - Existing schema patterns
- `/home/antti/Repos/Misc/home-warehouse-system/backend/internal/domain/analytics/service.go` - Analytics service patterns
- `/home/antti/Repos/Misc/home-warehouse-system/backend/db/queries/analytics.sql` - Complex aggregation query patterns
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx` - UI patterns for lists, filters, export
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/utils/csv-export.ts` - CSV export utility

### Secondary (MEDIUM confidence)
- Existing repair_log implementation (Phase 12-13) for domain structure patterns
- ROADMAP.md success criteria for feature requirements

### Tertiary (LOW confidence)
- None - all findings verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified all libraries already in use
- Architecture: HIGH - patterns directly from existing codebase
- Pitfalls: MEDIUM - based on codebase patterns and general SQL knowledge

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - stable codebase, no external dependencies)
