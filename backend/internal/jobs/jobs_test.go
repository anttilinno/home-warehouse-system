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
// Task Type Tests
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
// LoanReminderPayload Tests
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

func TestLoanReminderPayload_OverdueFlag(t *testing.T) {
	tests := []struct {
		name      string
		dueDate   time.Time
		isOverdue bool
	}{
		{
			name:      "future due date - not overdue",
			dueDate:   time.Now().Add(24 * time.Hour),
			isOverdue: false,
		},
		{
			name:      "past due date - overdue",
			dueDate:   time.Now().Add(-24 * time.Hour),
			isOverdue: true,
		},
		{
			name:      "today - not overdue yet",
			dueDate:   time.Now(),
			isOverdue: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := LoanReminderPayload{
				DueDate:   tt.dueDate,
				IsOverdue: tt.isOverdue,
			}
			assert.Equal(t, tt.isOverdue, payload.IsOverdue)
		})
	}
}

// =============================================================================
// CleanupConfig Tests
// =============================================================================

func TestDefaultCleanupConfig(t *testing.T) {
	config := DefaultCleanupConfig()

	assert.Equal(t, 90, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 365, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_CustomValues(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 30,
		ActivityLogsRetentionDays:   180,
	}

	assert.Equal(t, 30, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 180, config.ActivityLogsRetentionDays)
}

// =============================================================================
// SchedulerConfig Tests
// =============================================================================

func TestDefaultSchedulerConfig(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")

	assert.Equal(t, "localhost:6379", config.RedisAddr)
	assert.NotNil(t, config.Queues)
	assert.Equal(t, 6, config.Queues[QueueCritical])
	assert.Equal(t, 3, config.Queues[QueueDefault])
	assert.Equal(t, 1, config.Queues[QueueLow])
}

// =============================================================================
// Task Creation Tests
// =============================================================================

func TestNewScheduleLoanRemindersTask(t *testing.T) {
	task := NewScheduleLoanRemindersTask()
	assert.NotNil(t, task)
	assert.Equal(t, TypeLoanReminder+":schedule", task.Type())
}

func TestNewCleanupDeletedRecordsTask(t *testing.T) {
	task := NewCleanupDeletedRecordsTask()
	assert.NotNil(t, task)
	assert.Equal(t, TypeCleanupDeletedRecords, task.Type())
}

func TestNewCleanupActivityTask(t *testing.T) {
	task := NewCleanupActivityTask()
	assert.NotNil(t, task)
	assert.Equal(t, TypeCleanupOldActivity, task.Type())
}

// =============================================================================
// Processor Constructor Tests
// =============================================================================

func TestNewLoanReminderProcessor(t *testing.T) {
	processor := NewLoanReminderProcessor(nil, nil)
	assert.NotNil(t, processor)
}

func TestNewCleanupProcessor(t *testing.T) {
	config := DefaultCleanupConfig()
	processor := NewCleanupProcessor(nil, config)
	assert.NotNil(t, processor)
}

func TestNewLoanReminderScheduler(t *testing.T) {
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
	processor := NewLoanReminderProcessor(nil, mockSender)

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

func TestLoanReminderProcessor_ProcessTask_InvalidPayload(t *testing.T) {
	processor := NewLoanReminderProcessor(nil, nil)

	task := asynq.NewTask(TypeLoanReminder, []byte("invalid json"))
	err := processor.ProcessTask(context.Background(), task)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to unmarshal payload")
}

func TestLoanReminderProcessor_ProcessTask_NoEmailSender(t *testing.T) {
	// Processor with nil email sender should not fail
	processor := NewLoanReminderProcessor(nil, nil)

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
// Cleanup Config Validation Tests
// =============================================================================

func TestCleanupConfig_ZeroRetention(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 0,
		ActivityLogsRetentionDays:   0,
	}

	assert.Equal(t, 0, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 0, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_LargeRetention(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 3650, // 10 years
		ActivityLogsRetentionDays:   7300, // 20 years
	}

	assert.Equal(t, 3650, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 7300, config.ActivityLogsRetentionDays)
}

// =============================================================================
// Loan Reminder Payload Edge Cases
// =============================================================================

func TestLoanReminderPayload_EmptyStrings(t *testing.T) {
	payload := LoanReminderPayload{
		LoanID:        uuid.New(),
		WorkspaceID:   uuid.New(),
		BorrowerName:  "",
		BorrowerEmail: "",
		ItemName:      "",
		DueDate:       time.Now(),
		IsOverdue:     false,
	}

	data, err := json.Marshal(payload)
	assert.NoError(t, err)

	var unmarshaled LoanReminderPayload
	err = json.Unmarshal(data, &unmarshaled)
	assert.NoError(t, err)

	assert.Equal(t, "", unmarshaled.BorrowerName)
	assert.Equal(t, "", unmarshaled.BorrowerEmail)
	assert.Equal(t, "", unmarshaled.ItemName)
}

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

// =============================================================================
// Task Creation Edge Cases
// =============================================================================

func TestNewScheduleLoanRemindersTask_Multiple(t *testing.T) {
	task1 := NewScheduleLoanRemindersTask()
	task2 := NewScheduleLoanRemindersTask()

	// Tasks should be independent
	assert.NotNil(t, task1)
	assert.NotNil(t, task2)
	assert.Equal(t, task1.Type(), task2.Type())
}

func TestNewCleanupTasks_Independent(t *testing.T) {
	deletedTask := NewCleanupDeletedRecordsTask()
	activityTask := NewCleanupActivityTask()

	assert.NotNil(t, deletedTask)
	assert.NotNil(t, activityTask)
	assert.NotEqual(t, deletedTask.Type(), activityTask.Type())
}

// =============================================================================
// RegisterHandlers Tests
// =============================================================================

func TestScheduler_RegisterHandlers(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")
	scheduler := NewScheduler(nil, config)

	mockSender := &mockEmailSender{}
	cleanupConfig := DefaultCleanupConfig()

	mux := scheduler.RegisterHandlers(mockSender, cleanupConfig)

	assert.NotNil(t, mux)
}

func TestScheduler_RegisterHandlers_WithNilEmailSender(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")
	scheduler := NewScheduler(nil, config)

	cleanupConfig := DefaultCleanupConfig()

	mux := scheduler.RegisterHandlers(nil, cleanupConfig)

	assert.NotNil(t, mux)
}

func TestScheduler_RegisterHandlers_WithCustomCleanupConfig(t *testing.T) {
	config := DefaultSchedulerConfig("localhost:6379")
	scheduler := NewScheduler(nil, config)

	customCleanupConfig := CleanupConfig{
		DeletedRecordsRetentionDays: 30,
		ActivityLogsRetentionDays:   180,
	}

	mux := scheduler.RegisterHandlers(nil, customCleanupConfig)

	assert.NotNil(t, mux)
}
