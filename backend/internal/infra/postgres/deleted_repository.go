package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/deleted"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

type DeletedRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewDeletedRepository(pool *pgxpool.Pool) *DeletedRepository {
	return &DeletedRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *DeletedRepository) Save(ctx context.Context, d *deleted.DeletedRecord) error {
	var deletedBy pgtype.UUID
	if d.DeletedBy() != nil {
		deletedBy = pgtype.UUID{Bytes: *d.DeletedBy(), Valid: true}
	}

	_, err := r.queries.CreateDeletedRecord(ctx, queries.CreateDeletedRecordParams{
		ID:          d.ID(),
		WorkspaceID: d.WorkspaceID(),
		EntityType:  queries.WarehouseActivityEntityEnum(d.EntityType()),
		EntityID:    d.EntityID(),
		DeletedBy:   deletedBy,
	})
	return err
}

func (r *DeletedRepository) FindSince(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*deleted.DeletedRecord, error) {
	rows, err := r.queries.ListDeletedSince(ctx, queries.ListDeletedSinceParams{
		WorkspaceID: workspaceID,
		DeletedAt:   since,
	})
	if err != nil {
		return nil, err
	}

	records := make([]*deleted.DeletedRecord, 0, len(rows))
	for _, row := range rows {
		records = append(records, r.rowToDeletedRecord(row))
	}

	return records, nil
}

func (r *DeletedRepository) CleanupOld(ctx context.Context, before time.Time) error {
	return r.queries.CleanupOldDeletedRecords(ctx, before)
}

func (r *DeletedRepository) rowToDeletedRecord(row queries.WarehouseDeletedRecord) *deleted.DeletedRecord {
	var deletedBy *uuid.UUID
	if row.DeletedBy.Valid {
		id := uuid.UUID(row.DeletedBy.Bytes)
		deletedBy = &id
	}

	return deleted.Reconstruct(
		row.ID,
		row.WorkspaceID,
		activity.EntityType(row.EntityType),
		row.EntityID,
		row.DeletedAt,
		deletedBy,
	)
}
