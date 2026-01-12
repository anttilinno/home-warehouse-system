package workspace

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for workspace persistence.
type Repository interface {
	// Save persists a workspace (create or update).
	Save(ctx context.Context, workspace *Workspace) error

	// FindByID retrieves a workspace by ID.
	FindByID(ctx context.Context, id uuid.UUID) (*Workspace, error)

	// FindBySlug retrieves a workspace by slug.
	FindBySlug(ctx context.Context, slug string) (*Workspace, error)

	// FindByUserID retrieves all workspaces for a user.
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]*Workspace, error)

	// Delete removes a workspace by ID.
	Delete(ctx context.Context, id uuid.UUID) error

	// ExistsBySlug checks if a workspace with the given slug exists.
	ExistsBySlug(ctx context.Context, slug string) (bool, error)
}
