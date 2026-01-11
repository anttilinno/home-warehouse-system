package label

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	Save(ctx context.Context, label *Label) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Label, error)
	FindByName(ctx context.Context, workspaceID uuid.UUID, name string) (*Label, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Label, error)
	Delete(ctx context.Context, id uuid.UUID) error
	NameExists(ctx context.Context, workspaceID uuid.UUID, name string) (bool, error)
}
