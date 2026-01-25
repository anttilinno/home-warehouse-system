package repairlog

import "errors"

var (
	// ErrRepairLogNotFound is returned when a repair log is not found.
	ErrRepairLogNotFound = errors.New("repair log not found")

	// ErrInvalidStatusTransition is returned when an invalid status transition is attempted.
	ErrInvalidStatusTransition = errors.New("invalid status transition")

	// ErrRepairAlreadyCompleted is returned when trying to modify a completed repair.
	ErrRepairAlreadyCompleted = errors.New("repair has already been completed")

	// ErrInvalidDescription is returned when description is empty or invalid.
	ErrInvalidDescription = errors.New("description is required")
)
