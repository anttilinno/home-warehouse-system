package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool creates a new PostgreSQL connection pool. maxConns/minConns come
// from config (DATABASE_MAX_CONN / DATABASE_MIN_CONN); non-positive values
// fall back to the previous hardcoded defaults.
func NewPool(ctx context.Context, databaseURL string, maxConns, minConns int) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Configure pool settings
	if maxConns <= 0 {
		maxConns = 25
	}
	if minConns <= 0 {
		minConns = 5
	}
	config.MaxConns = int32(maxConns)
	config.MinConns = int32(minConns)

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, nil
}
