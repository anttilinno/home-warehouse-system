package item

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ListFilters encapsulates filter/sort parameters for the paginated items list.
// Fields are optional: empty Search / nil CategoryID / false IncludeArchived mean
// "no filter on this dimension". Sort and SortDir default to "name" and "asc"
// respectively when empty (handled at the repository layer).
type ListFilters struct {
	Search          string     // FTS search over name, SKU, barcode; empty → no search
	CategoryID      *uuid.UUID // filter by category; nil → no filter
	IncludeArchived bool       // true → include is_archived=true rows; false → active only
	Sort            string     // one of: name, sku, created_at, updated_at
	SortDir         string     // one of: asc, desc
}

type Repository interface {
	Save(ctx context.Context, item *Item) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error)
	FindBySKU(ctx context.Context, workspaceID uuid.UUID, sku string) (*Item, error)
	FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*Item, error)
	FindByBarcode(ctx context.Context, workspaceID uuid.UUID, barcode string) (*Item, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Item, int, error)
	// FindByWorkspaceFiltered returns filtered, sorted, paginated items plus the
	// TRUE total count matching the filter (independent of LIMIT/OFFSET).
	FindByWorkspaceFiltered(ctx context.Context, workspaceID uuid.UUID, filters ListFilters, pagination shared.Pagination) ([]*Item, int, error)
	FindNeedingReview(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Item, int, error)
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
