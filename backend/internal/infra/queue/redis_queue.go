package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// jobTTL is how long a job payload is kept in Redis. The TTL is refreshed on
// every dequeue so a job that waited in queue for a long time still has its
// payload available for the whole processing window (and for retries).
const jobTTL = 24 * time.Hour

type Job struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt time.Time              `json:"created_at"`
	Retries   int                    `json:"retries"`
	// LastError records the most recent processing failure, so dead-lettered
	// jobs carry their failure reason with them.
	LastError string `json:"last_error,omitempty"`
}

// Queue is a small Redis-list-backed job queue with at-least-once delivery:
// Dequeue atomically moves the job ID to a per-queue in-flight list (BLMOVE),
// Complete/Fail acknowledge it by removing it from that list, and
// RecoverInFlight re-enqueues anything a crashed worker left behind. Jobs
// that exhaust their retries are moved to a dead-letter list instead of being
// silently deleted.
//
// NOTE: RecoverInFlight assumes a single worker process per queue. With
// multiple workers it would re-enqueue jobs that another live worker is still
// processing (per-worker in-flight lists would be needed for that).
type Queue struct {
	client         *redis.Client
	queueName      string
	processingName string
	deadName       string
	jobsKeyPrefix  string
	maxRetries     int
}

func NewQueue(client *redis.Client, queueName string) *Queue {
	return &Queue{
		client:         client,
		queueName:      fmt.Sprintf("queue:%s", queueName),
		processingName: fmt.Sprintf("queue:%s:processing", queueName),
		deadName:       fmt.Sprintf("queue:%s:dead", queueName),
		jobsKeyPrefix:  fmt.Sprintf("job:%s", queueName),
		maxRetries:     3,
	}
}

func (q *Queue) jobKey(jobID string) string {
	return fmt.Sprintf("%s:%s", q.jobsKeyPrefix, jobID)
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
	if err := q.client.Set(ctx, q.jobKey(job.ID), jobData, jobTTL).Err(); err != nil {
		return nil, fmt.Errorf("failed to store job: %w", err)
	}

	// Add job ID to queue
	if err := q.client.RPush(ctx, q.queueName, job.ID).Err(); err != nil {
		return nil, fmt.Errorf("failed to enqueue job: %w", err)
	}

	return job, nil
}

// Dequeue blocks up to timeout for the next job. The job ID is atomically
// moved to the in-flight list (not popped and dropped), so a worker crash
// mid-processing leaves the ID recoverable via RecoverInFlight instead of
// losing the job. Callers MUST acknowledge with Complete or Fail.
func (q *Queue) Dequeue(ctx context.Context, timeout time.Duration) (*Job, error) {
	jobID, err := q.client.BLMove(ctx, q.queueName, q.processingName, "LEFT", "RIGHT", timeout).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, nil // No job available
		}
		return nil, fmt.Errorf("failed to dequeue: %w", err)
	}

	jobKey := q.jobKey(jobID)

	// Get job data
	jobData, err := q.client.Get(ctx, jobKey).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			// Payload expired or was never written; drop the orphaned ID from
			// the in-flight list so it isn't endlessly recovered.
			q.client.LRem(ctx, q.processingName, 1, jobID)
			return nil, fmt.Errorf("job data not found: %s", jobID)
		}
		return nil, fmt.Errorf("failed to get job data: %w", err)
	}

	var job Job
	if err := json.Unmarshal([]byte(jobData), &job); err != nil {
		q.client.LRem(ctx, q.processingName, 1, jobID)
		return nil, fmt.Errorf("failed to unmarshal job: %w", err)
	}

	// Refresh the payload TTL for the processing window — a job that sat in
	// queue for hours must not lose its payload mid-processing or mid-retry.
	if err := q.client.Expire(ctx, jobKey, jobTTL).Err(); err != nil {
		slog.Warn("failed to extend job payload TTL", "job_id", jobID, "error", err)
	}

	return &job, nil
}

// Complete acknowledges successful processing: removes the job from the
// in-flight list and deletes its payload.
func (q *Queue) Complete(ctx context.Context, jobID string) error {
	if err := q.client.LRem(ctx, q.processingName, 1, jobID).Err(); err != nil {
		return fmt.Errorf("failed to ack job %s: %w", jobID, err)
	}
	return q.client.Del(ctx, q.jobKey(jobID)).Err()
}

// Fail acknowledges a failed processing attempt. Under maxRetries the job is
// re-enqueued and dead=false is returned. Once retries are exhausted the job
// (with its last error) is moved to the dead-letter list and dead=true is
// returned so the caller can mark the underlying work item as failed.
func (q *Queue) Fail(ctx context.Context, jobID string, errorMsg string) (dead bool, err error) {
	jobKey := q.jobKey(jobID)

	// Ack: remove from the in-flight list regardless of what happens next.
	if err := q.client.LRem(ctx, q.processingName, 1, jobID).Err(); err != nil {
		return false, fmt.Errorf("failed to ack job %s: %w", jobID, err)
	}

	// Get current job
	jobData, err := q.client.Get(ctx, jobKey).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			// Payload gone — dead-letter a minimal record so the failure
			// still leaves a trace.
			orphan, _ := json.Marshal(Job{ID: jobID, LastError: errorMsg})
			if dlqErr := q.client.RPush(ctx, q.deadName, orphan).Err(); dlqErr != nil {
				return true, fmt.Errorf("failed to dead-letter orphaned job %s: %w", jobID, dlqErr)
			}
			return true, nil
		}
		return false, err
	}

	var job Job
	if err := json.Unmarshal([]byte(jobData), &job); err != nil {
		return false, err
	}

	// Increment retries
	job.Retries++
	job.LastError = errorMsg

	updatedData, err := json.Marshal(job)
	if err != nil {
		return false, err
	}

	// If under max retries, re-enqueue
	if job.Retries < q.maxRetries {
		if err := q.client.Set(ctx, jobKey, updatedData, jobTTL).Err(); err != nil {
			return false, err
		}
		if err := q.client.RPush(ctx, q.queueName, job.ID).Err(); err != nil {
			return false, err
		}
		return false, nil
	}

	// Max retries exceeded: move the full payload to the dead-letter list and
	// delete the job key. Never silently delete the job.
	if err := q.client.RPush(ctx, q.deadName, updatedData).Err(); err != nil {
		return true, fmt.Errorf("failed to dead-letter job %s: %w", jobID, err)
	}
	if err := q.client.Del(ctx, jobKey).Err(); err != nil {
		slog.Warn("failed to delete dead-lettered job payload", "job_id", jobID, "error", err)
	}
	return true, nil
}

// RecoverInFlight moves any job IDs stranded on the in-flight list (by a
// previous worker crash or kill) back onto the queue. Call once on worker
// startup, before the dequeue loop. Returns the number of recovered jobs.
func (q *Queue) RecoverInFlight(ctx context.Context) (int, error) {
	recovered := 0
	for {
		// LMove RIGHT->LEFT puts crashed jobs at the front of the queue so
		// they are retried before newly enqueued work.
		_, err := q.client.LMove(ctx, q.processingName, q.queueName, "RIGHT", "LEFT").Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				return recovered, nil // in-flight list drained
			}
			return recovered, fmt.Errorf("failed to recover in-flight job: %w", err)
		}
		recovered++
	}
}

func (q *Queue) Length(ctx context.Context) (int64, error) {
	return q.client.LLen(ctx, q.queueName).Result()
}
