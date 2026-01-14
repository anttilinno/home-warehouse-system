package postgres

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

func TestHandleNotFound_ConvertsErrNoRows(t *testing.T) {
	err := HandleNotFound(pgx.ErrNoRows)
	assert.ErrorIs(t, err, shared.ErrNotFound)
	assert.True(t, shared.IsNotFound(err))
}

func TestHandleNotFound_PreservesOtherErrors(t *testing.T) {
	originalErr := errors.New("database connection failed")
	err := HandleNotFound(originalErr)
	assert.Equal(t, originalErr, err)
	assert.False(t, shared.IsNotFound(err))
}

func TestHandleNotFound_PreservesNilError(t *testing.T) {
	err := HandleNotFound(nil)
	assert.NoError(t, err)
}

func TestWrapNotFound_ReturnsEntityOnSuccess(t *testing.T) {
	type TestEntity struct {
		ID   int
		Name string
	}

	entity := TestEntity{ID: 1, Name: "test"}
	result, err := WrapNotFound(entity, nil)

	assert.NoError(t, err)
	assert.Equal(t, entity, result)
}

func TestWrapNotFound_ConvertsErrNoRows(t *testing.T) {
	type TestEntity struct {
		ID   int
		Name string
	}

	result, err := WrapNotFound(TestEntity{}, pgx.ErrNoRows)

	assert.ErrorIs(t, err, shared.ErrNotFound)
	assert.True(t, shared.IsNotFound(err))
	assert.Equal(t, TestEntity{}, result) // Returns zero value
}

func TestWrapNotFound_PreservesOtherErrors(t *testing.T) {
	type TestEntity struct {
		ID   int
		Name string
	}

	originalErr := errors.New("scan error")
	result, err := WrapNotFound(TestEntity{}, originalErr)

	assert.Equal(t, originalErr, err)
	assert.False(t, shared.IsNotFound(err))
	assert.Equal(t, TestEntity{}, result) // Returns zero value on error
}

func TestWrapNotFound_WithPointer(t *testing.T) {
	type TestEntity struct {
		ID   int
		Name string
	}

	entity := &TestEntity{ID: 1, Name: "test"}
	result, err := WrapNotFound(entity, nil)

	assert.NoError(t, err)
	assert.Equal(t, entity, result)
}

func TestWrapNotFound_WithPointerNotFound(t *testing.T) {
	type TestEntity struct {
		ID   int
		Name string
	}

	result, err := WrapNotFound((*TestEntity)(nil), pgx.ErrNoRows)

	assert.ErrorIs(t, err, shared.ErrNotFound)
	assert.Nil(t, result)
}
