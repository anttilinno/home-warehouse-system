package member

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for member persistence.
type Repository interface {
	// Save persists a member (create or update).
	Save(ctx context.Context, member *Member) error

	// FindByWorkspaceAndUser retrieves a member by workspace and user ID.
	FindByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID) (*Member, error)

	// ListByWorkspace retrieves all members in a workspace.
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Member, error)

	// Delete removes a member.
	Delete(ctx context.Context, workspaceID, userID uuid.UUID) error

	// CountOwners counts the number of owners in a workspace.
	CountOwners(ctx context.Context, workspaceID uuid.UUID) (int64, error)

	// Exists checks if a member exists.
	Exists(ctx context.Context, workspaceID, userID uuid.UUID) (bool, error)
}
