package jobs_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/jobs"
)

// =============================================================================
// SchedulerConfig Tests
// =============================================================================

func TestDefaultSchedulerConfig(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")

	assert.Equal(t, "localhost:6379", config.RedisAddr)
	assert.NotEmpty(t, config.Queues)
	assert.Contains(t, config.Queues, jobs.QueueCritical)
	assert.Contains(t, config.Queues, jobs.QueueDefault)
	assert.Contains(t, config.Queues, jobs.QueueLow)
}

func TestDefaultSchedulerConfig_QueuePriorities(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")

	// Critical should have highest priority
	assert.Greater(t, config.Queues[jobs.QueueCritical], config.Queues[jobs.QueueDefault])
	// Default should have higher priority than low
	assert.Greater(t, config.Queues[jobs.QueueDefault], config.Queues[jobs.QueueLow])
}

func TestDefaultSchedulerConfig_DifferentRedisAddresses(t *testing.T) {
	tests := []struct {
		name      string
		redisAddr string
	}{
		{"localhost default port", "localhost:6379"},
		{"localhost custom port", "localhost:6380"},
		{"remote host", "redis.example.com:6379"},
		{"IP address", "192.168.1.100:6379"},
		{"with password in addr", "redis:6379"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := jobs.DefaultSchedulerConfig(tt.redisAddr)
			assert.Equal(t, tt.redisAddr, config.RedisAddr)
		})
	}
}

func TestSchedulerConfig_WithCustomQueues(t *testing.T) {
	config := jobs.SchedulerConfig{
		RedisAddr: "localhost:6379",
		Queues: map[string]int{
			"high":   10,
			"medium": 5,
			"low":    1,
		},
	}

	assert.Equal(t, "localhost:6379", config.RedisAddr)
	assert.Len(t, config.Queues, 3)
	assert.Equal(t, 10, config.Queues["high"])
	assert.Equal(t, 5, config.Queues["medium"])
	assert.Equal(t, 1, config.Queues["low"])
}

func TestSchedulerConfig_WithEmptyQueues(t *testing.T) {
	config := jobs.SchedulerConfig{
		RedisAddr: "localhost:6379",
		Queues:    map[string]int{},
	}

	assert.Equal(t, "localhost:6379", config.RedisAddr)
	assert.Empty(t, config.Queues)
}

func TestSchedulerConfig_WithSingleQueue(t *testing.T) {
	config := jobs.SchedulerConfig{
		RedisAddr: "localhost:6379",
		Queues: map[string]int{
			"single": 1,
		},
	}

	assert.Len(t, config.Queues, 1)
	assert.Equal(t, 1, config.Queues["single"])
}

func TestSchedulerConfig_WithHighPriorityValues(t *testing.T) {
	config := jobs.SchedulerConfig{
		RedisAddr: "localhost:6379",
		Queues: map[string]int{
			"critical": 100,
			"high":     50,
			"normal":   10,
			"low":      1,
		},
	}

	assert.Len(t, config.Queues, 4)
	assert.Equal(t, 100, config.Queues["critical"])
}

// =============================================================================
// Scheduler Constructor Tests
// =============================================================================

func TestNewScheduler(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	assert.NotNil(t, scheduler)
	assert.NotNil(t, scheduler.Client())
}

func TestNewScheduler_WithNilPool(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	// Scheduler should still be created even with nil pool
	assert.NotNil(t, scheduler)
}

func TestNewScheduler_ClientIsNotNil(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	client := scheduler.Client()
	assert.NotNil(t, client)
}

func TestNewScheduler_MultipleInstances(t *testing.T) {
	config1 := jobs.DefaultSchedulerConfig("localhost:6379")
	config2 := jobs.DefaultSchedulerConfig("localhost:6380")

	scheduler1 := jobs.NewScheduler(nil, config1)
	scheduler2 := jobs.NewScheduler(nil, config2)

	// Each scheduler should be independent
	assert.NotNil(t, scheduler1)
	assert.NotNil(t, scheduler2)
	assert.NotSame(t, scheduler1.Client(), scheduler2.Client())
}

// =============================================================================
// RegisterHandlers Tests
// =============================================================================

func TestScheduler_RegisterHandlers(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	cleanupConfig := jobs.DefaultCleanupConfig()
	mux := scheduler.RegisterHandlers(nil, cleanupConfig)

	assert.NotNil(t, mux)
}

func TestScheduler_RegisterHandlers_WithNilEmailSender(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	cleanupConfig := jobs.DefaultCleanupConfig()
	mux := scheduler.RegisterHandlers(nil, cleanupConfig)

	// Should work with nil email sender
	assert.NotNil(t, mux)
}

func TestScheduler_RegisterHandlers_WithMockEmailSender(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	mockSender := &mockEmailSender{}
	cleanupConfig := jobs.DefaultCleanupConfig()
	mux := scheduler.RegisterHandlers(mockSender, cleanupConfig)

	assert.NotNil(t, mux)
}

func TestScheduler_RegisterHandlers_WithCustomCleanupConfig(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	customCleanupConfig := jobs.CleanupConfig{
		DeletedRecordsRetentionDays: 7,
		ActivityLogsRetentionDays:   30,
	}
	mux := scheduler.RegisterHandlers(nil, customCleanupConfig)

	assert.NotNil(t, mux)
}

func TestScheduler_RegisterHandlers_CalledMultipleTimes(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	cleanupConfig := jobs.DefaultCleanupConfig()

	// Should be able to register handlers multiple times
	mux1 := scheduler.RegisterHandlers(nil, cleanupConfig)
	mux2 := scheduler.RegisterHandlers(nil, cleanupConfig)

	assert.NotNil(t, mux1)
	assert.NotNil(t, mux2)
	// Each call creates a new mux
	assert.NotSame(t, mux1, mux2)
}

// =============================================================================
// Scheduler Stop Tests (non-integration, doesn't require Redis)
// =============================================================================

func TestScheduler_Stop_DoesNotPanic(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	// Stop should not panic even if scheduler was never started
	assert.NotPanics(t, func() {
		scheduler.Stop()
	})
}

// =============================================================================
// Queue Constants Tests
// =============================================================================

func TestQueueConstants(t *testing.T) {
	assert.Equal(t, "critical", jobs.QueueCritical)
	assert.Equal(t, "default", jobs.QueueDefault)
	assert.Equal(t, "low", jobs.QueueLow)
}

func TestQueueConstants_AreUnique(t *testing.T) {
	queues := map[string]bool{
		jobs.QueueCritical: true,
		jobs.QueueDefault:  true,
		jobs.QueueLow:      true,
	}

	// All queue names should be unique
	assert.Len(t, queues, 3)
}

// =============================================================================
// Task Type Constants Tests
// =============================================================================

func TestTaskTypeConstants(t *testing.T) {
	assert.Equal(t, "loan:reminder", jobs.TypeLoanReminder)
	assert.Equal(t, "cleanup:deleted_records", jobs.TypeCleanupDeletedRecords)
	assert.Equal(t, "cleanup:old_activity", jobs.TypeCleanupOldActivity)
}

func TestTaskTypeConstants_AreUnique(t *testing.T) {
	types := map[string]bool{
		jobs.TypeLoanReminder:          true,
		jobs.TypeCleanupDeletedRecords: true,
		jobs.TypeCleanupOldActivity:    true,
	}

	// All task types should be unique
	assert.Len(t, types, 3)
}

func TestTaskTypeConstants_HaveCorrectFormat(t *testing.T) {
	// Task types should follow namespace:action format
	assert.Contains(t, jobs.TypeLoanReminder, ":")
	assert.Contains(t, jobs.TypeCleanupDeletedRecords, ":")
	assert.Contains(t, jobs.TypeCleanupOldActivity, ":")
}

// =============================================================================
// Task Creation Tests
// =============================================================================

func TestNewScheduleLoanRemindersTask(t *testing.T) {
	task := jobs.NewScheduleLoanRemindersTask()

	assert.NotNil(t, task)
	assert.Equal(t, jobs.TypeLoanReminder+":schedule", task.Type())
	assert.Nil(t, task.Payload())
}

func TestNewCleanupDeletedRecordsTask(t *testing.T) {
	task := jobs.NewCleanupDeletedRecordsTask()

	assert.NotNil(t, task)
	assert.Equal(t, jobs.TypeCleanupDeletedRecords, task.Type())
	assert.Nil(t, task.Payload())
}

func TestNewCleanupActivityTask(t *testing.T) {
	task := jobs.NewCleanupActivityTask()

	assert.NotNil(t, task)
	assert.Equal(t, jobs.TypeCleanupOldActivity, task.Type())
	assert.Nil(t, task.Payload())
}

func TestTaskCreation_MultipleInstances(t *testing.T) {
	task1 := jobs.NewScheduleLoanRemindersTask()
	task2 := jobs.NewScheduleLoanRemindersTask()

	// Each call should create a new task instance
	assert.NotNil(t, task1)
	assert.NotNil(t, task2)
	assert.Equal(t, task1.Type(), task2.Type())
}

// =============================================================================
// Mock Email Sender for Tests
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

// =============================================================================
// Processor Constructor Tests
// =============================================================================

func TestNewLoanReminderProcessor(t *testing.T) {
	processor := jobs.NewLoanReminderProcessor(nil, nil)
	assert.NotNil(t, processor)
}

func TestNewLoanReminderProcessor_WithMockSender(t *testing.T) {
	mockSender := &mockEmailSender{}
	processor := jobs.NewLoanReminderProcessor(nil, mockSender)
	assert.NotNil(t, processor)
}

func TestNewCleanupProcessor(t *testing.T) {
	config := jobs.DefaultCleanupConfig()
	processor := jobs.NewCleanupProcessor(nil, config)
	assert.NotNil(t, processor)
}

func TestNewCleanupProcessor_WithCustomConfig(t *testing.T) {
	config := jobs.CleanupConfig{
		DeletedRecordsRetentionDays: 30,
		ActivityLogsRetentionDays:   180,
	}
	processor := jobs.NewCleanupProcessor(nil, config)
	assert.NotNil(t, processor)
}

func TestNewLoanReminderScheduler(t *testing.T) {
	scheduler := jobs.NewLoanReminderScheduler(nil, nil)
	assert.NotNil(t, scheduler)
}

// =============================================================================
// CleanupConfig Tests
// =============================================================================

func TestDefaultCleanupConfig(t *testing.T) {
	config := jobs.DefaultCleanupConfig()

	assert.Equal(t, 90, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 365, config.ActivityLogsRetentionDays)
}

func TestDefaultCleanupConfig_ReasonableDefaults(t *testing.T) {
	config := jobs.DefaultCleanupConfig()

	// Deleted records should be retained long enough for recovery
	assert.GreaterOrEqual(t, config.DeletedRecordsRetentionDays, 30)
	// Activity logs should be retained for compliance
	assert.GreaterOrEqual(t, config.ActivityLogsRetentionDays, 90)
}

func TestCleanupConfig_CustomValues(t *testing.T) {
	config := jobs.CleanupConfig{
		DeletedRecordsRetentionDays: 7,
		ActivityLogsRetentionDays:   14,
	}

	assert.Equal(t, 7, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 14, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_ZeroValues(t *testing.T) {
	config := jobs.CleanupConfig{
		DeletedRecordsRetentionDays: 0,
		ActivityLogsRetentionDays:   0,
	}

	// Zero values should be allowed (immediate cleanup)
	assert.Equal(t, 0, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 0, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_LargeValues(t *testing.T) {
	config := jobs.CleanupConfig{
		DeletedRecordsRetentionDays: 3650, // 10 years
		ActivityLogsRetentionDays:   7300, // 20 years
	}

	assert.Equal(t, 3650, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 7300, config.ActivityLogsRetentionDays)
}

// =============================================================================
// Concurrent Access Tests
// =============================================================================

func TestScheduler_ConcurrentClientAccess(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			client := scheduler.Client()
			require.NotNil(t, client)
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestScheduler_ConcurrentRegisterHandlers(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)
	cleanupConfig := jobs.DefaultCleanupConfig()

	done := make(chan bool)
	for i := 0; i < 5; i++ {
		go func() {
			mux := scheduler.RegisterHandlers(nil, cleanupConfig)
			require.NotNil(t, mux)
			done <- true
		}()
	}

	for i := 0; i < 5; i++ {
		<-done
	}
}
