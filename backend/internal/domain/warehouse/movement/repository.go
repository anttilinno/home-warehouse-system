package movement

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, movement *InventoryMovement) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*InventoryMovement, error)
	FindByInventory(ctx context.Context, inventoryID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error)
	FindByLocation(ctx context.Context, locationID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error)
}
