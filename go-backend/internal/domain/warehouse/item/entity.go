package item

import (
	"fmt"
	"net/url"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Item struct {
	id                uuid.UUID
	workspaceID       uuid.UUID
	sku               string
	name              string
	description       *string
	categoryID        *uuid.UUID
	brand             *string
	model             *string
	imageURL          *string
	serialNumber      *string
	manufacturer      *string
	barcode           *string
	isInsured         *bool
	isArchived        *bool
	lifetimeWarranty  *bool
	warrantyDetails   *string
	purchasedFrom     *uuid.UUID
	minStockLevel     int
	shortCode         *string
	obsidianVaultPath *string
	obsidianNotePath  *string
	createdAt         time.Time
	updatedAt         time.Time
}

func NewItem(workspaceID uuid.UUID, name, sku string, minStockLevel int) (*Item, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "name", "item name is required")
	}
	if sku == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "sku", "item SKU is required")
	}
	if minStockLevel < 0 {
		return nil, ErrInvalidMinStock
	}

	falseVal := false
	now := time.Now()
	return &Item{
		id:               shared.NewUUID(),
		workspaceID:      workspaceID,
		sku:              sku,
		name:             name,
		minStockLevel:    minStockLevel,
		isInsured:        &falseVal,
		isArchived:       &falseVal,
		lifetimeWarranty: &falseVal,
		createdAt:        now,
		updatedAt:        now,
	}, nil
}

func Reconstruct(
	id, workspaceID uuid.UUID,
	sku string,
	name string,
	description *string,
	categoryID *uuid.UUID,
	brand, model, imageURL, serialNumber, manufacturer, barcode *string,
	isInsured, isArchived, lifetimeWarranty *bool,
	warrantyDetails *string,
	purchasedFrom *uuid.UUID,
	minStockLevel int,
	shortCode, obsidianVaultPath, obsidianNotePath *string,
	createdAt, updatedAt time.Time,
) *Item {
	return &Item{
		id:                id,
		workspaceID:       workspaceID,
		sku:               sku,
		name:              name,
		description:       description,
		categoryID:        categoryID,
		brand:             brand,
		model:             model,
		imageURL:          imageURL,
		serialNumber:      serialNumber,
		manufacturer:      manufacturer,
		barcode:           barcode,
		isInsured:         isInsured,
		isArchived:        isArchived,
		lifetimeWarranty:  lifetimeWarranty,
		warrantyDetails:   warrantyDetails,
		purchasedFrom:     purchasedFrom,
		minStockLevel:     minStockLevel,
		shortCode:         shortCode,
		obsidianVaultPath: obsidianVaultPath,
		obsidianNotePath:  obsidianNotePath,
		createdAt:         createdAt,
		updatedAt:         updatedAt,
	}
}

// Getters
func (i *Item) ID() uuid.UUID              { return i.id }
func (i *Item) WorkspaceID() uuid.UUID     { return i.workspaceID }
func (i *Item) SKU() string                { return i.sku }
func (i *Item) Name() string               { return i.name }
func (i *Item) Description() *string       { return i.description }
func (i *Item) CategoryID() *uuid.UUID     { return i.categoryID }
func (i *Item) Brand() *string             { return i.brand }
func (i *Item) Model() *string             { return i.model }
func (i *Item) ImageURL() *string          { return i.imageURL }
func (i *Item) SerialNumber() *string      { return i.serialNumber }
func (i *Item) Manufacturer() *string      { return i.manufacturer }
func (i *Item) Barcode() *string           { return i.barcode }
func (i *Item) IsInsured() *bool           { return i.isInsured }
func (i *Item) IsArchived() *bool          { return i.isArchived }
func (i *Item) LifetimeWarranty() *bool    { return i.lifetimeWarranty }
func (i *Item) WarrantyDetails() *string   { return i.warrantyDetails }
func (i *Item) PurchasedFrom() *uuid.UUID  { return i.purchasedFrom }
func (i *Item) MinStockLevel() int         { return i.minStockLevel }
func (i *Item) ShortCode() *string         { return i.shortCode }
func (i *Item) ObsidianVaultPath() *string { return i.obsidianVaultPath }
func (i *Item) ObsidianNotePath() *string  { return i.obsidianNotePath }
func (i *Item) CreatedAt() time.Time       { return i.createdAt }
func (i *Item) UpdatedAt() time.Time       { return i.updatedAt }

type UpdateInput struct {
	Name              string
	Description       *string
	CategoryID        *uuid.UUID
	Brand             *string
	Model             *string
	ImageURL          *string
	SerialNumber      *string
	Manufacturer      *string
	Barcode           *string
	IsInsured         *bool
	LifetimeWarranty  *bool
	WarrantyDetails   *string
	PurchasedFrom     *uuid.UUID
	MinStockLevel     int
	ObsidianVaultPath *string
	ObsidianNotePath  *string
}

func (i *Item) Update(input UpdateInput) error {
	if input.Name == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "name", "item name is required")
	}
	if input.MinStockLevel < 0 {
		return ErrInvalidMinStock
	}

	i.name = input.Name
	i.description = input.Description
	i.categoryID = input.CategoryID
	i.brand = input.Brand
	i.model = input.Model
	i.imageURL = input.ImageURL
	i.serialNumber = input.SerialNumber
	i.manufacturer = input.Manufacturer
	i.barcode = input.Barcode
	i.isInsured = input.IsInsured
	i.lifetimeWarranty = input.LifetimeWarranty
	i.warrantyDetails = input.WarrantyDetails
	i.purchasedFrom = input.PurchasedFrom
	i.minStockLevel = input.MinStockLevel
	i.obsidianVaultPath = input.ObsidianVaultPath
	i.obsidianNotePath = input.ObsidianNotePath
	i.updatedAt = time.Now()
	return nil
}

func (i *Item) SetSKU(sku string) {
	i.sku = sku
	i.updatedAt = time.Now()
}

func (i *Item) SetShortCode(shortCode string) {
	i.shortCode = &shortCode
	i.updatedAt = time.Now()
}

func (i *Item) Archive() {
	trueVal := true
	i.isArchived = &trueVal
	i.updatedAt = time.Now()
}

func (i *Item) Restore() {
	falseVal := false
	i.isArchived = &falseVal
	i.updatedAt = time.Now()
}

// ObsidianURI generates a deep link URI for opening this item's note in Obsidian.
// Returns nil if either vault path or note path is not set.
// Format: obsidian://open?vault=VaultName&file=path/to/note
func (i *Item) ObsidianURI() *string {
	if i.obsidianVaultPath == nil || i.obsidianNotePath == nil {
		return nil
	}
	if *i.obsidianVaultPath == "" || *i.obsidianNotePath == "" {
		return nil
	}

	uri := fmt.Sprintf(
		"obsidian://open?vault=%s&file=%s",
		url.PathEscape(*i.obsidianVaultPath),
		url.PathEscape(*i.obsidianNotePath),
	)
	return &uri
}
