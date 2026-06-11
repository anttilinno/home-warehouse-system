package inventory

import (
	"context"
	"time"

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
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error

	// FindExpiring returns inventory whose expiration_date and/or
	// warranty_expires falls between today and today+withinDays. Items with
	// lifetime_warranty never appear as warranty entries. One inventory row
	// can appear twice (once per kind).
	FindExpiring(ctx context.Context, workspaceID uuid.UUID, withinDays int) ([]ExpiringInventory, error)
}

// Expiring inventory kinds.
const (
	// ExpiringKindExpiration marks an entry produced by expiration_date.
	ExpiringKindExpiration = "expiration"
	// ExpiringKindWarranty marks an entry produced by warranty_expires.
	ExpiringKindWarranty = "warranty"
)

// ExpiringInventory is a read model for "expiring soon" listings (dashboard
// widget, inventory filter).
type ExpiringInventory struct {
	InventoryID uuid.UUID
	ItemID      uuid.UUID
	ItemName    string
	Quantity    int
	Kind        string // ExpiringKindExpiration | ExpiringKindWarranty
	Date        time.Time
}
