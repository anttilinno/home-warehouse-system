# Phase 13: Repair Log Extensions - Research

**Researched:** 2026-01-25
**Domain:** Repair photos, attachments, lifecycle cost, warranty claims, maintenance reminders
**Confidence:** HIGH

## Summary

Phase 13 extends the repair log functionality from Phase 12 with photos, attachments, cost aggregation, warranty flag, and scheduled reminders. All required infrastructure already exists in the codebase:

- **Photos**: Existing `itemphoto` domain with Storage + ImageProcessor + multipart upload provides a complete pattern for repair photos
- **Attachments**: Existing `attachment` domain with File storage supports receipts/documents with minimal adaptation
- **Notifications/Reminders**: Existing `notification` entity + `jobs/scheduler` with asynq provides pattern for scheduled maintenance reminders
- **Cost Aggregation**: Simple SQL aggregation query - no library needed

The approach is straightforward: create new tables for repair-specific photos/attachments (following item patterns), add `is_warranty_claim` flag to repair_logs, add `reminder_date` field, and implement a scheduled job similar to loan_reminders.

**Primary recommendation:** Model repair photos/attachments after the existing item patterns. Reuse the same Storage and ImageProcessor interfaces. Add maintenance reminders following the loan reminder job pattern.

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
| disintegration/imaging | latest | Image processing | Already used for item photos |
| kolesa-team/go-webp | latest | WebP encoding | Already used for thumbnails |
| hibiken/asynq | latest | Background job scheduling | Already used for loan reminders |

### Supporting (Already in Use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pgtype | v5 | PostgreSQL type handling | Nullable fields, dates |
| testify | v1 | Testing assertions | All tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate repair_photos table | Extend item_photos with entity_type | Cleaner separation, simpler queries - prefer separate table |
| User-defined reminder time | Fixed reminder days before | Simpler implementation - use fixed 3-day window like loans |

**Installation:**
No new dependencies needed - all libraries already in project.

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── db/
│   └── migrations/
│       └── 004_repair_log_extensions.sql    # New tables + columns
├── db/
│   └── queries/
│       ├── repair_logs.sql                   # Extended queries
│       ├── repair_photos.sql                 # NEW: Photo queries
│       └── repair_attachments.sql            # NEW: Attachment queries
├── internal/
│   ├── domain/
│   │   └── warehouse/
│   │       ├── repairlog/
│   │       │   ├── entity.go                 # Extended with warranty/reminder
│   │       │   ├── service.go                # Extended service
│   │       │   └── handler.go                # Extended handlers
│   │       ├── repairphoto/                  # NEW DOMAIN
│   │       │   ├── entity.go                 # Similar to itemphoto
│   │       │   ├── service.go                # Reuses Storage/ImageProcessor
│   │       │   ├── handler.go                # Multipart upload
│   │       │   └── repository.go
│   │       └── repairattachment/             # NEW DOMAIN (optional - can extend attachment)
│   │           └── ...
│   └── jobs/
│       ├── tasks.go                          # Add TypeRepairReminder
│       ├── scheduler.go                      # Register repair reminder task
│       └── repair_reminders.go               # NEW: Like loan_reminders.go
frontend/
├── lib/
│   ├── api/
│   │   └── repair-logs.ts                    # Extended API client
│   └── types/
│       └── repair-log.ts                     # Extended types
└── components/
    └── inventory/
        └── repair-history.tsx                # Extended with photo/attachment UI
```

### Pattern 1: Repair Photos Following Item Photos Pattern
**What:** New repairphoto domain that mirrors itemphoto structure
**When to use:** For before/after photos attached to repairs
**Example:**
```go
// Source: Existing itemphoto pattern
// backend/internal/domain/warehouse/repairphoto/entity.go
type RepairPhoto struct {
    ID            uuid.UUID
    RepairLogID   uuid.UUID  // Instead of ItemID
    WorkspaceID   uuid.UUID
    PhotoType     PhotoType  // BEFORE, AFTER, DURING
    Filename      string
    StoragePath   string
    ThumbnailPath string
    FileSize      int64
    MimeType      string
    Width         int32
    Height        int32
    DisplayOrder  int32
    Caption       *string
    UploadedBy    uuid.UUID
    CreatedAt     time.Time
    UpdatedAt     time.Time
}

type PhotoType string

const (
    PhotoTypeBefore PhotoType = "BEFORE"
    PhotoTypeDuring PhotoType = "DURING"
    PhotoTypeAfter  PhotoType = "AFTER"
)
```

### Pattern 2: Repair Attachments Extending Attachment Pattern
**What:** Link existing attachment system to repair logs
**When to use:** For receipts, invoices, warranty documents
**Example:**
```go
// Option 1: New junction table (recommended - cleaner)
// warehouse.repair_attachments links repair_logs to files

// Option 2: Extend existing attachment with repair_log_id
// Requires schema change to existing table

// Recommended approach - new repair_attachments table:
CREATE TABLE warehouse.repair_attachments (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    repair_log_id uuid NOT NULL REFERENCES warehouse.repair_logs(id) ON DELETE CASCADE,
    file_id uuid NOT NULL REFERENCES warehouse.files(id) ON DELETE CASCADE,
    attachment_type warehouse.attachment_type_enum NOT NULL,
    title VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Pattern 3: Lifecycle Cost Aggregation
**What:** Query to sum all repair costs for an inventory item
**When to use:** Display total repair cost in inventory detail
**Example:**
```sql
-- Source: Standard SQL aggregation
-- name: GetTotalRepairCostByInventory :one
SELECT
    COALESCE(SUM(cost), 0)::int AS total_cost_cents,
    COUNT(*)::int AS repair_count
FROM warehouse.repair_logs
WHERE workspace_id = $1
  AND inventory_id = $2
  AND status = 'COMPLETED';

-- Can also aggregate across all inventory for an item
-- name: GetTotalRepairCostByItem :one
SELECT
    COALESCE(SUM(rl.cost), 0)::int AS total_cost_cents,
    COUNT(*)::int AS repair_count
FROM warehouse.repair_logs rl
JOIN warehouse.inventory inv ON rl.inventory_id = inv.id
WHERE inv.workspace_id = $1
  AND inv.item_id = $2
  AND rl.status = 'COMPLETED';
```

### Pattern 4: Maintenance Reminder Job Following Loan Pattern
**What:** Scheduled job that checks for upcoming repair reminders
**When to use:** For future maintenance scheduling
**Example:**
```go
// Source: Existing loan_reminders.go pattern
// backend/internal/jobs/repair_reminders.go

const TypeRepairReminder = "repair:reminder"

type RepairReminderPayload struct {
    RepairLogID   uuid.UUID `json:"repair_log_id"`
    WorkspaceID   uuid.UUID `json:"workspace_id"`
    ItemName      string    `json:"item_name"`
    Description   string    `json:"description"`
    ReminderDate  time.Time `json:"reminder_date"`
}

// SQL query to find repairs needing reminders
-- name: ListRepairsNeedingReminder :many
SELECT
    rl.id,
    rl.workspace_id,
    rl.description,
    rl.reminder_date,
    it.name as item_name
FROM warehouse.repair_logs rl
JOIN warehouse.inventory inv ON rl.inventory_id = inv.id
JOIN warehouse.items it ON inv.item_id = it.id
WHERE rl.reminder_date IS NOT NULL
  AND rl.reminder_date <= $1
  AND rl.reminder_sent = false;
```

### Anti-Patterns to Avoid
- **Storing photos in repair_logs directly:** Use separate table for photos, allows multiple per repair
- **Single attachment model for both items and repairs:** Keep domains separate for clarity
- **Complex reminder scheduling UI:** Start simple with date field, not recurring patterns
- **Real-time aggregation without caching:** For high-traffic scenarios, consider caching totals

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image upload/processing | Custom upload logic | itemphoto pattern + Storage interface | Already handles validation, thumbnails, storage |
| Background job scheduling | Cron jobs or goroutines | asynq scheduler | Already integrated, handles retries, monitoring |
| File storage abstraction | Direct filesystem writes | Storage interface | Supports local/S3/etc., already tested |
| Image validation | Manual file checks | ImageProcessor.Validate() | Checks format, dimensions, corruption |
| Notification creation | Custom notification logic | notification.NewNotification() | Consistent notification entity |
| UUID generation | uuid.New() | shared.NewUUID() | Generates UUIDv7 for ordering |

**Key insight:** Every component needed for this phase already exists in the codebase. The work is composition, not creation.

## Common Pitfalls

### Pitfall 1: Orphaned Photos/Attachments on Repair Deletion
**What goes wrong:** Photos remain in storage when repair is deleted
**Why it happens:** ON DELETE CASCADE removes DB records but not files
**How to avoid:** Service layer must delete storage files before/after DB deletion (see itemphoto.DeletePhoto pattern)
**Warning signs:** Storage growing larger than expected, orphaned files accumulating

### Pitfall 2: Reminder Job Running Multiple Times
**What goes wrong:** Same reminder sent repeatedly
**Why it happens:** Missing `reminder_sent` flag or not updating after send
**How to avoid:** Add `reminder_sent BOOLEAN DEFAULT false` and update after successful send
**Warning signs:** Users receiving duplicate reminder notifications

### Pitfall 3: Cost Aggregation Currency Mismatch
**What goes wrong:** Summing costs in different currencies produces incorrect totals
**Why it happens:** Not grouping by currency_code
**How to avoid:** Either require same currency or group by currency in aggregation
**Warning signs:** Totals that don't match manual calculation
```sql
-- Better: Group by currency
SELECT currency_code, SUM(cost)::int as total
FROM warehouse.repair_logs
WHERE workspace_id = $1 AND inventory_id = $2 AND status = 'COMPLETED'
GROUP BY currency_code;
```

### Pitfall 4: Missing Workspace ID in Photo Queries
**What goes wrong:** Photos/attachments leak between workspaces
**Why it happens:** Joining only on repair_log_id without workspace check
**How to avoid:** Always include workspace_id in WHERE clause
**Warning signs:** Security audit finding, photos visible across workspaces

### Pitfall 5: Photo Type Validation Gaps
**What goes wrong:** Arbitrary photo types uploaded
**Why it happens:** Not validating PhotoType enum on upload
**How to avoid:** Validate in entity constructor and handler
**Warning signs:** Database contains invalid photo_type values

## Code Examples

Verified patterns from existing codebase:

### Migration for Phase 13 Extensions
```sql
-- Source: Pattern from existing migrations

-- migrate:up

-- Add warranty claim and reminder fields to repair_logs
ALTER TABLE warehouse.repair_logs
    ADD COLUMN is_warranty_claim BOOLEAN DEFAULT false,
    ADD COLUMN reminder_date DATE,
    ADD COLUMN reminder_sent BOOLEAN DEFAULT false;

COMMENT ON COLUMN warehouse.repair_logs.is_warranty_claim IS
'Whether this repair was covered under warranty.';

COMMENT ON COLUMN warehouse.repair_logs.reminder_date IS
'Optional future date for maintenance reminder.';

CREATE INDEX ix_repair_logs_reminder ON warehouse.repair_logs(reminder_date)
    WHERE reminder_date IS NOT NULL AND reminder_sent = false;

-- Repair photos table
CREATE TYPE warehouse.repair_photo_type_enum AS ENUM (
    'BEFORE',
    'DURING',
    'AFTER'
);

CREATE TABLE warehouse.repair_photos (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    repair_log_id UUID NOT NULL REFERENCES warehouse.repair_logs(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    photo_type warehouse.repair_photo_type_enum NOT NULL DEFAULT 'DURING',
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    caption TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_repair_photos_repair ON warehouse.repair_photos(repair_log_id, display_order);
CREATE INDEX idx_repair_photos_workspace ON warehouse.repair_photos(workspace_id);

-- Repair attachments table (links to existing files table)
CREATE TABLE warehouse.repair_attachments (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    repair_log_id uuid NOT NULL REFERENCES warehouse.repair_logs(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    file_id uuid NOT NULL REFERENCES warehouse.files(id) ON DELETE CASCADE,
    attachment_type warehouse.attachment_type_enum NOT NULL,
    title VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_repair_attachments_repair ON warehouse.repair_attachments(repair_log_id);
CREATE INDEX ix_repair_attachments_workspace ON warehouse.repair_attachments(workspace_id);

-- migrate:down
DROP TABLE IF EXISTS warehouse.repair_attachments;
DROP TABLE IF EXISTS warehouse.repair_photos;
DROP TYPE IF EXISTS warehouse.repair_photo_type_enum;
ALTER TABLE warehouse.repair_logs
    DROP COLUMN IF EXISTS is_warranty_claim,
    DROP COLUMN IF EXISTS reminder_date,
    DROP COLUMN IF EXISTS reminder_sent;
```

### Repair Photo Service (Following Item Photo Pattern)
```go
// Source: Existing itemphoto/service.go pattern
type Service struct {
    repo      Repository
    storage   Storage              // Reuse existing Storage interface
    processor ImageProcessor       // Reuse existing ImageProcessor
    uploadDir string
}

func (s *Service) UploadPhoto(
    ctx context.Context,
    repairLogID, workspaceID, userID uuid.UUID,
    photoType PhotoType,
    file multipart.File,
    header *multipart.FileHeader,
    caption *string,
) (*RepairPhoto, error) {
    // Validate file size and MIME type (same as item photo)
    if header.Size > MaxFileSize {
        return nil, ErrFileTooLarge
    }
    mimeType := header.Header.Get("Content-Type")
    if !isValidMimeType(mimeType) {
        return nil, ErrInvalidFileType
    }

    // Create temp file, validate, generate thumbnail (same pattern)
    // ...

    // Save to storage with repair-specific path
    storagePath, err := s.storage.Save(
        ctx,
        workspaceID.String(),
        fmt.Sprintf("repairs/%s", repairLogID.String()),  // Different path structure
        header.Filename,
        fileReader,
    )
    // ...
}
```

### Frontend Photo Upload Component Extension
```typescript
// Source: Pattern from components/items/photo-upload.tsx
// Extend repair-history.tsx with photo upload section

interface RepairPhotoUploadProps {
  workspaceId: string;
  repairLogId: string;
  photoType: 'BEFORE' | 'DURING' | 'AFTER';
  onUploadComplete?: (photos: RepairPhoto[]) => void;
}

// Uses same drag-drop, preview, progress patterns as item photos
```

### Repair Reminder Scheduler
```go
// Source: Existing loan_reminders.go pattern
func (s *RepairReminderScheduler) ScheduleReminders(ctx context.Context) error {
    q := queries.New(s.pool)

    // Find repairs with reminders due in next 3 days
    reminderDate := time.Now().AddDate(0, 0, 3)
    var pgDate pgtype.Date
    pgDate.Time = reminderDate
    pgDate.Valid = true

    repairs, err := q.ListRepairsNeedingReminder(ctx, pgDate)
    if err != nil {
        return fmt.Errorf("failed to list repairs needing reminder: %w", err)
    }

    for _, repair := range repairs {
        payload := RepairReminderPayload{
            RepairLogID:  repair.ID,
            WorkspaceID:  repair.WorkspaceID,
            ItemName:     repair.ItemName,
            Description:  repair.Description,
            ReminderDate: repair.ReminderDate.Time,
        }
        // Enqueue task...
    }
    return nil
}
```

### Notification Type Addition
```go
// Source: Existing notification/entity.go
// Add new notification type
const (
    TypeLoanDueSoon     NotificationType = "LOAN_DUE_SOON"
    TypeLoanOverdue     NotificationType = "LOAN_OVERDUE"
    TypeLoanReturned    NotificationType = "LOAN_RETURNED"
    TypeLowStock        NotificationType = "LOW_STOCK"
    TypeWorkspaceInvite NotificationType = "WORKSPACE_INVITE"
    TypeMemberJoined    NotificationType = "MEMBER_JOINED"
    TypeSystem          NotificationType = "SYSTEM"
    TypeRepairReminder  NotificationType = "REPAIR_REMINDER"  // NEW
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | N/A | N/A | N/A |

**Deprecated/outdated:**
- None - building on existing patterns

## Open Questions

Things that couldn't be fully resolved:

1. **Recurring maintenance schedules vs. one-time reminders**
   - What we know: Loan reminders use simple date comparison
   - What's unclear: Should repairs support recurring maintenance (e.g., "oil change every 6 months")?
   - Recommendation: Start with one-time reminders. Recurring schedules can be added later if needed. Keep Phase 13 scope simple.

2. **Photo storage path structure**
   - What we know: Item photos use `workspaces/{id}/items/{id}/photos/`
   - What's unclear: Should repairs nest under inventory or be separate?
   - Recommendation: Use `workspaces/{id}/repairs/{id}/photos/` for clarity and isolation

3. **Warranty claim workflow**
   - What we know: Basic boolean flag is planned
   - What's unclear: Should warranty claims have special workflow states (submitted, approved, rejected)?
   - Recommendation: Start with simple boolean. Complex warranty workflow can be a future phase.

4. **Multi-currency cost aggregation**
   - What we know: Each repair stores currency_code
   - What's unclear: How to display total when repairs use different currencies?
   - Recommendation: Group by currency in response, let frontend format appropriately

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `/backend/internal/domain/warehouse/itemphoto/` - Complete photo domain pattern
  - `/backend/internal/domain/warehouse/attachment/` - Attachment with file storage
  - `/backend/internal/domain/auth/notification/` - Notification entity
  - `/backend/internal/jobs/loan_reminders.go` - Scheduled reminder job pattern
  - `/backend/internal/jobs/scheduler.go` - asynq integration
  - `/backend/internal/infra/imageprocessor/` - Image processing
  - `/backend/internal/infra/storage/` - Storage interface
  - `/backend/db/migrations/001_initial_schema.sql` - Table patterns

### Secondary (MEDIUM confidence)
- None needed - all patterns verified from existing codebase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project libraries only, no new dependencies
- Architecture: HIGH - Following established domain patterns from itemphoto/attachment/loans
- Pitfalls: HIGH - Based on observed patterns and multi-tenant concerns in existing code

**Research date:** 2026-01-25
**Valid until:** Indefinite (patterns are stable in this codebase)
