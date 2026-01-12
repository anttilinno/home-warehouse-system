package item

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, item *Item) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error)
	FindBySKU(ctx context.Context, workspaceID uuid.UUID, sku string) (*Item, error)
	FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*Item, error)
	FindByBarcode(ctx context.Context, workspaceID uuid.UUID, barcode string) (*Item, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Item, int, error)
	FindByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*Item, error)
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Item, error)
	Delete(ctx context.Context, id uuid.UUID) error
	SKUExists(ctx context.Context, workspaceID uuid.UUID, sku string) (bool, error)
	ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error)

	// Label associations
	AttachLabel(ctx context.Context, itemID, labelID uuid.UUID) error
	DetachLabel(ctx context.Context, itemID, labelID uuid.UUID) error
	GetItemLabels(ctx context.Context, itemID uuid.UUID) ([]uuid.UUID, error)
}
