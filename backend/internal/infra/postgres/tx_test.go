//go:build integration
// +build integration

package postgres

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// =============================================================================
// Transaction Manager Tests
// =============================================================================

func TestTxManager_WithTx_CommitsOnSuccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	defer pool.Close()

	txMgr := NewTxManager(pool)

	// Track execution
	executed := false

	err := txMgr.WithTx(context.Background(), func(ctx context.Context) error {
		executed = true

		// Verify transaction is in context
		tx := GetTx(ctx)
		assert.NotNil(t, tx, "transaction should be in context")

		// Execute a simple query to verify transaction works
		_, err := tx.Exec(ctx, "SELECT 1")
		return err
	})

	require.NoError(t, err)
	assert.True(t, executed, "function should have been executed")
}

func TestTxManager_WithTx_RollbacksOnError(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)

	expectedErr := errors.New("test error")
	executed := false

	err := txMgr.WithTx(context.Background(), func(ctx context.Context) error {
		executed = true
		return expectedErr
	})

	require.Error(t, err)
	assert.Equal(t, expectedErr, err)
	assert.True(t, executed, "function should have been executed")
}

func TestTxManager_WithTx_RollbacksOnPanic(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)

	executed := false

	// Should panic and rollback
	assert.Panics(t, func() {
		_ = txMgr.WithTx(context.Background(), func(ctx context.Context) error {
			executed = true
			panic("test panic")
		})
	})

	assert.True(t, executed, "function should have been executed before panic")
}

func TestTxManager_WithTx_NestedTransactions(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)

	outer := false
	inner := false

	err := txMgr.WithTx(context.Background(), func(outerCtx context.Context) error {
		outer = true
		outerTx := GetTx(outerCtx)
		assert.NotNil(t, outerTx, "outer transaction should be in context")

		// Nested transaction should reuse the same transaction
		return txMgr.WithTx(outerCtx, func(innerCtx context.Context) error {
			inner = true
			innerTx := GetTx(innerCtx)
			assert.NotNil(t, innerTx, "inner transaction should be in context")
			assert.Equal(t, outerTx, innerTx, "should reuse the same transaction")

			return nil
		})
	})

	require.NoError(t, err)
	assert.True(t, outer, "outer function should have been executed")
	assert.True(t, inner, "inner function should have been executed")
}

func TestTxManager_WithTx_NestedRollback(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)

	expectedErr := errors.New("inner error")
	outer := false
	inner := false

	err := txMgr.WithTx(context.Background(), func(outerCtx context.Context) error {
		outer = true

		// Inner transaction fails, should rollback entire transaction
		return txMgr.WithTx(outerCtx, func(innerCtx context.Context) error {
			inner = true
			return expectedErr
		})
	})

	require.Error(t, err)
	assert.Equal(t, expectedErr, err)
	assert.True(t, outer, "outer function should have been executed")
	assert.True(t, inner, "inner function should have been executed")
}

func TestTxManager_WithTx_ContextCancellation(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	executed := false

	err := txMgr.WithTx(ctx, func(ctx context.Context) error {
		executed = true
		return nil
	})

	// Should fail to begin transaction due to cancelled context
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to begin transaction")
	assert.False(t, executed, "function should not have been executed")
}

// =============================================================================
// GetTx Tests
// =============================================================================

func TestGetTx_WithTransaction(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)

	var capturedTx interface{}

	err := txMgr.WithTx(context.Background(), func(ctx context.Context) error {
		capturedTx = GetTx(ctx)
		return nil
	})

	require.NoError(t, err)
	assert.NotNil(t, capturedTx, "should capture transaction from context")
}

func TestGetTx_WithoutTransaction(t *testing.T) {
	ctx := context.Background()
	tx := GetTx(ctx)
	assert.Nil(t, tx, "should return nil when no transaction in context")
}

func TestGetTx_WithWrongTypeInContext(t *testing.T) {
	ctx := context.WithValue(context.Background(), txContextKey, "not a transaction")
	tx := GetTx(ctx)
	assert.Nil(t, tx, "should return nil when context value is wrong type")
}

// =============================================================================
// GetDBTX Tests
// =============================================================================

func TestGetDBTX_WithTransaction(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)

	var db interface{}

	err := txMgr.WithTx(context.Background(), func(ctx context.Context) error {
		db = GetDBTX(ctx, pool)
		return nil
	})

	require.NoError(t, err)
	assert.NotNil(t, db, "should return transaction")
	assert.NotEqual(t, pool, db, "should return transaction, not pool")
}

func TestGetDBTX_WithoutTransaction(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	ctx := context.Background()
	db := GetDBTX(ctx, pool)

	assert.NotNil(t, db, "should return pool")
	assert.Equal(t, pool, db, "should return pool when no transaction")
}

// =============================================================================
// Integration Tests with Real Database Operations
// =============================================================================

func TestTxManager_WithTx_RealDatabaseCommit(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)
	ctx := context.Background()

	// Create a test table
	_, err := pool.Exec(ctx, `
		CREATE TEMPORARY TABLE IF NOT EXISTS tx_test (
			id SERIAL PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	require.NoError(t, err)

	// Insert within transaction
	err = txMgr.WithTx(ctx, func(txCtx context.Context) error {
		tx := GetTx(txCtx)
		_, err := tx.Exec(txCtx, "INSERT INTO tx_test (value) VALUES ($1)", "test1")
		return err
	})
	require.NoError(t, err)

	// Verify data was committed
	var count int
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM tx_test WHERE value = $1", "test1").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count, "data should be committed")
}

func TestTxManager_WithTx_RealDatabaseRollback(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)
	ctx := context.Background()

	// Create a test table
	_, err := pool.Exec(ctx, `
		CREATE TEMPORARY TABLE IF NOT EXISTS tx_test_rb (
			id SERIAL PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	require.NoError(t, err)

	// Insert within transaction, then return error
	expectedErr := errors.New("rollback test")
	err = txMgr.WithTx(ctx, func(txCtx context.Context) error {
		tx := GetTx(txCtx)
		_, err := tx.Exec(txCtx, "INSERT INTO tx_test_rb (value) VALUES ($1)", "test2")
		if err != nil {
			return err
		}
		return expectedErr
	})
	require.Error(t, err)
	assert.Equal(t, expectedErr, err)

	// Verify data was rolled back
	var count int
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM tx_test_rb WHERE value = $1", "test2").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "data should be rolled back")
}

func TestTxManager_WithTx_MultipleOperations(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)
	ctx := context.Background()

	// Create test tables
	_, err := pool.Exec(ctx, `
		CREATE TEMPORARY TABLE IF NOT EXISTS tx_test_multi1 (
			id SERIAL PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		CREATE TEMPORARY TABLE IF NOT EXISTS tx_test_multi2 (
			id SERIAL PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	require.NoError(t, err)

	// Insert into both tables within transaction
	err = txMgr.WithTx(ctx, func(txCtx context.Context) error {
		tx := GetTx(txCtx)

		_, err := tx.Exec(txCtx, "INSERT INTO tx_test_multi1 (value) VALUES ($1)", "value1")
		if err != nil {
			return err
		}

		_, err = tx.Exec(txCtx, "INSERT INTO tx_test_multi2 (value) VALUES ($1)", "value2")
		return err
	})
	require.NoError(t, err)

	// Verify both inserts were committed
	var count1, count2 int
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM tx_test_multi1").Scan(&count1)
	require.NoError(t, err)
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM tx_test_multi2").Scan(&count2)
	require.NoError(t, err)

	assert.Equal(t, 1, count1, "first table should have data")
	assert.Equal(t, 1, count2, "second table should have data")
}

func TestTxManager_WithTx_PartialFailureRollsBackAll(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	defer pool.Close()

	txMgr := NewTxManager(pool)
	ctx := context.Background()

	// Create test tables
	_, err := pool.Exec(ctx, `
		CREATE TEMPORARY TABLE IF NOT EXISTS tx_test_partial1 (
			id SERIAL PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		CREATE TEMPORARY TABLE IF NOT EXISTS tx_test_partial2 (
			id SERIAL PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	require.NoError(t, err)

	// First insert succeeds, second fails
	err = txMgr.WithTx(ctx, func(txCtx context.Context) error {
		tx := GetTx(txCtx)

		_, err := tx.Exec(txCtx, "INSERT INTO tx_test_partial1 (value) VALUES ($1)", "value1")
		if err != nil {
			return err
		}

		// This should fail and rollback everything
		return errors.New("simulated failure")
	})
	require.Error(t, err)

	// Verify first insert was also rolled back
	var count int
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM tx_test_partial1").Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "all operations should be rolled back")
}
