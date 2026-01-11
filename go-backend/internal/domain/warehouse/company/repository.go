package company

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, company *Company) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Company, error)
	FindByName(ctx context.Context, workspaceID uuid.UUID, name string) (*Company, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Company, int, error)
	Delete(ctx context.Context, id uuid.UUID) error
	NameExists(ctx context.Context, workspaceID uuid.UUID, name string) (bool, error)
}
