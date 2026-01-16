package pendingchange

import "errors"

// Domain-specific errors for the approval pipeline
var (
	// ErrPendingChangeNotFound is returned when a requested pending change does not exist
	ErrPendingChangeNotFound = errors.New("pending change not found")

	// ErrChangeAlreadyReviewed is returned when attempting to approve/reject a change that has already been reviewed
	ErrChangeAlreadyReviewed = errors.New("pending change has already been reviewed")

	// ErrUnauthorized is returned when a user lacks permission to perform an approval operation (not owner/admin)
	ErrUnauthorized = errors.New("user is not authorized to perform this action")

	// ErrInvalidEntityType is returned when an unsupported entity type is specified
	ErrInvalidEntityType = errors.New("invalid entity type")
)
