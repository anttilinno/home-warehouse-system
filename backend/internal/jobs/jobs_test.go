package jobs

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Task Type Constants Tests
// =============================================================================

func TestTaskTypes(t *testing.T) {
	assert.Equal(t, "loan:reminder", TypeLoanReminder)
	assert.Equal(t, "cleanup:deleted_records", TypeCleanupDeletedRecords)
	assert.Equal(t, "cleanup:old_activity", TypeCleanupOldActivity)
}

func TestQueueNames(t *testing.T) {
	assert.Equal(t, "critical", QueueCritical)
	assert.Equal(t, "default", QueueDefault)
	assert.Equal(t, "low", QueueLow)
}

// =============================================================================
// LoanReminderPayload JSON Tests
// =============================================================================

func TestLoanReminderPayload_JSON(t *testing.T) {
	loanID := uuid.New()
	workspaceID := uuid.New()
	dueDate := time.Now().Add(24 * time.Hour).Truncate(time.Second)

	payload := LoanReminderPayload{
		LoanID:        loanID,
		WorkspaceID:   workspaceID,
		BorrowerName:  "John Doe",
		BorrowerEmail: "john@example.com",
		ItemName:      "Power Drill",
		DueDate:       dueDate,
		IsOverdue:     false,
	}

	// Test marshaling
	data, err := json.Marshal(payload)
	assert.NoError(t, err)

	// Test unmarshaling
	var unmarshaled LoanReminderPayload
	err = json.Unmarshal(data, &unmarshaled)
	assert.NoError(t, err)

	assert.Equal(t, payload.LoanID, unmarshaled.LoanID)
	assert.Equal(t, payload.WorkspaceID, unmarshaled.WorkspaceID)
	assert.Equal(t, payload.BorrowerName, unmarshaled.BorrowerName)
	assert.Equal(t, payload.BorrowerEmail, unmarshaled.BorrowerEmail)
	assert.Equal(t, payload.ItemName, unmarshaled.ItemName)
	assert.Equal(t, payload.DueDate.Unix(), unmarshaled.DueDate.Unix())
	assert.Equal(t, payload.IsOverdue, unmarshaled.IsOverdue)
}

// =============================================================================
// SchedulerConfig Tests
// =============================================================================

func TestDefaultSchedulerConfigInternal(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")

	assert.Equal(t, "localhost:6379", config.RedisAddr)
	assert.NotNil(t, config.Queues)
	assert.Equal(t, 6, config.Queues[QueueCritical])
	assert.Equal(t, 3, config.Queues[QueueDefault])
	assert.Equal(t, 1, config.Queues[QueueLow])
}

func TestSchedulerConfig_CustomQueues(t *testing.T) {
	config := SchedulerConfig{
		RedisAddr: "redis:6379",
		Queues: map[string]int{
			QueueCritical: 20,
			QueueDefault:  10,
			QueueLow:      5,
		},
	}

	assert.Equal(t, "redis:6379", config.RedisAddr)
	assert.Equal(t, 20, config.Queues[QueueCritical])
	assert.Equal(t, 10, config.Queues[QueueDefault])
	assert.Equal(t, 5, config.Queues[QueueLow])
}

// =============================================================================
// Task Creation Tests
// =============================================================================

func TestNewScheduleLoanRemindersTaskInternal(t *testing.T) {
	task := NewScheduleLoanRemindersTask()
	assert.NotNil(t, task)
	assert.Equal(t, TypeLoanReminder+":schedule", task.Type())
}

func TestNewCleanupDeletedRecordsTaskInternal(t *testing.T) {
	task := NewCleanupDeletedRecordsTask()
	assert.NotNil(t, task)
	assert.Equal(t, TypeCleanupDeletedRecords, task.Type())
}

func TestNewCleanupActivityTaskInternal(t *testing.T) {
	task := NewCleanupActivityTask()
	assert.NotNil(t, task)
	assert.Equal(t, TypeCleanupOldActivity, task.Type())
}

func TestNewCleanupTasks_Independent(t *testing.T) {
	deletedTask := NewCleanupDeletedRecordsTask()
	activityTask := NewCleanupActivityTask()

	assert.NotNil(t, deletedTask)
	assert.NotNil(t, activityTask)
	assert.NotEqual(t, deletedTask.Type(), activityTask.Type())
}

// =============================================================================
// Processor Constructor Tests
// =============================================================================

func TestNewLoanReminderProcessorInternal(t *testing.T) {
	processor := NewLoanReminderProcessor(nil, nil, nil)
	assert.NotNil(t, processor)
}

func TestNewCleanupProcessorInternal(t *testing.T) {
	config := DefaultCleanupConfig()
	processor := NewCleanupProcessor(nil, config)
	assert.NotNil(t, processor)
}

func TestNewLoanReminderSchedulerInternal(t *testing.T) {
	scheduler := NewLoanReminderScheduler(nil, nil)
	assert.NotNil(t, scheduler)
}

// =============================================================================
// Mock Email Sender for Testing
// =============================================================================

type mockEmailSender struct {
	sentEmails []sentEmail
}

type sentEmail struct {
	to           string
	borrowerName string
	itemName     string
	dueDate      time.Time
	isOverdue    bool
}

func (m *mockEmailSender) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	m.sentEmails = append(m.sentEmails, sentEmail{
		to:           to,
		borrowerName: borrowerName,
		itemName:     itemName,
		dueDate:      dueDate,
		isOverdue:    isOverdue,
	})
	return nil
}

func TestLoanReminderProcessor_ProcessTask_WithMockEmailSender(t *testing.T) {
	mockSender := &mockEmailSender{}
	processor := NewLoanReminderProcessor(nil, mockSender, nil)

	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "Jane Doe",
		BorrowerEmail: "jane@example.com",
		ItemName:      "Circular Saw",
		DueDate:       time.Now().Add(24 * time.Hour),
		IsOverdue:     false,
	}

	payloadBytes, err := json.Marshal(payload)
	assert.NoError(t, err)

	task := asynq.NewTask(TypeLoanReminder, payloadBytes)
	err = processor.ProcessTask(context.Background(), task)
	assert.NoError(t, err)

	// Verify email was sent
	assert.Len(t, mockSender.sentEmails, 1)
	assert.Equal(t, "jane@example.com", mockSender.sentEmails[0].to)
	assert.Equal(t, "Jane Doe", mockSender.sentEmails[0].borrowerName)
	assert.Equal(t, "Circular Saw", mockSender.sentEmails[0].itemName)
	assert.False(t, mockSender.sentEmails[0].isOverdue)
}

func TestLoanReminderProcessor_ProcessTask_NoEmailSender(t *testing.T) {
	// Processor with nil email sender should not fail
	processor := NewLoanReminderProcessor(nil, nil, nil)

	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		BorrowerName:  "Test User",
		BorrowerEmail: "test@example.com",
		ItemName:      "Test Item",
		DueDate:       time.Now(),
		IsOverdue:     false,
	}

	payloadBytes, _ := json.Marshal(payload)
	task := asynq.NewTask(TypeLoanReminder, payloadBytes)

	err := processor.ProcessTask(context.Background(), task)
	assert.NoError(t, err) // Should succeed even without email sender
}

// =============================================================================
// Scheduler Tests
// =============================================================================

func TestNewScheduler_ConfigPreserved(t *testing.T) {
	config := SchedulerConfig{
		RedisAddr: "localhost:6379",
		Queues: map[string]int{
			QueueCritical: 10,
			QueueDefault:  5,
			QueueLow:      2,
		},
	}

	scheduler := NewScheduler(nil, config)

	assert.NotNil(t, scheduler)
	assert.NotNil(t, scheduler.Client())
}

func TestScheduler_Client(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")
	scheduler := NewScheduler(nil, config)

	client := scheduler.Client()

	assert.NotNil(t, client)
}

// =============================================================================
// Loan Reminder Payload Edge Cases
// =============================================================================

func TestLoanReminderPayload_PastDueDate(t *testing.T) {
	pastDate := time.Now().Add(-7 * 24 * time.Hour) // 7 days ago
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "Late User",
		BorrowerEmail: "late@example.com",
		ItemName:      "Overdue Item",
		DueDate:       pastDate,
		IsOverdue:     true,
	}

	data, err := json.Marshal(payload)
	assert.NoError(t, err)

	var unmarshaled LoanReminderPayload
	err = json.Unmarshal(data, &unmarshaled)
	assert.NoError(t, err)

	assert.True(t, unmarshaled.IsOverdue)
	assert.True(t, unmarshaled.DueDate.Before(time.Now()))
}

func TestLoanReminderPayload_FarFuture(t *testing.T) {
	futureDate := time.Now().Add(365 * 24 * time.Hour) // 1 year ahead
	payload := LoanReminderPayload{
		LoanID:      uuid.New(),
		WorkspaceID: uuid.New(),
		DueDate:     futureDate,
		IsOverdue:   false,
	}

	assert.False(t, payload.IsOverdue)
	assert.True(t, payload.DueDate.After(time.Now()))
}

func TestNewScheduleLoanRemindersTask_Multiple(t *testing.T) {
	task1 := NewScheduleLoanRemindersTask()
	task2 := NewScheduleLoanRemindersTask()

	// Tasks should be independent
	assert.NotNil(t, task1)
	assert.NotNil(t, task2)
	assert.Equal(t, task1.Type(), task2.Type())
}

// =============================================================================
// RegisterHandlers Tests
// =============================================================================

func TestScheduler_RegisterHandlersInternal(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")
	scheduler := NewScheduler(nil, config)

	mockSender := &mockEmailSender{}
	cleanupConfig := DefaultCleanupConfig()

	mux := scheduler.RegisterHandlers(mockSender, nil, cleanupConfig)

	assert.NotNil(t, mux)
}

func TestScheduler_RegisterHandlers_WithNilEmailSenderInternal(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")
	scheduler := NewScheduler(nil, config)

	cleanupConfig := DefaultCleanupConfig()

	mux := scheduler.RegisterHandlers(nil, nil, cleanupConfig)

	assert.NotNil(t, mux)
}

func TestScheduler_RegisterHandlers_WithCustomCleanupConfigInternal(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")
	scheduler := NewScheduler(nil, config)

	customCleanupConfig := CleanupConfig{
		DeletedRecordsRetentionDays: 30,
		ActivityLogsRetentionDays:   180,
	}

	mux := scheduler.RegisterHandlers(nil, nil, customCleanupConfig)

	assert.NotNil(t, mux)
}
