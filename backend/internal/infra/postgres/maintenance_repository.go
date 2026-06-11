package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/maintenance"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MaintenanceRepository implements the maintenance.Repository interface.
type MaintenanceRepository struct {
	pool *pgxpool.Pool
}

// NewMaintenanceRepository creates a new MaintenanceRepository.
func NewMaintenanceRepository(pool *pgxpool.Pool) *MaintenanceRepository {
	return &MaintenanceRepository{pool: pool}
}

// q returns Queries bound to the active transaction in ctx (if any) or the
// pool, so the completion flow (repair log + schedule advance) is atomic
// under TxManager.WithTx.
func (r *MaintenanceRepository) q(ctx context.Context) *queries.Queries {
	return queries.New(GetDBTX(ctx, r.pool))
}

// Save creates or updates a maintenance schedule.
func (r *MaintenanceRepository) Save(ctx context.Context, schedule *maintenance.Schedule) error {
	existing, err := r.q(ctx).GetMaintenanceSchedule(ctx, queries.GetMaintenanceScheduleParams{
		ID:          schedule.ID(),
		WorkspaceID: schedule.WorkspaceID(),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	nextDue := pgtype.Date{Time: schedule.NextDue(), Valid: true}

	if existing.ID != uuid.Nil {
		var lastCompletedAt pgtype.Timestamptz
		if schedule.LastCompletedAt() != nil {
			lastCompletedAt = pgtype.Timestamptz{Time: *schedule.LastCompletedAt(), Valid: true}
		}
		_, err = r.q(ctx).UpdateMaintenanceSchedule(ctx, queries.UpdateMaintenanceScheduleParams{
			ID:              schedule.ID(),
			WorkspaceID:     schedule.WorkspaceID(),
			Title:           schedule.Title(),
			Notes:           schedule.Notes(),
			IntervalDays:    int32(schedule.IntervalDays()),
			NextDue:         nextDue,
			LastCompletedAt: lastCompletedAt,
			IsActive:        schedule.IsActive(),
		})
		return err
	}

	_, err = r.q(ctx).CreateMaintenanceSchedule(ctx, queries.CreateMaintenanceScheduleParams{
		ID:           schedule.ID(),
		WorkspaceID:  schedule.WorkspaceID(),
		InventoryID:  schedule.InventoryID(),
		Title:        schedule.Title(),
		Notes:        schedule.Notes(),
		IntervalDays: int32(schedule.IntervalDays()),
		NextDue:      nextDue,
		IsActive:     schedule.IsActive(),
	})
	return err
}

// FindByID retrieves a schedule by ID within a workspace.
func (r *MaintenanceRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*maintenance.Schedule, error) {
	row, err := r.q(ctx).GetMaintenanceSchedule(ctx, queries.GetMaintenanceScheduleParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}
	return rowToSchedule(row), nil
}

// FindByWorkspace retrieves schedules for a workspace with pagination.
func (r *MaintenanceRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*maintenance.Schedule, int, error) {
	rows, err := r.q(ctx).ListMaintenanceSchedulesByWorkspace(ctx, queries.ListMaintenanceSchedulesByWorkspaceParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := r.q(ctx).CountMaintenanceSchedulesByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, 0, err
	}

	schedules := make([]*maintenance.Schedule, 0, len(rows))
	for _, row := range rows {
		schedules = append(schedules, rowToSchedule(row))
	}
	return schedules, int(total), nil
}

// FindByInventory retrieves all schedules for an inventory entry.
func (r *MaintenanceRepository) FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*maintenance.Schedule, error) {
	rows, err := r.q(ctx).ListMaintenanceSchedulesByInventory(ctx, queries.ListMaintenanceSchedulesByInventoryParams{
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
	})
	if err != nil {
		return nil, err
	}

	schedules := make([]*maintenance.Schedule, 0, len(rows))
	for _, row := range rows {
		schedules = append(schedules, rowToSchedule(row))
	}
	return schedules, nil
}

// FindDue retrieves active schedules due on or before dueBy.
func (r *MaintenanceRepository) FindDue(ctx context.Context, workspaceID uuid.UUID, dueBy time.Time) ([]maintenance.DueSchedule, error) {
	rows, err := r.q(ctx).ListMaintenanceSchedulesDue(ctx, queries.ListMaintenanceSchedulesDueParams{
		WorkspaceID: workspaceID,
		NextDue:     pgtype.Date{Time: dueBy, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	due := make([]maintenance.DueSchedule, 0, len(rows))
	for _, row := range rows {
		due = append(due, maintenance.DueSchedule{
			Schedule: rowToSchedule(queries.WarehouseMaintenanceSchedule{
				ID:              row.ID,
				WorkspaceID:     row.WorkspaceID,
				InventoryID:     row.InventoryID,
				Title:           row.Title,
				Notes:           row.Notes,
				IntervalDays:    row.IntervalDays,
				NextDue:         row.NextDue,
				LastCompletedAt: row.LastCompletedAt,
				IsActive:        row.IsActive,
				CreatedAt:       row.CreatedAt,
				UpdatedAt:       row.UpdatedAt,
			}),
			ItemID:   row.ItemID,
			ItemName: row.ItemName,
		})
	}
	return due, nil
}

// Delete removes a schedule by ID.
func (r *MaintenanceRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return r.q(ctx).DeleteMaintenanceSchedule(ctx, queries.DeleteMaintenanceScheduleParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
}

// CreateCompletionRepairLog writes the COMPLETED repair_logs row recording a
// maintenance completion (repair_date = today).
func (r *MaintenanceRepository) CreateCompletionRepairLog(ctx context.Context, workspaceID, inventoryID uuid.UUID, description string, notes *string) error {
	_, err := r.q(ctx).CreateMaintenanceRepairLog(ctx, queries.CreateMaintenanceRepairLogParams{
		ID:          shared.NewUUID(),
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
		Description: description,
		RepairDate:  pgtype.Date{Time: time.Now(), Valid: true},
		Notes:       notes,
	})
	return err
}

// rowToSchedule converts a database row to a domain entity.
func rowToSchedule(row queries.WarehouseMaintenanceSchedule) *maintenance.Schedule {
	var lastCompletedAt *time.Time
	if row.LastCompletedAt.Valid {
		t := row.LastCompletedAt.Time
		lastCompletedAt = &t
	}

	return maintenance.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.InventoryID,
		row.Title,
		row.Notes,
		int(row.IntervalDays),
		row.NextDue.Time,
		lastCompletedAt,
		row.IsActive,
		row.CreatedAt,
		row.UpdatedAt,
	)
}
