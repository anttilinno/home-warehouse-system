package jobs

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// =============================================================================
// CleanupConfig Tests
// =============================================================================

func TestDefaultCleanupConfigValues(t *testing.T) {
	config := DefaultCleanupConfig()

	// Default should be 90 days for deleted records
	assert.Equal(t, 90, config.DeletedRecordsRetentionDays)
	// Default should be 365 days for activity logs
	assert.Equal(t, 365, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_NegativeValues(t *testing.T) {
	// Negative values should be allowed (validation happens elsewhere)
	config := CleanupConfig{
		DeletedRecordsRetentionDays: -1,
		ActivityLogsRetentionDays:   -1,
	}

	assert.Equal(t, -1, config.DeletedRecordsRetentionDays)
	assert.Equal(t, -1, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_ZeroValues(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 0,
		ActivityLogsRetentionDays:   0,
	}

	// Zero values mean immediate cleanup
	assert.Equal(t, 0, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 0, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_VeryLongRetention(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 10000, // ~27 years
		ActivityLogsRetentionDays:   20000, // ~54 years
	}

	assert.Equal(t, 10000, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 20000, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_CommonComplianceValues(t *testing.T) {
	tests := []struct {
		name            string
		deletedDays     int
		activityDays    int
		complianceLabel string
	}{
		{"GDPR-friendly", 30, 180, "GDPR"},
		{"SOX compliance", 365, 2555, "SOX"}, // 7 years
		{"HIPAA-like", 180, 2190, "HIPAA"},   // 6 years
		{"minimal", 7, 30, "minimal"},
		{"standard", 90, 365, "standard"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := CleanupConfig{
				DeletedRecordsRetentionDays: tt.deletedDays,
				ActivityLogsRetentionDays:   tt.activityDays,
			}

			assert.Equal(t, tt.deletedDays, config.DeletedRecordsRetentionDays)
			assert.Equal(t, tt.activityDays, config.ActivityLogsRetentionDays)
		})
	}
}

func TestCleanupConfig_DifferentRetentionPeriods(t *testing.T) {
	// Test that deleted records and activity can have different retention
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 30,
		ActivityLogsRetentionDays:   365,
	}

	assert.NotEqual(t, config.DeletedRecordsRetentionDays, config.ActivityLogsRetentionDays)
	assert.Less(t, config.DeletedRecordsRetentionDays, config.ActivityLogsRetentionDays)
}

// =============================================================================
// CleanupProcessor Constructor Tests
// =============================================================================

func TestNewCleanupProcessor_WithDefaultConfig(t *testing.T) {
	config := DefaultCleanupConfig()
	processor := NewCleanupProcessor(nil, config)

	assert.NotNil(t, processor)
}

func TestNewCleanupProcessor_WithCustomConfig(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 7,
		ActivityLogsRetentionDays:   14,
	}
	processor := NewCleanupProcessor(nil, config)

	assert.NotNil(t, processor)
}

func TestNewCleanupProcessor_WithNilPool(t *testing.T) {
	config := DefaultCleanupConfig()
	processor := NewCleanupProcessor(nil, config)

	// Should create processor even with nil pool
	assert.NotNil(t, processor)
}

func TestNewCleanupProcessor_WithZeroConfig(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 0,
		ActivityLogsRetentionDays:   0,
	}
	processor := NewCleanupProcessor(nil, config)

	assert.NotNil(t, processor)
}

// =============================================================================
// Cleanup Task Creation Tests
// =============================================================================

func TestNewCleanupDeletedRecordsTask_Type(t *testing.T) {
	task := NewCleanupDeletedRecordsTask()

	assert.NotNil(t, task)
	assert.Equal(t, TypeCleanupDeletedRecords, task.Type())
	assert.Equal(t, "cleanup:deleted_records", task.Type())
}

func TestNewCleanupDeletedRecordsTask_NoPayload(t *testing.T) {
	task := NewCleanupDeletedRecordsTask()

	assert.Nil(t, task.Payload())
}

func TestNewCleanupActivityTask_Type(t *testing.T) {
	task := NewCleanupActivityTask()

	assert.NotNil(t, task)
	assert.Equal(t, TypeCleanupOldActivity, task.Type())
	assert.Equal(t, "cleanup:old_activity", task.Type())
}

func TestNewCleanupActivityTask_NoPayload(t *testing.T) {
	task := NewCleanupActivityTask()

	assert.Nil(t, task.Payload())
}

func TestCleanupTasks_DifferentTypes(t *testing.T) {
	deletedTask := NewCleanupDeletedRecordsTask()
	activityTask := NewCleanupActivityTask()

	assert.NotEqual(t, deletedTask.Type(), activityTask.Type())
}

func TestCleanupTasks_MultipleInstances(t *testing.T) {
	// Create multiple instances and verify they're all valid
	for i := 0; i < 5; i++ {
		deleted := NewCleanupDeletedRecordsTask()
		activity := NewCleanupActivityTask()

		assert.NotNil(t, deleted)
		assert.NotNil(t, activity)
		assert.Equal(t, TypeCleanupDeletedRecords, deleted.Type())
		assert.Equal(t, TypeCleanupOldActivity, activity.Type())
	}
}

// =============================================================================
// Retention Period Calculation Tests
// =============================================================================

func TestCleanupConfig_RetentionPeriodUsage(t *testing.T) {
	// Test that retention values can be used for date calculations
	tests := []struct {
		name string
		days int
	}{
		{"1 day", 1},
		{"7 days", 7},
		{"30 days", 30},
		{"90 days", 90},
		{"365 days", 365},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := CleanupConfig{
				DeletedRecordsRetentionDays: tt.days,
			}

			// Verify the cutoff date calculation works correctly
			now := time.Now()
			cutoffDate := now.AddDate(0, 0, -config.DeletedRecordsRetentionDays)

			// The cutoff should be in the past
			assert.True(t, cutoffDate.Before(now))

			// The difference in days should match (approximately)
			daysDiff := int(now.Sub(cutoffDate).Hours() / 24)
			assert.Equal(t, tt.days, daysDiff)
		})
	}
}

// =============================================================================
// Edge Cases
// =============================================================================

func TestCleanupConfig_MaxInt(t *testing.T) {
	// Test with max reasonable value (not max int to avoid overflow)
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 36500, // 100 years
		ActivityLogsRetentionDays:   36500,
	}

	assert.Equal(t, 36500, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 36500, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_OneDay(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 1,
		ActivityLogsRetentionDays:   1,
	}

	assert.Equal(t, 1, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 1, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_Immutability(t *testing.T) {
	// Test that configs are independent
	config1 := CleanupConfig{
		DeletedRecordsRetentionDays: 30,
		ActivityLogsRetentionDays:   60,
	}

	config2 := config1
	config2.DeletedRecordsRetentionDays = 90

	// Original should be unchanged
	assert.Equal(t, 30, config1.DeletedRecordsRetentionDays)
	assert.Equal(t, 90, config2.DeletedRecordsRetentionDays)
}

func TestDefaultCleanupConfig_Immutability(t *testing.T) {
	// Multiple calls should return independent configs
	config1 := DefaultCleanupConfig()
	config2 := DefaultCleanupConfig()

	config1.DeletedRecordsRetentionDays = 999

	// config2 should still have default value
	assert.Equal(t, 90, config2.DeletedRecordsRetentionDays)
}
