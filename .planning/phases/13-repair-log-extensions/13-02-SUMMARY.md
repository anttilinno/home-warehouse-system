---
phase: 13
plan: 02
subsystem: backend/repairphoto, backend/repairlog
tags: [go, photos, repairs, warranty, reminders]
dependency-graph:
  requires: ["13-01"]
  provides: ["repairphoto-domain", "warranty-claims", "reminder-dates", "repair-cost"]
  affects: ["13-03", "frontend-repairs"]
tech-stack:
  added: []
  patterns: ["multipart-upload", "storage-interface", "photo-processing"]
key-files:
  created:
    - backend/internal/domain/warehouse/repairphoto/entity.go
    - backend/internal/domain/warehouse/repairphoto/repository.go
    - backend/internal/domain/warehouse/repairphoto/service.go
    - backend/internal/domain/warehouse/repairphoto/handler.go
    - backend/internal/infra/postgres/repairphoto_repository.go
  modified:
    - backend/db/queries/repair_logs.sql
    - backend/internal/domain/warehouse/repairlog/entity.go
    - backend/internal/domain/warehouse/repairlog/repository.go
    - backend/internal/domain/warehouse/repairlog/service.go
    - backend/internal/domain/warehouse/repairlog/handler.go
    - backend/internal/infra/postgres/repairlog_repository.go
    - backend/internal/api/router.go
decisions:
  - decision: "PhotoType enum values BEFORE, DURING, AFTER mirror repair workflow stages"
    rationale: "Documents repair progression visually"
  - decision: "Repair photos share same storage infrastructure as item photos"
    rationale: "Consistent photo handling, reuses imageprocessor and local storage"
  - decision: "Warranty claim and reminder date setters fail on completed repairs"
    rationale: "Completed repairs are immutable per existing domain rules"
metrics:
  duration: "13 minutes"
  completed: "2026-01-25"
---

# Phase 13 Plan 02: RepairPhoto Domain and RepairLog Extensions Summary

RepairPhoto domain for repair documentation photos with before/during/after types; extended RepairLog with warranty claim tracking and reminder date support.

## What Was Built

### RepairPhoto Domain
- **entity.go**: PhotoType enum (BEFORE, DURING, AFTER), RepairPhoto struct with validation, URL generation methods
- **repository.go**: Repository interface with Create, GetByID, ListByRepairLog, UpdateCaption, UpdateDisplayOrder, Delete, GetMaxDisplayOrder
- **service.go**: Service with UploadPhoto (multipart + thumbnail), ListPhotos, GetPhoto, UpdateCaption, DeletePhoto
- **handler.go**: REST API handlers for photo CRUD, multipart upload handler, file serving endpoints

### RepairLog Extensions
- **New entity fields**: isWarrantyClaim (bool), reminderDate (*time.Time), reminderSent (bool)
- **New domain methods**: SetWarrantyClaim, SetReminderDate, MarkReminderSent
- **New service methods**: SetWarrantyClaim, SetReminderDate, GetTotalRepairCost
- **New handler endpoint**: GET /inventory/{id}/repair-cost for lifecycle cost queries

### Infrastructure
- **repairphoto_repository.go**: PostgreSQL implementation using sqlc queries
- **repair_logs.sql**: Added UpdateRepairLogWarrantyClaim, UpdateRepairLogReminderDate, CreateRepairLogWithWarranty queries
- **router.go**: Registered repairphoto routes with URL generator and storage getter

## API Endpoints

### RepairPhoto API
| Method | Path | Description |
|--------|------|-------------|
| POST | /repairs/{repair_log_id}/photos | Upload photo (multipart) |
| GET | /repairs/{repair_log_id}/photos/list | List photos for repair |
| GET | /repairs/{repair_log_id}/photos/{id} | Get photo metadata |
| PUT | /repairs/{repair_log_id}/photos/{id}/caption | Update caption |
| DELETE | /repairs/{repair_log_id}/photos/{id} | Delete photo |
| GET | /repairs/{repair_log_id}/photos/{photo_id}/file | Serve full-size photo |
| GET | /repairs/{repair_log_id}/photos/{photo_id}/thumbnail | Serve thumbnail |

### RepairLog Extended API
| Method | Path | Description |
|--------|------|-------------|
| POST | /repairs | Now accepts is_warranty_claim, reminder_date |
| GET | /inventory/{id}/repair-cost | Get total repair cost summary by currency |

## Technical Decisions

1. **Photo type validation**: Only BEFORE, DURING, AFTER are valid - enforced at entity creation
2. **Storage path structure**: `workspaces/{workspaceID}/repairs/{repairLogID}/photos/{filename}`
3. **Thumbnail generation**: 400x400 max, uses shared imageprocessor infrastructure
4. **Warranty immutability**: Cannot change warranty claim or reminder on completed repairs
5. **Cost aggregation**: Groups by currency_code, sums only COMPLETED repairs

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| c8cac3d | feat(13-02): create repairphoto domain entity and repository |
| e9d7272 | feat(13-02): add repairphoto service, handler and router integration |
| 88d19c7 | feat(13-02): extend repairlog with warranty claims and reminders |

## Verification Results

- [x] Server compiles: `go build ./backend/cmd/server/...`
- [x] repairlog tests pass: `go test ./backend/internal/domain/warehouse/repairlog/...`
- [x] Routes registered: grep confirms "repairs.*photos" patterns in handler
- [x] Photo upload endpoint accepts photo_type parameter

## Next Phase Readiness

Ready for 13-03 (Frontend Integration) which will:
- Create RepairPhoto TypeScript types and API client
- Extend repair log forms with warranty claim and reminder date fields
- Display photo galleries on repair detail views
- Show lifecycle cost summary on inventory pages
