package postgres

import (
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// HandleNotFound converts pgx.ErrNoRows to shared.ErrNotFound.
// This provides consistent error handling across all repositories.
//
// Usage:
//
//	row := pool.QueryRow(ctx, query, id)
//	entity, err := r.scanEntity(row)
//	if err != nil {
//	    return nil, postgres.HandleNotFound(err)
//	}
func HandleNotFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return shared.ErrNotFound
	}
	return err
}

// WrapNotFound is a convenience function that wraps entity retrieval
// and automatically converts pgx.ErrNoRows to shared.ErrNotFound.
//
// Usage:
//
//	return postgres.WrapNotFound(r.scanEntity(row))
func WrapNotFound[T any](entity T, err error) (T, error) {
	if err != nil {
		var zero T
		return zero, HandleNotFound(err)
	}
	return entity, nil
}
