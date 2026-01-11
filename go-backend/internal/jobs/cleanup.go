package jobs

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// CleanupConfig holds configuration for cleanup jobs.
type CleanupConfig struct {
	// DeletedRecordsRetentionDays is how long to keep deleted records (default: 90 days).
	DeletedRecordsRetentionDays int

	// ActivityLogsRetentionDays is how long to keep activity logs (default: 365 days).
	ActivityLogsRetentionDays int
}

// DefaultCleanupConfig returns the default cleanup configuration.
func DefaultCleanupConfig() CleanupConfig {
	return CleanupConfig{
		DeletedRecordsRetentionDays: 90,
		ActivityLogsRetentionDays:   365,
	}
}

// CleanupProcessor handles cleanup tasks.
type CleanupProcessor struct {
	pool   *pgxpool.Pool
	config CleanupConfig
}

// NewCleanupProcessor creates a new cleanup processor.
func NewCleanupProcessor(pool *pgxpool.Pool, config CleanupConfig) *CleanupProcessor {
	return &CleanupProcessor{
		pool:   pool,
		config: config,
	}
}

// ProcessDeletedRecordsCleanup removes old deleted records.
func (p *CleanupProcessor) ProcessDeletedRecordsCleanup(ctx context.Context, t *asynq.Task) error {
	q := queries.New(p.pool)

	cutoffDate := time.Now().AddDate(0, 0, -p.config.DeletedRecordsRetentionDays)

	log.Printf("Cleaning up deleted records older than %s", cutoffDate.Format(time.RFC3339))

	err := q.CleanupOldDeletedRecords(ctx, cutoffDate)
	if err != nil {
		return fmt.Errorf("failed to cleanup deleted records: %w", err)
	}

	log.Printf("Deleted records cleanup completed")
	return nil
}

// ProcessActivityCleanup removes old activity logs.
func (p *CleanupProcessor) ProcessActivityCleanup(ctx context.Context, t *asynq.Task) error {
	q := queries.New(p.pool)

	cutoffDate := time.Now().AddDate(0, 0, -p.config.ActivityLogsRetentionDays)

	log.Printf("Cleaning up activity logs older than %s", cutoffDate.Format(time.RFC3339))

	pgTimestamp := pgtype.Timestamptz{
		Time:  cutoffDate,
		Valid: true,
	}

	err := q.CleanupOldActivity(ctx, pgTimestamp)
	if err != nil {
		return fmt.Errorf("failed to cleanup activity logs: %w", err)
	}

	log.Printf("Activity logs cleanup completed")
	return nil
}

// NewCleanupDeletedRecordsTask creates a task to cleanup deleted records.
func NewCleanupDeletedRecordsTask() *asynq.Task {
	return asynq.NewTask(TypeCleanupDeletedRecords, nil)
}

// NewCleanupActivityTask creates a task to cleanup old activity logs.
func NewCleanupActivityTask() *asynq.Task {
	return asynq.NewTask(TypeCleanupOldActivity, nil)
}
