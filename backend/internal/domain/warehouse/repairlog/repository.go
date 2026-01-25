package repairlog

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Repository defines the interface for repair log persistence.
type Repository interface {
	// Save creates or updates a repair log.
	Save(ctx context.Context, repair *RepairLog) error

	// FindByID retrieves a repair log by ID within a workspace.
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairLog, error)

	// FindByInventory retrieves all repair logs for an inventory item.
	FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*RepairLog, error)

	// FindByWorkspace retrieves repair logs for a workspace with pagination.
	// Returns the repair logs, total count, and any error.
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*RepairLog, int, error)

	// FindByStatus retrieves repair logs by status with pagination.
	FindByStatus(ctx context.Context, workspaceID uuid.UUID, status RepairStatus, pagination shared.Pagination) ([]*RepairLog, error)

	// CountByInventory returns the count of repair logs for an inventory item.
	CountByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) (int, error)

	// Delete removes a repair log by ID.
	Delete(ctx context.Context, id uuid.UUID) error
}
