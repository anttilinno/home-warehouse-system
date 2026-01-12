package jobs

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// Additional cleanup config tests beyond those in jobs_test.go

func TestCleanupConfig_NegativeValues(t *testing.T) {
	// Negative values should be allowed (validation happens elsewhere)
	config := CleanupConfig{
		DeletedRecordsRetentionDays: -1,
		ActivityLogsRetentionDays:   -1,
	}

	assert.Equal(t, -1, config.DeletedRecordsRetentionDays)
	assert.Equal(t, -1, config.ActivityLogsRetentionDays)
}

func TestCleanupConfig_VeryLongRetention(t *testing.T) {
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 10000, // ~27 years
		ActivityLogsRetentionDays:   20000, // ~54 years
	}

	assert.Equal(t, 10000, config.DeletedRecordsRetentionDays)
	assert.Equal(t, 20000, config.ActivityLogsRetentionDays)
}
