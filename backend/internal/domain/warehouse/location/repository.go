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
	Delete(ctx context.Context, id uuid.UUID) error
	ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error)
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Location, error)
}
