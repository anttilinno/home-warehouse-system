package maintenance

import "errors"

var (
	// ErrScheduleNotFound is returned when a maintenance schedule does not
	// exist in the workspace.
	ErrScheduleNotFound = errors.New("maintenance schedule not found")

	// ErrInvalidTitle is returned when the schedule title is empty.
	ErrInvalidTitle = errors.New("maintenance schedule title is required")

	// ErrInvalidInterval is returned when interval_days is not positive.
	ErrInvalidInterval = errors.New("maintenance interval must be positive")

	// ErrInvalidNextDue is returned when the next due date is missing.
	ErrInvalidNextDue = errors.New("maintenance next due date is required")

	// ErrScheduleInactive is returned when completing a deactivated schedule.
	ErrScheduleInactive = errors.New("maintenance schedule is inactive")
)
