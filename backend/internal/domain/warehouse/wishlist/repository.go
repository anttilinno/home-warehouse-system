package wishlist

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Repository defines the interface for wishlist item persistence.
type Repository interface {
	// Save creates or updates a wishlist item.
	Save(ctx context.Context, item *Item) error

	// FindByID retrieves a wishlist item by ID within a workspace.
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error)

	// FindByWorkspace retrieves wishlist items for a workspace with
	// pagination, optionally filtered by status (nil = all statuses).
	// Results are sorted by priority (1 = highest first), newest first
	// within a priority. Returns the items, total count, and any error.
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, status *Status, pagination shared.Pagination) ([]*Item, int, error)

	// Delete removes a wishlist item by ID.
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}
