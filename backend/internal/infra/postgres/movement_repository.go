package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/movement"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type MovementRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewMovementRepository(pool *pgxpool.Pool) *MovementRepository {
	return &MovementRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *MovementRepository) Save(ctx context.Context, m *movement.InventoryMovement) error {
	var fromLocationID, toLocationID, fromContainerID, toContainerID, movedBy pgtype.UUID

	if m.FromLocationID() != nil {
		fromLocationID = pgtype.UUID{Bytes: *m.FromLocationID(), Valid: true}
	}
	if m.ToLocationID() != nil {
		toLocationID = pgtype.UUID{Bytes: *m.ToLocationID(), Valid: true}
	}
	if m.FromContainerID() != nil {
		fromContainerID = pgtype.UUID{Bytes: *m.FromContainerID(), Valid: true}
	}
	if m.ToContainerID() != nil {
		toContainerID = pgtype.UUID{Bytes: *m.ToContainerID(), Valid: true}
	}
	if m.MovedBy() != nil {
		movedBy = pgtype.UUID{Bytes: *m.MovedBy(), Valid: true}
	}

	_, err := r.queries.CreateMovement(ctx, queries.CreateMovementParams{
		ID:              m.ID(),
		WorkspaceID:     m.WorkspaceID(),
		InventoryID:     m.InventoryID(),
		FromLocationID:  fromLocationID,
		ToLocationID:    toLocationID,
		FromContainerID: fromContainerID,
		ToContainerID:   toContainerID,
		Quantity:        int32(m.Quantity()),
		MovedBy:         movedBy,
		Reason:          m.Reason(),
	})
	return err
}

func (r *MovementRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*movement.InventoryMovement, error) {
	row, err := r.queries.GetMovement(ctx, queries.GetMovementParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		return nil, err
	}
	return r.rowToMovement(row), nil
}

func (r *MovementRepository) FindByInventory(ctx context.Context, inventoryID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*movement.InventoryMovement, error) {
	rows, err := r.queries.ListMovementsByInventory(ctx, queries.ListMovementsByInventoryParams{
		InventoryID: inventoryID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	movements := make([]*movement.InventoryMovement, len(rows))
	for i, row := range rows {
		movements[i] = r.inventoryRowToMovement(row)
	}
	return movements, nil
}

func (r *MovementRepository) FindByLocation(ctx context.Context, locationID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*movement.InventoryMovement, error) {
	rows, err := r.queries.ListMovementsByLocation(ctx, queries.ListMovementsByLocationParams{
		WorkspaceID:    workspaceID,
		FromLocationID: pgtype.UUID{Bytes: locationID, Valid: true},
		Limit:          int32(pagination.Limit()),
		Offset:         int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	movements := make([]*movement.InventoryMovement, len(rows))
	for i, row := range rows {
		movements[i] = r.rowToMovement(row)
	}
	return movements, nil
}

func (r *MovementRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*movement.InventoryMovement, error) {
	rows, err := r.queries.ListMovementsByWorkspace(ctx, queries.ListMovementsByWorkspaceParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	movements := make([]*movement.InventoryMovement, len(rows))
	for i, row := range rows {
		movements[i] = r.workspaceRowToMovement(row)
	}
	return movements, nil
}

func (r *MovementRepository) rowToMovement(row queries.WarehouseInventoryMovement) *movement.InventoryMovement {
	var fromLocationID, toLocationID, fromContainerID, toContainerID, movedBy *uuid.UUID

	if row.FromLocationID.Valid {
		id := uuid.UUID(row.FromLocationID.Bytes)
		fromLocationID = &id
	}
	if row.ToLocationID.Valid {
		id := uuid.UUID(row.ToLocationID.Bytes)
		toLocationID = &id
	}
	if row.FromContainerID.Valid {
		id := uuid.UUID(row.FromContainerID.Bytes)
		fromContainerID = &id
	}
	if row.ToContainerID.Valid {
		id := uuid.UUID(row.ToContainerID.Bytes)
		toContainerID = &id
	}
	if row.MovedBy.Valid {
		id := uuid.UUID(row.MovedBy.Bytes)
		movedBy = &id
	}

	return movement.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.InventoryID,
		fromLocationID,
		fromContainerID,
		toLocationID,
		toContainerID,
		int(row.Quantity),
		movedBy,
		row.Reason,
		row.CreatedAt.Time,
	)
}

func (r *MovementRepository) inventoryRowToMovement(row queries.ListMovementsByInventoryRow) *movement.InventoryMovement {
	var fromLocationID, toLocationID, fromContainerID, toContainerID, movedBy *uuid.UUID

	if row.FromLocationID.Valid {
		id := uuid.UUID(row.FromLocationID.Bytes)
		fromLocationID = &id
	}
	if row.ToLocationID.Valid {
		id := uuid.UUID(row.ToLocationID.Bytes)
		toLocationID = &id
	}
	if row.FromContainerID.Valid {
		id := uuid.UUID(row.FromContainerID.Bytes)
		fromContainerID = &id
	}
	if row.ToContainerID.Valid {
		id := uuid.UUID(row.ToContainerID.Bytes)
		toContainerID = &id
	}
	if row.MovedBy.Valid {
		id := uuid.UUID(row.MovedBy.Bytes)
		movedBy = &id
	}

	return movement.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.InventoryID,
		fromLocationID,
		fromContainerID,
		toLocationID,
		toContainerID,
		int(row.Quantity),
		movedBy,
		row.Reason,
		row.CreatedAt.Time,
	)
}

func (r *MovementRepository) workspaceRowToMovement(row queries.ListMovementsByWorkspaceRow) *movement.InventoryMovement {
	var fromLocationID, toLocationID, fromContainerID, toContainerID, movedBy *uuid.UUID

	if row.FromLocationID.Valid {
		id := uuid.UUID(row.FromLocationID.Bytes)
		fromLocationID = &id
	}
	if row.ToLocationID.Valid {
		id := uuid.UUID(row.ToLocationID.Bytes)
		toLocationID = &id
	}
	if row.FromContainerID.Valid {
		id := uuid.UUID(row.FromContainerID.Bytes)
		fromContainerID = &id
	}
	if row.ToContainerID.Valid {
		id := uuid.UUID(row.ToContainerID.Bytes)
		toContainerID = &id
	}
	if row.MovedBy.Valid {
		id := uuid.UUID(row.MovedBy.Bytes)
		movedBy = &id
	}

	return movement.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.InventoryID,
		fromLocationID,
		fromContainerID,
		toLocationID,
		toContainerID,
		int(row.Quantity),
		movedBy,
		row.Reason,
		row.CreatedAt.Time,
	)
}
