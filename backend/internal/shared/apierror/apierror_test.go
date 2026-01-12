package apierror

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

// =============================================================================
// APIError Tests
// =============================================================================

func TestAPIError_Error(t *testing.T) {
	err := &APIError{
		Code:    ErrCodeUserNotFound,
		Message: "user not found",
	}

	assert.Equal(t, "USER_NOT_FOUND: user not found", err.Error())
}

func TestNewAPIError(t *testing.T) {
	err := NewAPIError(ErrCodeInvalidToken, "token is invalid", http.StatusUnauthorized)

	assert.Equal(t, ErrCodeInvalidToken, err.Code)
	assert.Equal(t, "token is invalid", err.Message)
	assert.Equal(t, http.StatusUnauthorized, err.HTTPStatus)
	assert.Empty(t, err.Field)
	assert.Nil(t, err.Details)
}

// =============================================================================
// Error Factory Tests
// =============================================================================

func TestNotFound(t *testing.T) {
	err := NotFound(ErrCodeItemNotFound, "Item")

	assert.Equal(t, ErrCodeItemNotFound, err.Code)
	assert.Equal(t, "Item not found", err.Message)
	assert.Equal(t, http.StatusNotFound, err.HTTPStatus)
}

func TestConflict(t *testing.T) {
	err := Conflict(ErrCodeEmailTaken, "email already in use")

	assert.Equal(t, ErrCodeEmailTaken, err.Code)
	assert.Equal(t, "email already in use", err.Message)
	assert.Equal(t, http.StatusConflict, err.HTTPStatus)
}

func TestValidationError(t *testing.T) {
	err := ValidationError(ErrCodeRequiredField, "email", "email is required")

	assert.Equal(t, ErrCodeRequiredField, err.Code)
	assert.Equal(t, "email is required", err.Message)
	assert.Equal(t, "email", err.Field)
	assert.Equal(t, http.StatusBadRequest, err.HTTPStatus)
}

func TestForbidden(t *testing.T) {
	err := Forbidden(ErrCodeWorkspaceAccessDenied, "you don't have access to this workspace")

	assert.Equal(t, ErrCodeWorkspaceAccessDenied, err.Code)
	assert.Equal(t, "you don't have access to this workspace", err.Message)
	assert.Equal(t, http.StatusForbidden, err.HTTPStatus)
}

func TestUnauthorized(t *testing.T) {
	err := Unauthorized(ErrCodeUnauthorized, "authentication required")

	assert.Equal(t, ErrCodeUnauthorized, err.Code)
	assert.Equal(t, "authentication required", err.Message)
	assert.Equal(t, http.StatusUnauthorized, err.HTTPStatus)
}

func TestInternalError(t *testing.T) {
	err := InternalError("database connection failed")

	assert.Equal(t, ErrCodeInternalError, err.Code)
	assert.Equal(t, "database connection failed", err.Message)
	assert.Equal(t, http.StatusInternalServerError, err.HTTPStatus)
}

func TestBadRequest(t *testing.T) {
	err := BadRequest(ErrCodeValidationFailed, "invalid request format")

	assert.Equal(t, ErrCodeValidationFailed, err.Code)
	assert.Equal(t, "invalid request format", err.Message)
	assert.Equal(t, http.StatusBadRequest, err.HTTPStatus)
}

// =============================================================================
// Chainable Methods Tests
// =============================================================================

func TestWithDetails(t *testing.T) {
	details := map[string]any{
		"field":    "email",
		"expected": "valid email format",
	}

	err := ValidationError(ErrCodeInvalidFormat, "email", "invalid email").
		WithDetails(details)

	assert.Equal(t, details, err.Details)
	assert.Equal(t, "email", err.Field)
}

func TestWithField(t *testing.T) {
	err := BadRequest(ErrCodeValidationFailed, "value out of range").
		WithField("quantity")

	assert.Equal(t, "quantity", err.Field)
}

func TestChaining(t *testing.T) {
	details := map[string]any{"min": 1, "max": 100}

	err := NewAPIError(ErrCodeValidationFailed, "out of range", http.StatusBadRequest).
		WithField("quantity").
		WithDetails(details)

	assert.Equal(t, "quantity", err.Field)
	assert.Equal(t, details, err.Details)
	assert.Equal(t, http.StatusBadRequest, err.HTTPStatus)
}

// =============================================================================
// Error Code Tests
// =============================================================================

func TestErrorCodes_Auth(t *testing.T) {
	assert.Equal(t, ErrorCode("AUTH_UNAUTHORIZED"), ErrCodeUnauthorized)
	assert.Equal(t, ErrorCode("AUTH_INVALID_TOKEN"), ErrCodeInvalidToken)
	assert.Equal(t, ErrorCode("AUTH_TOKEN_EXPIRED"), ErrCodeTokenExpired)
	assert.Equal(t, ErrorCode("AUTH_INVALID_CREDENTIALS"), ErrCodeInvalidCredentials)
	assert.Equal(t, ErrorCode("AUTH_SESSION_EXPIRED"), ErrCodeSessionExpired)
}

func TestErrorCodes_User(t *testing.T) {
	assert.Equal(t, ErrorCode("USER_NOT_FOUND"), ErrCodeUserNotFound)
	assert.Equal(t, ErrorCode("USER_EMAIL_REQUIRED"), ErrCodeEmailRequired)
	assert.Equal(t, ErrorCode("USER_EMAIL_INVALID"), ErrCodeEmailInvalid)
	assert.Equal(t, ErrorCode("USER_EMAIL_TAKEN"), ErrCodeEmailTaken)
}

func TestErrorCodes_Workspace(t *testing.T) {
	assert.Equal(t, ErrorCode("WORKSPACE_NOT_FOUND"), ErrCodeWorkspaceNotFound)
	assert.Equal(t, ErrorCode("WORKSPACE_SLUG_TAKEN"), ErrCodeWorkspaceSlugTaken)
	assert.Equal(t, ErrorCode("WORKSPACE_ACCESS_DENIED"), ErrCodeWorkspaceAccessDenied)
}

func TestErrorCodes_Inventory(t *testing.T) {
	assert.Equal(t, ErrorCode("INVENTORY_NOT_FOUND"), ErrCodeInventoryNotFound)
	assert.Equal(t, ErrorCode("INVENTORY_INSUFFICIENT_QTY"), ErrCodeInventoryInsufficientQty)
	assert.Equal(t, ErrorCode("INVENTORY_ON_LOAN"), ErrCodeInventoryOnLoan)
}

func TestErrorCodes_Validation(t *testing.T) {
	assert.Equal(t, ErrorCode("VALIDATION_FAILED"), ErrCodeValidationFailed)
	assert.Equal(t, ErrorCode("VALIDATION_INVALID_UUID"), ErrCodeInvalidUUID)
	assert.Equal(t, ErrorCode("VALIDATION_REQUIRED_FIELD"), ErrCodeRequiredField)
}

func TestErrorCodes_System(t *testing.T) {
	assert.Equal(t, ErrorCode("SYSTEM_INTERNAL_ERROR"), ErrCodeInternalError)
	assert.Equal(t, ErrorCode("SYSTEM_DATABASE_ERROR"), ErrCodeDatabaseError)
	assert.Equal(t, ErrorCode("SYSTEM_SERVICE_UNAVAILABLE"), ErrCodeServiceUnavailable)
}
