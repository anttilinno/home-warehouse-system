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

// RepairReminderPayload is the payload for repair reminder tasks.
type RepairReminderPayload struct {
	RepairLogID  uuid.UUID `json:"repair_log_id"`
	WorkspaceID  uuid.UUID `json:"workspace_id"`
	InventoryID  uuid.UUID `json:"inventory_id"`
	ItemName     string    `json:"item_name"`
	Description  string    `json:"description"`
	ReminderDate time.Time `json:"reminder_date"`
}

// RepairReminderProcessor handles repair reminder tasks.
type RepairReminderProcessor struct {
	pool       *pgxpool.Pool
	pushSender *webpush.Sender
}

// NewRepairReminderProcessor creates a new repair reminder processor.
func NewRepairReminderProcessor(pool *pgxpool.Pool, pushSender *webpush.Sender) *RepairReminderProcessor {
	return &RepairReminderProcessor{
		pool:       pool,
		pushSender: pushSender,
	}
}

// ProcessTask handles the repair reminder task.
func (p *RepairReminderProcessor) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload RepairReminderPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing repair reminder for repair %s, item: %s",
		payload.RepairLogID, payload.ItemName)

	q := queries.New(p.pool)

	// Create in-app notifications for workspace owners/admins
	if err := p.createInAppNotifications(ctx, q, payload); err != nil {
		log.Printf("Failed to create in-app notification for repair %s: %v", payload.RepairLogID, err)
		// Don't fail the task, continue to push
	}

	// Send push notifications to workspace members (owners/admins)
	if p.pushSender != nil && p.pushSender.IsEnabled() {
		if err := p.sendPushNotifications(ctx, q, payload); err != nil {
			// Log but don't fail the task if push fails
			log.Printf("Failed to send push notification for repair %s: %v", payload.RepairLogID, err)
		}
	}

	// Mark reminder as sent
	if err := q.MarkRepairReminderSent(ctx, payload.RepairLogID); err != nil {
		return fmt.Errorf("failed to mark repair reminder as sent: %w", err)
	}

	log.Printf("Repair reminder sent for repair %s", payload.RepairLogID)
	return nil
}

// createInAppNotifications creates in-app notifications for workspace owners/admins.
func (p *RepairReminderProcessor) createInAppNotifications(ctx context.Context, q *queries.Queries, payload RepairReminderPayload) error {
	// Get workspace members who should receive notifications (owners and admins)
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

	title := "Maintenance Reminder"
	message := fmt.Sprintf("Scheduled maintenance for %s: %s", payload.ItemName, payload.Description)
	if len(payload.Description) > 100 {
		message = fmt.Sprintf("Scheduled maintenance for %s: %s...", payload.ItemName, payload.Description[:100])
	}

	// Create notification for each admin/owner
	for _, m := range members {
		metadata, _ := json.Marshal(map[string]interface{}{
			"repair_log_id": payload.RepairLogID.String(),
			"inventory_id":  payload.InventoryID.String(),
			"item_name":     payload.ItemName,
		})

		wsID := pgtype.UUID{Bytes: payload.WorkspaceID, Valid: true}
		_, err := q.CreateNotification(ctx, queries.CreateNotificationParams{
			ID:               uuid.New(),
			UserID:           m.UserID,
			WorkspaceID:      wsID,
			NotificationType: queries.AuthNotificationTypeEnum(notification.TypeRepairReminder),
			Title:            title,
			Message:          message,
			Metadata:         metadata,
		})
		if err != nil {
			log.Printf("Failed to create notification for user %s: %v", m.UserID, err)
			// Continue with other users
		}
	}

	return nil
}

// sendPushNotifications sends push notifications to workspace admins/owners about the repair reminder.
func (p *RepairReminderProcessor) sendPushNotifications(ctx context.Context, q *queries.Queries, payload RepairReminderPayload) error {
	// Get workspace members who should receive notifications (owners and admins)
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

	// Collect user IDs
	userIDs := make([]uuid.UUID, len(members))
	for i, m := range members {
		userIDs[i] = m.UserID
	}

	// Build push message
	title := "Maintenance Reminder"
	body := fmt.Sprintf("Scheduled maintenance for %s", payload.ItemName)
	if payload.Description != "" {
		// Truncate description for push notification
		desc := payload.Description
		if len(desc) > 50 {
			desc = desc[:50] + "..."
		}
		body = fmt.Sprintf("%s: %s", payload.ItemName, desc)
	}

	message := webpush.PushMessage{
		Title: title,
		Body:  body,
		Icon:  "/icon-192.png",
		Badge: "/favicon-32x32.png",
		Tag:   "repair-reminder",
		URL:   fmt.Sprintf("/dashboard/inventory/%s", payload.InventoryID),
		Data: map[string]interface{}{
			"type":          "repair_reminder",
			"repair_log_id": payload.RepairLogID.String(),
			"workspace_id":  payload.WorkspaceID.String(),
			"inventory_id":  payload.InventoryID.String(),
		},
	}

	return p.pushSender.SendToUsers(ctx, userIDs, message)
}

// RepairReminderScheduler schedules repair reminder tasks.
type RepairReminderScheduler struct {
	pool   *pgxpool.Pool
	client *asynq.Client
}

// NewRepairReminderScheduler creates a new repair reminder scheduler.
func NewRepairReminderScheduler(pool *pgxpool.Pool, client *asynq.Client) *RepairReminderScheduler {
	return &RepairReminderScheduler{
		pool:   pool,
		client: client,
	}
}

// ScheduleReminders finds repairs needing reminders and enqueues tasks.
func (s *RepairReminderScheduler) ScheduleReminders(ctx context.Context) error {
	q := queries.New(s.pool)

	// Find repairs with reminder_date within the next 3 days (including past due)
	reminderDate := time.Now().AddDate(0, 0, 3)
	var pgDate pgtype.Date
	pgDate.Time = reminderDate
	pgDate.Valid = true

	repairs, err := q.ListRepairsNeedingReminder(ctx, pgDate)
	if err != nil {
		return fmt.Errorf("failed to list repairs needing reminder: %w", err)
	}

	log.Printf("Found %d repairs needing reminders", len(repairs))

	for _, repair := range repairs {
		var reminderDateValue time.Time
		if repair.ReminderDate.Valid {
			reminderDateValue = repair.ReminderDate.Time
		}

		payload := RepairReminderPayload{
			RepairLogID:  repair.ID,
			WorkspaceID:  repair.WorkspaceID,
			InventoryID:  repair.InventoryID,
			ItemName:     repair.ItemName,
			Description:  repair.Description,
			ReminderDate: reminderDateValue,
		}

		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			log.Printf("Failed to marshal payload for repair %s: %v", repair.ID, err)
			continue
		}

		task := asynq.NewTask(TypeRepairReminder, payloadBytes)
		_, err = s.client.Enqueue(task,
			asynq.Queue(QueueDefault),
			asynq.MaxRetry(3),
			asynq.Timeout(30*time.Second),
		)
		if err != nil {
			log.Printf("Failed to enqueue repair reminder for repair %s: %v", repair.ID, err)
			continue
		}

		log.Printf("Enqueued repair reminder for repair %s (item: %s)", repair.ID, repair.ItemName)
	}

	return nil
}

// NewScheduleRepairRemindersTask creates a task that schedules all repair reminders.
// This is used by the scheduler to periodically check for repairs needing reminders.
func NewScheduleRepairRemindersTask() *asynq.Task {
	return asynq.NewTask(TypeRepairReminder+":schedule", nil)
}
