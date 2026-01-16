package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Job struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt time.Time              `json:"created_at"`
	Retries   int                    `json:"retries"`
}

type Queue struct {
	client        *redis.Client
	queueName     string
	jobsKeyPrefix string
	maxRetries    int
}

func NewQueue(client *redis.Client, queueName string) *Queue {
	return &Queue{
		client:        client,
		queueName:     fmt.Sprintf("queue:%s", queueName),
		jobsKeyPrefix: fmt.Sprintf("job:%s", queueName),
		maxRetries:    3,
	}
}

func (q *Queue) Enqueue(ctx context.Context, jobType string, payload map[string]any) (*Job, error) {
	job := &Job{
		ID:        uuid.New().String(),
		Type:      jobType,
		Payload:   payload,
		CreatedAt: time.Now(),
		Retries:   0,
	}

	jobData, err := json.Marshal(job)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job: %w", err)
	}

	// Store job data
	jobKey := fmt.Sprintf("%s:%s", q.jobsKeyPrefix, job.ID)
	if err := q.client.Set(ctx, jobKey, jobData, 24*time.Hour).Err(); err != nil {
		return nil, fmt.Errorf("failed to store job: %w", err)
	}

	// Add job ID to queue
	if err := q.client.RPush(ctx, q.queueName, job.ID).Err(); err != nil {
		return nil, fmt.Errorf("failed to enqueue job: %w", err)
	}

	return job, nil
}

func (q *Queue) Dequeue(ctx context.Context, timeout time.Duration) (*Job, error) {
	// Blocking pop from queue
	result, err := q.client.BLPop(ctx, timeout, q.queueName).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // No job available
		}
		return nil, fmt.Errorf("failed to dequeue: %w", err)
	}

	if len(result) < 2 {
		return nil, fmt.Errorf("invalid blpop result")
	}

	jobID := result[1]
	jobKey := fmt.Sprintf("%s:%s", q.jobsKeyPrefix, jobID)

	// Get job data
	jobData, err := q.client.Get(ctx, jobKey).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("job data not found: %s", jobID)
		}
		return nil, fmt.Errorf("failed to get job data: %w", err)
	}

	var job Job
	if err := json.Unmarshal([]byte(jobData), &job); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job: %w", err)
	}

	return &job, nil
}

func (q *Queue) Complete(ctx context.Context, jobID string) error {
	jobKey := fmt.Sprintf("%s:%s", q.jobsKeyPrefix, jobID)
	return q.client.Del(ctx, jobKey).Err()
}

func (q *Queue) Fail(ctx context.Context, jobID string, errorMsg string) error {
	jobKey := fmt.Sprintf("%s:%s", q.jobsKeyPrefix, jobID)

	// Get current job
	jobData, err := q.client.Get(ctx, jobKey).Result()
	if err != nil {
		return err
	}

	var job Job
	if err := json.Unmarshal([]byte(jobData), &job); err != nil {
		return err
	}

	// Increment retries
	job.Retries++

	// If under max retries, re-enqueue
	if job.Retries < q.maxRetries {
		updatedData, err := json.Marshal(job)
		if err != nil {
			return err
		}

		// Update job data
		if err := q.client.Set(ctx, jobKey, updatedData, 24*time.Hour).Err(); err != nil {
			return err
		}

		// Re-enqueue
		return q.client.RPush(ctx, q.queueName, job.ID).Err()
	}

	// Max retries exceeded, delete job
	return q.client.Del(ctx, jobKey).Err()
}

func (q *Queue) Length(ctx context.Context) (int64, error) {
	return q.client.LLen(ctx, q.queueName).Result()
}
