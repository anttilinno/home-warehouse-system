package shared

import (
	"errors"
	"fmt"
)

// Common domain errors.
var (
	ErrNotFound       = errors.New("not found")
	ErrAlreadyExists  = errors.New("already exists")
	ErrInvalidInput   = errors.New("invalid input")
	ErrUnauthorized   = errors.New("unauthorized")
	ErrForbidden      = errors.New("forbidden")
	ErrConflict       = errors.New("conflict")
	ErrInternal       = errors.New("internal error")
)

// DomainError represents a domain-specific error with context.
type DomainError struct {
	Err     error
	Message string
	Field   string
}

func (e *DomainError) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("%s: %s", e.Field, e.Message)
	}
	return e.Message
}

func (e *DomainError) Unwrap() error {
	return e.Err
}

// NewDomainError creates a new domain error.
func NewDomainError(err error, message string) *DomainError {
	return &DomainError{
		Err:     err,
		Message: message,
	}
}

// NewFieldError creates a new field-specific error.
func NewFieldError(err error, field, message string) *DomainError {
	return &DomainError{
		Err:     err,
		Message: message,
		Field:   field,
	}
}

// IsNotFound checks if the error is a not found error.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

// IsAlreadyExists checks if the error is an already exists error.
func IsAlreadyExists(err error) bool {
	return errors.Is(err, ErrAlreadyExists)
}

// IsInvalidInput checks if the error is an invalid input error.
func IsInvalidInput(err error) bool {
	return errors.Is(err, ErrInvalidInput)
}
