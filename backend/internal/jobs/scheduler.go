package jobs

import (
	"context"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/webpush"
)

// SchedulerConfig holds configuration for the job scheduler.
type SchedulerConfig struct {
	RedisAddr string
	Queues    map[string]int
}

// DefaultSchedulerConfig returns the default scheduler configuration.
func DefaultSchedulerConfig(redisAddr string) SchedulerConfig {
	return SchedulerConfig{
		RedisAddr: redisAddr,
		Queues: map[string]int{
			QueueCritical: 6,
			QueueDefault:  3,
			QueueLow:      1,
		},
	}
}

// Scheduler manages background jobs using asynq.
type Scheduler struct {
	client    *asynq.Client
	server    *asynq.Server
	scheduler *asynq.Scheduler
	pool      *pgxpool.Pool
	config    SchedulerConfig
}

// NewScheduler creates a new job scheduler.
func NewScheduler(pool *pgxpool.Pool, config SchedulerConfig) *Scheduler {
	redisOpt := asynq.RedisClientOpt{Addr: config.RedisAddr}

	client := asynq.NewClient(redisOpt)

	server := asynq.NewServer(
		redisOpt,
		asynq.Config{
			Queues:      config.Queues,
			Concurrency: 10,
			// Retry configuration
			RetryDelayFunc: func(n int, e error, t *asynq.Task) time.Duration {
				return time.Duration(n) * time.Minute
			},
		},
	)

	scheduler := asynq.NewScheduler(redisOpt, nil)

	return &Scheduler{
		client:    client,
		server:    server,
		scheduler: scheduler,
		pool:      pool,
		config:    config,
	}
}

// RegisterHandlers registers all task handlers.
func (s *Scheduler) RegisterHandlers(emailSender EmailSender, pushSender *webpush.Sender, cleanupConfig CleanupConfig) *asynq.ServeMux {
	mux := asynq.NewServeMux()

	// Loan reminder processor
	loanProcessor := NewLoanReminderProcessor(s.pool, emailSender, pushSender)
	mux.HandleFunc(TypeLoanReminder, loanProcessor.ProcessTask)

	// Repair reminder processor
	repairProcessor := NewRepairReminderProcessor(s.pool, pushSender)
	mux.HandleFunc(TypeRepairReminder, repairProcessor.ProcessTask)

	// Cleanup processor
	cleanupProcessor := NewCleanupProcessor(s.pool, cleanupConfig)
	mux.HandleFunc(TypeCleanupDeletedRecords, cleanupProcessor.ProcessDeletedRecordsCleanup)
	mux.HandleFunc(TypeCleanupOldActivity, cleanupProcessor.ProcessActivityCleanup)

	return mux
}

// RegisterScheduledTasks registers all scheduled/periodic tasks.
func (s *Scheduler) RegisterScheduledTasks() error {
	// Schedule loan reminders check daily at 9 AM
	_, err := s.scheduler.Register("0 9 * * *", NewScheduleLoanRemindersTask(),
		asynq.Queue(QueueDefault),
	)
	if err != nil {
		return err
	}
	log.Println("Registered scheduled task: loan reminders (daily at 9 AM)")

	// Schedule repair reminders check daily at 9 AM (same schedule as loan reminders)
	_, err = s.scheduler.Register("0 9 * * *", NewScheduleRepairRemindersTask(),
		asynq.Queue(QueueDefault),
	)
	if err != nil {
		return err
	}
	log.Println("Registered scheduled task: repair reminders (daily at 9 AM)")

	// Schedule deleted records cleanup weekly on Sunday at 3 AM
	_, err = s.scheduler.Register("0 3 * * 0", NewCleanupDeletedRecordsTask(),
		asynq.Queue(QueueLow),
	)
	if err != nil {
		return err
	}
	log.Println("Registered scheduled task: deleted records cleanup (weekly Sunday 3 AM)")

	// Schedule activity logs cleanup weekly on Sunday at 4 AM
	_, err = s.scheduler.Register("0 4 * * 0", NewCleanupActivityTask(),
		asynq.Queue(QueueLow),
	)
	if err != nil {
		return err
	}
	log.Println("Registered scheduled task: activity logs cleanup (weekly Sunday 4 AM)")

	return nil
}

// Start starts the scheduler and worker server.
func (s *Scheduler) Start(mux *asynq.ServeMux) error {
	// Start the scheduler for periodic tasks
	if err := s.scheduler.Start(); err != nil {
		return err
	}
	log.Println("Asynq scheduler started")

	// Start the worker server
	if err := s.server.Start(mux); err != nil {
		return err
	}
	log.Println("Asynq worker server started")

	return nil
}

// Stop gracefully stops the scheduler and worker server.
func (s *Scheduler) Stop() {
	log.Println("Stopping asynq scheduler...")
	s.scheduler.Shutdown()

	log.Println("Stopping asynq worker server...")
	s.server.Shutdown()

	log.Println("Closing asynq client...")
	s.client.Close()
}

// Client returns the asynq client for enqueueing tasks.
func (s *Scheduler) Client() *asynq.Client {
	return s.client
}

// EnqueueLoanReminders manually triggers loan reminder scheduling.
// This is useful for testing or manual triggering.
func (s *Scheduler) EnqueueLoanReminders() error {
	scheduler := NewLoanReminderScheduler(s.pool, s.client)
	return scheduler.ScheduleReminders(context.Background())
}

// EnqueueRepairReminders manually triggers repair reminder scheduling.
// This is useful for testing or manual triggering.
func (s *Scheduler) EnqueueRepairReminders() error {
	scheduler := NewRepairReminderScheduler(s.pool, s.client)
	return scheduler.ScheduleReminders(context.Background())
}
