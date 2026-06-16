package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/notification"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/infra/webpush"
)

// MaintenanceReminderWindowDays is how far ahead of next_due reminders fire.
// Overdue schedules are always included.
const MaintenanceReminderWindowDays = 7

// maintenancePrefKey is the users.notification_preferences key gating
// maintenance-due alerts. Missing key means enabled.
const maintenancePrefKey = "maintenance_alerts"

// maintenanceDateFormat is the date layout used in maintenance reminder
// dedup keys and notification messages.
const maintenanceDateFormat = "2006-01-02"

// MaintenanceReminderPayload is the payload for maintenance reminder tasks.
type MaintenanceReminderPayload struct {
	ScheduleID  uuid.UUID `json:"schedule_id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	InventoryID uuid.UUID `json:"inventory_id"`
	ItemID      uuid.UUID `json:"item_id"`
	ItemName    string    `json:"item_name"`
	Title       string    `json:"title"`
	NextDue     time.Time `json:"next_due"`
	IsOverdue   bool      `json:"is_overdue"`
}

// DedupeKey identifies one (schedule, due date) notification slot. Completing
// a schedule advances next_due, which produces a fresh key — so each
// occurrence is notified exactly once per user (same notification-exists
// dedupe approach as the expiry reminder job).
func (p MaintenanceReminderPayload) DedupeKey() string {
	return fmt.Sprintf("maintenance:%s:%s", p.ScheduleID, p.NextDue.Format(maintenanceDateFormat))
}

// MaintenanceReminderProcessor handles maintenance reminder tasks: creates
// deduplicated in-app notifications for workspace owners/admins (honouring
// the maintenance_alerts preference toggle) and sends web push notifications.
type MaintenanceReminderProcessor struct {
	pool       *pgxpool.Pool
	pushSender *webpush.Sender
}

// NewMaintenanceReminderProcessor creates a new maintenance reminder processor.
func NewMaintenanceReminderProcessor(pool *pgxpool.Pool, pushSender *webpush.Sender) *MaintenanceReminderProcessor {
	return &MaintenanceReminderProcessor{
		pool:       pool,
		pushSender: pushSender,
	}
}

// ProcessTask handles the maintenance reminder task.
func (p *MaintenanceReminderProcessor) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload MaintenanceReminderPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing maintenance reminder for schedule %s (item: %s, due: %s, overdue: %t)",
		payload.ScheduleID, payload.ItemName, payload.NextDue.Format(maintenanceDateFormat), payload.IsOverdue)

	q := queries.New(p.pool)

	members, err := q.ListWorkspaceMembersByRole(ctx, queries.ListWorkspaceMembersByRoleParams{
		WorkspaceID: payload.WorkspaceID,
		Column2:     []queries.AuthWorkspaceRoleEnum{queries.AuthWorkspaceRoleEnumOwner, queries.AuthWorkspaceRoleEnumAdmin},
	})
	if err != nil {
		return fmt.Errorf("failed to get workspace members: %w", err)
	}
	if len(members) == 0 {
		return nil
	}

	title, body := maintenanceMessage(payload)

	metadata, _ := json.Marshal(map[string]interface{}{
		"dedupe_key":   payload.DedupeKey(),
		"schedule_id":  payload.ScheduleID.String(),
		"inventory_id": payload.InventoryID.String(),
		"item_id":      payload.ItemID.String(),
		"item_name":    payload.ItemName,
		"next_due":     payload.NextDue.Format(maintenanceDateFormat),
		"is_overdue":   payload.IsOverdue,
	})

	var pushUserIDs []uuid.UUID
	for _, m := range members {
		enabled, err := userPrefEnabled(ctx, q, m.UserID, maintenancePrefKey)
		if err != nil {
			log.Printf("Failed to load notification preferences for user %s: %v", m.UserID, err)
			continue
		}
		if !enabled {
			continue
		}

		// Dedupe: one notification per schedule occurrence per user.
		count, err := q.CountNotificationsByDedupeKey(ctx, queries.CountNotificationsByDedupeKeyParams{
			UserID:           m.UserID,
			NotificationType: queries.AuthNotificationTypeEnumMAINTENANCEDUE,
			DedupeKey:        payload.DedupeKey(),
		})
		if err != nil {
			log.Printf("Failed dedupe check for user %s: %v", m.UserID, err)
			continue
		}
		if count > 0 {
			continue
		}

		wsID := pgtype.UUID{Bytes: payload.WorkspaceID, Valid: true}
		if _, err := q.CreateNotification(ctx, queries.CreateNotificationParams{
			ID:               uuid.New(),
			UserID:           m.UserID,
			WorkspaceID:      wsID,
			NotificationType: queries.AuthNotificationTypeEnum(notification.TypeMaintenanceDue),
			Title:            title,
			Message:          body,
			Metadata:         metadata,
		}); err != nil {
			log.Printf("Failed to create maintenance notification for user %s: %v", m.UserID, err)
			continue
		}
		pushUserIDs = append(pushUserIDs, m.UserID)
	}

	if len(pushUserIDs) > 0 && p.pushSender != nil && p.pushSender.IsEnabled() {
		tag := "maintenance-due"
		if payload.IsOverdue {
			tag = "maintenance-overdue"
		}
		message := webpush.PushMessage{
			Title: title,
			Body:  body,
			Icon:  "/icon-192.png",
			Badge: "/favicon-32x32.png",
			Tag:   tag,
			URL:   fmt.Sprintf("/dashboard/items/%s", payload.ItemID),
			Data: map[string]interface{}{
				"type":         "maintenance_reminder",
				"schedule_id":  payload.ScheduleID.String(),
				"workspace_id": payload.WorkspaceID.String(),
				"inventory_id": payload.InventoryID.String(),
				"is_overdue":   payload.IsOverdue,
			},
		}
		if err := p.pushSender.SendToUsers(ctx, pushUserIDs, message); err != nil {
			log.Printf("Failed to send push notification for schedule %s: %v", payload.ScheduleID, err)
		}
	}

	log.Printf("Maintenance reminder processed for schedule %s", payload.ScheduleID)
	return nil
}

// maintenanceMessage builds the notification title/body for a payload.
func maintenanceMessage(payload MaintenanceReminderPayload) (title, body string) {
	dateStr := payload.NextDue.Format("Jan 2, 2006")
	if payload.IsOverdue {
		title = "Maintenance Overdue"
		body = fmt.Sprintf("%s for %s was due on %s", payload.Title, payload.ItemName, dateStr)
		return title, body
	}
	title = "Maintenance Due"
	body = fmt.Sprintf("%s for %s is due on %s", payload.Title, payload.ItemName, dateStr)
	return title, body
}

// MaintenanceReminderScheduler scans all workspaces for active schedules due
// within the reminder window (or overdue) and enqueues one task per schedule.
// The processor performs the per-user dedupe, so running this daily is safe.
type MaintenanceReminderScheduler struct {
	pool   *pgxpool.Pool
	client *asynq.Client
}

// NewMaintenanceReminderScheduler creates a new maintenance reminder scheduler.
func NewMaintenanceReminderScheduler(pool *pgxpool.Pool, client *asynq.Client) *MaintenanceReminderScheduler {
	return &MaintenanceReminderScheduler{
		pool:   pool,
		client: client,
	}
}

// ScheduleReminders finds schedules needing reminders and enqueues tasks,
// iterating per workspace (the query is workspace-scoped).
func (s *MaintenanceReminderScheduler) ScheduleReminders(ctx context.Context) error {
	q := queries.New(s.pool)

	workspaceIDs, err := q.ListAllWorkspaceIDs(ctx)
	if err != nil {
		return fmt.Errorf("failed to list workspaces: %w", err)
	}

	now := time.Now()
	cutoff := pgtype.Date{Time: now.AddDate(0, 0, MaintenanceReminderWindowDays), Valid: true}

	enqueued := 0
	for _, wsID := range workspaceIDs {
		due, err := q.ListMaintenanceSchedulesDue(ctx, queries.ListMaintenanceSchedulesDueParams{
			WorkspaceID: wsID,
			NextDue:     cutoff,
		})
		if err != nil {
			log.Printf("Failed to list due maintenance for workspace %s: %v", wsID, err)
			continue
		}

		for _, row := range due {
			payload := MaintenanceReminderPayload{
				ScheduleID:  row.ID,
				WorkspaceID: row.WorkspaceID,
				InventoryID: row.InventoryID,
				ItemID:      row.ItemID,
				ItemName:    row.ItemName,
				Title:       row.Title,
				NextDue:     row.NextDue.Time,
				IsOverdue:   row.NextDue.Time.Before(now.Truncate(24 * time.Hour)),
			}

			payloadBytes, err := json.Marshal(payload)
			if err != nil {
				log.Printf("Failed to marshal maintenance payload for schedule %s: %v", row.ID, err)
				continue
			}

			task := asynq.NewTask(TypeMaintenanceReminder, payloadBytes)
			if _, err := s.client.Enqueue(task,
				asynq.Queue(QueueDefault),
				asynq.MaxRetry(3),
				asynq.Timeout(30*time.Second),
			); err != nil {
				log.Printf("Failed to enqueue maintenance reminder for schedule %s: %v", row.ID, err)
				continue
			}
			enqueued++
		}
	}

	log.Printf("Enqueued %d maintenance reminders across %d workspaces", enqueued, len(workspaceIDs))
	return nil
}

// NewScheduleMaintenanceRemindersTask creates a task that schedules all
// maintenance reminders. Used by the periodic scheduler.
func NewScheduleMaintenanceRemindersTask() *asynq.Task {
	return asynq.NewTask(TypeMaintenanceReminder+":schedule", nil)
}
