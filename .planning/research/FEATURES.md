# Feature Landscape: v1.2 Phase 2 - Repair Tracking & Declutter Assistant

**Domain:** Home inventory management with maintenance tracking and organization assistance
**Researched:** 2026-01-25
**Confidence:** MEDIUM (domain patterns verified, implementation details inferred from industry standards)

## Current State Assessment

The application already has foundational capabilities relevant to these features:

| Existing Feature | Implementation | Relevance |
|------------------|----------------|-----------|
| Item condition tracking | `item_condition_enum`: NEW, EXCELLENT, GOOD, FAIR, POOR, DAMAGED, FOR_REPAIR | Direct - repair tracking builds on FOR_REPAIR status |
| Activity logging | `activity_log` table with JSONB changes field | Reusable pattern for repair history |
| Item photos | Full upload, thumbnail, captions, ordering | Foundation for bulk photo operations |
| Inventory movements | `inventory_movements` table with history | Similar pattern for repair history |
| Date tracking | `date_acquired`, `warranty_expires`, `expiration_date` | Pattern for repair dates |
| Loans with due dates | `loans` table with `due_date`, reminders | Pattern for scheduled maintenance |

---

## Repair Tracking Features

### Table Stakes

Features users expect from repair/maintenance tracking in inventory apps. Missing = incomplete feature.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Repair history log | Core use case - "what was done to this item?" | Medium | New `repair_log` table | Links to inventory, not items (per-instance history) |
| Repair date tracking | Know when repairs happened | Low | `repaired_at` field | Required for history timeline |
| Repair description | What was actually done | Low | `description` text field | Free-form notes about the repair |
| Repair cost tracking | Track money spent on maintenance | Low | `cost` integer (cents) + `currency_code` | Matches existing `purchase_price` pattern |
| Condition change on repair | Repair should update item condition | Low | Existing `condition` enum | DAMAGED -> GOOD after repair |
| Link repairs to service provider | Who did the repair | Low | Optional `service_provider` text | Simple text, not full entity |
| View repair history on item detail | See all repairs for an inventory item | Low | Query + UI component | Chronological list view |

### Differentiators

Features that distinguish a well-implemented repair tracking system.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Repair photos (before/after) | Visual documentation of repairs | Medium | Extend `item_photos` pattern | Optional photo attachments per repair |
| Repair receipts/attachments | Store warranty claims, invoices | Medium | Existing `attachments` table | Link attachments to repair entries |
| Total repair cost per item | Lifecycle cost analysis | Low | Aggregation query | "Is this item worth keeping?" |
| Repair reminders | Scheduled maintenance alerts | Medium | Notification system | Similar to loan due date reminders |
| Repair triggers for condition | Auto-update condition on repair completion | Low | Domain logic | If repair marked complete, prompt condition update |
| Warranty claim tracking | Mark repairs as warranty claims | Low | `is_warranty_claim` boolean | Useful for warranty tracking users |
| Repair status workflow | Track repair progress (pending/in-progress/complete) | Low | `repair_status` enum | Simple state machine |

### Anti-Features

Features to explicitly NOT build for repair tracking.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full CMMS work order system | Over-engineered for home use; CMMS features like MTBF, work order assignments, PM schedules add complexity without home user value | Simple repair log with optional reminders |
| Preventive maintenance calendars | Complex scheduling, low home user adoption; most home users react to issues rather than schedule PM | Allow manual "next service due" date field |
| Technician assignment/labor tracking | Multi-user complexity; home warehouses rarely have dedicated technicians | Simple "service provider" text field |
| Part inventory integration | Scope creep; managing parts inventory is a separate domain | Notes field for parts used |
| Repair approval workflows | Unnecessary for personal inventory | Direct repair logging |
| Equipment hierarchies (parent/child repairs) | CMMS pattern that adds complexity | Flat repair-per-inventory-item |

---

## Declutter Assistant Features

### Table Stakes

Features users expect from a declutter suggestion system. Missing = not useful.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| "Last used" date tracking | Core signal for unused items | Medium | New `last_used_at` field on inventory | Manual update or loan-based inference |
| Unused items list | Surface items not used in X days | Low | Query + UI | Configurable threshold (90/180/365 days) |
| Filter by time threshold | User chooses "unused for 90 days" vs "1 year" | Low | UI filter control | Common thresholds: 90, 180, 365 days |
| Item value display | Help prioritize what to declutter | Low | Existing `purchase_price` | Show value alongside unused items |
| Quick action: mark as used | Update last_used_at easily | Low | Single-click action | "I used this" button |

### Differentiators

Features that make declutter suggestions genuinely helpful.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Declutter score/ranking | Prioritize items by unused time + value | Medium | Algorithm combining multiple factors | Higher score = better candidate for declutter |
| Category-based suggestions | "You have 15 unused items in Electronics" | Low | Group by category | Quick category overview |
| Location-based view | "Garage has 23 unused items" | Low | Group by location | Helps with room-by-room decluttering |
| Seasonal awareness | Don't suggest holiday decorations in January | Medium | Category + date logic | Optional sophistication |
| Estimated resale value | Help decide keep vs sell | High | External APIs or manual entry | Could use eBay/FB Marketplace estimates |
| Action suggestions | Keep/Sell/Donate/Dispose recommendations | Medium | Simple rules or user preference | Based on value thresholds |
| Declutter progress tracking | Gamification - "decluttered 15 items this month" | Low | Count disposed/archived items | Motivational feature |
| Export declutter list | Share with partner, create selling list | Low | Export to CSV/PDF | Planning feature |

### Anti-Features

Features to explicitly NOT build for declutter assistant.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI room scanning | Complex, requires camera integration, privacy concerns; Decluttify does this but requires significant ML investment | Manual inventory with good search/filter |
| Automatic usage tracking | Would require IoT integration, invasive; no reasonable way to auto-detect item usage | Manual "mark as used" or infer from loans |
| Automatic disposal actions | Dangerous - user must explicitly decide | Suggestions only, user confirms actions |
| Social sharing of declutter | Privacy risk, unnecessary complexity | Export for manual sharing if desired |
| Marketplace integration (auto-listing) | Scope creep, API complexity, liability | Link to external marketplaces manually |
| KonMari "spark joy" prompts | Philosophical approach not suitable for app UX | Practical unused-time metrics |
| Aggressive notifications | "You haven't used X in 6 months!" is annoying | On-demand declutter review, not push |

---

## Bulk Photo Operations Features

### Table Stakes

Features users expect when managing multiple photos.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Multi-select photos | Select several photos for bulk action | Low | UI pattern | Checkbox or long-press selection |
| Bulk delete | Remove multiple photos at once | Low | Batch API endpoint | Confirmation required |
| Bulk caption edit | Add same caption to multiple photos | Low | Batch update endpoint | Template with item name variable |
| Reorder photos (drag-drop) | Already exists but verify | Low | Existing `display_order` | May need touch-friendly UI |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Bulk upload with progress | Upload 10+ photos with progress bar | Medium | Chunked upload, progress tracking | Better UX for large batches |
| Auto-rotate based on EXIF | Correct orientation automatically | Low | Backend image processing | Already may exist in thumbnail generation |
| Bulk download (zip) | Export all item photos | Medium | Server-side zip generation | Useful for backup/insurance |
| Photo compression options | Choose quality vs size tradeoff | Medium | Backend processing options | Save storage space |
| Duplicate photo detection | Warn before uploading same image | Medium | Hash comparison | Prevent accidental duplicates |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full photo editor | Scope creep; users have phone editors | Crop/rotate only if needed |
| AI object detection | Complex, expensive, limited value for home inventory | Manual categorization |
| Photo backup service | Separate concern, liability | Export/download features |
| Social sharing from app | Privacy risk, out of scope | Standard OS share sheet |

---

## Background Thumbnail Processing Features

### Table Stakes

Features needed for reliable background processing.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Async thumbnail generation | Don't block upload on thumbnail creation | Medium | Queue + worker pattern | Already have Redis worker infrastructure |
| Processing status indicator | Know when thumbnails are ready | Low | Status field + UI | "Processing..." placeholder |
| Retry on failure | Recover from transient errors | Low | Worker retry logic | Exponential backoff |
| Error reporting | Know when processing fails permanently | Low | Error logging + UI notification | Admin visibility |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Multiple thumbnail sizes | Optimize for different UI contexts | Medium | Generate small/medium/large | Better performance on list vs detail views |
| WebP conversion | Smaller file sizes, faster loading | Low | Image processing library | Modern format with good support |
| Progressive JPEG | Faster perceived loading | Low | Encoding option | Better UX on slow connections |
| Batch reprocessing | Regenerate all thumbnails if settings change | Medium | Admin tool | Useful if thumbnail size requirements change |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time processing in service worker | PWA service workers have limited CPU time; iOS especially restrictive | Server-side processing with worker |
| Client-side thumbnail generation | Inconsistent results, battery drain | Server-side with queue |
| Infinite thumbnail variants | Storage cost, processing overhead | Fixed set of useful sizes |

---

## Feature Dependencies

```
Existing Infrastructure:
  - activity_log table -----------------> Pattern for repair_log
  - item_photos system ----------------> Extend for repair photos, bulk ops
  - inventory.condition enum ----------> FOR_REPAIR status exists
  - Redis worker infrastructure -------> Background thumbnail processing
  - notifications table ---------------> Repair reminders

New Features - Repair Tracking:
  1. repair_log table (core)
     - id, inventory_id, workspace_id
     - repaired_at, description, cost, currency_code
     - service_provider, is_warranty_claim
     - repair_status (pending/in_progress/completed)
     - condition_before, condition_after
     - created_by, created_at, updated_at

  2. Repair photos (optional)
     - Link existing item_photos or separate repair_photos table
     - Consider: repair_attachments junction table

  3. Repair UI
     - Add to inventory detail page
     - Repair history list
     - Add repair form

New Features - Declutter Assistant:
  1. last_used_at field on inventory
     - Nullable timestamp
     - Updated manually or on loan return

  2. Declutter queries
     - Unused items by threshold
     - Group by category/location
     - Calculate declutter score

  3. Declutter UI
     - Dedicated declutter view
     - Quick actions (mark used, archive, etc.)

New Features - Bulk Photo Operations:
  1. Batch API endpoints
     - POST /photos/bulk-delete
     - PATCH /photos/bulk-update

  2. Multi-select UI
     - Selection mode toggle
     - Bulk action toolbar

Dependencies Graph:
  repair_log -> inventory (FK)
  repair_log -> users (FK: created_by)
  declutter queries -> inventory.last_used_at
  bulk photo ops -> existing item_photos system
  thumbnail processing -> existing Redis worker
```

---

## Database Schema Recommendations

### Repair Log Table

```sql
CREATE TYPE warehouse.repair_status_enum AS ENUM (
    'pending',      -- Repair needed, not started
    'in_progress',  -- Currently being repaired
    'completed'     -- Repair finished
);

CREATE TABLE warehouse.repair_log (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES auth.workspaces(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES warehouse.inventory(id) ON DELETE CASCADE,

    -- Repair details
    repaired_at TIMESTAMPTZ,  -- NULL if not yet completed
    description TEXT NOT NULL,
    cost INTEGER,  -- In cents, matches purchase_price pattern
    currency_code VARCHAR(3) DEFAULT 'EUR',
    service_provider VARCHAR(200),

    -- Status tracking
    repair_status warehouse.repair_status_enum NOT NULL DEFAULT 'pending',
    is_warranty_claim BOOLEAN DEFAULT false,

    -- Condition tracking
    condition_before warehouse.item_condition_enum,
    condition_after warehouse.item_condition_enum,

    -- Audit
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_log_inventory ON warehouse.repair_log(inventory_id);
CREATE INDEX idx_repair_log_workspace ON warehouse.repair_log(workspace_id);
CREATE INDEX idx_repair_log_status ON warehouse.repair_log(workspace_id, repair_status);
```

### Inventory Extension for Declutter

```sql
ALTER TABLE warehouse.inventory
ADD COLUMN last_used_at TIMESTAMPTZ;

-- Index for efficient unused item queries
CREATE INDEX idx_inventory_last_used ON warehouse.inventory(workspace_id, last_used_at)
WHERE is_archived = false;
```

---

## MVP Recommendation

### Phase 1: Repair Tracking Core

**Effort:** ~12-16 hours

1. **repair_log table migration** (2h)
2. **Backend: repair CRUD endpoints** (4h)
   - Create, Read (list by inventory), Update, Delete
   - Include condition update on repair completion
3. **Frontend: repair history UI** (4h)
   - List view on inventory detail page
   - Add repair form/dialog
   - Repair history timeline
4. **Activity log integration** (2h)
   - Log repair create/update/complete actions

### Phase 2: Declutter Assistant Core

**Effort:** ~10-14 hours

1. **Inventory schema migration** (1h)
   - Add `last_used_at` column
2. **Backend: declutter endpoints** (3h)
   - GET /declutter/suggestions?threshold=90
   - PATCH /inventory/:id/mark-used
3. **Frontend: declutter view** (6h)
   - Unused items list with filters
   - Quick actions (mark used, archive)
   - Category/location grouping
4. **Loan integration** (2h)
   - Auto-update `last_used_at` on loan return

### Phase 3: Bulk Photo Operations

**Effort:** ~8-10 hours

1. **Backend: batch endpoints** (3h)
   - POST /photos/bulk-delete
   - PATCH /photos/bulk-update (captions)
2. **Frontend: multi-select UI** (4h)
   - Selection mode toggle
   - Bulk action toolbar
   - Confirmation dialogs
3. **Background processing improvements** (if needed) (3h)
   - Verify thumbnail queue is robust
   - Add processing status indicator

### Defer to Post-MVP

- Repair photos/attachments
- Repair reminders
- Seasonal declutter awareness
- Estimated resale values
- Multiple thumbnail sizes
- WebP conversion

---

## Sources

### Maintenance/Repair Tracking Patterns
- [BarCloud Asset Maintenance Tracking](https://barcloud.com/product/maintenance-tracking/)
- [Connecteam Maintenance Management Software 2026](https://connecteam.com/best-maintenance-management-software/)
- [HomeZada Home Maintenance](https://www.homezada.com/homeowners/home-maintenance)
- [Under My Roof App](https://apps.apple.com/us/app/under-my-roof-home-inventory/id1524335878)
- [EZO Equipment Maintenance Log Guide](https://ezo.io/ezofficeinventory/blog/equipment-maintenance-log/)
- [Fabrico Work Order Types](https://www.fabrico.io/blog/work-order-types-explained/)

### Declutter/Unused Item Patterns
- [Decluttify App](https://play.google.com/store/apps/details?id=com.asanarebel.Decluttify&hl=en_US)
- [Sortly Inventory Features](https://www.sortly.com/features/)
- [Good Housekeeping 90/90 Rule](https://www.goodhousekeeping.com/home/organizing/a70025689/before-you-declutter-i-tried-90-90-rule/)
- [Clean.Email Best Decluttering Apps 2026](https://clean.email/blog/email-management/best-decluttering-apps)
- [MyAssets Decluttering Apps](https://myassets.com/blog/asset-management/apps-for-decluttering/)

### Bulk Photo Operations
- [BatchPhoto Features](https://www.batchphoto.com/)
- [MDN Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [ZeePalm Background Sync PWA Guide](https://www.zeepalm.com/blog/background-sync-in-pwas-service-worker-guide)

### Existing Codebase (Primary Source)
- `/backend/db/migrations/001_initial_schema.sql` - Current schema patterns
- `/backend/internal/domain/warehouse/inventory/entity.go` - Condition/Status enums
- `/backend/internal/domain/warehouse/itemphoto/` - Photo handling patterns
- `/.planning/PROJECT.md` - Project context and constraints
