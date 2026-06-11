package maintenance

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Repository defines the interface for maintenance schedule persistence.
// Implementations must route reads/writes through the transaction carried in
// ctx (infra/postgres.GetDBTX) so Service.Complete stays atomic.
type Repository interface {
	// Save creates or updates a maintenance schedule.
	Save(ctx context.Context, schedule *Schedule) error

	// FindByID retrieves a schedule by ID within a workspace.
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Schedule, error)

	// FindByWorkspace retrieves schedules for a workspace with pagination.
	// Returns the schedules, total count, and any error.
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Schedule, int, error)

	// FindByInventory retrieves all schedules for an inventory entry.
	FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*Schedule, error)

	// FindDue retrieves active schedules due on or before dueBy (overdue
	// included), decorated with item info for display.
	FindDue(ctx context.Context, workspaceID uuid.UUID, dueBy time.Time) ([]DueSchedule, error)

	// Delete removes a schedule by ID.
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error

	// CreateCompletionRepairLog writes the COMPLETED repair_logs row that
	// records a maintenance completion. Called inside the completion
	// transaction.
	CreateCompletionRepairLog(ctx context.Context, workspaceID, inventoryID uuid.UUID, description string, notes *string) error
}

// DueSchedule is a read model pairing a due schedule with its item, for the
// reminder job and the "Due maintenance" dashboard widget.
type DueSchedule struct {
	Schedule *Schedule
	ItemID   uuid.UUID
	ItemName string
}
