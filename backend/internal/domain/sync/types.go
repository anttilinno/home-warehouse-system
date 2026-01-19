package sync

import (
	"time"

	"github.com/google/uuid"
)

// EntityType represents the type of entity being synced
type EntityType string

const (
	EntityTypeItem      EntityType = "item"
	EntityTypeLocation  EntityType = "location"
	EntityTypeContainer EntityType = "container"
	EntityTypeInventory EntityType = "inventory"
	EntityTypeCategory  EntityType = "category"
	EntityTypeLabel     EntityType = "label"
	EntityTypeCompany   EntityType = "company"
	EntityTypeBorrower  EntityType = "borrower"
	EntityTypeLoan      EntityType = "loan"
)

// AllEntityTypes returns all supported entity types for syncing
func AllEntityTypes() []EntityType {
	return []EntityType{
		EntityTypeItem,
		EntityTypeLocation,
		EntityTypeContainer,
		EntityTypeInventory,
		EntityTypeCategory,
		EntityTypeLabel,
		EntityTypeCompany,
		EntityTypeBorrower,
		EntityTypeLoan,
	}
}

// IsValid checks if the entity type is valid
func (e EntityType) IsValid() bool {
	switch e {
	case EntityTypeItem, EntityTypeLocation, EntityTypeContainer,
		EntityTypeInventory, EntityTypeCategory, EntityTypeLabel,
		EntityTypeCompany, EntityTypeBorrower, EntityTypeLoan:
		return true
	}
	return false
}

// DeletedRecord represents a tombstone for sync
type DeletedRecord struct {
	ID         uuid.UUID  `json:"id"`
	EntityType string     `json:"entity_type"`
	EntityID   uuid.UUID  `json:"entity_id"`
	DeletedAt  time.Time  `json:"deleted_at"`
	DeletedBy  *uuid.UUID `json:"deleted_by,omitempty"`
}

// SyncResult holds the result of a delta sync operation
type SyncResult struct {
	Items      []ItemSyncData      `json:"items,omitempty"`
	Locations  []LocationSyncData  `json:"locations,omitempty"`
	Containers []ContainerSyncData `json:"containers,omitempty"`
	Inventory  []InventorySyncData `json:"inventory,omitempty"`
	Categories []CategorySyncData  `json:"categories,omitempty"`
	Labels     []LabelSyncData     `json:"labels,omitempty"`
	Companies  []CompanySyncData   `json:"companies,omitempty"`
	Borrowers  []BorrowerSyncData  `json:"borrowers,omitempty"`
	Loans      []LoanSyncData      `json:"loans,omitempty"`
	Deleted    []DeletedRecord     `json:"deleted"`
	SyncedAt   time.Time           `json:"synced_at"`
	HasMore    bool                `json:"has_more"`
}

// ItemSyncData represents an item for sync response
type ItemSyncData struct {
	ID               uuid.UUID  `json:"id"`
	WorkspaceID      uuid.UUID  `json:"workspace_id"`
	SKU              *string    `json:"sku,omitempty"`
	Name             string     `json:"name"`
	Description      *string    `json:"description,omitempty"`
	CategoryID       *uuid.UUID `json:"category_id,omitempty"`
	Brand            *string    `json:"brand,omitempty"`
	Model            *string    `json:"model,omitempty"`
	ImageURL         *string    `json:"image_url,omitempty"`
	SerialNumber     *string    `json:"serial_number,omitempty"`
	Manufacturer     *string    `json:"manufacturer,omitempty"`
	Barcode          *string    `json:"barcode,omitempty"`
	IsInsured        bool       `json:"is_insured"`
	LifetimeWarranty bool       `json:"lifetime_warranty"`
	WarrantyDetails  *string    `json:"warranty_details,omitempty"`
	PurchasedFrom    *uuid.UUID `json:"purchased_from,omitempty"`
	MinStockLevel    *int32     `json:"min_stock_level,omitempty"`
	ShortCode        string     `json:"short_code"`
	IsArchived       bool       `json:"is_archived"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// LocationSyncData represents a location for sync response
type LocationSyncData struct {
	ID             uuid.UUID  `json:"id"`
	WorkspaceID    uuid.UUID  `json:"workspace_id"`
	Name           string     `json:"name"`
	ParentLocation *uuid.UUID `json:"parent_location,omitempty"`
	Description    *string    `json:"description,omitempty"`
	ShortCode      string     `json:"short_code"`
	IsArchived     bool       `json:"is_archived"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// ContainerSyncData represents a container for sync response
type ContainerSyncData struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	LocationID  uuid.UUID `json:"location_id"`
	Description *string   `json:"description,omitempty"`
	Capacity    *int32    `json:"capacity,omitempty"`
	ShortCode   string    `json:"short_code"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// InventorySyncData represents an inventory record for sync response
type InventorySyncData struct {
	ID              uuid.UUID  `json:"id"`
	WorkspaceID     uuid.UUID  `json:"workspace_id"`
	ItemID          uuid.UUID  `json:"item_id"`
	LocationID      uuid.UUID  `json:"location_id"`
	ContainerID     *uuid.UUID `json:"container_id,omitempty"`
	Quantity        int32      `json:"quantity"`
	Condition       string     `json:"condition"`
	Status          string     `json:"status"`
	DateAcquired    *time.Time `json:"date_acquired,omitempty"`
	PurchasePrice   *int32     `json:"purchase_price,omitempty"`
	CurrencyCode    *string    `json:"currency_code,omitempty"`
	WarrantyExpires *time.Time `json:"warranty_expires,omitempty"`
	ExpirationDate  *time.Time `json:"expiration_date,omitempty"`
	Notes           *string    `json:"notes,omitempty"`
	IsArchived      bool       `json:"is_archived"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// CategorySyncData represents a category for sync response
type CategorySyncData struct {
	ID               uuid.UUID  `json:"id"`
	WorkspaceID      uuid.UUID  `json:"workspace_id"`
	Name             string     `json:"name"`
	ParentCategoryID *uuid.UUID `json:"parent_category_id,omitempty"`
	Description      *string    `json:"description,omitempty"`
	IsArchived       bool       `json:"is_archived"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// LabelSyncData represents a label for sync response
type LabelSyncData struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	Description *string   `json:"description,omitempty"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CompanySyncData represents a company for sync response
type CompanySyncData struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	Website     *string   `json:"website,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	Email       *string   `json:"email,omitempty"`
	Notes       *string   `json:"notes,omitempty"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BorrowerSyncData represents a borrower for sync response
type BorrowerSyncData struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Name        string    `json:"name"`
	Email       *string   `json:"email,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	Notes       *string   `json:"notes,omitempty"`
	IsArchived  bool      `json:"is_archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// LoanSyncData represents a loan for sync response
type LoanSyncData struct {
	ID          uuid.UUID  `json:"id"`
	WorkspaceID uuid.UUID  `json:"workspace_id"`
	InventoryID uuid.UUID  `json:"inventory_id"`
	BorrowerID  uuid.UUID  `json:"borrower_id"`
	Quantity    int32      `json:"quantity"`
	LoanedAt    time.Time  `json:"loaned_at"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	ReturnedAt  *time.Time `json:"returned_at,omitempty"`
	Notes       *string    `json:"notes,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
