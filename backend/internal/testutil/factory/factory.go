// Package factory provides test factories for creating domain entities with
// realistic fake data using gofakeit. Factories use the builder pattern with
// functional options for customization.
package factory

import (
	"github.com/google/uuid"
)

// Default IDs for test isolation - consistent across test runs
var (
	DefaultWorkspaceID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	DefaultUserID      = uuid.MustParse("00000000-0000-0000-0000-000000000002")
)

// Factory provides methods for creating test entities with sensible defaults.
// It maintains workspace and user context for multi-tenant entity creation.
type Factory struct {
	workspaceID uuid.UUID
	userID      uuid.UUID
}

// New creates a new Factory with default workspace and user IDs.
func New() *Factory {
	return &Factory{
		workspaceID: DefaultWorkspaceID,
		userID:      DefaultUserID,
	}
}

// WithWorkspace returns a new Factory with the specified workspace ID.
func (f *Factory) WithWorkspace(id uuid.UUID) *Factory {
	return &Factory{
		workspaceID: id,
		userID:      f.userID,
	}
}

// WithUser returns a new Factory with the specified user ID.
func (f *Factory) WithUser(id uuid.UUID) *Factory {
	return &Factory{
		workspaceID: f.workspaceID,
		userID:      id,
	}
}

// WorkspaceID returns the factory's workspace ID.
func (f *Factory) WorkspaceID() uuid.UUID {
	return f.workspaceID
}

// UserID returns the factory's user ID.
func (f *Factory) UserID() uuid.UUID {
	return f.userID
}
