package middleware

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/shared/apierror"
)

// =============================================================================
// ErrorTransformer Tests
// =============================================================================

func TestErrorTransformer_APIError(t *testing.T) {
	tests := []struct {
		name           string
		apiErr         *apierror.APIError
		expectedStatus int
		expectedMsg    string
	}{
		{
			name:           "not found error",
			apiErr:         apierror.NotFound(apierror.ErrCodeItemNotFound, "Item"),
			expectedStatus: http.StatusNotFound,
			expectedMsg:    "Item not found",
		},
		{
			name:           "validation error",
			apiErr:         apierror.ValidationError(apierror.ErrCodeRequiredField, "name", "Name is required"),
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "Name is required",
		},
		{
			name:           "conflict error",
			apiErr:         apierror.Conflict(apierror.ErrCodeEmailTaken, "Email is already taken"),
			expectedStatus: http.StatusConflict,
			expectedMsg:    "Email is already taken",
		},
		{
			name:           "forbidden error",
			apiErr:         apierror.Forbidden(apierror.ErrCodeWorkspaceAccessDenied, "Access denied"),
			expectedStatus: http.StatusForbidden,
			expectedMsg:    "Access denied",
		},
		{
			name:           "unauthorized error",
			apiErr:         apierror.Unauthorized(apierror.ErrCodeUnauthorized, "Authentication required"),
			expectedStatus: http.StatusUnauthorized,
			expectedMsg:    "Authentication required",
		},
		{
			name:           "internal error",
			apiErr:         apierror.InternalError("Something went wrong"),
			expectedStatus: http.StatusInternalServerError,
			expectedMsg:    "Something went wrong",
		},
		{
			name:           "bad request error",
			apiErr:         apierror.BadRequest(apierror.ErrCodeValidationFailed, "Invalid input"),
			expectedStatus: http.StatusBadRequest,
			expectedMsg:    "Invalid input",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			humaErr := ErrorTransformer(ctx, tt.apiErr)

			assert.Equal(t, tt.expectedStatus, humaErr.GetStatus())
			assert.Contains(t, humaErr.Error(), tt.expectedMsg)
		})
	}
}

func TestErrorTransformer_APIErrorWithField(t *testing.T) {
	apiErr := apierror.ValidationError(apierror.ErrCodeRequiredField, "name", "Name is required")
	ctx := context.Background()

	humaErr := ErrorTransformer(ctx, apiErr)

	assert.Equal(t, http.StatusBadRequest, humaErr.GetStatus())
	assert.Contains(t, humaErr.Error(), "Name is required")
}

func TestErrorTransformer_APIErrorWithDetails(t *testing.T) {
	apiErr := apierror.BadRequest(apierror.ErrCodeValidationFailed, "Invalid input").
		WithDetails(map[string]any{
			"field1": "error1",
			"field2": "error2",
		})
	ctx := context.Background()

	humaErr := ErrorTransformer(ctx, apiErr)

	assert.Equal(t, http.StatusBadRequest, humaErr.GetStatus())
	assert.Contains(t, humaErr.Error(), "Invalid input")
}

func TestErrorTransformer_NonAPIError(t *testing.T) {
	tests := []struct {
		name string
		err  error
	}{
		{
			name: "standard error",
			err:  errors.New("some error"),
		},
		{
			name: "nil error wrapped",
			err:  errors.New(""),
		},
		{
			name: "formatted error",
			err:  errors.New("failed to connect: connection timeout"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			humaErr := ErrorTransformer(ctx, tt.err)

			// Non-API errors should fallback to 500 Internal Server Error
			assert.Equal(t, http.StatusInternalServerError, humaErr.GetStatus())
			assert.Contains(t, humaErr.Error(), "Internal server error")
		})
	}
}

func TestErrorTransformer_WrappedAPIError(t *testing.T) {
	// Create an API error and wrap it
	apiErr := apierror.NotFound(apierror.ErrCodeUserNotFound, "User")
	wrappedErr := errors.Join(errors.New("operation failed"), apiErr)

	ctx := context.Background()
	humaErr := ErrorTransformer(ctx, wrappedErr)

	// Should still extract and use the API error
	assert.Equal(t, http.StatusNotFound, humaErr.GetStatus())
	assert.Contains(t, humaErr.Error(), "User not found")
}

func TestErrorTransformer_PreservesHTTPStatus(t *testing.T) {
	statusTests := []struct {
		name   string
		status int
		apiErr *apierror.APIError
	}{
		{
			name:   "200 range (should not happen but test anyway)",
			status: http.StatusOK,
			apiErr: &apierror.APIError{
				Code:       "TEST",
				Message:    "Test",
				HTTPStatus: http.StatusOK,
			},
		},
		{
			name:   "400 Bad Request",
			status: http.StatusBadRequest,
			apiErr: apierror.BadRequest("TEST", "Test"),
		},
		{
			name:   "401 Unauthorized",
			status: http.StatusUnauthorized,
			apiErr: apierror.Unauthorized("TEST", "Test"),
		},
		{
			name:   "403 Forbidden",
			status: http.StatusForbidden,
			apiErr: apierror.Forbidden("TEST", "Test"),
		},
		{
			name:   "404 Not Found",
			status: http.StatusNotFound,
			apiErr: apierror.NotFound("TEST", "Test"),
		},
		{
			name:   "409 Conflict",
			status: http.StatusConflict,
			apiErr: apierror.Conflict("TEST", "Test"),
		},
		{
			name:   "500 Internal Server Error",
			status: http.StatusInternalServerError,
			apiErr: apierror.InternalError("Test"),
		},
	}

	for _, tt := range statusTests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			humaErr := ErrorTransformer(ctx, tt.apiErr)

			assert.Equal(t, tt.status, humaErr.GetStatus())
		})
	}
}

func TestErrorTransformer_ContextPassed(t *testing.T) {
	// Verify that context is passed through (even though not used in current implementation)
	// This is important for future enhancements like logging with context
	type contextKey string
	const testKey contextKey = "test"

	ctx := context.WithValue(context.Background(), testKey, "test-value")
	apiErr := apierror.NotFound(apierror.ErrCodeItemNotFound, "Item")

	// Should not panic and should work with context
	humaErr := ErrorTransformer(ctx, apiErr)

	assert.NotNil(t, humaErr)
	assert.Equal(t, http.StatusNotFound, humaErr.GetStatus())
}
