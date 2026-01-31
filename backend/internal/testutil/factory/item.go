package factory

import (
	"github.com/brianvoe/gofakeit/v7"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
)

// ItemOpt is a functional option for customizing an Item.
type ItemOpt func(*item.Item)

// Item creates a new Item entity with realistic fake data.
// Options can be used to override specific fields.
func (f *Factory) Item(opts ...ItemOpt) *item.Item {
	name := gofakeit.ProductName()
	sku := gofakeit.LetterN(3) + "-" + gofakeit.DigitN(5)

	i, err := item.NewItem(f.workspaceID, name, sku, 0)
	if err != nil {
		panic("factory: failed to create item: " + err.Error())
	}

	for _, opt := range opts {
		opt(i)
	}

	return i
}

// WithItemName sets the item's name.
func WithItemName(name string) ItemOpt {
	return func(i *item.Item) {
		_ = i.Update(item.UpdateInput{
			Name:              name,
			Description:       i.Description(),
			CategoryID:        i.CategoryID(),
			Brand:             i.Brand(),
			Model:             i.Model(),
			ImageURL:          i.ImageURL(),
			SerialNumber:      i.SerialNumber(),
			Manufacturer:      i.Manufacturer(),
			Barcode:           i.Barcode(),
			IsInsured:         i.IsInsured(),
			LifetimeWarranty:  i.LifetimeWarranty(),
			WarrantyDetails:   i.WarrantyDetails(),
			PurchasedFrom:     i.PurchasedFrom(),
			MinStockLevel:     i.MinStockLevel(),
			ObsidianVaultPath: i.ObsidianVaultPath(),
			ObsidianNotePath:  i.ObsidianNotePath(),
		})
	}
}

// WithItemSKU sets the item's SKU.
func WithItemSKU(sku string) ItemOpt {
	return func(i *item.Item) {
		i.SetSKU(sku)
	}
}

// WithItemCategory sets the item's category ID.
func WithItemCategory(categoryID uuid.UUID) ItemOpt {
	return func(i *item.Item) {
		_ = i.Update(item.UpdateInput{
			Name:              i.Name(),
			Description:       i.Description(),
			CategoryID:        &categoryID,
			Brand:             i.Brand(),
			Model:             i.Model(),
			ImageURL:          i.ImageURL(),
			SerialNumber:      i.SerialNumber(),
			Manufacturer:      i.Manufacturer(),
			Barcode:           i.Barcode(),
			IsInsured:         i.IsInsured(),
			LifetimeWarranty:  i.LifetimeWarranty(),
			WarrantyDetails:   i.WarrantyDetails(),
			PurchasedFrom:     i.PurchasedFrom(),
			MinStockLevel:     i.MinStockLevel(),
			ObsidianVaultPath: i.ObsidianVaultPath(),
			ObsidianNotePath:  i.ObsidianNotePath(),
		})
	}
}

// WithItemBrand sets the item's brand.
func WithItemBrand(brand string) ItemOpt {
	return func(i *item.Item) {
		_ = i.Update(item.UpdateInput{
			Name:              i.Name(),
			Description:       i.Description(),
			CategoryID:        i.CategoryID(),
			Brand:             &brand,
			Model:             i.Model(),
			ImageURL:          i.ImageURL(),
			SerialNumber:      i.SerialNumber(),
			Manufacturer:      i.Manufacturer(),
			Barcode:           i.Barcode(),
			IsInsured:         i.IsInsured(),
			LifetimeWarranty:  i.LifetimeWarranty(),
			WarrantyDetails:   i.WarrantyDetails(),
			PurchasedFrom:     i.PurchasedFrom(),
			MinStockLevel:     i.MinStockLevel(),
			ObsidianVaultPath: i.ObsidianVaultPath(),
			ObsidianNotePath:  i.ObsidianNotePath(),
		})
	}
}

// WithItemModel sets the item's model.
func WithItemModel(model string) ItemOpt {
	return func(i *item.Item) {
		_ = i.Update(item.UpdateInput{
			Name:              i.Name(),
			Description:       i.Description(),
			CategoryID:        i.CategoryID(),
			Brand:             i.Brand(),
			Model:             &model,
			ImageURL:          i.ImageURL(),
			SerialNumber:      i.SerialNumber(),
			Manufacturer:      i.Manufacturer(),
			Barcode:           i.Barcode(),
			IsInsured:         i.IsInsured(),
			LifetimeWarranty:  i.LifetimeWarranty(),
			WarrantyDetails:   i.WarrantyDetails(),
			PurchasedFrom:     i.PurchasedFrom(),
			MinStockLevel:     i.MinStockLevel(),
			ObsidianVaultPath: i.ObsidianVaultPath(),
			ObsidianNotePath:  i.ObsidianNotePath(),
		})
	}
}

// WithItemDescription sets the item's description.
func WithItemDescription(description string) ItemOpt {
	return func(i *item.Item) {
		_ = i.Update(item.UpdateInput{
			Name:              i.Name(),
			Description:       &description,
			CategoryID:        i.CategoryID(),
			Brand:             i.Brand(),
			Model:             i.Model(),
			ImageURL:          i.ImageURL(),
			SerialNumber:      i.SerialNumber(),
			Manufacturer:      i.Manufacturer(),
			Barcode:           i.Barcode(),
			IsInsured:         i.IsInsured(),
			LifetimeWarranty:  i.LifetimeWarranty(),
			WarrantyDetails:   i.WarrantyDetails(),
			PurchasedFrom:     i.PurchasedFrom(),
			MinStockLevel:     i.MinStockLevel(),
			ObsidianVaultPath: i.ObsidianVaultPath(),
			ObsidianNotePath:  i.ObsidianNotePath(),
		})
	}
}

// WithItemBarcode sets the item's barcode.
func WithItemBarcode(barcode string) ItemOpt {
	return func(i *item.Item) {
		_ = i.Update(item.UpdateInput{
			Name:              i.Name(),
			Description:       i.Description(),
			CategoryID:        i.CategoryID(),
			Brand:             i.Brand(),
			Model:             i.Model(),
			ImageURL:          i.ImageURL(),
			SerialNumber:      i.SerialNumber(),
			Manufacturer:      i.Manufacturer(),
			Barcode:           &barcode,
			IsInsured:         i.IsInsured(),
			LifetimeWarranty:  i.LifetimeWarranty(),
			WarrantyDetails:   i.WarrantyDetails(),
			PurchasedFrom:     i.PurchasedFrom(),
			MinStockLevel:     i.MinStockLevel(),
			ObsidianVaultPath: i.ObsidianVaultPath(),
			ObsidianNotePath:  i.ObsidianNotePath(),
		})
	}
}
