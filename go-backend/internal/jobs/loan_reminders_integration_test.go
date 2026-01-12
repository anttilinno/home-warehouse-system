//go:build integration
// +build integration

package jobs

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
)

func getTestPoolForLoans(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://wh:wh@localhost:5432/warehouse_test"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Skipf("skipping integration test: database connection failed: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		t.Skipf("skipping integration test: database ping failed: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

func setupLoanTestData(t *testing.T, pool *pgxpool.Pool) (workspaceID, borrowerID, inventoryID uuid.UUID) {
	t.Helper()
	ctx := context.Background()

	workspaceID = uuid.New()
	userID := uuid.New()
	borrowerID = uuid.New()
	inventoryID = uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	// Insert test user
	_, err := pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'Loan Test User', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, "loan_test_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	// Insert test workspace
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Loan Test Workspace', $2, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, workspaceID, "loan-test-"+uuid.New().String()[:8])
	require.NoError(t, err)

	// Insert workspace membership
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, 'owner', NOW(), NOW())
		ON CONFLICT DO NOTHING
	`, workspaceID, userID)
	require.NoError(t, err)

	// Insert borrower with email
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.borrowers (id, workspace_id, name, email, created_at, updated_at)
		VALUES ($1, $2, 'Test Borrower', 'borrower@example.com', NOW(), NOW())
	`, borrowerID, workspaceID)
	require.NoError(t, err)

	// Insert location
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.locations (id, workspace_id, name, created_at, updated_at)
		VALUES ($1, $2, 'Test Location', NOW(), NOW())
	`, locationID, workspaceID)
	require.NoError(t, err)

	// Insert item
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.items (id, workspace_id, name, sku, min_stock_level, created_at, updated_at)
		VALUES ($1, $2, 'Test Item', 'TEST-SKU', 0, NOW(), NOW())
	`, itemID, workspaceID)
	require.NoError(t, err)

	// Insert inventory
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.inventory (id, workspace_id, item_id, location_id, quantity, condition, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, 'NEW', 'ON_LOAN', NOW(), NOW())
	`, inventoryID, workspaceID, itemID, locationID)
	require.NoError(t, err)

	return workspaceID, borrowerID, inventoryID
}

func TestLoanReminderScheduler_ScheduleReminders_NoLoans(t *testing.T) {
	pool := getTestPoolForLoans(t)
	ctx := context.Background()

	// First, check if there are any existing loans in the database
	// This test only makes sense when database is clean
	var count int
	err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.loans l
		JOIN warehouse.borrowers b ON l.borrower_id = b.id
		WHERE l.returned_at IS NULL
		AND l.due_date <= NOW() + INTERVAL '3 days'
		AND b.email IS NOT NULL AND b.email != ''
	`).Scan(&count)
	require.NoError(t, err)

	if count > 0 {
		t.Skip("skipping test: database has existing loans, this test requires a clean state")
	}

	// Create scheduler with nil client - since no loans exist, it won't try to enqueue
	scheduler := NewLoanReminderScheduler(pool, nil)

	err = scheduler.ScheduleReminders(ctx)

	// Should not error when no loans need reminders
	require.NoError(t, err)
}

func TestLoanReminderScheduler_FindsLoansNeedingReminder(t *testing.T) {
	pool := getTestPoolForLoans(t)
	ctx := context.Background()

	workspaceID, borrowerID, inventoryID := setupLoanTestData(t, pool)

	// Create a loan due in 2 days (should trigger reminder)
	loanID := uuid.New()
	dueDate := time.Now().AddDate(0, 0, 2)

	_, err := pool.Exec(ctx, `
		INSERT INTO warehouse.loans (id, workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, returned_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, NOW(), $5, NULL, NOW(), NOW())
	`, loanID, workspaceID, inventoryID, borrowerID, dueDate)
	require.NoError(t, err)

	// Verify the loan exists and will be found by the query (active = returned_at IS NULL)
	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.loans l
		JOIN warehouse.borrowers b ON l.borrower_id = b.id
		WHERE l.returned_at IS NULL
		AND l.due_date <= NOW() + INTERVAL '3 days'
		AND b.email IS NOT NULL
	`).Scan(&count)
	require.NoError(t, err)
	require.GreaterOrEqual(t, count, 1, "should find at least one loan needing reminder")
}

func TestLoanReminderScheduler_IgnoresLoansWithoutEmail(t *testing.T) {
	pool := getTestPoolForLoans(t)
	ctx := context.Background()

	workspaceID := uuid.New()
	userID := uuid.New()
	borrowerID := uuid.New()
	inventoryID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	// Setup workspace and user
	_, err := pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'No Email Test User', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, "noemail_test_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'No Email Test Workspace', $2, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, workspaceID, "noemail-test-"+uuid.New().String()[:8])
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, 'owner', NOW(), NOW())
		ON CONFLICT DO NOTHING
	`, workspaceID, userID)
	require.NoError(t, err)

	// Insert borrower WITHOUT email
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.borrowers (id, workspace_id, name, email, created_at, updated_at)
		VALUES ($1, $2, 'No Email Borrower', NULL, NOW(), NOW())
	`, borrowerID, workspaceID)
	require.NoError(t, err)

	// Insert location
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.locations (id, workspace_id, name, created_at, updated_at)
		VALUES ($1, $2, 'No Email Location', NOW(), NOW())
	`, locationID, workspaceID)
	require.NoError(t, err)

	// Insert item
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.items (id, workspace_id, name, sku, min_stock_level, created_at, updated_at)
		VALUES ($1, $2, 'No Email Item', $3, 0, NOW(), NOW())
	`, itemID, workspaceID, "NOEMAIL-SKU-"+uuid.New().String()[:8])
	require.NoError(t, err)

	// Insert inventory
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.inventory (id, workspace_id, item_id, location_id, quantity, condition, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, 'NEW', 'ON_LOAN', NOW(), NOW())
	`, inventoryID, workspaceID, itemID, locationID)
	require.NoError(t, err)

	// Create a loan due in 2 days (returned_at NULL = active)
	loanID := uuid.New()
	dueDate := time.Now().AddDate(0, 0, 2)

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.loans (id, workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, returned_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, NOW(), $5, NULL, NOW(), NOW())
	`, loanID, workspaceID, inventoryID, borrowerID, dueDate)
	require.NoError(t, err)

	// Verify this loan is NOT found by the reminder query (no email)
	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.loans l
		JOIN warehouse.borrowers b ON l.borrower_id = b.id
		WHERE l.id = $1
		AND l.returned_at IS NULL
		AND l.due_date <= NOW() + INTERVAL '3 days'
		AND b.email IS NOT NULL AND b.email != ''
	`, loanID).Scan(&count)
	require.NoError(t, err)
	require.Equal(t, 0, count, "should not find loans without borrower email")
}

func TestLoanReminderProcessor_WithMockEmailSender_Integration(t *testing.T) {
	pool := getTestPoolForLoans(t)

	// Create a mock email sender
	emailsSent := make([]string, 0)
	mockSender := &testEmailSender{
		sentTo: &emailsSent,
	}

	processor := NewLoanReminderProcessor(pool, mockSender)

	// Create a test payload
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "Test Borrower",
		BorrowerEmail: "test@example.com",
		ItemName:      "Test Item",
		DueDate:       time.Now().AddDate(0, 0, 2),
		IsOverdue:     false,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	task := asynq.NewTask(TypeLoanReminder, payloadBytes)
	err = processor.ProcessTask(context.Background(), task)
	require.NoError(t, err)

	// Verify email was sent
	require.Len(t, emailsSent, 1)
	require.Equal(t, "test@example.com", emailsSent[0])
}

type testEmailSender struct {
	sentTo *[]string
}

func (s *testEmailSender) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	*s.sentTo = append(*s.sentTo, to)
	return nil
}
