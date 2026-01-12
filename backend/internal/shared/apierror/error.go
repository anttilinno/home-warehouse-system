package apierror

import (
	"fmt"
	"net/http"
)

// APIError represents a structured API error response
type APIError struct {
	Code       ErrorCode      `json:"code"`
	Message    string         `json:"message"`
	Details    map[string]any `json:"details,omitempty"`
	Field      string         `json:"field,omitempty"` // For validation errors
	HTTPStatus int            `json:"-"`               // Not serialized
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// NewAPIError creates a new API error with the given code, message, and HTTP status
func NewAPIError(code ErrorCode, message string, status int) *APIError {
	return &APIError{
		Code:       code,
		Message:    message,
		HTTPStatus: status,
	}
}

// NotFound creates a 404 Not Found error
func NotFound(code ErrorCode, entity string) *APIError {
	return &APIError{
		Code:       code,
		Message:    fmt.Sprintf("%s not found", entity),
		HTTPStatus: http.StatusNotFound,
	}
}

// Conflict creates a 409 Conflict error
func Conflict(code ErrorCode, message string) *APIError {
	return &APIError{
		Code:       code,
		Message:    message,
		HTTPStatus: http.StatusConflict,
	}
}

// ValidationError creates a 400 Bad Request validation error
func ValidationError(code ErrorCode, field, message string) *APIError {
	return &APIError{
		Code:       code,
		Message:    message,
		Field:      field,
		HTTPStatus: http.StatusBadRequest,
	}
}

// Forbidden creates a 403 Forbidden error
func Forbidden(code ErrorCode, message string) *APIError {
	return &APIError{
		Code:       code,
		Message:    message,
		HTTPStatus: http.StatusForbidden,
	}
}

// Unauthorized creates a 401 Unauthorized error
func Unauthorized(code ErrorCode, message string) *APIError {
	return &APIError{
		Code:       code,
		Message:    message,
		HTTPStatus: http.StatusUnauthorized,
	}
}

// InternalError creates a 500 Internal Server Error
func InternalError(message string) *APIError {
	return &APIError{
		Code:       ErrCodeInternalError,
		Message:    message,
		HTTPStatus: http.StatusInternalServerError,
	}
}

// BadRequest creates a 400 Bad Request error
func BadRequest(code ErrorCode, message string) *APIError {
	return &APIError{
		Code:       code,
		Message:    message,
		HTTPStatus: http.StatusBadRequest,
	}
}

// WithDetails adds details to the error (chainable)
func (e *APIError) WithDetails(details map[string]any) *APIError {
	e.Details = details
	return e
}

// WithField sets the field for the error (chainable)
func (e *APIError) WithField(field string) *APIError {
	e.Field = field
	return e
}
