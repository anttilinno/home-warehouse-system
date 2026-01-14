package events

import (
	"github.com/google/uuid"
)

// ItemCreatedEvent is published when an item is created.
type ItemCreatedEvent struct {
	BaseEvent
	ItemID     uuid.UUID
	ItemName   string
	SKU        string
	CategoryID *uuid.UUID
	CreatedBy  *uuid.UUID
}

// EventName returns the event name.
func (e ItemCreatedEvent) EventName() string {
	return "item.created"
}

// NewItemCreatedEvent creates a new ItemCreatedEvent.
func NewItemCreatedEvent(workspaceID, itemID uuid.UUID, itemName, sku string, categoryID, createdBy *uuid.UUID) ItemCreatedEvent {
	return ItemCreatedEvent{
		BaseEvent:  NewBaseEvent(workspaceID),
		ItemID:     itemID,
		ItemName:   itemName,
		SKU:        sku,
		CategoryID: categoryID,
		CreatedBy:  createdBy,
	}
}

// ItemUpdatedEvent is published when an item is updated.
type ItemUpdatedEvent struct {
	BaseEvent
	ItemID     uuid.UUID
	ItemName   string
	Changes    map[string]interface{}
	UpdatedBy  *uuid.UUID
}

// EventName returns the event name.
func (e ItemUpdatedEvent) EventName() string {
	return "item.updated"
}

// NewItemUpdatedEvent creates a new ItemUpdatedEvent.
func NewItemUpdatedEvent(workspaceID, itemID uuid.UUID, itemName string, changes map[string]interface{}, updatedBy *uuid.UUID) ItemUpdatedEvent {
	return ItemUpdatedEvent{
		BaseEvent: NewBaseEvent(workspaceID),
		ItemID:    itemID,
		ItemName:  itemName,
		Changes:   changes,
		UpdatedBy: updatedBy,
	}
}

// ItemArchivedEvent is published when an item is archived.
type ItemArchivedEvent struct {
	BaseEvent
	ItemID     uuid.UUID
	ItemName   string
	ArchivedBy *uuid.UUID
}

// EventName returns the event name.
func (e ItemArchivedEvent) EventName() string {
	return "item.archived"
}

// NewItemArchivedEvent creates a new ItemArchivedEvent.
func NewItemArchivedEvent(workspaceID, itemID uuid.UUID, itemName string, archivedBy *uuid.UUID) ItemArchivedEvent {
	return ItemArchivedEvent{
		BaseEvent:  NewBaseEvent(workspaceID),
		ItemID:     itemID,
		ItemName:   itemName,
		ArchivedBy: archivedBy,
	}
}

// ItemRestoredEvent is published when an item is restored from archive.
type ItemRestoredEvent struct {
	BaseEvent
	ItemID     uuid.UUID
	ItemName   string
	RestoredBy *uuid.UUID
}

// EventName returns the event name.
func (e ItemRestoredEvent) EventName() string {
	return "item.restored"
}

// NewItemRestoredEvent creates a new ItemRestoredEvent.
func NewItemRestoredEvent(workspaceID, itemID uuid.UUID, itemName string, restoredBy *uuid.UUID) ItemRestoredEvent {
	return ItemRestoredEvent{
		BaseEvent:  NewBaseEvent(workspaceID),
		ItemID:     itemID,
		ItemName:   itemName,
		RestoredBy: restoredBy,
	}
}

// InventoryCreatedEvent is published when inventory is created.
type InventoryCreatedEvent struct {
	BaseEvent
	InventoryID uuid.UUID
	ItemID      uuid.UUID
	ItemName    string
	Quantity    int
	LocationID  *uuid.UUID
	CreatedBy   *uuid.UUID
}

// EventName returns the event name.
func (e InventoryCreatedEvent) EventName() string {
	return "inventory.created"
}

// NewInventoryCreatedEvent creates a new InventoryCreatedEvent.
func NewInventoryCreatedEvent(workspaceID, inventoryID, itemID uuid.UUID, itemName string, quantity int, locationID, createdBy *uuid.UUID) InventoryCreatedEvent {
	return InventoryCreatedEvent{
		BaseEvent:   NewBaseEvent(workspaceID),
		InventoryID: inventoryID,
		ItemID:      itemID,
		ItemName:    itemName,
		Quantity:    quantity,
		LocationID:  locationID,
		CreatedBy:   createdBy,
	}
}

// InventoryMovedEvent is published when inventory is moved.
type InventoryMovedEvent struct {
	BaseEvent
	InventoryID uuid.UUID
	ItemName    string
	FromLocation *uuid.UUID
	ToLocation   *uuid.UUID
	MovedBy      *uuid.UUID
}

// EventName returns the event name.
func (e InventoryMovedEvent) EventName() string {
	return "inventory.moved"
}

// NewInventoryMovedEvent creates a new InventoryMovedEvent.
func NewInventoryMovedEvent(workspaceID, inventoryID uuid.UUID, itemName string, fromLocation, toLocation, movedBy *uuid.UUID) InventoryMovedEvent {
	return InventoryMovedEvent{
		BaseEvent:    NewBaseEvent(workspaceID),
		InventoryID:  inventoryID,
		ItemName:     itemName,
		FromLocation: fromLocation,
		ToLocation:   toLocation,
		MovedBy:      movedBy,
	}
}

// LoanCreatedEvent is published when a loan is created.
type LoanCreatedEvent struct {
	BaseEvent
	LoanID      uuid.UUID
	InventoryID uuid.UUID
	ItemName    string
	BorrowerID  uuid.UUID
	DueDate     *string
	CreatedBy   *uuid.UUID
}

// EventName returns the event name.
func (e LoanCreatedEvent) EventName() string {
	return "loan.created"
}

// NewLoanCreatedEvent creates a new LoanCreatedEvent.
func NewLoanCreatedEvent(workspaceID, loanID, inventoryID uuid.UUID, itemName string, borrowerID uuid.UUID, dueDate *string, createdBy *uuid.UUID) LoanCreatedEvent {
	return LoanCreatedEvent{
		BaseEvent:   NewBaseEvent(workspaceID),
		LoanID:      loanID,
		InventoryID: inventoryID,
		ItemName:    itemName,
		BorrowerID:  borrowerID,
		DueDate:     dueDate,
		CreatedBy:   createdBy,
	}
}

// LoanReturnedEvent is published when a loan is returned.
type LoanReturnedEvent struct {
	BaseEvent
	LoanID     uuid.UUID
	ItemName   string
	BorrowerID uuid.UUID
	ReturnedBy *uuid.UUID
}

// EventName returns the event name.
func (e LoanReturnedEvent) EventName() string {
	return "loan.returned"
}

// NewLoanReturnedEvent creates a new LoanReturnedEvent.
func NewLoanReturnedEvent(workspaceID, loanID uuid.UUID, itemName string, borrowerID uuid.UUID, returnedBy *uuid.UUID) LoanReturnedEvent {
	return LoanReturnedEvent{
		BaseEvent:  NewBaseEvent(workspaceID),
		LoanID:     loanID,
		ItemName:   itemName,
		BorrowerID: borrowerID,
		ReturnedBy: returnedBy,
	}
}
