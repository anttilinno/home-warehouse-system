package location

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, location *Location) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Location, error)
	FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*Location, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Location, int, error)
	FindRootLocations(ctx context.Context, workspaceID uuid.UUID) ([]*Location, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	// ShortCodeExists reports whether shortCode is taken anywhere in the
	// global warehouse.short_codes registry (codes are globally unique
	// since migration 005, not per-workspace).
	ShortCodeExists(ctx context.Context, shortCode string) (bool, error)
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Location, error)
}
