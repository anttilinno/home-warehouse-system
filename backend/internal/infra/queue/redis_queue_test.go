//go:build integration
// +build integration

package queue

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getRedisAddr(t *testing.T) string {
	t.Helper()
	addr := os.Getenv("TEST_REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	return addr
}

func newTestQueue(t *testing.T) (*Queue, *redis.Client) {
	t.Helper()

	client := redis.NewClient(&redis.Options{Addr: getRedisAddr(t)})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("skipping integration test: redis ping failed: %v", err)
	}

	// Unique queue name per test so parallel runs never share keys.
	name := fmt.Sprintf("test-%s", uuid.New().String()[:8])
	q := NewQueue(client, name)

	t.Cleanup(func() {
		bgCtx := context.Background()
		client.Del(bgCtx, q.queueName, q.processingName, q.deadName)
		client.Close()
	})

	return q, client
}

func TestQueue_EnqueueDequeueComplete(t *testing.T) {
	q, client := newTestQueue(t)
	ctx := context.Background()

	job, err := q.Enqueue(ctx, "test.job", map[string]any{"foo": "bar"})
	require.NoError(t, err)
	require.NotEmpty(t, job.ID)

	length, err := q.Length(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), length)

	dequeued, err := q.Dequeue(ctx, time.Second)
	require.NoError(t, err)
	require.NotNil(t, dequeued)
	assert.Equal(t, job.ID, dequeued.ID)
	assert.Equal(t, "test.job", dequeued.Type)
	assert.Equal(t, "bar", dequeued.Payload["foo"])

	length, err = q.Length(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), length, "dequeued job must leave the queue list")

	inFlight, err := client.LRange(ctx, q.processingName, 0, -1).Result()
	require.NoError(t, err)
	assert.Equal(t, []string{job.ID}, inFlight, "dequeue must move the job to the in-flight list, not drop it")

	require.NoError(t, q.Complete(ctx, job.ID))

	inFlight, err = client.LRange(ctx, q.processingName, 0, -1).Result()
	require.NoError(t, err)
	assert.Empty(t, inFlight, "complete must remove the job from the in-flight list")

	exists, err := client.Exists(ctx, q.jobKey(job.ID)).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), exists, "complete must delete the job payload")
}

func TestQueue_Dequeue_NoJobAvailable(t *testing.T) {
	q, _ := newTestQueue(t)
	ctx := context.Background()

	job, err := q.Dequeue(ctx, time.Second)
	require.NoError(t, err)
	assert.Nil(t, job)
}

func TestQueue_Fail_RetriesUnderMaxThenReenqueues(t *testing.T) {
	q, _ := newTestQueue(t)
	ctx := context.Background()

	job, err := q.Enqueue(ctx, "test.job", map[string]any{"foo": "bar"})
	require.NoError(t, err)

	dequeued, err := q.Dequeue(ctx, time.Second)
	require.NoError(t, err)
	require.NotNil(t, dequeued)

	dead, err := q.Fail(ctx, job.ID, "boom")
	require.NoError(t, err)
	assert.False(t, dead, "job under max retries must not be dead-lettered")

	length, err := q.Length(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), length, "failed job under max retries must be re-enqueued")

	requeued, err := q.Dequeue(ctx, time.Second)
	require.NoError(t, err)
	require.NotNil(t, requeued)
	assert.Equal(t, job.ID, requeued.ID)
	assert.Equal(t, 1, requeued.Retries)
	assert.Equal(t, "boom", requeued.LastError)
}

func TestQueue_Fail_DeadLettersAfterMaxRetries(t *testing.T) {
	q, client := newTestQueue(t)
	ctx := context.Background()

	job, err := q.Enqueue(ctx, "test.job", map[string]any{"foo": "bar"})
	require.NoError(t, err)

	var dead bool
	for i := 0; i < q.maxRetries; i++ {
		dequeued, derr := q.Dequeue(ctx, time.Second)
		require.NoError(t, derr)
		require.NotNil(t, dequeued)

		dead, err = q.Fail(ctx, job.ID, fmt.Sprintf("attempt %d failed", i+1))
		require.NoError(t, err)
	}

	assert.True(t, dead, "job must be dead-lettered once retries are exhausted")

	length, err := q.Length(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), length, "dead-lettered job must not remain on the live queue")

	deadLetters, err := client.LRange(ctx, q.deadName, 0, -1).Result()
	require.NoError(t, err)
	require.Len(t, deadLetters, 1)

	exists, err := client.Exists(ctx, q.jobKey(job.ID)).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), exists, "dead-lettered job payload must be deleted from the job key")
}

func TestQueue_RecoverInFlight(t *testing.T) {
	q, _ := newTestQueue(t)
	ctx := context.Background()

	job, err := q.Enqueue(ctx, "test.job", map[string]any{"foo": "bar"})
	require.NoError(t, err)

	// Simulate a worker crash: dequeue moves the job to the in-flight list,
	// then nobody calls Complete or Fail.
	dequeued, err := q.Dequeue(ctx, time.Second)
	require.NoError(t, err)
	require.NotNil(t, dequeued)

	length, err := q.Length(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(0), length)

	recovered, err := q.RecoverInFlight(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, recovered)

	length, err = q.Length(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), length, "recovered job must be back on the live queue")

	requeued, err := q.Dequeue(ctx, time.Second)
	require.NoError(t, err)
	require.NotNil(t, requeued)
	assert.Equal(t, job.ID, requeued.ID)
}
