package pendingchange

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for pending change persistence
type Repository interface {
	// Save creates or updates a pending change
	Save(ctx context.Context, change *PendingChange) error

	// FindByID retrieves a pending change by its ID, scoped to the workspace
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*PendingChange, error)

	// FindByWorkspace retrieves pending changes for a workspace, optionally filtered by status
	// If status is nil, returns all pending changes regardless of status
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, status *Status) ([]*PendingChange, error)

	// FindByRequester retrieves pending changes created by a specific user
	// If status is nil, returns all changes regardless of status
	FindByRequester(ctx context.Context, requesterID uuid.UUID, status *Status) ([]*PendingChange, error)

	// FindByEntity retrieves pending changes for a specific entity, scoped to the workspace
	FindByEntity(ctx context.Context, workspaceID uuid.UUID, entityType string, entityID uuid.UUID) ([]*PendingChange, error)

	// Delete removes a pending change by ID, scoped to the workspace
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}
