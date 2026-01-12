package category

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for category persistence.
type Repository interface {
	// Save persists a category (create or update).
	Save(ctx context.Context, category *Category) error

	// FindByID retrieves a category by ID.
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Category, error)

	// FindByWorkspace retrieves all categories in a workspace.
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error)

	// FindByParent retrieves all categories with a specific parent.
	FindByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*Category, error)

	// FindRootCategories retrieves all root categories (no parent).
	FindRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error)

	// Delete removes a category by ID.
	Delete(ctx context.Context, id uuid.UUID) error

	// HasChildren checks if a category has children.
	HasChildren(ctx context.Context, id uuid.UUID) (bool, error)
}
