package inventory

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, inventory *Inventory) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Inventory, error)
	List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Inventory, int, error)
	FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*Inventory, error)
	FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*Inventory, error)
	FindByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*Inventory, error)
	FindAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*Inventory, error)
	GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
