# Phase 12: Repair Log Foundation - Research

**Researched:** 2026-01-25
**Domain:** Inventory repair tracking, status workflow, CRUD operations
**Confidence:** HIGH

## Summary

This phase adds repair log functionality to track repair history for inventory items. The feature is straightforward CRUD with a status workflow (pending -> in_progress -> completed) and integration with the existing inventory condition system.

The codebase already has well-established patterns for similar features:
- **Loans domain**: References inventory, tracks status/lifecycle, similar relationship pattern
- **Movements domain**: Tracks history per inventory item, read-heavy with timeline display
- **Inventory domain**: Has condition enum that repairs should update upon completion

The repair log follows the same domain-driven architecture with entity, service, repository, and handler layers. No external libraries needed - this uses the existing Go/Chi/sqlc/Huma stack.

**Primary recommendation:** Model after the loans domain - same relationship to inventory, similar status workflow, proven patterns for status transitions and inventory updates.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chi router | v5 | HTTP routing | Already used project-wide |
| Huma | v2 | OpenAPI-first API framework | Already used for all handlers |
| sqlc | latest | Type-safe SQL | Already used for all queries |
| pgx/v5 | v5 | PostgreSQL driver | Already used project-wide |
| google/uuid | v1 | UUIDv7 generation | Already used for all IDs |

### Supporting (Already in Use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pgtype | v5 | PostgreSQL type handling | Nullable fields, dates |
| testify | v1 | Testing assertions | All tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom enum | PostgreSQL enum | Use PG enum for consistency with existing enums |
| Text status field | Enum type | Enum enforces valid values at DB level |

**Installation:**
No new dependencies needed - all libraries already in project.

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── db/
│   ├── migrations/
│   │   └── 003_repair_logs.sql           # New migration
│   └── queries/
│       └── repair_logs.sql               # sqlc queries
├── internal/
│   ├── domain/
│   │   └── warehouse/
│   │       └── repairlog/
│   │           ├── entity.go             # RepairLog domain entity
│   │           ├── entity_test.go        # Entity validation tests
│   │           ├── errors.go             # Domain errors
│   │           ├── repository.go         # Repository interface
│   │           ├── service.go            # Business logic
│   │           ├── service_test.go       # Service unit tests
│   │           └── handler.go            # HTTP handlers
│   └── infra/
│       └── postgres/
│           ├── repairlog_repository.go   # Repository implementation
│           └── repairlog_repository_test.go
frontend/
├── lib/
│   ├── api/
│   │   └── repair-logs.ts                # API client
│   └── types/
│       └── repair-log.ts                 # TypeScript types
├── components/
│   └── inventory/
│       └── repair-history.tsx            # Repair history component
└── app/[locale]/(dashboard)/dashboard/
    └── inventory/
        └── [id]/
            └── repairs/
                └── page.tsx              # Repair history page (optional)
```

### Pattern 1: Domain Entity with Status Workflow
**What:** Encapsulated entity with state machine for status transitions
**When to use:** Any entity with lifecycle states
**Example:**
```go
// Source: Existing loan domain pattern in codebase
type RepairStatus string

const (
    StatusPending    RepairStatus = "PENDING"
    StatusInProgress RepairStatus = "IN_PROGRESS"
    StatusCompleted  RepairStatus = "COMPLETED"
)

type RepairLog struct {
    id              uuid.UUID
    workspaceID     uuid.UUID
    inventoryID     uuid.UUID
    status          RepairStatus
    description     string
    repairDate      *time.Time
    cost            *int         // cents
    currencyCode    *string
    serviceProvider *string
    completedAt     *time.Time
    newCondition    *Condition   // inventory condition to set on completion
    notes           *string
    createdAt       time.Time
    updatedAt       time.Time
}

func (r *RepairLog) StartRepair() error {
    if r.status != StatusPending {
        return ErrInvalidStatusTransition
    }
    r.status = StatusInProgress
    r.updatedAt = time.Now()
    return nil
}

func (r *RepairLog) Complete(newCondition *inventory.Condition) error {
    if r.status != StatusInProgress {
        return ErrInvalidStatusTransition
    }
    r.status = StatusCompleted
    now := time.Now()
    r.completedAt = &now
    r.newCondition = newCondition
    r.updatedAt = now
    return nil
}
```

### Pattern 2: Service with Cross-Entity Updates
**What:** Service layer coordinates updates across related entities
**When to use:** When one operation affects multiple entities
**Example:**
```go
// Source: Existing loan service pattern - updates inventory status
func (s *Service) Complete(ctx context.Context, id, workspaceID uuid.UUID, newCondition *inventory.Condition) (*RepairLog, error) {
    repair, err := s.repo.FindByID(ctx, id, workspaceID)
    if err != nil {
        return nil, err
    }

    if err := repair.Complete(newCondition); err != nil {
        return nil, err
    }

    // Update inventory condition if specified
    if newCondition != nil {
        inv, err := s.inventoryRepo.FindByID(ctx, repair.InventoryID(), workspaceID)
        if err != nil {
            return nil, err
        }
        if err := inv.UpdateCondition(*newCondition); err != nil {
            return nil, err
        }
        if err := s.inventoryRepo.Save(ctx, inv); err != nil {
            return nil, err
        }
    }

    if err := s.repo.Save(ctx, repair); err != nil {
        return nil, err
    }

    return repair, nil
}
```

### Pattern 3: Handler with Huma API Framework
**What:** RESTful handlers using Huma for OpenAPI generation
**When to use:** All HTTP endpoints
**Example:**
```go
// Source: Existing loan handler pattern
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
    // List repairs for inventory
    huma.Get(api, "/inventory/{inventory_id}/repairs", func(ctx context.Context, input *ListRepairsInput) (*ListRepairsOutput, error) {
        workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
        if !ok {
            return nil, huma.Error401Unauthorized("workspace context required")
        }

        repairs, err := svc.ListByInventory(ctx, workspaceID, input.InventoryID)
        if err != nil {
            return nil, huma.Error500InternalServerError("failed to list repairs")
        }

        items := make([]RepairLogResponse, len(repairs))
        for i, r := range repairs {
            items[i] = toRepairResponse(r)
        }

        return &ListRepairsOutput{
            Body: RepairListResponse{Items: items},
        }, nil
    })
}
```

### Anti-Patterns to Avoid
- **Direct database access in handlers:** Always go through service layer
- **Status transitions without validation:** Use entity methods that validate transitions
- **Skipping workspace_id checks:** Every query must filter by workspace_id for multi-tenancy
- **Raw SQL in repository:** Use sqlc generated queries for type safety

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | custom ID logic | shared.NewUUID() | Already provides UUIDv7 |
| Pagination | manual LIMIT/OFFSET | shared.Pagination | Consistent pagination across API |
| Error handling | custom error types | shared.ErrNotFound etc. | Consistent error responses |
| Date handling | string parsing | pgtype.Date/Timestamptz | Proper timezone handling |
| Status enums | string constants | PostgreSQL ENUM type | DB-level validation |
| API responses | manual JSON | Huma response types | OpenAPI generation |

**Key insight:** The codebase has mature patterns for every aspect of CRUD with status workflow. Follow loans domain as the template.

## Common Pitfalls

### Pitfall 1: Status Transition Without Validation
**What goes wrong:** Allowing any status to transition to any other status
**Why it happens:** Skipping entity-level validation
**How to avoid:** Entity methods validate current state before transition
**Warning signs:** Tests that set status directly without calling transition methods

### Pitfall 2: Missing Workspace ID Filter
**What goes wrong:** Query returns data from other workspaces
**Why it happens:** Forgetting to add workspace_id to WHERE clause
**How to avoid:** Every sqlc query must include workspace_id parameter
**Warning signs:** Queries that only use entity ID without workspace_id

### Pitfall 3: Inventory Condition Update Race
**What goes wrong:** Concurrent repairs complete and overwrite each other's condition
**Why it happens:** Not using transactions for cross-entity updates
**How to avoid:** Use transaction for Complete() that updates both repair and inventory
**Warning signs:** Service methods that call multiple repo.Save() without transaction

### Pitfall 4: Missing SSE Events
**What goes wrong:** UI doesn't update when repairs change
**Why it happens:** Forgetting to publish events after mutations
**How to avoid:** Every create/update/delete publishes SSE event (follow loan handler pattern)
**Warning signs:** Handler without broadcaster.Publish() calls

### Pitfall 5: Frontend Type Mismatches
**What goes wrong:** TypeScript errors when consuming API
**Why it happens:** Frontend types don't match backend response
**How to avoid:** Define frontend types to exactly match RepairLogResponse struct
**Warning signs:** Using `any` type for repair log data

## Code Examples

Verified patterns from existing codebase:

### Database Migration
```sql
-- Source: Pattern from 001_initial_schema.sql
CREATE TYPE warehouse.repair_status_enum AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED'
);

CREATE TABLE warehouse.repair_logs (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    inventory_id uuid NOT NULL REFERENCES warehouse.inventory(id) ON DELETE CASCADE,
    status warehouse.repair_status_enum NOT NULL DEFAULT 'PENDING',
    description TEXT NOT NULL,
    repair_date DATE,
    cost INTEGER,                    -- cents
    currency_code VARCHAR(3) DEFAULT 'EUR',
    service_provider VARCHAR(200),
    completed_at TIMESTAMPTZ,
    new_condition warehouse.item_condition_enum,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_repair_logs_workspace ON warehouse.repair_logs(workspace_id);
CREATE INDEX ix_repair_logs_inventory ON warehouse.repair_logs(inventory_id);
CREATE INDEX ix_repair_logs_status ON warehouse.repair_logs(workspace_id, status);
```

### sqlc Queries
```sql
-- Source: Pattern from loans.sql
-- name: GetRepairLog :one
SELECT * FROM warehouse.repair_logs
WHERE id = $1 AND workspace_id = $2;

-- name: CreateRepairLog :one
INSERT INTO warehouse.repair_logs (
    id, workspace_id, inventory_id, status, description,
    repair_date, cost, currency_code, service_provider, notes
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: UpdateRepairLogStatus :one
UPDATE warehouse.repair_logs
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: CompleteRepairLog :one
UPDATE warehouse.repair_logs
SET status = 'COMPLETED', completed_at = now(), new_condition = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListRepairLogsByInventory :many
SELECT * FROM warehouse.repair_logs
WHERE workspace_id = $1 AND inventory_id = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: ListRepairLogsByWorkspace :many
SELECT r.*, i.id as item_id, it.name as item_name
FROM warehouse.repair_logs r
JOIN warehouse.inventory i ON r.inventory_id = i.id
JOIN warehouse.items it ON i.item_id = it.id
WHERE r.workspace_id = $1
ORDER BY r.created_at DESC
LIMIT $2 OFFSET $3;
```

### Frontend TypeScript Types
```typescript
// Source: Pattern from lib/types/
export type RepairStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface RepairLog {
  id: string;
  workspace_id: string;
  inventory_id: string;
  status: RepairStatus;
  description: string;
  repair_date: string | null;
  cost: number | null;
  currency_code: string | null;
  service_provider: string | null;
  completed_at: string | null;
  new_condition: InventoryCondition | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairLogCreate {
  inventory_id: string;
  description: string;
  repair_date?: string;
  cost?: number;
  currency_code?: string;
  service_provider?: string;
  notes?: string;
}
```

### Frontend API Client
```typescript
// Source: Pattern from lib/api/
export const repairLogsApi = {
  listByInventory: async (workspaceId: string, inventoryId: string, params?: { page?: number; limit?: number }) => {
    const response = await apiClient.get<{ items: RepairLog[] }>(
      `/api/v1/workspaces/${workspaceId}/inventory/${inventoryId}/repairs`,
      { params }
    );
    return response.data;
  },

  create: async (workspaceId: string, data: RepairLogCreate) => {
    const response = await apiClient.post<RepairLog>(
      `/api/v1/workspaces/${workspaceId}/repairs`,
      data
    );
    return response.data;
  },

  updateStatus: async (workspaceId: string, id: string, status: RepairStatus, newCondition?: InventoryCondition) => {
    const response = await apiClient.patch<RepairLog>(
      `/api/v1/workspaces/${workspaceId}/repairs/${id}/status`,
      { status, new_condition: newCondition }
    );
    return response.data;
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | N/A | N/A | N/A |

**Deprecated/outdated:**
- None - this is a new feature with no migration from legacy

## Open Questions

Things that couldn't be fully resolved:

1. **Repair attachments/photos**
   - What we know: Item photos exist with full upload/gallery functionality
   - What's unclear: Should repairs have their own photos? (e.g., before/after)
   - Recommendation: Defer to future phase - this phase focuses on core repair tracking

2. **Repair reminders/notifications**
   - What we know: Notification system exists for loans (LOAN_DUE_SOON, LOAN_OVERDUE)
   - What's unclear: Should repairs have similar reminders? (e.g., "repair pending for X days")
   - Recommendation: Defer to future phase - this phase focuses on manual tracking

3. **Repair cost currency handling**
   - What we know: Inventory uses `currency_code` + `purchase_price` (cents) pattern
   - What's unclear: Should cost support multi-currency conversion?
   - Recommendation: Use same pattern as inventory - store in cents with currency_code, no conversion

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `/backend/internal/domain/warehouse/loan/` - status workflow, inventory relationship
  - `/backend/internal/domain/warehouse/movement/` - history tracking per inventory
  - `/backend/db/migrations/001_initial_schema.sql` - enum patterns, table structure
  - `/backend/db/queries/loans.sql` - sqlc query patterns
  - `/frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx` - inventory UI patterns

### Secondary (MEDIUM confidence)
- None needed - all patterns verified from existing codebase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project libraries only
- Architecture: HIGH - Following established domain patterns from loans/movements
- Pitfalls: HIGH - Based on observed patterns and common mistakes in similar domains

**Research date:** 2026-01-25
**Valid until:** Indefinite (patterns are stable in this codebase)
