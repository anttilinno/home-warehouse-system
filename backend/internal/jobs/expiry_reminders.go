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

// Expiry alert kinds. An inventory row can produce alerts of both kinds
// independently (its contents expire AND its warranty lapses).
const (
	// ExpiryKindExpiration is an alert for inventory.expiration_date
	// (food, medicine, batteries, ...).
	ExpiryKindExpiration = "expiration"
	// ExpiryKindWarranty is an alert for inventory.warranty_expires.
	// Items flagged lifetime_warranty never produce warranty alerts.
	ExpiryKindWarranty = "warranty"
)

// ExpiryReminderWindows are the alert windows in days. A row is notified at
// most once per window: once when it enters the 30-day window, again at 7
// days, and a final time at 1 day before the date.
var ExpiryReminderWindows = []int{30, 7, 1}

// expiryPrefKey is the users.notification_preferences key gating expiry and
// warranty alerts. Missing key means enabled (empty preferences = all on).
const expiryPrefKey = "expiry_alerts"

// ExpiryReminderPayload is the payload for expiry reminder tasks.
type ExpiryReminderPayload struct {
	InventoryID uuid.UUID `json:"inventory_id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	ItemID      uuid.UUID `json:"item_id"`
	ItemName    string    `json:"item_name"`
	Kind        string    `json:"kind"` // ExpiryKindExpiration | ExpiryKindWarranty
	Date        time.Time `json:"date"` // the expiration / warranty-end date
	WindowDays  int       `json:"window_days"`
}

// DedupeKey identifies one (inventory row, kind, window) notification slot.
// It is stored in the notification metadata and checked before sending so a
// row is notified at most once per window even though the schedule task runs
// daily (same approach the loan/repair reminder family uses for send-once
// semantics: a persisted "already sent" marker, here the notification row
// itself).
func (p ExpiryReminderPayload) DedupeKey() string {
	return fmt.Sprintf("expiry:%s:%s:%d", p.InventoryID, p.Kind, p.WindowDays)
}

// ExpiryWindowFor classifies how far away a date is into one of the reminder
// windows. daysUntil is the number of whole days from today until the date
// (0 = today). Returns the matched window and true, or 0 and false when the
// date is outside all windows (past, or further out than the widest window).
func ExpiryWindowFor(daysUntil int) (int, bool) {
	if daysUntil < 0 {
		return 0, false
	}
	for i := len(ExpiryReminderWindows) - 1; i >= 0; i-- {
		if daysUntil <= ExpiryReminderWindows[i] {
			return ExpiryReminderWindows[i], true
		}
	}
	return 0, false
}

// DaysUntil returns the number of whole calendar days from today until date,
// both evaluated in UTC.
func DaysUntil(date, now time.Time) int {
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	target := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	return int(target.Sub(today).Hours() / 24)
}

// ExpiryReminderProcessor handles expiry reminder tasks: creates deduplicated
// in-app notifications for workspace owners/admins (honouring the
// expiry_alerts preference toggle) and sends web push notifications.
type ExpiryReminderProcessor struct {
	pool       *pgxpool.Pool
	pushSender *webpush.Sender
}

// NewExpiryReminderProcessor creates a new expiry reminder processor.
func NewExpiryReminderProcessor(pool *pgxpool.Pool, pushSender *webpush.Sender) *ExpiryReminderProcessor {
	return &ExpiryReminderProcessor{
		pool:       pool,
		pushSender: pushSender,
	}
}

// ProcessTask handles the expiry reminder task.
func (p *ExpiryReminderProcessor) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload ExpiryReminderPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing expiry reminder for inventory %s (kind: %s, window: %dd, item: %s)",
		payload.InventoryID, payload.Kind, payload.WindowDays, payload.ItemName)

	q := queries.New(p.pool)

	// Workspace owners/admins are the alert audience (same audience as loan
	// and repair reminders).
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

	notifType := notification.TypeExpiryAlert
	if payload.Kind == ExpiryKindWarranty {
		notifType = notification.TypeWarrantyAlert
	}
	title, body := expiryMessage(payload)

	metadata, _ := json.Marshal(map[string]interface{}{
		"dedupe_key":   payload.DedupeKey(),
		"inventory_id": payload.InventoryID.String(),
		"item_id":      payload.ItemID.String(),
		"item_name":    payload.ItemName,
		"kind":         payload.Kind,
		"date":         payload.Date.Format("2006-01-02"),
		"window_days":  payload.WindowDays,
	})

	var pushUserIDs []uuid.UUID
	for _, m := range members {
		enabled, err := userPrefEnabled(ctx, q, m.UserID, expiryPrefKey)
		if err != nil {
			log.Printf("Failed to load notification preferences for user %s: %v", m.UserID, err)
			continue
		}
		if !enabled {
			continue
		}

		// Dedupe: one notification per inventory row per window per user.
		count, err := q.CountNotificationsByDedupeKey(ctx, queries.CountNotificationsByDedupeKeyParams{
			UserID:           m.UserID,
			NotificationType: queries.AuthNotificationTypeEnum(notifType),
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
			NotificationType: queries.AuthNotificationTypeEnum(notifType),
			Title:            title,
			Message:          body,
			Metadata:         metadata,
		}); err != nil {
			log.Printf("Failed to create expiry notification for user %s: %v", m.UserID, err)
			continue
		}
		pushUserIDs = append(pushUserIDs, m.UserID)
	}

	// Web push to exactly the users that received a fresh in-app
	// notification (push therefore inherits both the preference toggle and
	// the dedupe check).
	if len(pushUserIDs) > 0 && p.pushSender != nil && p.pushSender.IsEnabled() {
		message := webpush.PushMessage{
			Title: title,
			Body:  body,
			Icon:  "/icon-192.png",
			Badge: "/favicon-32x32.png",
			Tag:   "expiry-" + payload.Kind,
			URL:   "/dashboard/inventory",
			Data: map[string]interface{}{
				"type":         "expiry_reminder",
				"inventory_id": payload.InventoryID.String(),
				"workspace_id": payload.WorkspaceID.String(),
				"kind":         payload.Kind,
			},
		}
		if err := p.pushSender.SendToUsers(ctx, pushUserIDs, message); err != nil {
			// Log but don't fail the task if push fails.
			log.Printf("Failed to send push notification for inventory %s: %v", payload.InventoryID, err)
		}
	}

	log.Printf("Expiry reminder processed for inventory %s (%s, %dd window)",
		payload.InventoryID, payload.Kind, payload.WindowDays)
	return nil
}

// expiryMessage builds the notification title/body for a payload.
func expiryMessage(payload ExpiryReminderPayload) (title, body string) {
	dateStr := payload.Date.Format("Jan 2, 2006")
	if payload.Kind == ExpiryKindWarranty {
		title = "Warranty Expiring"
		body = fmt.Sprintf("Warranty for %s expires on %s", payload.ItemName, dateStr)
		return title, body
	}
	title = "Item Expiring Soon"
	body = fmt.Sprintf("%s expires on %s", payload.ItemName, dateStr)
	return title, body
}

// userPrefEnabled reports whether the given notification preference key is
// enabled for the user. Preferences are an opt-out map: a missing key (or an
// empty preferences object) means enabled. The master "enabled" switch turns
// everything off.
func userPrefEnabled(ctx context.Context, q *queries.Queries, userID uuid.UUID, key string) (bool, error) {
	raw, err := q.GetUserNotificationPreferences(ctx, userID)
	if err != nil {
		return false, err
	}
	return prefEnabled(raw, key), nil
}

// prefEnabled implements the preference semantics on a raw
// notification_preferences JSON document. Split out for unit testing.
func prefEnabled(raw []byte, key string) bool {
	if len(raw) == 0 {
		return true
	}
	var prefs map[string]bool
	if err := json.Unmarshal(raw, &prefs); err != nil {
		// Malformed preferences must not silently drop alerts.
		return true
	}
	if v, ok := prefs["enabled"]; ok && !v {
		return false
	}
	if v, ok := prefs[key]; ok && !v {
		return false
	}
	return true
}

// ExpiryReminderScheduler scans all workspaces for inventory rows whose
// expiration or warranty date enters a reminder window and enqueues one task
// per row+kind. The processor performs the per-user dedupe, so running this
// daily is safe.
type ExpiryReminderScheduler struct {
	pool   *pgxpool.Pool
	client *asynq.Client
}

// NewExpiryReminderScheduler creates a new expiry reminder scheduler.
func NewExpiryReminderScheduler(pool *pgxpool.Pool, client *asynq.Client) *ExpiryReminderScheduler {
	return &ExpiryReminderScheduler{
		pool:   pool,
		client: client,
	}
}

// ScheduleReminders finds inventory needing expiry/warranty reminders and
// enqueues tasks, iterating per workspace (the queries are workspace-scoped).
func (s *ExpiryReminderScheduler) ScheduleReminders(ctx context.Context) error {
	q := queries.New(s.pool)

	workspaceIDs, err := q.ListAllWorkspaceIDs(ctx)
	if err != nil {
		return fmt.Errorf("failed to list workspaces: %w", err)
	}

	now := time.Now()
	maxWindow := ExpiryReminderWindows[0]
	cutoff := pgtype.Date{Time: now.AddDate(0, 0, maxWindow), Valid: true}

	enqueued := 0
	for _, wsID := range workspaceIDs {
		expiring, err := q.ListInventoryExpiringSoon(ctx, queries.ListInventoryExpiringSoonParams{
			WorkspaceID:    wsID,
			ExpirationDate: cutoff,
		})
		if err != nil {
			log.Printf("Failed to list expiring inventory for workspace %s: %v", wsID, err)
			continue
		}
		for _, row := range expiring {
			if !row.ExpirationDate.Valid {
				continue
			}
			enqueued += s.enqueueIfInWindow(ExpiryReminderPayload{
				InventoryID: row.ID,
				WorkspaceID: row.WorkspaceID,
				ItemID:      row.ItemID,
				ItemName:    row.ItemName,
				Kind:        ExpiryKindExpiration,
				Date:        row.ExpirationDate.Time,
			}, now)
		}

		warranties, err := q.ListWarrantiesExpiringSoon(ctx, queries.ListWarrantiesExpiringSoonParams{
			WorkspaceID:     wsID,
			WarrantyExpires: cutoff,
		})
		if err != nil {
			log.Printf("Failed to list expiring warranties for workspace %s: %v", wsID, err)
			continue
		}
		for _, row := range warranties {
			if !row.WarrantyExpires.Valid {
				continue
			}
			enqueued += s.enqueueIfInWindow(ExpiryReminderPayload{
				InventoryID: row.ID,
				WorkspaceID: row.WorkspaceID,
				ItemID:      row.ItemID,
				ItemName:    row.ItemName,
				Kind:        ExpiryKindWarranty,
				Date:        row.WarrantyExpires.Time,
			}, now)
		}
	}

	log.Printf("Enqueued %d expiry reminders across %d workspaces", enqueued, len(workspaceIDs))
	return nil
}

// enqueueIfInWindow classifies the payload's date into a reminder window and
// enqueues the task. Returns 1 when a task was enqueued, 0 otherwise.
func (s *ExpiryReminderScheduler) enqueueIfInWindow(payload ExpiryReminderPayload, now time.Time) int {
	window, ok := ExpiryWindowFor(DaysUntil(payload.Date, now))
	if !ok {
		return 0
	}
	payload.WindowDays = window

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal expiry payload for inventory %s: %v", payload.InventoryID, err)
		return 0
	}

	task := asynq.NewTask(TypeExpiryReminder, payloadBytes)
	if _, err := s.client.Enqueue(task,
		asynq.Queue(QueueDefault),
		asynq.MaxRetry(3),
		asynq.Timeout(30*time.Second),
	); err != nil {
		log.Printf("Failed to enqueue expiry reminder for inventory %s: %v", payload.InventoryID, err)
		return 0
	}
	return 1
}

// NewScheduleExpiryRemindersTask creates a task that schedules all expiry
// reminders. Used by the periodic scheduler.
func NewScheduleExpiryRemindersTask() *asynq.Task {
	return asynq.NewTask(TypeExpiryReminder+":schedule", nil)
}
