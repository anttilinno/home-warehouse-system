package movement

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type InventoryMovement struct {
	id              uuid.UUID
	workspaceID     uuid.UUID
	inventoryID     uuid.UUID
	fromLocationID  *uuid.UUID
	fromContainerID *uuid.UUID
	toLocationID    *uuid.UUID
	toContainerID   *uuid.UUID
	quantity        int
	movedBy         *uuid.UUID
	reason          *string
	createdAt       time.Time
}

func NewInventoryMovement(
	workspaceID, inventoryID uuid.UUID,
	fromLocationID, fromContainerID, toLocationID, toContainerID *uuid.UUID,
	quantity int,
	movedBy *uuid.UUID,
	reason *string,
) (*InventoryMovement, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(inventoryID, "inventory_id"); err != nil {
		return nil, err
	}
	if quantity <= 0 {
		return nil, ErrInvalidQuantity
	}

	return &InventoryMovement{
		id:              shared.NewUUID(),
		workspaceID:     workspaceID,
		inventoryID:     inventoryID,
		fromLocationID:  fromLocationID,
		fromContainerID: fromContainerID,
		toLocationID:    toLocationID,
		toContainerID:   toContainerID,
		quantity:        quantity,
		movedBy:         movedBy,
		reason:          reason,
		createdAt:       time.Now(),
	}, nil
}

func Reconstruct(
	id, workspaceID, inventoryID uuid.UUID,
	fromLocationID, fromContainerID, toLocationID, toContainerID *uuid.UUID,
	quantity int,
	movedBy *uuid.UUID,
	reason *string,
	createdAt time.Time,
) *InventoryMovement {
	return &InventoryMovement{
		id:              id,
		workspaceID:     workspaceID,
		inventoryID:     inventoryID,
		fromLocationID:  fromLocationID,
		fromContainerID: fromContainerID,
		toLocationID:    toLocationID,
		toContainerID:   toContainerID,
		quantity:        quantity,
		movedBy:         movedBy,
		reason:          reason,
		createdAt:       createdAt,
	}
}

// Getters
func (m *InventoryMovement) ID() uuid.UUID              { return m.id }
func (m *InventoryMovement) WorkspaceID() uuid.UUID     { return m.workspaceID }
func (m *InventoryMovement) InventoryID() uuid.UUID     { return m.inventoryID }
func (m *InventoryMovement) FromLocationID() *uuid.UUID { return m.fromLocationID }
func (m *InventoryMovement) FromContainerID() *uuid.UUID { return m.fromContainerID }
func (m *InventoryMovement) ToLocationID() *uuid.UUID   { return m.toLocationID }
func (m *InventoryMovement) ToContainerID() *uuid.UUID  { return m.toContainerID }
func (m *InventoryMovement) Quantity() int              { return m.quantity }
func (m *InventoryMovement) MovedBy() *uuid.UUID        { return m.movedBy }
func (m *InventoryMovement) Reason() *string            { return m.reason }
func (m *InventoryMovement) CreatedAt() time.Time       { return m.createdAt }
