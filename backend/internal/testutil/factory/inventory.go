package factory

import (
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
)

// InventoryOpt is a functional option for customizing an Inventory.
type InventoryOpt func(*inventory.Inventory)

// Inventory creates a new Inventory entity with sensible defaults.
// Requires itemID and locationID. Use f.Item() and f.Location() to create them first.
// Options can be used to override specific fields.
func (f *Factory) Inventory(itemID, locationID uuid.UUID, opts ...InventoryOpt) *inventory.Inventory {
	inv, err := inventory.NewInventory(
		f.workspaceID,
		itemID,
		locationID,
		nil, // containerID
		1,   // quantity
		inventory.ConditionGood,
		inventory.StatusAvailable,
		nil, // currencyCode
	)
	if err != nil {
		panic("factory: failed to create inventory: " + err.Error())
	}

	for _, opt := range opts {
		opt(inv)
	}

	return inv
}

// WithInventoryItem sets the inventory's item ID.
func WithInventoryItem(itemID uuid.UUID) InventoryOpt {
	return func(inv *inventory.Inventory) {
		*inv = *inventory.Reconstruct(
			inv.ID(),
			inv.WorkspaceID(),
			itemID,
			inv.LocationID(),
			inv.ContainerID(),
			inv.Quantity(),
			inv.Condition(),
			inv.Status(),
			inv.DateAcquired(),
			inv.PurchasePrice(),
			inv.CurrencyCode(),
			inv.WarrantyExpires(),
			inv.ExpirationDate(),
			inv.Notes(),
			inv.IsArchived(),
			inv.CreatedAt(),
			inv.UpdatedAt(),
		)
	}
}

// WithInventoryLocation sets the inventory's location ID.
func WithInventoryLocation(locationID uuid.UUID) InventoryOpt {
	return func(inv *inventory.Inventory) {
		_ = inv.Move(locationID, inv.ContainerID())
	}
}

// WithInventoryContainer sets the inventory's container ID.
func WithInventoryContainer(containerID uuid.UUID) InventoryOpt {
	return func(inv *inventory.Inventory) {
		_ = inv.Move(inv.LocationID(), &containerID)
	}
}

// WithInventoryCondition sets the inventory's condition.
func WithInventoryCondition(condition inventory.Condition) InventoryOpt {
	return func(inv *inventory.Inventory) {
		_ = inv.Update(inventory.UpdateInput{
			LocationID:      inv.LocationID(),
			ContainerID:     inv.ContainerID(),
			Quantity:        inv.Quantity(),
			Condition:       condition,
			DateAcquired:    inv.DateAcquired(),
			PurchasePrice:   inv.PurchasePrice(),
			CurrencyCode:    inv.CurrencyCode(),
			WarrantyExpires: inv.WarrantyExpires(),
			ExpirationDate:  inv.ExpirationDate(),
			Notes:           inv.Notes(),
		})
	}
}

// WithInventoryStatus sets the inventory's status.
func WithInventoryStatus(status inventory.Status) InventoryOpt {
	return func(inv *inventory.Inventory) {
		_ = inv.UpdateStatus(status)
	}
}

// WithInventoryQuantity sets the inventory's quantity.
func WithInventoryQuantity(quantity int) InventoryOpt {
	return func(inv *inventory.Inventory) {
		_ = inv.UpdateQuantity(quantity)
	}
}

// WithInventoryNotes sets the inventory's notes.
func WithInventoryNotes(notes string) InventoryOpt {
	return func(inv *inventory.Inventory) {
		_ = inv.Update(inventory.UpdateInput{
			LocationID:      inv.LocationID(),
			ContainerID:     inv.ContainerID(),
			Quantity:        inv.Quantity(),
			Condition:       inv.Condition(),
			DateAcquired:    inv.DateAcquired(),
			PurchasePrice:   inv.PurchasePrice(),
			CurrencyCode:    inv.CurrencyCode(),
			WarrantyExpires: inv.WarrantyExpires(),
			ExpirationDate:  inv.ExpirationDate(),
			Notes:           &notes,
		})
	}
}
