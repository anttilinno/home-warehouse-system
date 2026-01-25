package repairphoto

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for repair photo data access
type Repository interface {
	// Create inserts a new repair photo
	Create(ctx context.Context, photo *RepairPhoto) (*RepairPhoto, error)

	// GetByID retrieves a repair photo by its ID within a workspace
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairPhoto, error)

	// ListByRepairLog retrieves all photos for a repair log, ordered by display_order
	ListByRepairLog(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*RepairPhoto, error)

	// UpdateCaption updates the caption of a photo
	UpdateCaption(ctx context.Context, id, workspaceID uuid.UUID, caption *string) (*RepairPhoto, error)

	// UpdateDisplayOrder updates the display order of a photo
	UpdateDisplayOrder(ctx context.Context, id, workspaceID uuid.UUID, order int32) error

	// Delete removes a repair photo
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error

	// GetMaxDisplayOrder returns the maximum display order for a repair log
	GetMaxDisplayOrder(ctx context.Context, repairLogID, workspaceID uuid.UUID) (int32, error)
}
