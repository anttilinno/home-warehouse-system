package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// contextKey is a type for context keys to avoid collisions.
type contextKey string

const (
	// txContextKey is the key used to store transactions in context.
	txContextKey contextKey = "tx"
)

// TxManager manages database transactions.
type TxManager struct {
	pool *pgxpool.Pool
}

// NewTxManager creates a new transaction manager.
func NewTxManager(pool *pgxpool.Pool) *TxManager {
	return &TxManager{pool: pool}
}

// WithTx executes a function within a database transaction.
// If the function returns an error, the transaction is rolled back.
// Otherwise, the transaction is committed.
//
// Example usage:
//
//	err := txManager.WithTx(ctx, func(ctx context.Context) error {
//	    inv, err := inventoryRepo.Save(ctx, inventory)
//	    if err != nil {
//	        return err
//	    }
//	    return movementRepo.Save(ctx, movement)
//	})
func (tm *TxManager) WithTx(ctx context.Context, fn func(context.Context) error) error {
	// Check if we're already in a transaction
	if GetTx(ctx) != nil {
		// Already in a transaction, just execute the function
		return fn(ctx)
	}

	// Start a new transaction
	tx, err := tm.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Store transaction in context
	ctx = context.WithValue(ctx, txContextKey, tx)

	// Ensure transaction is finalized
	defer func() {
		if p := recover(); p != nil {
			// Rollback on panic and re-panic
			_ = tx.Rollback(ctx)
			panic(p)
		}
	}()

	// Execute the function
	if err := fn(ctx); err != nil {
		// Rollback on error
		if rbErr := tx.Rollback(ctx); rbErr != nil {
			return fmt.Errorf("failed to rollback transaction: %v (original error: %w)", rbErr, err)
		}
		return err
	}

	// Commit on success
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetTx retrieves the transaction from context, if present.
// Returns nil if no transaction is active.
func GetTx(ctx context.Context) pgx.Tx {
	if tx, ok := ctx.Value(txContextKey).(pgx.Tx); ok {
		return tx
	}
	return nil
}

// GetDBTX returns either the transaction from context (if active) or the pool.
// This is a convenience function for repositories to use the appropriate database connection.
//
// Usage in repositories:
//
//	func (r *Repository) Save(ctx context.Context, entity *Entity) error {
//	    db := postgres.GetDBTX(ctx, r.pool)
//	    queries := queries.New(db)
//	    // ... use queries
//	}
func GetDBTX(ctx context.Context, pool *pgxpool.Pool) queries.DBTX {
	if tx := GetTx(ctx); tx != nil {
		return tx
	}
	return pool
}
