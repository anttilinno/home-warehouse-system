package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/idempotency"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// IdempotencyRepository is the single Postgres-backed idempotency.Store,
// shared by the item/container/location create flows (warehouse.idempotency_keys,
// migration 008).
type IdempotencyRepository struct {
	queries *queries.Queries
}

func NewIdempotencyRepository(pool *pgxpool.Pool) *IdempotencyRepository {
	return &IdempotencyRepository{queries: queries.New(pool)}
}

func (r *IdempotencyRepository) FindByIdempotencyKey(ctx context.Context, workspaceID uuid.UUID, key string) (uuid.UUID, bool, error) {
	entityID, err := r.queries.FindIdempotencyKey(ctx, queries.FindIdempotencyKeyParams{
		WorkspaceID:    workspaceID,
		IdempotencyKey: key,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, false, nil
		}
		return uuid.Nil, false, err
	}
	return entityID, true, nil
}

func (r *IdempotencyRepository) SaveIdempotencyKey(ctx context.Context, workspaceID uuid.UUID, key string, entityType idempotency.EntityType, entityID uuid.UUID) error {
	return r.queries.SaveIdempotencyKey(ctx, queries.SaveIdempotencyKeyParams{
		WorkspaceID:    workspaceID,
		IdempotencyKey: key,
		EntityType:     queries.WarehouseFavoriteTypeEnum(entityType),
		EntityID:       entityID,
	})
}
