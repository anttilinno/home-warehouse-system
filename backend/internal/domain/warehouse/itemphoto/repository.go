package itemphoto

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for item photo data access
type Repository interface {
	// Create inserts a new item photo
	Create(ctx context.Context, photo *ItemPhoto) (*ItemPhoto, error)

	// GetByID retrieves an item photo by its ID
	GetByID(ctx context.Context, id uuid.UUID) (*ItemPhoto, error)

	// GetByItem retrieves all photos for an item, ordered by display_order
	GetByItem(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*ItemPhoto, error)

	// GetPrimary retrieves the primary photo for an item
	GetPrimary(ctx context.Context, itemID, workspaceID uuid.UUID) (*ItemPhoto, error)

	// Update updates an existing item photo
	Update(ctx context.Context, photo *ItemPhoto) error

	// UpdateDisplayOrder updates the display order of a photo
	UpdateDisplayOrder(ctx context.Context, photoID uuid.UUID, order int32) error

	// SetPrimary sets a photo as primary and unsets all other primary photos for the item
	SetPrimary(ctx context.Context, photoID uuid.UUID) error

	// Delete removes an item photo
	Delete(ctx context.Context, id uuid.UUID) error

	// DeleteByItem removes all photos for an item (bulk delete)
	DeleteByItem(ctx context.Context, itemID, workspaceID uuid.UUID) error
}
