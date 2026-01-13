//go:build integration
// +build integration

package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// Redis Connection Helpers
// =============================================================================

func getRedisAddr(t *testing.T) string {
	t.Helper()
	addr := os.Getenv("TEST_REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	return addr
}

func getTestPoolForRedis(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable"
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

func checkRedisConnection(t *testing.T, addr string) {
	t.Helper()
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: addr})
	defer client.Close()

	// Try to ping Redis by enqueueing and immediately deleting a test task
	task := asynq.NewTask("test:ping", nil)
	info, err := client.Enqueue(task, asynq.Queue("test"), asynq.Retention(time.Second))
	if err != nil {
		t.Skipf("skipping Redis e2e test: Redis connection failed: %v", err)
	}

	// Clean up test task
	inspector := asynq.NewInspector(asynq.RedisClientOpt{Addr: addr})
	defer inspector.Close()
	_ = inspector.DeleteTask("test", info.ID)
}

// =============================================================================
// Scheduler E2E Tests
// =============================================================================

func TestScheduler_NewScheduler_WithRedis(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	config := DefaultSchedulerConfig(redisAddr)
	scheduler := NewScheduler(pool, config)

	require.NotNil(t, scheduler)
	require.NotNil(t, scheduler.client)
	require.NotNil(t, scheduler.server)
	require.NotNil(t, scheduler.scheduler)

	// Clean up
	scheduler.client.Close()
}

func TestRedis_Scheduler_RegisterHandlers(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	config := DefaultSchedulerConfig(redisAddr)
	scheduler := NewScheduler(pool, config)
	defer scheduler.client.Close()

	// Create mock email sender
	mockSender := &mockEmailSenderForRedis{}

	// Register handlers
	cleanupConfig := DefaultCleanupConfig()
	mux := scheduler.RegisterHandlers(mockSender, cleanupConfig)

	require.NotNil(t, mux)
}

func TestScheduler_StartAndStop(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	config := DefaultSchedulerConfig(redisAddr)
	scheduler := NewScheduler(pool, config)

	// Create mock email sender
	mockSender := &mockEmailSenderForRedis{}
	cleanupConfig := DefaultCleanupConfig()
	mux := scheduler.RegisterHandlers(mockSender, cleanupConfig)

	// Start scheduler in background
	errChan := make(chan error, 1)
	go func() {
		errChan <- scheduler.Start(mux)
	}()

	// Give it time to start
	time.Sleep(100 * time.Millisecond)

	// Stop the scheduler
	scheduler.Stop()

	// Check if start returned an error (it shouldn't for a clean start/stop)
	select {
	case err := <-errChan:
		// Start may return nil or an error when stopped
		if err != nil {
			t.Logf("Scheduler start returned: %v (this may be expected on shutdown)", err)
		}
	case <-time.After(2 * time.Second):
		// Timeout waiting for start to return - this is fine
	}
}

func TestRedis_Scheduler_Client(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	config := DefaultSchedulerConfig(redisAddr)
	scheduler := NewScheduler(pool, config)
	defer scheduler.client.Close()

	client := scheduler.Client()
	require.NotNil(t, client)
	require.Equal(t, scheduler.client, client)
}

// =============================================================================
// Task Enqueueing E2E Tests
// =============================================================================

func TestEnqueueTask_LoanReminder(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)

	client := asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
	defer client.Close()

	// Create a loan reminder payload
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
	info, err := client.Enqueue(task,
		asynq.Queue(QueueDefault),
		asynq.MaxRetry(3),
		asynq.Retention(time.Minute), // Short retention for test cleanup
	)
	require.NoError(t, err)
	require.NotEmpty(t, info.ID)

	t.Logf("Enqueued loan reminder task: %s", info.ID)

	// Clean up: delete the task
	inspector := asynq.NewInspector(asynq.RedisClientOpt{Addr: redisAddr})
	defer inspector.Close()
	_ = inspector.DeleteTask(QueueDefault, info.ID)
}

func TestEnqueueTask_CleanupDeletedRecords(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)

	client := asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
	defer client.Close()

	task := NewCleanupDeletedRecordsTask()
	info, err := client.Enqueue(task,
		asynq.Queue(QueueLow),
		asynq.Retention(time.Minute),
	)
	require.NoError(t, err)
	require.NotEmpty(t, info.ID)

	t.Logf("Enqueued cleanup deleted records task: %s", info.ID)

	// Clean up
	inspector := asynq.NewInspector(asynq.RedisClientOpt{Addr: redisAddr})
	defer inspector.Close()
	_ = inspector.DeleteTask(QueueLow, info.ID)
}

func TestEnqueueTask_CleanupActivity(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)

	client := asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
	defer client.Close()

	task := NewCleanupActivityTask()
	info, err := client.Enqueue(task,
		asynq.Queue(QueueLow),
		asynq.Retention(time.Minute),
	)
	require.NoError(t, err)
	require.NotEmpty(t, info.ID)

	t.Logf("Enqueued cleanup activity task: %s", info.ID)

	// Clean up
	inspector := asynq.NewInspector(asynq.RedisClientOpt{Addr: redisAddr})
	defer inspector.Close()
	_ = inspector.DeleteTask(QueueLow, info.ID)
}

// =============================================================================
// End-to-End Task Processing Tests
// =============================================================================

func TestE2E_LoanReminderProcessing(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	// Use unique queue name to avoid interference
	testQueue := fmt.Sprintf("test-loan-%s", uuid.New().String()[:8])

	// Track emails sent
	var mu sync.Mutex
	emailsSent := make([]LoanReminderPayload, 0)

	mockSender := &trackingEmailSender{
		mu:         &mu,
		emailsSent: &emailsSent,
	}

	// Create and start server
	redisOpt := asynq.RedisClientOpt{Addr: redisAddr}
	server := asynq.NewServer(redisOpt, asynq.Config{
		Queues: map[string]int{
			testQueue: 1,
		},
		Concurrency: 1,
	})

	mux := asynq.NewServeMux()
	processor := NewLoanReminderProcessor(pool, mockSender)
	mux.HandleFunc(TypeLoanReminder, processor.ProcessTask)

	// Start server in background
	go func() {
		if err := server.Start(mux); err != nil {
			t.Logf("Server error: %v", err)
		}
	}()
	defer server.Shutdown()

	// Give server time to start
	time.Sleep(200 * time.Millisecond)

	// Enqueue a task
	client := asynq.NewClient(redisOpt)
	defer client.Close()

	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "E2E Test Borrower",
		BorrowerEmail: "e2e@example.com",
		ItemName:      "E2E Test Item",
		DueDate:       time.Now().AddDate(0, 0, 1),
		IsOverdue:     false,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	task := asynq.NewTask(TypeLoanReminder, payloadBytes)
	_, err = client.Enqueue(task, asynq.Queue(testQueue))
	require.NoError(t, err)

	// Wait for task to be processed with retry
	var success bool
	for i := 0; i < 10; i++ {
		time.Sleep(200 * time.Millisecond)
		mu.Lock()
		if len(emailsSent) == 1 {
			success = true
			mu.Unlock()
			break
		}
		mu.Unlock()
	}

	// Verify email was sent
	mu.Lock()
	defer mu.Unlock()
	require.True(t, success, "task should be processed within timeout")
	require.Len(t, emailsSent, 1)
	assert.Equal(t, "e2e@example.com", emailsSent[0].BorrowerEmail)
	assert.Equal(t, "E2E Test Borrower", emailsSent[0].BorrowerName)
}

func TestE2E_CleanupProcessing(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	// Use unique queue name to avoid interference
	testQueue := fmt.Sprintf("test-cleanup-%s", uuid.New().String()[:8])

	// Setup test data
	ctx := context.Background()
	workspaceID := setupTestWorkspaceForRedis(t, pool)

	// Insert an old deleted record
	oldDate := time.Now().AddDate(0, 0, -100)
	categoryID := uuid.New()

	_, err := pool.Exec(ctx, `
		INSERT INTO warehouse.categories (id, workspace_id, name, is_archived, created_at, updated_at)
		VALUES ($1, $2, 'Redis E2E Old Category', true, $3, $3)
	`, categoryID, workspaceID, oldDate)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.deleted_records (id, workspace_id, entity_type, entity_id, deleted_at)
		VALUES (gen_random_uuid(), $1, 'CATEGORY', $2, $3)
	`, workspaceID, categoryID, oldDate)
	require.NoError(t, err)

	// Verify record exists
	var countBefore int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.deleted_records
		WHERE workspace_id = $1 AND entity_id = $2
	`, workspaceID, categoryID).Scan(&countBefore)
	require.NoError(t, err)
	require.Equal(t, 1, countBefore)

	// Create and start server
	redisOpt := asynq.RedisClientOpt{Addr: redisAddr}
	server := asynq.NewServer(redisOpt, asynq.Config{
		Queues: map[string]int{
			testQueue: 1,
		},
		Concurrency: 1,
	})

	mux := asynq.NewServeMux()
	cleanupConfig := CleanupConfig{
		DeletedRecordsRetentionDays: 90,
		ActivityLogsRetentionDays:   365,
	}
	cleanupProcessor := NewCleanupProcessor(pool, cleanupConfig)
	mux.HandleFunc(TypeCleanupDeletedRecords, cleanupProcessor.ProcessDeletedRecordsCleanup)

	// Start server
	go func() {
		if err := server.Start(mux); err != nil {
			t.Logf("Server error: %v", err)
		}
	}()
	defer server.Shutdown()

	time.Sleep(200 * time.Millisecond)

	// Enqueue cleanup task
	client := asynq.NewClient(redisOpt)
	defer client.Close()

	task := NewCleanupDeletedRecordsTask()
	_, err = client.Enqueue(task, asynq.Queue(testQueue))
	require.NoError(t, err)

	// Wait for task to be processed with retry
	var countAfter int
	var success bool
	for i := 0; i < 10; i++ {
		time.Sleep(200 * time.Millisecond)
		err = pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM warehouse.deleted_records
			WHERE workspace_id = $1 AND entity_id = $2
		`, workspaceID, categoryID).Scan(&countAfter)
		require.NoError(t, err)
		if countAfter == 0 {
			success = true
			break
		}
	}

	// Verify record was cleaned up
	require.True(t, success, "task should be processed within timeout")
	assert.Equal(t, 0, countAfter, "old deleted record should be cleaned up")
}

func TestE2E_MultipleTasksInQueue(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	// Use unique queue name to avoid interference
	testQueue := fmt.Sprintf("test-multi-%s", uuid.New().String()[:8])

	// Track emails sent
	var mu sync.Mutex
	emailsSent := make([]string, 0)

	mockSender := &countingEmailSender{
		mu:         &mu,
		emailsSent: &emailsSent,
	}

	// Create and start server
	redisOpt := asynq.RedisClientOpt{Addr: redisAddr}
	server := asynq.NewServer(redisOpt, asynq.Config{
		Queues: map[string]int{
			testQueue: 1,
		},
		Concurrency: 2, // Process 2 tasks concurrently
	})

	mux := asynq.NewServeMux()
	processor := NewLoanReminderProcessor(pool, mockSender)
	mux.HandleFunc(TypeLoanReminder, processor.ProcessTask)

	go func() {
		if err := server.Start(mux); err != nil {
			t.Logf("Server error: %v", err)
		}
	}()
	defer server.Shutdown()

	time.Sleep(200 * time.Millisecond)

	// Enqueue multiple tasks
	client := asynq.NewClient(redisOpt)
	defer client.Close()

	numTasks := 5
	for i := 0; i < numTasks; i++ {
		payload := LoanReminderPayload{
			LoanID:        uuid.New(),
			WorkspaceID:   uuid.New(),
			BorrowerName:  "Borrower " + string(rune('A'+i)),
			BorrowerEmail: "borrower" + string(rune('a'+i)) + "@example.com",
			ItemName:      "Item " + string(rune('A'+i)),
			DueDate:       time.Now().AddDate(0, 0, 1),
			IsOverdue:     false,
		}

		payloadBytes, err := json.Marshal(payload)
		require.NoError(t, err)

		task := asynq.NewTask(TypeLoanReminder, payloadBytes)
		_, err = client.Enqueue(task, asynq.Queue(testQueue))
		require.NoError(t, err)
	}

	// Wait for all tasks to be processed with retry
	var success bool
	for i := 0; i < 15; i++ {
		time.Sleep(200 * time.Millisecond)
		mu.Lock()
		if len(emailsSent) >= numTasks {
			success = true
			mu.Unlock()
			break
		}
		mu.Unlock()
	}

	// Verify all emails were sent
	mu.Lock()
	defer mu.Unlock()
	require.True(t, success, "all tasks should be processed within timeout")
	assert.GreaterOrEqual(t, len(emailsSent), numTasks, "at least all enqueued tasks should be processed")
}

// =============================================================================
// Inspector Tests
// =============================================================================

func TestInspector_QueueInfo(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)

	inspector := asynq.NewInspector(asynq.RedisClientOpt{Addr: redisAddr})
	defer inspector.Close()

	// Get queue info - may be empty but shouldn't error
	queues, err := inspector.Queues()
	require.NoError(t, err)
	t.Logf("Found %d queues", len(queues))
}

// =============================================================================
// Scheduler Registration Tests
// =============================================================================

func TestScheduler_RegisterScheduledTasks(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	config := DefaultSchedulerConfig(redisAddr)
	scheduler := NewScheduler(pool, config)
	defer scheduler.client.Close()

	// Register scheduled tasks
	err := scheduler.RegisterScheduledTasks()
	require.NoError(t, err)

	// The tasks are registered with the scheduler, which will be shut down
	// when the scheduler is stopped
}

func TestScheduler_EnqueueLoanReminders(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	config := DefaultSchedulerConfig(redisAddr)
	scheduler := NewScheduler(pool, config)
	defer scheduler.client.Close()

	// This will query the database for loans needing reminders and enqueue tasks
	err := scheduler.EnqueueLoanReminders()
	require.NoError(t, err)
}

func TestLoanReminderScheduler_ScheduleReminders_WithRedis(t *testing.T) {
	redisAddr := getRedisAddr(t)
	checkRedisConnection(t, redisAddr)
	pool := getTestPoolForRedis(t)

	ctx := context.Background()

	// Setup test data with a loan that needs a reminder
	workspaceID, borrowerID, inventoryID := setupLoanTestDataForRedis(t, pool)

	// Create a loan due in 2 days
	loanID := uuid.New()
	dueDate := time.Now().AddDate(0, 0, 2)

	_, err := pool.Exec(ctx, `
		INSERT INTO warehouse.loans (id, workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, returned_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, NOW(), $5, NULL, NOW(), NOW())
	`, loanID, workspaceID, inventoryID, borrowerID, dueDate)
	require.NoError(t, err)

	// Create client and scheduler
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
	defer client.Close()

	scheduler := NewLoanReminderScheduler(pool, client)

	// Schedule reminders - this should find our loan and enqueue a task
	err = scheduler.ScheduleReminders(ctx)
	require.NoError(t, err)
}

func setupLoanTestDataForRedis(t *testing.T, pool *pgxpool.Pool) (workspaceID, borrowerID, inventoryID uuid.UUID) {
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
		VALUES ($1, $2, 'Redis Loan Test User', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, "redis_loan_test_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	// Insert test workspace
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Redis Loan Test Workspace', $2, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, workspaceID, "redis-loan-test-"+uuid.New().String()[:8])
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
		VALUES ($1, $2, 'Redis Test Borrower', 'redis_borrower@example.com', NOW(), NOW())
	`, borrowerID, workspaceID)
	require.NoError(t, err)

	// Insert location
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.locations (id, workspace_id, name, created_at, updated_at)
		VALUES ($1, $2, 'Redis Test Location', NOW(), NOW())
	`, locationID, workspaceID)
	require.NoError(t, err)

	// Insert item with unique SKU
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.items (id, workspace_id, name, sku, min_stock_level, created_at, updated_at)
		VALUES ($1, $2, 'Redis Test Item', $3, 0, NOW(), NOW())
	`, itemID, workspaceID, "REDIS-SKU-"+uuid.New().String()[:8])
	require.NoError(t, err)

	// Insert inventory
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.inventory (id, workspace_id, item_id, location_id, quantity, condition, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, 'NEW', 'ON_LOAN', NOW(), NOW())
	`, inventoryID, workspaceID, itemID, locationID)
	require.NoError(t, err)

	return workspaceID, borrowerID, inventoryID
}

// =============================================================================
// Helper Types and Functions
// =============================================================================

type mockEmailSenderForRedis struct{}

func (m *mockEmailSenderForRedis) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	return nil
}

type trackingEmailSender struct {
	mu         *sync.Mutex
	emailsSent *[]LoanReminderPayload
}

func (s *trackingEmailSender) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	*s.emailsSent = append(*s.emailsSent, LoanReminderPayload{
		BorrowerEmail: to,
		BorrowerName:  borrowerName,
		ItemName:      itemName,
		DueDate:       dueDate,
		IsOverdue:     isOverdue,
	})
	return nil
}

type countingEmailSender struct {
	mu         *sync.Mutex
	emailsSent *[]string
}

func (s *countingEmailSender) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	*s.emailsSent = append(*s.emailsSent, to)
	return nil
}

func setupTestWorkspaceForRedis(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()

	// Insert test user
	_, err := pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'Redis E2E User', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, "redis_e2e_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	// Insert test workspace
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Redis E2E Workspace', $2, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, workspaceID, "redis-e2e-"+uuid.New().String()[:8])
	require.NoError(t, err)

	// Insert workspace membership
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, 'owner', NOW(), NOW())
		ON CONFLICT DO NOTHING
	`, workspaceID, userID)
	require.NoError(t, err)

	return workspaceID
}
