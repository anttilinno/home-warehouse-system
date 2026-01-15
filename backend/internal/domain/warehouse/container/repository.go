package container

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, container *Container) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Container, error)
	FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*Container, error)
	FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*Container, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Container, int, error)
	Delete(ctx context.Context, id uuid.UUID) error
	ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error)
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Container, error)
}
