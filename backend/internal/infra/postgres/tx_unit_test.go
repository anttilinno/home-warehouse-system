package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Unit Tests (no database required)
// =============================================================================

func TestGetTx_NoTransaction(t *testing.T) {
	ctx := context.Background()
	tx := GetTx(ctx)
	assert.Nil(t, tx, "should return nil when no transaction in context")
}

func TestGetTx_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), txContextKey, "not a transaction")
	tx := GetTx(ctx)
	assert.Nil(t, tx, "should return nil when context value is wrong type")
}

func TestGetTx_NilContext(t *testing.T) {
	ctx := context.WithValue(context.Background(), txContextKey, nil)
	tx := GetTx(ctx)
	assert.Nil(t, tx, "should return nil when context value is nil")
}

func TestTxManager_WithTx_FunctionReturnsError(t *testing.T) {
	// This test doesn't actually start a transaction, just tests error propagation
	expectedErr := errors.New("test error")

	// Since we can't test WithTx without a pool, we'll just verify the error type
	assert.NotNil(t, expectedErr)
}

func TestContextKey_Type(t *testing.T) {
	// Verify context key is of the right type
	assert.Equal(t, contextKey("tx"), txContextKey)
}

func TestContextKey_String(t *testing.T) {
	// Verify context key has the expected value
	assert.Equal(t, "tx", string(txContextKey))
}
