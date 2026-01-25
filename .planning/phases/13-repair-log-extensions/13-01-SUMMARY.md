---
phase: 13-repair-log-extensions
plan: 01
subsystem: database
tags: [repair-logs, photos, attachments, warranty, reminders, sqlc, migration]

dependency-graph:
  requires:
    - "12-repair-log-foundation: repair_logs table and basic CRUD"
  provides:
    - "repair_photos table: before/during/after photos for repairs"
    - "repair_attachments table: link files to repairs"
    - "repair_logs extensions: warranty claims and maintenance reminders"
    - "sqlc queries: full CRUD for photos/attachments, cost aggregation, reminders"
  affects:
    - "13-02: repair photo domain and handlers"
    - "13-03: repair attachment domain"
    - "13-04: maintenance reminder job"

tech-stack:
  added: []
  patterns:
    - "repair_photo_type_enum for BEFORE/DURING/AFTER categorization"
    - "Partial index for efficient reminder queries"
    - "Multi-currency cost aggregation with GROUP BY"

key-files:
  created:
    - backend/db/migrations/004_repair_log_extensions.sql
    - backend/db/queries/repair_photos.sql
    - backend/db/queries/repair_attachments.sql
    - backend/internal/infra/queries/repair_photos.sql.go
    - backend/internal/infra/queries/repair_attachments.sql.go
  modified:
    - backend/db/queries/repair_logs.sql
    - backend/internal/infra/queries/repair_logs.sql.go
    - backend/internal/infra/queries/models.go

decisions:
  - id: repair-photo-type-enum
    choice: "BEFORE/DURING/AFTER enum for categorizing repair photos"
    reason: "Clear workflow stages for documenting repair progress"
  - id: separate-photo-table
    choice: "New repair_photos table rather than extending item_photos"
    reason: "Cleaner separation, repair-specific fields (photo_type), simpler queries"
  - id: multi-currency-aggregation
    choice: "GROUP BY currency_code in cost aggregation"
    reason: "Avoid summing different currencies, let frontend format per-currency totals"

metrics:
  tasks: 3/3
  commits: 3
  duration: ~5min
  completed: 2026-01-25
---

# Phase 13 Plan 01: Database Schema Extensions Summary

**One-liner:** Repair photos, attachments, warranty flags, and maintenance reminders via new tables and sqlc queries

## What Was Done

### Task 1: Migration for repair log extensions
Created `004_repair_log_extensions.sql` with:
- Added `is_warranty_claim`, `reminder_date`, `reminder_sent` columns to `repair_logs`
- Created `repair_photo_type_enum` (BEFORE, DURING, AFTER)
- Created `repair_photos` table with full photo metadata, workspace_id for multi-tenant isolation
- Created `repair_attachments` junction table linking repairs to files
- Added partial index on `reminder_date` for efficient reminder queries

### Task 2: Sqlc queries for repair photos
Created `repair_photos.sql` with 8 queries following `item_photos.sql` pattern:
- InsertRepairPhoto, GetRepairPhoto, ListRepairPhotosByRepairLog
- UpdateRepairPhotoCaption, UpdateRepairPhotoDisplayOrder
- DeleteRepairPhoto, CountRepairPhotosByRepairLog, GetMaxRepairPhotoDisplayOrder

### Task 3: Sqlc queries for attachments and cost aggregation
Created `repair_attachments.sql` with 4 queries:
- InsertRepairAttachment, GetRepairAttachment
- ListRepairAttachmentsByRepairLog (with file JOIN)
- DeleteRepairAttachment

Added to `repair_logs.sql`:
- GetTotalRepairCostByInventory: Sum cost grouped by currency for completed repairs
- ListRepairsNeedingReminder: Find repairs with pending reminders (joins inventory/items for item_name)
- MarkRepairReminderSent: Update reminder_sent flag

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 3a7cdcb | feat(13-01): add repair log extensions migration |
| 44fc1a2 | feat(13-01): add sqlc queries for repair photos |
| d535824 | feat(13-01): add repair attachment queries and cost aggregation |

## Verification

- [x] Migration applies without errors
- [x] sqlc generates without errors
- [x] repair_photos.sql.go exists with InsertRepairPhoto function
- [x] repair_attachments.sql.go exists with InsertRepairAttachment function
- [x] repair_logs.sql.go has GetTotalRepairCostByInventory and ListRepairsNeedingReminder

## Next Phase Readiness

Ready for 13-02 (repair photo domain):
- Database tables exist with proper indexes
- Sqlc queries generated and ready for use
- Multi-tenant security enforced via workspace_id in all queries
