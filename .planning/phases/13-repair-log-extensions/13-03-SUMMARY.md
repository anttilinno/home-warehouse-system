---
phase: 13-repair-log-extensions
plan: 03
subsystem: backend
completed: 2026-01-25
duration: ~30min

dependency-graph:
  requires:
    - "13-01"  # Database schema with repair_attachments table
  provides:
    - repairattachment domain with CRUD operations
    - repair reminder background job with push notifications
    - in-app notifications for repair reminders
  affects:
    - "13-04"  # Frontend will need to use these APIs

tech-stack:
  added: []
  patterns:
    - "FileVerifier interface for cross-domain file validation"
    - "asynq task processor for scheduled notifications"
    - "In-app + push notification dual delivery"

key-files:
  created:
    - backend/internal/domain/warehouse/repairattachment/entity.go
    - backend/internal/domain/warehouse/repairattachment/repository.go
    - backend/internal/domain/warehouse/repairattachment/service.go
    - backend/internal/domain/warehouse/repairattachment/handler.go
    - backend/internal/infra/postgres/repair_attachment_repository.go
    - backend/internal/jobs/repair_reminders.go
    - backend/internal/jobs/repair_reminders_test.go
    - backend/db/migrations/005_repair_reminder_notification.sql
  modified:
    - backend/internal/api/router.go
    - backend/internal/infra/postgres/attachment_repository.go
    - backend/internal/jobs/tasks.go
    - backend/internal/jobs/scheduler.go
    - backend/internal/domain/auth/notification/entity.go
    - backend/cmd/scheduler/main.go
    - backend/internal/domain/warehouse/repairlog/service.go

decisions:
  - id: "13-03-01"
    area: "architecture"
    choice: "Reuse existing file infrastructure for repair attachments"
    rationale: "Files are already managed via files table; repair_attachments is a junction table linking repairs to existing files"

  - id: "13-03-02"
    area: "notifications"
    choice: "Dual notification delivery (push + in-app)"
    rationale: "Push for immediate attention, in-app for persistence and review history"

  - id: "13-03-03"
    area: "scheduling"
    choice: "Same 9 AM daily schedule as loan reminders"
    rationale: "Consistent user experience and resource usage patterns"

metrics:
  tasks-completed: 3
  tasks-total: 3
  deviations: 1
---

# Phase 13 Plan 03: Repair Attachment Domain and Reminder Job Summary

Repair attachment domain for linking documents to repairs, plus scheduled maintenance reminder background job with push and in-app notifications.

## What Was Built

### 1. RepairAttachment Domain
Created full CRUD domain for repair attachments:
- **Entity**: `RepairAttachment` and `RepairAttachmentWithFile` (joined with file metadata)
- **Repository**: Interface + PostgreSQL implementation using sqlc queries from 13-01
- **Service**: Validates file existence and workspace ownership before linking
- **Handler**: Routes at `/repairs/{repairLogId}/attachments` (POST, GET, DELETE)
- **FileVerifier**: Interface implemented by FileRepository for cross-domain validation

### 2. Repair Reminder Background Job
Following loan_reminders.go pattern:
- **TypeRepairReminder**: Task type constant `"repair:reminder"`
- **RepairReminderPayload**: Serializable payload with repair/item details
- **RepairReminderProcessor**: Sends push + creates in-app notifications
- **RepairReminderScheduler**: Queries repairs with upcoming reminder dates
- **Scheduled Task**: Daily at 9 AM (same as loan reminders)

### 3. Notification Type
Added `REPAIR_REMINDER` to:
- `notification.TypeRepairReminder` constant
- Database enum via migration 005

## API Endpoints

```
POST   /api/v1/workspaces/{wsId}/repairs/{repairLogId}/attachments
  - Body: { file_id, attachment_type, title? }
  - Links existing file to repair

GET    /api/v1/workspaces/{wsId}/repairs/{repairLogId}/attachments
  - Returns attachments with file metadata

DELETE /api/v1/workspaces/{wsId}/repairs/{repairLogId}/attachments/{attachmentId}
  - Unlinks attachment (file persists)
```

## Background Job Flow

1. Scheduler runs daily at 9 AM
2. Queries `ListRepairsNeedingReminder` (reminder_date <= now+3d, reminder_sent=false)
3. Enqueues `repair:reminder` task for each
4. Processor creates in-app notification for workspace owners/admins
5. Sends push notification via VAPID
6. Marks `reminder_sent = true`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed repairlog service CreateInput missing fields**
- **Found during:** Task 3 compilation
- **Issue:** NewRepairLog entity was extended with isWarrantyClaim/reminderDate in 13-01, but CreateInput and Create() weren't updated
- **Fix:** Added IsWarrantyClaim and ReminderDate to CreateInput struct and passed to NewRepairLog
- **Files modified:** backend/internal/domain/warehouse/repairlog/service.go
- **Commit:** ee464f3

## Test Coverage

Created `repair_reminders_test.go` with 18 test cases covering:
- Payload JSON roundtrip
- Special characters, unicode, empty strings
- Date boundaries (past, future, zero time)
- Invalid payload handling
- Scheduler constructor
- Task type verification

## Commits

| Hash | Description |
|------|-------------|
| 004940f | feat(13-03): create repairattachment domain with CRUD handlers |
| 305819f | feat(13-03): implement repair reminder background job |
| ee464f3 | feat(13-03): wire repair reminder job and add tests |

## Next Phase Readiness

**Ready for 13-04 (Frontend Integration)**
- Attachment APIs available for frontend components
- Reminder job will send notifications when repairs have upcoming reminder dates
- In-app notifications will appear in notification center
