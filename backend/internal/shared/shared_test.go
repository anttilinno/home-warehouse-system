package shared

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Domain Error Tests
// =============================================================================

func TestDomainError_Error_WithField(t *testing.T) {
	err := &DomainError{
		Err:     ErrInvalidInput,
		Message: "invalid email format",
		Field:   "email",
	}

	assert.Equal(t, "email: invalid email format", err.Error())
}

func TestDomainError_Error_WithoutField(t *testing.T) {
	err := &DomainError{
		Err:     ErrNotFound,
		Message: "item not found",
	}

	assert.Equal(t, "item not found", err.Error())
}

func TestDomainError_Unwrap(t *testing.T) {
	err := &DomainError{
		Err:     ErrNotFound,
		Message: "user not found",
	}

	assert.Equal(t, ErrNotFound, err.Unwrap())
	assert.True(t, errors.Is(err, ErrNotFound))
}

func TestNewDomainError(t *testing.T) {
	err := NewDomainError(ErrInvalidInput, "bad request")

	assert.Equal(t, ErrInvalidInput, err.Err)
	assert.Equal(t, "bad request", err.Message)
	assert.Empty(t, err.Field)
}

func TestNewFieldError(t *testing.T) {
	err := NewFieldError(ErrInvalidInput, "name", "name is required")

	assert.Equal(t, ErrInvalidInput, err.Err)
	assert.Equal(t, "name is required", err.Message)
	assert.Equal(t, "name", err.Field)
}

// =============================================================================
// Error Check Functions Tests
// =============================================================================

func TestIsNotFound_True(t *testing.T) {
	err := NewDomainError(ErrNotFound, "item not found")
	assert.True(t, IsNotFound(err))
}

func TestIsNotFound_False(t *testing.T) {
	err := NewDomainError(ErrInvalidInput, "bad input")
	assert.False(t, IsNotFound(err))
}

func TestIsNotFound_DirectError(t *testing.T) {
	assert.True(t, IsNotFound(ErrNotFound))
}

func TestIsAlreadyExists_True(t *testing.T) {
	err := NewDomainError(ErrAlreadyExists, "email already taken")
	assert.True(t, IsAlreadyExists(err))
}

func TestIsAlreadyExists_False(t *testing.T) {
	err := NewDomainError(ErrNotFound, "not found")
	assert.False(t, IsAlreadyExists(err))
}

func TestIsInvalidInput_True(t *testing.T) {
	err := NewDomainError(ErrInvalidInput, "invalid format")
	assert.True(t, IsInvalidInput(err))
}

func TestIsInvalidInput_False(t *testing.T) {
	err := NewDomainError(ErrNotFound, "not found")
	assert.False(t, IsInvalidInput(err))
}

// =============================================================================
// Common Error Variables Tests
// =============================================================================

func TestCommonErrors(t *testing.T) {
	assert.Equal(t, "not found", ErrNotFound.Error())
	assert.Equal(t, "already exists", ErrAlreadyExists.Error())
	assert.Equal(t, "invalid input", ErrInvalidInput.Error())
	assert.Equal(t, "unauthorized", ErrUnauthorized.Error())
	assert.Equal(t, "forbidden", ErrForbidden.Error())
	assert.Equal(t, "conflict", ErrConflict.Error())
	assert.Equal(t, "internal error", ErrInternal.Error())
}

// =============================================================================
// Pagination Tests
// =============================================================================

func TestDefaultPagination(t *testing.T) {
	p := DefaultPagination()

	assert.Equal(t, 1, p.Page)
	assert.Equal(t, 50, p.PageSize)
}

func TestPagination_Offset_Page1(t *testing.T) {
	p := Pagination{Page: 1, PageSize: 20}
	assert.Equal(t, 0, p.Offset())
}

func TestPagination_Offset_Page2(t *testing.T) {
	p := Pagination{Page: 2, PageSize: 20}
	assert.Equal(t, 20, p.Offset())
}

func TestPagination_Offset_Page5(t *testing.T) {
	p := Pagination{Page: 5, PageSize: 10}
	assert.Equal(t, 40, p.Offset())
}

func TestPagination_Offset_PageZero(t *testing.T) {
	// Page 0 should be treated as page 1
	p := Pagination{Page: 0, PageSize: 20}
	assert.Equal(t, 0, p.Offset())
}

func TestPagination_Offset_NegativePage(t *testing.T) {
	// Negative page should be treated as page 1
	p := Pagination{Page: -5, PageSize: 20}
	assert.Equal(t, 0, p.Offset())
}

func TestPagination_Limit_Normal(t *testing.T) {
	p := Pagination{Page: 1, PageSize: 50}
	assert.Equal(t, 50, p.Limit())
}

func TestPagination_Limit_TooSmall(t *testing.T) {
	p := Pagination{Page: 1, PageSize: 0}
	assert.Equal(t, 50, p.Limit()) // Default to 50
}

func TestPagination_Limit_Negative(t *testing.T) {
	p := Pagination{Page: 1, PageSize: -10}
	assert.Equal(t, 50, p.Limit()) // Default to 50
}

func TestPagination_Limit_TooLarge(t *testing.T) {
	p := Pagination{Page: 1, PageSize: 500}
	assert.Equal(t, 100, p.Limit()) // Cap at 100
}

func TestPagination_Limit_ExactlyMax(t *testing.T) {
	p := Pagination{Page: 1, PageSize: 100}
	assert.Equal(t, 100, p.Limit())
}

// =============================================================================
// PagedResult Tests
// =============================================================================

func TestNewPagedResult(t *testing.T) {
	items := []string{"a", "b", "c"}
	pagination := Pagination{Page: 1, PageSize: 10}

	result := NewPagedResult(items, 25, pagination)

	assert.Equal(t, items, result.Items)
	assert.Equal(t, 25, result.Total)
	assert.Equal(t, 1, result.Page)
	assert.Equal(t, 10, result.PageSize)
	assert.Equal(t, 3, result.TotalPages) // 25/10 = 2.5, rounds up to 3
}

func TestNewPagedResult_ExactlyDivisible(t *testing.T) {
	items := []string{"a", "b"}
	pagination := Pagination{Page: 2, PageSize: 10}

	result := NewPagedResult(items, 20, pagination)

	assert.Equal(t, 2, result.TotalPages) // 20/10 = exactly 2
}

func TestNewPagedResult_EmptyItems(t *testing.T) {
	items := []string{}
	pagination := Pagination{Page: 1, PageSize: 10}

	result := NewPagedResult(items, 0, pagination)

	assert.Empty(t, result.Items)
	assert.Equal(t, 0, result.Total)
	assert.Equal(t, 0, result.TotalPages)
}

func TestNewPagedResult_GenericType(t *testing.T) {
	type Item struct {
		ID   int
		Name string
	}

	items := []Item{
		{ID: 1, Name: "first"},
		{ID: 2, Name: "second"},
	}
	pagination := Pagination{Page: 1, PageSize: 5}

	result := NewPagedResult(items, 10, pagination)

	assert.Len(t, result.Items, 2)
	assert.Equal(t, 1, result.Items[0].ID)
	assert.Equal(t, "second", result.Items[1].Name)
	assert.Equal(t, 2, result.TotalPages)
}

// =============================================================================
// UUID Helper Tests
// =============================================================================

func TestParseUUID_Valid(t *testing.T) {
	validUUID := "550e8400-e29b-41d4-a716-446655440000"
	id, err := ParseUUID(validUUID)

	assert.NoError(t, err)
	assert.Equal(t, validUUID, id.String())
}

func TestParseUUID_Invalid(t *testing.T) {
	_, err := ParseUUID("not-a-uuid")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "VALIDATION_INVALID_UUID")
}

func TestParseUUID_Empty(t *testing.T) {
	_, err := ParseUUID("")

	assert.Error(t, err)
}

func TestMustParseUUID_Valid(t *testing.T) {
	validUUID := "550e8400-e29b-41d4-a716-446655440000"
	id := MustParseUUID(validUUID)

	assert.Equal(t, validUUID, id.String())
}

func TestMustParseUUID_Invalid(t *testing.T) {
	assert.Panics(t, func() {
		MustParseUUID("not-a-uuid")
	})
}

func TestNewUUID(t *testing.T) {
	id := NewUUID()

	// UUID should not be nil
	assert.NotEqual(t, uuid.Nil, id)

	// Should be a valid UUID
	_, err := uuid.Parse(id.String())
	assert.NoError(t, err)
}

func TestNewUUID_Unique(t *testing.T) {
	id1 := NewUUID()
	id2 := NewUUID()

	assert.NotEqual(t, id1, id2)
}

func TestIsNilUUID_True(t *testing.T) {
	assert.True(t, IsNilUUID(uuid.Nil))
}

func TestIsNilUUID_False(t *testing.T) {
	id := uuid.New()
	assert.False(t, IsNilUUID(id))
}

func TestValidateUUID_Valid(t *testing.T) {
	id := uuid.New()
	err := ValidateUUID(id, "user_id")

	assert.NoError(t, err)
}

func TestValidateUUID_Nil(t *testing.T) {
	err := ValidateUUID(uuid.Nil, "user_id")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "user_id")
}
