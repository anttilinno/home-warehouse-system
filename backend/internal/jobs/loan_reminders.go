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

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/infra/webpush"
)

// LoanReminderPayload is the payload for loan reminder tasks.
type LoanReminderPayload struct {
	LoanID        uuid.UUID `json:"loan_id"`
	WorkspaceID   uuid.UUID `json:"workspace_id"`
	BorrowerName  string    `json:"borrower_name"`
	BorrowerEmail string    `json:"borrower_email"`
	ItemName      string    `json:"item_name"`
	DueDate       time.Time `json:"due_date"`
	IsOverdue     bool      `json:"is_overdue"`
}

// LoanReminderProcessor handles loan reminder tasks.
type LoanReminderProcessor struct {
	pool        *pgxpool.Pool
	emailSender EmailSender
	pushSender  *webpush.Sender
}

// EmailSender is an interface for sending emails.
type EmailSender interface {
	SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error
}

// NewLoanReminderProcessor creates a new loan reminder processor.
func NewLoanReminderProcessor(pool *pgxpool.Pool, emailSender EmailSender, pushSender *webpush.Sender) *LoanReminderProcessor {
	return &LoanReminderProcessor{
		pool:        pool,
		emailSender: emailSender,
		pushSender:  pushSender,
	}
}

// ProcessTask handles the loan reminder task.
func (p *LoanReminderProcessor) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload LoanReminderPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing loan reminder for loan %s, borrower: %s, item: %s",
		payload.LoanID, payload.BorrowerName, payload.ItemName)

	// Send the reminder email
	if p.emailSender != nil {
		if err := p.emailSender.SendLoanReminder(
			ctx,
			payload.BorrowerEmail,
			payload.BorrowerName,
			payload.ItemName,
			payload.DueDate,
			payload.IsOverdue,
		); err != nil {
			return fmt.Errorf("failed to send loan reminder email: %w", err)
		}
	}

	// Send push notifications to workspace members (owners/admins)
	if p.pushSender != nil && p.pushSender.IsEnabled() {
		if err := p.sendPushNotifications(ctx, payload); err != nil {
			// Log but don't fail the task if push fails
			log.Printf("Failed to send push notification for loan %s: %v", payload.LoanID, err)
		}
	}

	log.Printf("Loan reminder sent for loan %s", payload.LoanID)
	return nil
}

// sendPushNotifications sends push notifications to workspace admins/owners about the loan.
func (p *LoanReminderProcessor) sendPushNotifications(ctx context.Context, payload LoanReminderPayload) error {
	q := queries.New(p.pool)

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
	title := "Loan Due Soon"
	body := fmt.Sprintf("%s borrowed by %s is due on %s",
		payload.ItemName, payload.BorrowerName, payload.DueDate.Format("Jan 2, 2006"))
	tag := "loan-due"

	if payload.IsOverdue {
		title = "Loan Overdue"
		body = fmt.Sprintf("%s borrowed by %s was due on %s",
			payload.ItemName, payload.BorrowerName, payload.DueDate.Format("Jan 2, 2006"))
		tag = "loan-overdue"
	}

	message := webpush.PushMessage{
		Title: title,
		Body:  body,
		Icon:  "/icon-192.png",
		Badge: "/favicon-32x32.png",
		Tag:   tag,
		URL:   fmt.Sprintf("/dashboard/loans/%s", payload.LoanID),
		Data: map[string]interface{}{
			"type":         "loan_reminder",
			"loan_id":      payload.LoanID.String(),
			"workspace_id": payload.WorkspaceID.String(),
			"is_overdue":   payload.IsOverdue,
		},
	}

	return p.pushSender.SendToUsers(ctx, userIDs, message)
}

// LoanReminderScheduler schedules loan reminder tasks.
type LoanReminderScheduler struct {
	pool   *pgxpool.Pool
	client *asynq.Client
}

// NewLoanReminderScheduler creates a new loan reminder scheduler.
func NewLoanReminderScheduler(pool *pgxpool.Pool, client *asynq.Client) *LoanReminderScheduler {
	return &LoanReminderScheduler{
		pool:   pool,
		client: client,
	}
}

// ScheduleReminders finds loans needing reminders and enqueues tasks.
func (s *LoanReminderScheduler) ScheduleReminders(ctx context.Context) error {
	q := queries.New(s.pool)

	// Find loans due within the next 3 days (including overdue)
	reminderDate := time.Now().AddDate(0, 0, 3)
	var pgDate pgtype.Date
	pgDate.Time = reminderDate
	pgDate.Valid = true

	loans, err := q.ListLoansNeedingReminder(ctx, pgDate)
	if err != nil {
		return fmt.Errorf("failed to list loans needing reminder: %w", err)
	}

	log.Printf("Found %d loans needing reminders", len(loans))

	now := time.Now()
	for _, loan := range loans {
		if loan.BorrowerEmail == nil || *loan.BorrowerEmail == "" {
			continue
		}

		var dueDate time.Time
		if loan.DueDate.Valid {
			dueDate = loan.DueDate.Time
		}

		payload := LoanReminderPayload{
			LoanID:        loan.ID,
			WorkspaceID:   loan.WorkspaceID,
			BorrowerName:  loan.BorrowerName,
			BorrowerEmail: *loan.BorrowerEmail,
			ItemName:      loan.ItemName,
			DueDate:       dueDate,
			IsOverdue:     dueDate.Before(now),
		}

		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			log.Printf("Failed to marshal payload for loan %s: %v", loan.ID, err)
			continue
		}

		task := asynq.NewTask(TypeLoanReminder, payloadBytes)
		_, err = s.client.Enqueue(task,
			asynq.Queue(QueueDefault),
			asynq.MaxRetry(3),
			asynq.Timeout(30*time.Second),
		)
		if err != nil {
			log.Printf("Failed to enqueue loan reminder for loan %s: %v", loan.ID, err)
			continue
		}

		log.Printf("Enqueued loan reminder for loan %s (borrower: %s)", loan.ID, loan.BorrowerName)
	}

	return nil
}

// NewScheduleLoanRemindersTask creates a task that schedules all loan reminders.
// This is used by the scheduler to periodically check for loans needing reminders.
func NewScheduleLoanRemindersTask() *asynq.Task {
	return asynq.NewTask(TypeLoanReminder+":schedule", nil)
}
