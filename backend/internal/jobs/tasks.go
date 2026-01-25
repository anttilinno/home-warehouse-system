package jobs

// Task type constants for asynq task registration.
const (
	// TypeLoanReminder is the task type for sending loan reminder emails.
	TypeLoanReminder = "loan:reminder"

	// TypeRepairReminder is the task type for sending repair reminder notifications.
	TypeRepairReminder = "repair:reminder"

	// TypeCleanupDeletedRecords is the task type for cleaning up old deleted records.
	TypeCleanupDeletedRecords = "cleanup:deleted_records"

	// TypeCleanupOldActivity is the task type for cleaning up old activity logs.
	TypeCleanupOldActivity = "cleanup:old_activity"

	// TypeThumbnailGeneration is the task type for generating photo thumbnails.
	TypeThumbnailGeneration = "photo:generate_thumbnails"
)

// Queue names for task prioritization.
const (
	QueueCritical = "critical"
	QueueDefault  = "default"
	QueueLow      = "low"
)
