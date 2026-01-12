package inventory

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Condition string

const (
	ConditionNew       Condition = "NEW"
	ConditionExcellent Condition = "EXCELLENT"
	ConditionGood      Condition = "GOOD"
	ConditionFair      Condition = "FAIR"
	ConditionPoor      Condition = "POOR"
	ConditionDamaged   Condition = "DAMAGED"
	ConditionForRepair Condition = "FOR_REPAIR"
)

func (c Condition) IsValid() bool {
	switch c {
	case ConditionNew, ConditionExcellent, ConditionGood, ConditionFair,
		ConditionPoor, ConditionDamaged, ConditionForRepair:
		return true
	}
	return false
}

type Status string

const (
	StatusAvailable Status = "AVAILABLE"
	StatusInUse     Status = "IN_USE"
	StatusReserved  Status = "RESERVED"
	StatusOnLoan    Status = "ON_LOAN"
	StatusInTransit Status = "IN_TRANSIT"
	StatusDisposed  Status = "DISPOSED"
	StatusMissing   Status = "MISSING"
)

func (s Status) IsValid() bool {
	switch s {
	case StatusAvailable, StatusInUse, StatusReserved, StatusOnLoan,
		StatusInTransit, StatusDisposed, StatusMissing:
		return true
	}
	return false
}

type Inventory struct {
	id              uuid.UUID
	workspaceID     uuid.UUID
	itemID          uuid.UUID
	locationID      uuid.UUID
	containerID     *uuid.UUID
	quantity        int
	condition       Condition
	status          Status
	dateAcquired    *time.Time
	purchasePrice   *int // cents
	currencyCode    *string
	warrantyExpires *time.Time
	expirationDate  *time.Time
	notes           *string
	isArchived      bool
	createdAt       time.Time
	updatedAt       time.Time
}

func NewInventory(
	workspaceID, itemID, locationID uuid.UUID,
	containerID *uuid.UUID,
	quantity int,
	condition Condition,
	status Status,
	currencyCode *string,
) (*Inventory, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(itemID, "item_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(locationID, "location_id"); err != nil {
		return nil, err
	}
	if quantity <= 0 {
		return nil, ErrInsufficientQuantity
	}
	if !condition.IsValid() {
		return nil, ErrInvalidCondition
	}
	if !status.IsValid() {
		return nil, ErrInvalidStatus
	}

	now := time.Now()
	return &Inventory{
		id:           shared.NewUUID(),
		workspaceID:  workspaceID,
		itemID:       itemID,
		locationID:   locationID,
		containerID:  containerID,
		quantity:     quantity,
		condition:    condition,
		status:       status,
		currencyCode: currencyCode,
		isArchived:   false,
		createdAt:    now,
		updatedAt:    now,
	}, nil
}

func Reconstruct(
	id, workspaceID, itemID, locationID uuid.UUID,
	containerID *uuid.UUID,
	quantity int,
	condition Condition,
	status Status,
	dateAcquired *time.Time,
	purchasePrice *int,
	currencyCode *string,
	warrantyExpires, expirationDate *time.Time,
	notes *string,
	isArchived bool,
	createdAt, updatedAt time.Time,
) *Inventory {
	return &Inventory{
		id:              id,
		workspaceID:     workspaceID,
		itemID:          itemID,
		locationID:      locationID,
		containerID:     containerID,
		quantity:        quantity,
		condition:       condition,
		status:          status,
		dateAcquired:    dateAcquired,
		purchasePrice:   purchasePrice,
		currencyCode:    currencyCode,
		warrantyExpires: warrantyExpires,
		expirationDate:  expirationDate,
		notes:           notes,
		isArchived:      isArchived,
		createdAt:       createdAt,
		updatedAt:       updatedAt,
	}
}

// Getters
func (inv *Inventory) ID() uuid.UUID             { return inv.id }
func (inv *Inventory) WorkspaceID() uuid.UUID    { return inv.workspaceID }
func (inv *Inventory) ItemID() uuid.UUID         { return inv.itemID }
func (inv *Inventory) LocationID() uuid.UUID     { return inv.locationID }
func (inv *Inventory) ContainerID() *uuid.UUID   { return inv.containerID }
func (inv *Inventory) Quantity() int             { return inv.quantity }
func (inv *Inventory) Condition() Condition      { return inv.condition }
func (inv *Inventory) Status() Status            { return inv.status }
func (inv *Inventory) DateAcquired() *time.Time  { return inv.dateAcquired }
func (inv *Inventory) PurchasePrice() *int       { return inv.purchasePrice }
func (inv *Inventory) CurrencyCode() *string     { return inv.currencyCode }
func (inv *Inventory) WarrantyExpires() *time.Time { return inv.warrantyExpires }
func (inv *Inventory) ExpirationDate() *time.Time  { return inv.expirationDate }
func (inv *Inventory) Notes() *string            { return inv.notes }
func (inv *Inventory) IsArchived() bool          { return inv.isArchived }
func (inv *Inventory) CreatedAt() time.Time      { return inv.createdAt }
func (inv *Inventory) UpdatedAt() time.Time      { return inv.updatedAt }

type UpdateInput struct {
	LocationID      uuid.UUID
	ContainerID     *uuid.UUID
	Quantity        int
	Condition       Condition
	DateAcquired    *time.Time
	PurchasePrice   *int
	CurrencyCode    *string
	WarrantyExpires *time.Time
	ExpirationDate  *time.Time
	Notes           *string
}

func (inv *Inventory) Update(input UpdateInput) error {
	if err := shared.ValidateUUID(input.LocationID, "location_id"); err != nil {
		return err
	}
	if input.Quantity <= 0 {
		return ErrInsufficientQuantity
	}
	if !input.Condition.IsValid() {
		return ErrInvalidCondition
	}

	inv.locationID = input.LocationID
	inv.containerID = input.ContainerID
	inv.quantity = input.Quantity
	inv.condition = input.Condition
	inv.dateAcquired = input.DateAcquired
	inv.purchasePrice = input.PurchasePrice
	inv.currencyCode = input.CurrencyCode
	inv.warrantyExpires = input.WarrantyExpires
	inv.expirationDate = input.ExpirationDate
	inv.notes = input.Notes
	inv.updatedAt = time.Now()
	return nil
}

func (inv *Inventory) UpdateStatus(status Status) error {
	if !status.IsValid() {
		return ErrInvalidStatus
	}
	inv.status = status
	inv.updatedAt = time.Now()
	return nil
}

func (inv *Inventory) UpdateQuantity(quantity int) error {
	if quantity < 0 {
		return ErrInsufficientQuantity
	}
	inv.quantity = quantity
	inv.updatedAt = time.Now()
	return nil
}

func (inv *Inventory) Move(locationID uuid.UUID, containerID *uuid.UUID) error {
	if err := shared.ValidateUUID(locationID, "location_id"); err != nil {
		return err
	}
	inv.locationID = locationID
	inv.containerID = containerID
	inv.updatedAt = time.Now()
	return nil
}

func (inv *Inventory) Archive() {
	inv.isArchived = true
	inv.updatedAt = time.Now()
}

func (inv *Inventory) Restore() {
	inv.isArchived = false
	inv.updatedAt = time.Now()
}
