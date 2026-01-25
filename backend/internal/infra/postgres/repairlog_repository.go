package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairlog"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RepairLogRepository implements the repairlog.Repository interface.
type RepairLogRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

// NewRepairLogRepository creates a new RepairLogRepository.
func NewRepairLogRepository(pool *pgxpool.Pool) *RepairLogRepository {
	return &RepairLogRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

// Save creates or updates a repair log.
func (r *RepairLogRepository) Save(ctx context.Context, repair *repairlog.RepairLog) error {
	// Check if repair log already exists
	existing, err := r.queries.GetRepairLog(ctx, queries.GetRepairLogParams{
		ID:          repair.ID(),
		WorkspaceID: repair.WorkspaceID(),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	// If repair log exists, use appropriate update query
	if existing.ID != uuid.Nil {
		// If status changed to COMPLETED, use CompleteRepairLog query
		if repair.Status() == repairlog.StatusCompleted && existing.Status != queries.WarehouseRepairStatusEnumCOMPLETED {
			var newCondition queries.NullWarehouseItemConditionEnum
			if repair.NewCondition() != nil {
				newCondition = queries.NullWarehouseItemConditionEnum{
					WarehouseItemConditionEnum: queries.WarehouseItemConditionEnum(*repair.NewCondition()),
					Valid:                      true,
				}
			}
			_, err = r.queries.CompleteRepairLog(ctx, queries.CompleteRepairLogParams{
				ID:           repair.ID(),
				NewCondition: newCondition,
			})
			return err
		}

		// If status changed otherwise, use UpdateRepairLogStatus
		if string(repair.Status()) != string(existing.Status) {
			_, err = r.queries.UpdateRepairLogStatus(ctx, queries.UpdateRepairLogStatusParams{
				ID:     repair.ID(),
				Status: queries.WarehouseRepairStatusEnum(repair.Status()),
			})
			return err
		}

		// Otherwise, use UpdateRepairLog for detail changes
		var repairDate pgtype.Date
		if repair.RepairDate() != nil {
			repairDate = pgtype.Date{Time: *repair.RepairDate(), Valid: true}
		}

		var cost *int32
		if repair.Cost() != nil {
			c := int32(*repair.Cost())
			cost = &c
		}

		_, err = r.queries.UpdateRepairLog(ctx, queries.UpdateRepairLogParams{
			ID:              repair.ID(),
			Description:     repair.Description(),
			RepairDate:      repairDate,
			Cost:            cost,
			CurrencyCode:    repair.CurrencyCode(),
			ServiceProvider: repair.ServiceProvider(),
			Notes:           repair.Notes(),
		})
		return err
	}

	// Create new repair log
	var repairDate pgtype.Date
	if repair.RepairDate() != nil {
		repairDate = pgtype.Date{Time: *repair.RepairDate(), Valid: true}
	}

	var cost *int32
	if repair.Cost() != nil {
		c := int32(*repair.Cost())
		cost = &c
	}

	_, err = r.queries.CreateRepairLog(ctx, queries.CreateRepairLogParams{
		ID:              repair.ID(),
		WorkspaceID:     repair.WorkspaceID(),
		InventoryID:     repair.InventoryID(),
		Status:          queries.WarehouseRepairStatusEnum(repair.Status()),
		Description:     repair.Description(),
		RepairDate:      repairDate,
		Cost:            cost,
		CurrencyCode:    repair.CurrencyCode(),
		ServiceProvider: repair.ServiceProvider(),
		Notes:           repair.Notes(),
	})
	return err
}

// FindByID retrieves a repair log by ID within a workspace.
func (r *RepairLogRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*repairlog.RepairLog, error) {
	row, err := r.queries.GetRepairLog(ctx, queries.GetRepairLogParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToRepairLog(row), nil
}

// FindByInventory retrieves all repair logs for an inventory item.
func (r *RepairLogRepository) FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*repairlog.RepairLog, error) {
	rows, err := r.queries.ListRepairLogsByInventory(ctx, queries.ListRepairLogsByInventoryParams{
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
	})
	if err != nil {
		return nil, err
	}

	repairs := make([]*repairlog.RepairLog, 0, len(rows))
	for _, row := range rows {
		repairs = append(repairs, r.rowToRepairLog(row))
	}

	return repairs, nil
}

// FindByWorkspace retrieves repair logs for a workspace with pagination.
func (r *RepairLogRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*repairlog.RepairLog, int, error) {
	rows, err := r.queries.ListRepairLogsByWorkspace(ctx, queries.ListRepairLogsByWorkspaceParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	repairs := make([]*repairlog.RepairLog, 0, len(rows))
	for _, row := range rows {
		repairs = append(repairs, r.rowToRepairLog(row))
	}

	return repairs, len(repairs), nil
}

// FindByStatus retrieves repair logs by status with pagination.
func (r *RepairLogRepository) FindByStatus(ctx context.Context, workspaceID uuid.UUID, status repairlog.RepairStatus, pagination shared.Pagination) ([]*repairlog.RepairLog, error) {
	rows, err := r.queries.ListRepairLogsByStatus(ctx, queries.ListRepairLogsByStatusParams{
		WorkspaceID: workspaceID,
		Status:      queries.WarehouseRepairStatusEnum(status),
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	repairs := make([]*repairlog.RepairLog, 0, len(rows))
	for _, row := range rows {
		repairs = append(repairs, r.rowToRepairLog(row))
	}

	return repairs, nil
}

// CountByInventory returns the count of repair logs for an inventory item.
func (r *RepairLogRepository) CountByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) (int, error) {
	count, err := r.queries.CountRepairLogsByInventory(ctx, queries.CountRepairLogsByInventoryParams{
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
	})
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

// Delete removes a repair log by ID.
func (r *RepairLogRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteRepairLog(ctx, id)
}

// rowToRepairLog converts a database row to a domain entity.
func (r *RepairLogRepository) rowToRepairLog(row queries.WarehouseRepairLog) *repairlog.RepairLog {
	var repairDate, completedAt *time.Time
	if row.RepairDate.Valid {
		t := row.RepairDate.Time
		repairDate = &t
	}
	if row.CompletedAt.Valid {
		t := row.CompletedAt.Time
		completedAt = &t
	}

	var cost *int
	if row.Cost != nil {
		c := int(*row.Cost)
		cost = &c
	}

	var newCondition *string
	if row.NewCondition.Valid {
		s := string(row.NewCondition.WarehouseItemConditionEnum)
		newCondition = &s
	}

	return repairlog.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.InventoryID,
		repairlog.RepairStatus(row.Status),
		row.Description,
		repairDate,
		cost,
		row.CurrencyCode,
		row.ServiceProvider,
		completedAt,
		newCondition,
		row.Notes,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
