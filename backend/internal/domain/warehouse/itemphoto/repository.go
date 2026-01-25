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

	// Bulk operations

	// GetByIDs retrieves multiple photos by their IDs
	GetByIDs(ctx context.Context, ids []uuid.UUID, workspaceID uuid.UUID) ([]*ItemPhoto, error)

	// BulkDelete removes multiple photos by their IDs
	BulkDelete(ctx context.Context, ids []uuid.UUID, workspaceID uuid.UUID) error

	// UpdateCaption updates the caption for a single photo
	UpdateCaption(ctx context.Context, id, workspaceID uuid.UUID, caption *string) error

	// GetPhotosWithHashes retrieves all photos with perceptual hashes in a workspace
	GetPhotosWithHashes(ctx context.Context, workspaceID uuid.UUID) ([]*ItemPhoto, error)

	// GetItemPhotosWithHashes retrieves photos with hashes for a specific item
	GetItemPhotosWithHashes(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*ItemPhoto, error)

	// UpdatePerceptualHash sets the perceptual hash for a photo
	UpdatePerceptualHash(ctx context.Context, id uuid.UUID, hash int64) error
}
