package shared

import (
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared/apierror"
)

// ParseUUID parses a string into a UUID and returns an APIError if invalid
func ParseUUID(s string) (uuid.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, apierror.ValidationError(
			apierror.ErrCodeInvalidUUID,
			"id",
			"Invalid UUID format",
		)
	}
	return id, nil
}

// MustParseUUID parses a string into a UUID and panics if invalid
// Use only for compile-time constants or in tests
func MustParseUUID(s string) uuid.UUID {
	return uuid.MustParse(s)
}

// NewUUID generates a new UUIDv7 (time-ordered)
// Falls back to UUIDv4 if v7 generation fails
func NewUUID() uuid.UUID {
	// Note: google/uuid library v1.6.0+ supports v7
	id, err := uuid.NewV7()
	if err != nil {
		// Fallback to v4 if v7 fails
		return uuid.New()
	}
	return id
}

// IsNilUUID checks if a UUID is nil (all zeros)
func IsNilUUID(id uuid.UUID) bool {
	return id == uuid.Nil
}

// ValidateUUID validates that a UUID is not nil
func ValidateUUID(id uuid.UUID, fieldName string) error {
	if IsNilUUID(id) {
		return apierror.ValidationError(
			apierror.ErrCodeRequiredField,
			fieldName,
			fieldName+" is required",
		)
	}
	return nil
}
