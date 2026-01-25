# Architecture Patterns: v1.2 Phase 2 Features

**Domain:** Repair tracking, declutter assistant, photo processing enhancements
**Researched:** 2026-01-25
**Overall Confidence:** HIGH (based on existing codebase patterns)

## Executive Summary

This document covers the architecture for three new feature areas in v1.2 Phase 2:

1. **Repair Log** - Track repair history for inventory items
2. **Declutter Assistant** - Surface unused items for potential removal
3. **Background Photo Processing** - Async thumbnail generation and bulk operations

All features integrate with the existing Go/PostgreSQL/asynq architecture using established patterns. The key architectural decisions:

- **Repair Log:** New domain package following existing `loan` entity pattern
- **Declutter Assistant:** Backend query aggregation + frontend scoring algorithm
- **Photo Processing:** Extend asynq scheduler with new task types, async thumbnail flow

## Current Architecture Context

The system follows domain-driven design with clear separation:

```
backend/
  internal/
    domain/           # Business logic
      warehouse/      # Each entity: entity.go, service.go, repository.go, handler.go, errors.go
        item/
        inventory/
        loan/         # <-- Pattern to follow for repairs
        itemphoto/    # <-- Existing photo handling
        activity/     # <-- Audit trail pattern
    infra/           # Infrastructure adapters
      postgres/      # Repository implementations
      queue/         # Redis queue for background jobs
      imageprocessor/ # Thumbnail generation (already exists)
      events/        # SSE broadcasting
    jobs/            # Asynq scheduled tasks
    worker/          # Redis queue consumers (imports)
```

**Existing Background Job Infrastructure:**
- `asynq` scheduler in `jobs/scheduler.go`
- Task types: `loan:reminder`, `cleanup:deleted_records`, `cleanup:old_activity`
- Redis queue in `infra/queue/redis_queue.go` (used by import worker)
- SSE broadcaster in `infra/events/` for real-time notifications

## 1. Repair Log Architecture

### Database Schema

**New migration: `003_repairs.sql`**

```sql
-- migrate:up

-- Extend activity entity enum for repair tracking
ALTER TYPE warehouse.activity_entity_enum ADD VALUE IF NOT EXISTS 'REPAIR';

-- Repair status lifecycle
CREATE TYPE warehouse.repair_status_enum AS ENUM (
    'PENDING',      -- Repair needed, not started
    'IN_PROGRESS',  -- Currently being repaired
    'COMPLETED',    -- Successfully repaired
    'ABANDONED'     -- Decided not to repair (e.g., cost too high)
);

-- Repairs table
CREATE TABLE warehouse.repairs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES warehouse.inventory(id) ON DELETE CASCADE,
    status warehouse.repair_status_enum NOT NULL DEFAULT 'PENDING',

    -- Problem description
    problem_description TEXT NOT NULL,
    problem_detected_at DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Repair details (populated when completed/in progress)
    repair_notes TEXT,
    repair_cost INTEGER,           -- cents
    currency_code VARCHAR(3) DEFAULT 'EUR',
    repaired_by VARCHAR(200),      -- Person/shop who did the repair

    -- Lifecycle timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Audit
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repairs_workspace ON warehouse.repairs(workspace_id);
CREATE INDEX idx_repairs_inventory ON warehouse.repairs(inventory_id);
CREATE INDEX idx_repairs_status ON warehouse.repairs(workspace_id, status);
CREATE INDEX idx_repairs_pending ON warehouse.repairs(workspace_id, problem_detected_at)
    WHERE status = 'PENDING' AND is_archived = false;

COMMENT ON TABLE warehouse.repairs IS 'Repair history for inventory items, tracking problem detection through resolution.';
COMMENT ON COLUMN warehouse.repairs.repair_cost IS 'Cost in cents for currency-agnostic storage';
COMMENT ON COLUMN warehouse.repairs.repaired_by IS 'Name of person or repair shop that performed the repair';

-- migrate:down
DROP TABLE IF EXISTS warehouse.repairs;
DROP TYPE IF EXISTS warehouse.repair_status_enum;
-- Note: Cannot remove enum value from activity_entity_enum easily in down migration
```

### Relationship Pattern

**Mirrors `loans` table relationship to `inventory`:**
- `loans`: `inventory_id -> inventory` (one inventory can have many loans over time)
- `repairs`: `inventory_id -> inventory` (one inventory can have many repairs over time)

This is intentional - an item might need repair multiple times, and we want full history.

### Domain Package Structure

**Create: `backend/internal/domain/warehouse/repair/`**

```
repair/
  entity.go       # Repair struct, RepairStatus enum, validation
  service.go      # Business logic, status transitions
  repository.go   # Interface definition
  handler.go      # HTTP routes
  errors.go       # Domain errors
```

### Entity Design

```go
// backend/internal/domain/warehouse/repair/entity.go
package repair

import (
    "time"
    "github.com/google/uuid"
    "github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Status string

const (
    StatusPending    Status = "PENDING"
    StatusInProgress Status = "IN_PROGRESS"
    StatusCompleted  Status = "COMPLETED"
    StatusAbandoned  Status = "ABANDONED"
)

func (s Status) IsValid() bool {
    switch s {
    case StatusPending, StatusInProgress, StatusCompleted, StatusAbandoned:
        return true
    }
    return false
}

type Repair struct {
    id                  uuid.UUID
    workspaceID         uuid.UUID
    inventoryID         uuid.UUID
    status              Status
    problemDescription  string
    problemDetectedAt   time.Time
    repairNotes         *string
    repairCost          *int       // cents
    currencyCode        *string
    repairedBy          *string
    startedAt           *time.Time
    completedAt         *time.Time
    createdBy           *uuid.UUID
    isArchived          bool
    createdAt           time.Time
    updatedAt           time.Time
}

// Constructor
func NewRepair(
    workspaceID, inventoryID uuid.UUID,
    problemDescription string,
    problemDetectedAt time.Time,
    createdBy *uuid.UUID,
) (*Repair, error) {
    if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
        return nil, err
    }
    if err := shared.ValidateUUID(inventoryID, "inventory_id"); err != nil {
        return nil, err
    }
    if problemDescription == "" {
        return nil, ErrProblemDescriptionRequired
    }

    now := time.Now()
    return &Repair{
        id:                 shared.NewUUID(),
        workspaceID:        workspaceID,
        inventoryID:        inventoryID,
        status:             StatusPending,
        problemDescription: problemDescription,
        problemDetectedAt:  problemDetectedAt,
        createdBy:          createdBy,
        isArchived:         false,
        createdAt:          now,
        updatedAt:          now,
    }, nil
}

// Domain methods for state transitions
func (r *Repair) Start() error {
    if r.status != StatusPending {
        return ErrInvalidStatusTransition
    }
    now := time.Now()
    r.status = StatusInProgress
    r.startedAt = &now
    r.updatedAt = now
    return nil
}

func (r *Repair) Complete(notes *string, cost *int, currency *string, repairedBy *string) error {
    if r.status != StatusPending && r.status != StatusInProgress {
        return ErrInvalidStatusTransition
    }
    now := time.Now()
    r.status = StatusCompleted
    r.repairNotes = notes
    r.repairCost = cost
    r.currencyCode = currency
    r.repairedBy = repairedBy
    r.completedAt = &now
    r.updatedAt = now
    return nil
}

func (r *Repair) Abandon(notes *string) error {
    if r.status == StatusCompleted || r.status == StatusAbandoned {
        return ErrInvalidStatusTransition
    }
    now := time.Now()
    r.status = StatusAbandoned
    r.repairNotes = notes
    r.completedAt = &now
    r.updatedAt = now
    return nil
}

// Getters (follow existing pattern from loan/entity.go)
func (r *Repair) ID() uuid.UUID              { return r.id }
func (r *Repair) WorkspaceID() uuid.UUID     { return r.workspaceID }
func (r *Repair) InventoryID() uuid.UUID     { return r.inventoryID }
func (r *Repair) Status() Status             { return r.status }
// ... etc
```

### Repository Interface

```go
// backend/internal/domain/warehouse/repair/repository.go
package repair

import (
    "context"
    "github.com/google/uuid"
)

type Repository interface {
    Create(ctx context.Context, repair *Repair) (*Repair, error)
    Update(ctx context.Context, repair *Repair) error
    FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Repair, error)
    FindByInventory(ctx context.Context, inventoryID, workspaceID uuid.UUID) ([]*Repair, error)
    FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, filters RepairFilters) ([]*Repair, int, error)
    Archive(ctx context.Context, id, workspaceID uuid.UUID) error
}

type RepairFilters struct {
    Status    *Status
    Since     *time.Time
    Page      int
    PageSize  int
}
```

### API Endpoints

```
POST   /workspaces/{id}/repairs              # Create repair
GET    /workspaces/{id}/repairs              # List repairs (with filters)
GET    /workspaces/{id}/repairs/{repair_id}  # Get single repair
PATCH  /workspaces/{id}/repairs/{repair_id}  # Update repair
POST   /workspaces/{id}/repairs/{repair_id}/start     # Start repair
POST   /workspaces/{id}/repairs/{repair_id}/complete  # Complete repair
POST   /workspaces/{id}/repairs/{repair_id}/abandon   # Abandon repair
DELETE /workspaces/{id}/repairs/{repair_id}  # Archive repair

# Inventory-scoped view
GET    /workspaces/{id}/inventory/{inv_id}/repairs    # Repairs for specific inventory
```

### Activity Log Integration

**Extend `activity.EntityType` enum:**

```go
// backend/internal/domain/warehouse/activity/entity.go
const (
    // ... existing
    EntityRepair EntityType = "REPAIR"  // Add this
)
```

**Service integration:**

```go
// In repair/service.go
func (s *Service) Create(ctx context.Context, input CreateInput) (*Repair, error) {
    // ... create logic ...

    // Log activity
    if s.activitySvc != nil {
        s.activitySvc.Log(ctx, activity.CreateInput{
            WorkspaceID: repair.WorkspaceID(),
            UserID:      input.CreatedBy,
            Action:      activity.ActionCreate,
            EntityType:  activity.EntityRepair,
            EntityID:    repair.ID(),
            EntityName:  truncate(repair.ProblemDescription(), 50),
        })
    }

    return repair, nil
}
```

---

## 2. Declutter Assistant Architecture

### Design Decision: Backend Query + Frontend Scoring

**Why Backend Query:**
- Cross-table aggregation (inventory, loans, activity_log)
- Large datasets (workspace may have thousands of items)
- Consistent data retrieval across devices

**Why Frontend Scoring:**
- User-configurable weights (value unused items differently)
- Interactive filtering/sorting without round-trips
- Simpler backend API (returns raw data, frontend calculates scores)

### Backend: New Service (NOT a full domain)

Create as a service-only package since it's read-only aggregation:

```
backend/internal/domain/warehouse/declutter/
  service.go    # Query logic
  handler.go    # API endpoint
  types.go      # Request/response types
```

### SQL Query Pattern

```sql
-- name: GetDeclutterCandidates :many
SELECT
    i.id AS inventory_id,
    i.item_id,
    i.location_id,
    i.container_id,
    i.quantity,
    i.condition,
    i.status,
    i.date_acquired,
    i.purchase_price,
    i.currency_code,

    -- Item details for display
    it.name AS item_name,
    it.short_code AS item_short_code,
    it.brand AS item_brand,

    -- Location details
    l.name AS location_name,

    -- Container details (may be null)
    c.name AS container_name,

    -- Activity metrics (subqueries for efficiency)
    (
        SELECT MAX(created_at)
        FROM warehouse.activity_log
        WHERE entity_type = 'INVENTORY' AND entity_id = i.id
    ) AS last_activity_at,

    -- Loan history
    (
        SELECT COUNT(*)
        FROM warehouse.loans
        WHERE inventory_id = i.id
    ) AS total_loan_count,

    (
        SELECT MAX(returned_at)
        FROM warehouse.loans
        WHERE inventory_id = i.id AND returned_at IS NOT NULL
    ) AS last_loan_return_at

FROM warehouse.inventory i
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.locations l ON i.location_id = l.id
LEFT JOIN warehouse.containers c ON i.container_id = c.id
WHERE i.workspace_id = $1
    AND i.is_archived = false
    AND i.status = 'AVAILABLE'  -- Only available items are declutter candidates
    AND i.quantity > 0
ORDER BY last_activity_at NULLS FIRST
LIMIT $2;
```

### API Endpoint

```
GET /workspaces/{workspace_id}/declutter/candidates
Query params:
  - limit: int (default: 100, max: 500)
  - min_months_inactive: int (optional, filter to items inactive >= N months)
  - conditions: string[] (optional, e.g., "POOR,FAIR,DAMAGED")
```

### Response Structure

```go
type DeclutterCandidate struct {
    InventoryID      uuid.UUID  `json:"inventory_id"`
    Item             ItemSummary `json:"item"`
    Location         LocationSummary `json:"location"`
    Container        *ContainerSummary `json:"container,omitempty"`
    Quantity         int        `json:"quantity"`
    Condition        string     `json:"condition"`
    DateAcquired     *time.Time `json:"date_acquired,omitempty"`
    PurchasePrice    *int       `json:"purchase_price,omitempty"`
    CurrencyCode     *string    `json:"currency_code,omitempty"`
    LastActivityAt   *time.Time `json:"last_activity_at,omitempty"`
    TotalLoanCount   int        `json:"total_loan_count"`
    LastLoanReturnAt *time.Time `json:"last_loan_return_at,omitempty"`
}

type DeclutterResponse struct {
    Candidates []DeclutterCandidate `json:"candidates"`
    TotalCount int                  `json:"total_count"`
}
```

### Frontend Scoring Algorithm

```typescript
// frontend/lib/declutter/scoring.ts

interface DeclutterConfig {
    inactivityWeight: number;      // 0-1, default 0.4
    neverLoanedWeight: number;     // 0-1, default 0.2
    conditionWeight: number;       // 0-1, default 0.2
    lowValueWeight: number;        // 0-1, default 0.1
    quantityWeight: number;        // 0-1, default 0.1
    lowValueThreshold: number;     // cents, items below this get low-value points
}

interface DeclutterScore {
    inventoryId: string;
    score: number;  // 0-100, higher = stronger declutter candidate
    reasons: string[];
}

export function calculateDeclutterScore(
    candidate: DeclutterCandidate,
    config: DeclutterConfig = defaultConfig()
): DeclutterScore {
    let score = 0;
    const reasons: string[] = [];

    // Inactivity factor (0-40 points max)
    const monthsInactive = candidate.last_activity_at
        ? monthsSince(new Date(candidate.last_activity_at))
        : 24; // Assume very old if no activity recorded

    const inactivityScore = Math.min(40, monthsInactive * 2) * config.inactivityWeight;
    score += inactivityScore;
    if (monthsInactive >= 12) {
        reasons.push(`Unused for ${monthsInactive} months`);
    }

    // Never loaned factor (0-20 points max)
    if (candidate.total_loan_count === 0) {
        score += 20 * config.neverLoanedWeight;
        reasons.push("Never loaned out");
    }

    // Condition factor (0-20 points max)
    const conditionScores: Record<string, number> = {
        POOR: 20,
        FAIR: 10,
        DAMAGED: 15,
        FOR_REPAIR: 18,
    };
    if (conditionScores[candidate.condition]) {
        score += conditionScores[candidate.condition] * config.conditionWeight;
        reasons.push(`Condition: ${candidate.condition}`);
    }

    // Low value factor (0-10 points max)
    if (candidate.purchase_price &&
        candidate.purchase_price < config.lowValueThreshold) {
        score += 10 * config.lowValueWeight;
        reasons.push("Low original value");
    }

    // Quantity factor (0-10 points max) - multiples suggest hoarding
    if (candidate.quantity > 3) {
        score += 10 * config.quantityWeight;
        reasons.push(`Have ${candidate.quantity} of this item`);
    }

    return {
        inventoryId: candidate.inventory_id,
        score: Math.round(score),
        reasons,
    };
}

function defaultConfig(): DeclutterConfig {
    return {
        inactivityWeight: 1.0,
        neverLoanedWeight: 1.0,
        conditionWeight: 1.0,
        lowValueWeight: 1.0,
        quantityWeight: 1.0,
        lowValueThreshold: 2000, // 20 EUR
    };
}
```

---

## 3. Background Photo Processing Architecture

### Current State Analysis

**Existing `itemphoto` service (synchronous):**
1. Upload received
2. Validate file
3. Generate thumbnail (blocking!)
4. Save original + thumbnail
5. Create DB record
6. Return response

**Problem:** Large images block the request for seconds.

### Target State: Async Thumbnail

**New flow:**
1. Upload received
2. Validate file
3. Save original only
4. Create DB record with `thumbnail_status='pending'`
5. Enqueue thumbnail task to asynq
6. Return response immediately
7. Worker: Generate thumbnail
8. Worker: Update DB record
9. Worker: Send SSE notification to frontend

### Database Schema Updates

```sql
-- Add to existing item_photos table via migration
ALTER TABLE warehouse.item_photos
ADD COLUMN thumbnail_status VARCHAR(20) NOT NULL DEFAULT 'completed';
-- Values: 'pending', 'processing', 'completed', 'failed'
-- Default 'completed' for existing photos (they already have thumbnails)

ALTER TABLE warehouse.item_photos
ADD COLUMN thumbnail_error TEXT;

CREATE INDEX idx_item_photos_thumbnail_pending
ON warehouse.item_photos(workspace_id, thumbnail_status)
WHERE thumbnail_status = 'pending';

COMMENT ON COLUMN warehouse.item_photos.thumbnail_status IS
'Status of thumbnail generation: pending, processing, completed, failed';
```

### New Task Types

```go
// backend/internal/jobs/tasks.go
const (
    // Existing
    TypeLoanReminder          = "loan:reminder"
    TypeCleanupDeletedRecords = "cleanup:deleted_records"
    TypeCleanupOldActivity    = "cleanup:old_activity"

    // New photo tasks
    TypePhotoThumbnail     = "photo:thumbnail"      // Single photo thumbnail
    TypePhotoBulkThumbnail = "photo:bulk_thumbnail" // Regenerate all for item
)
```

### Photo Processor

```go
// backend/internal/jobs/photo_processor.go
package jobs

import (
    "context"
    "encoding/json"

    "github.com/hibiken/asynq"
    "github.com/jackc/pgx/v5/pgxpool"

    "github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
    "github.com/antti/home-warehouse/go-backend/internal/infra/events"
    "github.com/antti/home-warehouse/go-backend/internal/infra/imageprocessor"
)

type PhotoProcessor struct {
    pool        *pgxpool.Pool
    processor   imageprocessor.ImageProcessor
    storage     itemphoto.Storage
    broadcaster *events.Broadcaster
}

func NewPhotoProcessor(
    pool *pgxpool.Pool,
    processor imageprocessor.ImageProcessor,
    storage itemphoto.Storage,
    broadcaster *events.Broadcaster,
) *PhotoProcessor {
    return &PhotoProcessor{
        pool:        pool,
        processor:   processor,
        storage:     storage,
        broadcaster: broadcaster,
    }
}

type ThumbnailPayload struct {
    PhotoID     string `json:"photo_id"`
    WorkspaceID string `json:"workspace_id"`
    StoragePath string `json:"storage_path"`
}

func (p *PhotoProcessor) ProcessThumbnail(ctx context.Context, t *asynq.Task) error {
    var payload ThumbnailPayload
    if err := json.Unmarshal(t.Payload(), &payload); err != nil {
        return err
    }

    // Update status to processing
    if err := p.updateThumbnailStatus(ctx, payload.PhotoID, "processing", nil); err != nil {
        return err
    }

    // Generate thumbnail
    thumbnailPath, err := p.generateThumbnail(ctx, payload.StoragePath)
    if err != nil {
        errStr := err.Error()
        p.updateThumbnailStatus(ctx, payload.PhotoID, "failed", &errStr)
        return err
    }

    // Update record with thumbnail path
    if err := p.saveThumbnailPath(ctx, payload.PhotoID, thumbnailPath); err != nil {
        return err
    }

    // Update status to completed
    if err := p.updateThumbnailStatus(ctx, payload.PhotoID, "completed", nil); err != nil {
        return err
    }

    // Notify frontend via SSE
    if p.broadcaster != nil {
        workspaceID, _ := uuid.Parse(payload.WorkspaceID)
        p.broadcaster.Publish(workspaceID, events.Event{
            Type:       "photo.thumbnail_ready",
            EntityID:   payload.PhotoID,
            EntityType: "item_photo",
            Data: map[string]any{
                "photo_id":       payload.PhotoID,
                "thumbnail_path": thumbnailPath,
            },
        })
    }

    return nil
}

func (p *PhotoProcessor) generateThumbnail(ctx context.Context, storagePath string) (string, error) {
    // Use existing imageprocessor
    // ... implementation
}
```

### Scheduler Registration

```go
// backend/internal/jobs/scheduler.go
func (s *Scheduler) RegisterHandlers(
    emailSender EmailSender,
    pushSender *webpush.Sender,
    cleanupConfig CleanupConfig,
    photoProcessor *PhotoProcessor, // Add this
) *asynq.ServeMux {
    mux := asynq.NewServeMux()

    // Existing handlers
    loanProcessor := NewLoanReminderProcessor(s.pool, emailSender, pushSender)
    mux.HandleFunc(TypeLoanReminder, loanProcessor.ProcessTask)

    cleanupProcessor := NewCleanupProcessor(s.pool, cleanupConfig)
    mux.HandleFunc(TypeCleanupDeletedRecords, cleanupProcessor.ProcessDeletedRecordsCleanup)
    mux.HandleFunc(TypeCleanupOldActivity, cleanupProcessor.ProcessActivityCleanup)

    // New photo handlers
    mux.HandleFunc(TypePhotoThumbnail, photoProcessor.ProcessThumbnail)

    return mux
}
```

### Upload Service Modification

```go
// In itemphoto/service.go - modify UploadPhoto
func (s *Service) UploadPhoto(...) (*ItemPhoto, error) {
    // ... existing validation ...

    // Save original file (unchanged)
    storagePath, err := s.storage.Save(ctx, ...)

    // Create photo record WITHOUT thumbnail
    photo := &ItemPhoto{
        ID:              uuid.New(),
        ItemID:          itemID,
        WorkspaceID:     workspaceID,
        Filename:        header.Filename,
        StoragePath:     storagePath,
        ThumbnailPath:   "",              // Empty initially
        ThumbnailStatus: "pending",       // New field
        // ... rest of fields
    }

    // Save to database
    createdPhoto, err := s.repo.Create(ctx, photo)
    if err != nil {
        s.storage.Delete(ctx, storagePath)
        return nil, err
    }

    // Enqueue thumbnail generation (async)
    if s.jobClient != nil {
        payload, _ := json.Marshal(ThumbnailPayload{
            PhotoID:     createdPhoto.ID.String(),
            WorkspaceID: workspaceID.String(),
            StoragePath: storagePath,
        })
        task := asynq.NewTask(jobs.TypePhotoThumbnail, payload)
        s.jobClient.Enqueue(task, asynq.Queue(jobs.QueueDefault))
    }

    return createdPhoto, nil
}
```

---

## 4. Bulk Photo Operations

### Extend Existing Batch Pattern

Follow the pattern from `batch/handler.go` and `batch/types.go`.

### API Endpoint

```
POST /workspaces/{workspace_id}/items/{item_id}/photos/bulk
```

### Request/Response Types

```go
// backend/internal/domain/warehouse/itemphoto/bulk_types.go

type BulkPhotoOperation struct {
    Operation string     `json:"operation"` // "delete", "set_primary", "update_caption"
    PhotoID   uuid.UUID  `json:"photo_id"`
    Caption   *string    `json:"caption,omitempty"` // For update_caption
}

type BulkPhotoReorder struct {
    Operation string      `json:"operation"` // "reorder"
    PhotoIDs  []uuid.UUID `json:"photo_ids"` // Ordered list
}

type BulkPhotoRequest struct {
    Operations []json.RawMessage `json:"operations"`
}

type BulkPhotoResult struct {
    Index    int        `json:"index"`
    Status   string     `json:"status"` // "success", "error"
    PhotoID  *uuid.UUID `json:"photo_id,omitempty"`
    Error    *string    `json:"error,omitempty"`
}

type BulkPhotoResponse struct {
    Results   []BulkPhotoResult `json:"results"`
    Succeeded int               `json:"succeeded"`
    Failed    int               `json:"failed"`
}
```

### Handler Implementation

```go
// In itemphoto/handler.go - add bulk endpoint
func (h *Handler) BulkOperations(ctx context.Context, input *BulkPhotoInput) (*BulkPhotoOutput, error) {
    workspaceID, _ := middleware.GetWorkspaceID(ctx)
    itemID := input.ItemID

    response := &BulkPhotoResponse{
        Results: make([]BulkPhotoResult, len(input.Body.Operations)),
    }

    for i, rawOp := range input.Body.Operations {
        result := h.processOperation(ctx, workspaceID, itemID, i, rawOp)
        response.Results[i] = result

        if result.Status == "success" {
            response.Succeeded++
        } else {
            response.Failed++
        }
    }

    return &BulkPhotoOutput{Body: *response}, nil
}
```

---

## Component Boundaries Summary

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `repair` domain | Repair CRUD, status transitions | `inventory` (FK), `activity` (logging) |
| `declutter` service | Query aggregation for candidates | `inventory`, `activity_log`, `loans` (read-only) |
| `PhotoProcessor` job | Async thumbnail generation | `itemphoto` repo, `imageprocessor`, SSE broadcaster |
| `itemphoto` handler | Bulk photo operations | `itemphoto` service |

## Data Flow Diagrams

### Repair Creation Flow
```
Frontend -> POST /repairs
Handler -> repair.Service.Create()
  -> Validate inventory exists & workspace access
  -> Create Repair entity (status: PENDING)
  -> repo.Create() (database insert)
  -> activity.Service.Log() (audit trail)
  -> Return Repair
```

### Declutter Query Flow
```
Frontend -> GET /declutter/candidates?limit=100
Handler -> declutter.Service.GetCandidates()
  -> Single optimized SQL query with subqueries
  -> Return raw candidate data (no scoring)
Frontend -> calculateDeclutterScore() for each candidate
Frontend -> Sort by score, display with reasons
```

### Photo Upload with Async Thumbnail
```
Frontend -> POST /items/{id}/photos (multipart)
Handler -> itemphoto.Service.UploadPhoto()
  -> Validate file (size, type)
  -> Save original to storage
  -> Create ItemPhoto record (thumbnail_status='pending')
  -> asynq.Client.Enqueue(TypePhotoThumbnail, payload)
  -> Return ItemPhoto (no thumbnail yet)

Worker (async) -> PhotoProcessor.ProcessThumbnail()
  -> Update status to 'processing'
  -> imageprocessor.GenerateThumbnail()
  -> Save thumbnail to storage
  -> Update ItemPhoto record (thumbnail_path, status='completed')
  -> broadcaster.Publish(workspace, {type: "photo.thumbnail_ready"})

Frontend (via SSE) -> Receive photo.thumbnail_ready event
  -> Update photo display with thumbnail URL
```

---

## Build Order (Dependency Consideration)

### Phase 2.1: Repair Log (no dependencies on other new features)
1. Database migration (`003_repairs.sql`)
2. Domain package: `repair/entity.go`, `errors.go`
3. Repository interface + implementation
4. Service layer with activity logging
5. HTTP handler routes
6. Update activity enum (migration + Go code)
7. Tests

### Phase 2.2: Declutter Assistant (depends on existing activity_log data)
1. SQL query development + EXPLAIN analysis
2. Service layer
3. HTTP handler endpoint
4. Frontend scoring logic
5. UI components (list, filtering, score display)
6. Tests

### Phase 2.3: Background Photo Processing (depends on existing itemphoto + jobs)
1. Database migration (add status columns)
2. PhotoProcessor task implementation
3. Scheduler registration
4. Service refactor (remove sync thumbnail, add job enqueueing)
5. SSE event integration
6. Frontend: handle pending thumbnails, SSE updates
7. Tests

### Phase 2.4: Bulk Photo Operations (can parallel with 2.3)
1. Bulk types definition
2. Handler endpoint
3. Service methods (transactional where needed)
4. Frontend batch delete/reorder UI
5. Tests

---

## Patterns to Follow

### Domain Entity Pattern (from `loan/entity.go`)
- Private fields with public getters
- `New*()` constructor with validation
- `Reconstruct()` for database hydration
- Domain methods for state transitions (`Start()`, `Complete()`, `Abandon()`)

### Repository Interface Pattern (from `loan/repository.go`)
- Define interface in domain package
- Implement in `infra/postgres/`
- Use sqlc-generated queries

### Asynq Task Pattern (from `jobs/loan_reminders.go`)
- Task constructor creates `*asynq.Task`
- Processor struct with `Process*` method
- Registration in `scheduler.go`

### Activity Logging Pattern (from existing services)
- Log after successful mutations
- Include entity name for display

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous Heavy Processing
**What:** Generating thumbnails in the upload request
**Why bad:** Blocks user, causes timeouts on large images
**Instead:** Enqueue to asynq, notify via SSE when complete

### Anti-Pattern 2: N+1 Queries in Declutter
**What:** Fetching inventory, then querying activity per item
**Why bad:** 1000 items = 1001 queries
**Instead:** Single query with subqueries/CTEs

### Anti-Pattern 3: Direct Inventory Mutation from Repair
**What:** Repair service directly updating inventory condition
**Why bad:** Bypasses inventory service validation, dual source of truth
**Instead:** Repair tracks state, user manually updates inventory if needed

### Anti-Pattern 4: Storing Calculated Scores
**What:** Persisting declutter scores to database
**Why bad:** Stale quickly, user can't adjust weights, storage overhead
**Instead:** Calculate on-demand from raw data in frontend

---

## Scalability Considerations

| Concern | At 100 items | At 10K items | At 100K items |
|---------|--------------|--------------|---------------|
| Declutter query | < 100ms | 500ms-1s | Pagination + index tuning |
| Photo thumbnails | Sync OK | Async required | Async + rate limiting |
| Repair history | Single query | Pagination | Archive old repairs yearly |

---

## Sources

- **HIGH Confidence (Direct Code Analysis):**
  - `backend/internal/domain/warehouse/loan/entity.go` - Entity pattern
  - `backend/internal/jobs/scheduler.go` - Asynq integration
  - `backend/internal/domain/warehouse/itemphoto/service.go` - Photo handling
  - `backend/internal/domain/batch/service.go` - Batch operations pattern
  - `backend/db/migrations/001_initial_schema.sql` - Schema conventions
  - `backend/internal/domain/warehouse/activity/entity.go` - Audit trail

- **MEDIUM Confidence (Existing Infrastructure):**
  - `backend/internal/infra/imageprocessor/IMPLEMENTATION.md` - Thumbnail generation
  - `backend/internal/infra/queue/redis_queue.go` - Queue patterns
  - `backend/internal/infra/events/` - SSE broadcasting
