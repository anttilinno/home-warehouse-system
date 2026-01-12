package jobs_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/jobs"
)

func TestDefaultSchedulerConfig(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")

	assert.Equal(t, "localhost:6379", config.RedisAddr)
	assert.NotEmpty(t, config.Queues)
	assert.Contains(t, config.Queues, jobs.QueueCritical)
	assert.Contains(t, config.Queues, jobs.QueueDefault)
	assert.Contains(t, config.Queues, jobs.QueueLow)
}

func TestSchedulerConfig_WithCustomQueues(t *testing.T) {
	config := jobs.SchedulerConfig{
		RedisAddr: "localhost:6379",
		Queues: map[string]int{
			"high":    10,
			"medium":  5,
			"low":     1,
		},
	}

	assert.Equal(t, "localhost:6379", config.RedisAddr)
	assert.Len(t, config.Queues, 3)
	assert.Equal(t, 10, config.Queues["high"])
	assert.Equal(t, 5, config.Queues["medium"])
	assert.Equal(t, 1, config.Queues["low"])
}
