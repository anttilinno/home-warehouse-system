package inventory_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
)

func TestNewInventory(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	containerID := uuid.New()
	currencyCode := "USD"

	tests := []struct {
		name         string
		workspaceID  uuid.UUID
		itemID       uuid.UUID
		locationID   uuid.UUID
		containerID  *uuid.UUID
		quantity     int
		condition    inventory.Condition
		status       inventory.Status
		currencyCode *string
		wantErr      bool
		errMsg       string
	}{
		{
			name:         "valid inventory with all required fields",
			workspaceID:  workspaceID,
			itemID:       itemID,
			locationID:   locationID,
			containerID:  nil,
			quantity:     5,
			condition:    inventory.ConditionNew,
			status:       inventory.StatusAvailable,
			currencyCode: &currencyCode,
			wantErr:      false,
		},
		{
			name:         "valid inventory with container",
			workspaceID:  workspaceID,
			itemID:       itemID,
			locationID:   locationID,
			containerID:  &containerID,
			quantity:     10,
			condition:    inventory.ConditionGood,
			status:       inventory.StatusInUse,
			currencyCode: nil,
			wantErr:      false,
		},
		{
			name:         "nil workspace ID",
			workspaceID:  uuid.Nil,
			itemID:       itemID,
			locationID:   locationID,
			containerID:  nil,
			quantity:     5,
			condition:    inventory.ConditionNew,
			status:       inventory.StatusAvailable,
			currencyCode: nil,
			wantErr:      true,
			errMsg:       "workspace_id",
		},
		{
			name:         "nil item ID",
			workspaceID:  workspaceID,
			itemID:       uuid.Nil,
			locationID:   locationID,
			containerID:  nil,
			quantity:     5,
			condition:    inventory.ConditionNew,
			status:       inventory.StatusAvailable,
			currencyCode: nil,
			wantErr:      true,
			errMsg:       "item_id",
		},
		{
			name:         "nil location ID",
			workspaceID:  workspaceID,
			itemID:       itemID,
			locationID:   uuid.Nil,
			containerID:  nil,
			quantity:     5,
			condition:    inventory.ConditionNew,
			status:       inventory.StatusAvailable,
			currencyCode: nil,
			wantErr:      true,
			errMsg:       "location_id",
		},
		{
			name:         "zero quantity",
			workspaceID:  workspaceID,
			itemID:       itemID,
			locationID:   locationID,
			containerID:  nil,
			quantity:     0,
			condition:    inventory.ConditionNew,
			status:       inventory.StatusAvailable,
			currencyCode: nil,
			wantErr:      true,
			errMsg:       "quantity must be greater than zero",
		},
		{
			name:         "negative quantity",
			workspaceID:  workspaceID,
			itemID:       itemID,
			locationID:   locationID,
			containerID:  nil,
			quantity:     -5,
			condition:    inventory.ConditionNew,
			status:       inventory.StatusAvailable,
			currencyCode: nil,
			wantErr:      true,
			errMsg:       "quantity must be greater than zero",
		},
		{
			name:         "invalid condition",
			workspaceID:  workspaceID,
			itemID:       itemID,
			locationID:   locationID,
			containerID:  nil,
			quantity:     5,
			condition:    inventory.Condition("INVALID"),
			status:       inventory.StatusAvailable,
			currencyCode: nil,
			wantErr:      true,
			errMsg:       "invalid condition",
		},
		{
			name:         "invalid status",
			workspaceID:  workspaceID,
			itemID:       itemID,
			locationID:   locationID,
			containerID:  nil,
			quantity:     5,
			condition:    inventory.ConditionNew,
			status:       inventory.Status("INVALID"),
			currencyCode: nil,
			wantErr:      true,
			errMsg:       "invalid status",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv, err := inventory.NewInventory(
				tt.workspaceID,
				tt.itemID,
				tt.locationID,
				tt.containerID,
				tt.quantity,
				tt.condition,
				tt.status,
				tt.currencyCode,
			)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, inv)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, inv)
				assert.Equal(t, tt.workspaceID, inv.WorkspaceID())
				assert.Equal(t, tt.itemID, inv.ItemID())
				assert.Equal(t, tt.locationID, inv.LocationID())
				assert.Equal(t, tt.containerID, inv.ContainerID())
				assert.Equal(t, tt.quantity, inv.Quantity())
				assert.Equal(t, tt.condition, inv.Condition())
				assert.Equal(t, tt.status, inv.Status())
				assert.Equal(t, tt.currencyCode, inv.CurrencyCode())
				assert.NotEqual(t, uuid.Nil, inv.ID())
				assert.False(t, inv.IsArchived())
				assert.NotZero(t, inv.CreatedAt())
				assert.NotZero(t, inv.UpdatedAt())
			}
		})
	}
}

func TestConditionIsValid(t *testing.T) {
	tests := []struct {
		name      string
		condition inventory.Condition
		want      bool
	}{
		{"NEW is valid", inventory.ConditionNew, true},
		{"EXCELLENT is valid", inventory.ConditionExcellent, true},
		{"GOOD is valid", inventory.ConditionGood, true},
		{"FAIR is valid", inventory.ConditionFair, true},
		{"POOR is valid", inventory.ConditionPoor, true},
		{"DAMAGED is valid", inventory.ConditionDamaged, true},
		{"FOR_REPAIR is valid", inventory.ConditionForRepair, true},
		{"invalid string is invalid", inventory.Condition("INVALID"), false},
		{"empty string is invalid", inventory.Condition(""), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.condition.IsValid())
		})
	}
}

func TestStatusIsValid(t *testing.T) {
	tests := []struct {
		name   string
		status inventory.Status
		want   bool
	}{
		{"AVAILABLE is valid", inventory.StatusAvailable, true},
		{"IN_USE is valid", inventory.StatusInUse, true},
		{"RESERVED is valid", inventory.StatusReserved, true},
		{"ON_LOAN is valid", inventory.StatusOnLoan, true},
		{"IN_TRANSIT is valid", inventory.StatusInTransit, true},
		{"DISPOSED is valid", inventory.StatusDisposed, true},
		{"MISSING is valid", inventory.StatusMissing, true},
		{"invalid string is invalid", inventory.Status("INVALID"), false},
		{"empty string is invalid", inventory.Status(""), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.status.IsValid())
		})
	}
}

func TestInventory_Update(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	newLocationID := uuid.New()
	containerID := uuid.New()
	currencyCode := "USD"
	now := time.Now()
	notes := "Test notes"
	price := 10000 // $100.00

	tests := []struct {
		name    string
		input   inventory.UpdateInput
		wantErr bool
		errMsg  string
	}{
		{
			name: "update location",
			input: inventory.UpdateInput{
				LocationID:  newLocationID,
				ContainerID: nil,
				Quantity:    5,
				Condition:   inventory.ConditionGood,
			},
			wantErr: false,
		},
		{
			name: "update with container",
			input: inventory.UpdateInput{
				LocationID:  newLocationID,
				ContainerID: &containerID,
				Quantity:    10,
				Condition:   inventory.ConditionExcellent,
			},
			wantErr: false,
		},
		{
			name: "update with optional fields",
			input: inventory.UpdateInput{
				LocationID:      newLocationID,
				ContainerID:     &containerID,
				Quantity:        15,
				Condition:       inventory.ConditionFair,
				DateAcquired:    &now,
				PurchasePrice:   &price,
				CurrencyCode:    &currencyCode,
				WarrantyExpires: &now,
				ExpirationDate:  &now,
				Notes:           &notes,
			},
			wantErr: false,
		},
		{
			name: "update quantity",
			input: inventory.UpdateInput{
				LocationID: newLocationID,
				Quantity:   20,
				Condition:  inventory.ConditionNew,
			},
			wantErr: false,
		},
		{
			name: "nil location ID",
			input: inventory.UpdateInput{
				LocationID: uuid.Nil,
				Quantity:   5,
				Condition:  inventory.ConditionGood,
			},
			wantErr: true,
			errMsg:  "location_id",
		},
		{
			name: "zero quantity",
			input: inventory.UpdateInput{
				LocationID: newLocationID,
				Quantity:   0,
				Condition:  inventory.ConditionGood,
			},
			wantErr: true,
			errMsg:  "quantity must be greater than zero",
		},
		{
			name: "negative quantity",
			input: inventory.UpdateInput{
				LocationID: newLocationID,
				Quantity:   -5,
				Condition:  inventory.ConditionGood,
			},
			wantErr: true,
			errMsg:  "quantity must be greater than zero",
		},
		{
			name: "invalid condition",
			input: inventory.UpdateInput{
				LocationID: newLocationID,
				Quantity:   5,
				Condition:  inventory.Condition("INVALID"),
			},
			wantErr: true,
			errMsg:  "invalid condition",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh inventory for each test
			inv, _ := inventory.NewInventory(
				workspaceID,
				itemID,
				locationID,
				nil,
				5,
				inventory.ConditionNew,
				inventory.StatusAvailable,
				nil,
			)
			originalUpdatedAt := inv.UpdatedAt()
			time.Sleep(time.Millisecond) // Ensure time difference

			err := inv.Update(tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.input.LocationID, inv.LocationID())
				assert.Equal(t, tt.input.ContainerID, inv.ContainerID())
				assert.Equal(t, tt.input.Quantity, inv.Quantity())
				assert.Equal(t, tt.input.Condition, inv.Condition())
				if tt.input.DateAcquired != nil {
					assert.Equal(t, tt.input.DateAcquired, inv.DateAcquired())
				}
				if tt.input.PurchasePrice != nil {
					assert.Equal(t, tt.input.PurchasePrice, inv.PurchasePrice())
				}
				if tt.input.CurrencyCode != nil {
					assert.Equal(t, tt.input.CurrencyCode, inv.CurrencyCode())
				}
				if tt.input.Notes != nil {
					assert.Equal(t, tt.input.Notes, inv.Notes())
				}
				assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestInventory_UpdateStatus(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	tests := []struct {
		name    string
		status  inventory.Status
		wantErr bool
		errMsg  string
	}{
		{
			name:    "update to AVAILABLE",
			status:  inventory.StatusAvailable,
			wantErr: false,
		},
		{
			name:    "update to IN_USE",
			status:  inventory.StatusInUse,
			wantErr: false,
		},
		{
			name:    "update to RESERVED",
			status:  inventory.StatusReserved,
			wantErr: false,
		},
		{
			name:    "update to ON_LOAN",
			status:  inventory.StatusOnLoan,
			wantErr: false,
		},
		{
			name:    "update to IN_TRANSIT",
			status:  inventory.StatusInTransit,
			wantErr: false,
		},
		{
			name:    "update to DISPOSED",
			status:  inventory.StatusDisposed,
			wantErr: false,
		},
		{
			name:    "update to MISSING",
			status:  inventory.StatusMissing,
			wantErr: false,
		},
		{
			name:    "invalid status",
			status:  inventory.Status("INVALID"),
			wantErr: true,
			errMsg:  "invalid status",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv, _ := inventory.NewInventory(
				workspaceID,
				itemID,
				locationID,
				nil,
				5,
				inventory.ConditionNew,
				inventory.StatusAvailable,
				nil,
			)
			originalUpdatedAt := inv.UpdatedAt()
			time.Sleep(time.Millisecond)

			err := inv.UpdateStatus(tt.status)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.status, inv.Status())
				assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestInventory_UpdateQuantity(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	tests := []struct {
		name     string
		quantity int
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "update to positive quantity",
			quantity: 10,
			wantErr:  false,
		},
		{
			name:     "update to zero (allowed for quantity)",
			quantity: 0,
			wantErr:  false,
		},
		{
			name:     "negative quantity",
			quantity: -5,
			wantErr:  true,
			errMsg:   "quantity must be greater than zero",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv, _ := inventory.NewInventory(
				workspaceID,
				itemID,
				locationID,
				nil,
				5,
				inventory.ConditionNew,
				inventory.StatusAvailable,
				nil,
			)
			originalUpdatedAt := inv.UpdatedAt()
			time.Sleep(time.Millisecond)

			err := inv.UpdateQuantity(tt.quantity)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.quantity, inv.Quantity())
				assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestInventory_Move(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	newLocationID := uuid.New()
	containerID := uuid.New()

	tests := []struct {
		name        string
		newLocation uuid.UUID
		newContainer *uuid.UUID
		wantErr     bool
		errMsg      string
	}{
		{
			name:         "move to new location without container",
			newLocation:  newLocationID,
			newContainer: nil,
			wantErr:      false,
		},
		{
			name:         "move to new location with container",
			newLocation:  newLocationID,
			newContainer: &containerID,
			wantErr:      false,
		},
		{
			name:         "nil location ID",
			newLocation:  uuid.Nil,
			newContainer: nil,
			wantErr:      true,
			errMsg:       "location_id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv, _ := inventory.NewInventory(
				workspaceID,
				itemID,
				locationID,
				nil,
				5,
				inventory.ConditionNew,
				inventory.StatusAvailable,
				nil,
			)
			originalUpdatedAt := inv.UpdatedAt()
			time.Sleep(time.Millisecond)

			err := inv.Move(tt.newLocation, tt.newContainer)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.newLocation, inv.LocationID())
				assert.Equal(t, tt.newContainer, inv.ContainerID())
				assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestInventory_Archive(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	inv, err := inventory.NewInventory(
		workspaceID,
		itemID,
		locationID,
		nil,
		5,
		inventory.ConditionNew,
		inventory.StatusAvailable,
		nil,
	)
	assert.NoError(t, err)

	// Initially not archived
	assert.False(t, inv.IsArchived())

	originalUpdatedAt := inv.UpdatedAt()
	time.Sleep(time.Millisecond)
	inv.Archive()

	assert.True(t, inv.IsArchived())
	assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
}

func TestInventory_Restore(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	inv, err := inventory.NewInventory(
		workspaceID,
		itemID,
		locationID,
		nil,
		5,
		inventory.ConditionNew,
		inventory.StatusAvailable,
		nil,
	)
	assert.NoError(t, err)

	// Archive first
	inv.Archive()
	assert.True(t, inv.IsArchived())

	originalUpdatedAt := inv.UpdatedAt()
	time.Sleep(time.Millisecond)
	inv.Restore()

	assert.False(t, inv.IsArchived())
	assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
}

func TestInventory_Getters(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	containerID := uuid.New()
	currencyCode := "USD"
	now := time.Now()
	notes := "Test notes"
	price := 10000

	inv, err := inventory.NewInventory(
		workspaceID,
		itemID,
		locationID,
		&containerID,
		10,
		inventory.ConditionExcellent,
		inventory.StatusInUse,
		&currencyCode,
	)
	assert.NoError(t, err)

	// Update with optional fields
	err = inv.Update(inventory.UpdateInput{
		LocationID:      locationID,
		ContainerID:     &containerID,
		Quantity:        15,
		Condition:       inventory.ConditionGood,
		DateAcquired:    &now,
		PurchasePrice:   &price,
		CurrencyCode:    &currencyCode,
		WarrantyExpires: &now,
		ExpirationDate:  &now,
		Notes:           &notes,
	})
	assert.NoError(t, err)

	// Test all getters
	assert.NotEqual(t, uuid.Nil, inv.ID())
	assert.Equal(t, workspaceID, inv.WorkspaceID())
	assert.Equal(t, itemID, inv.ItemID())
	assert.Equal(t, locationID, inv.LocationID())
	assert.Equal(t, &containerID, inv.ContainerID())
	assert.Equal(t, 15, inv.Quantity())
	assert.Equal(t, inventory.ConditionGood, inv.Condition())
	assert.Equal(t, inventory.StatusInUse, inv.Status())
	assert.Equal(t, &now, inv.DateAcquired())
	assert.Equal(t, &price, inv.PurchasePrice())
	assert.Equal(t, &currencyCode, inv.CurrencyCode())
	assert.Equal(t, &now, inv.WarrantyExpires())
	assert.Equal(t, &now, inv.ExpirationDate())
	assert.Equal(t, &notes, inv.Notes())
	assert.False(t, inv.IsArchived())
	assert.NotZero(t, inv.CreatedAt())
	assert.NotZero(t, inv.UpdatedAt())
}

func TestInventory_Reconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	containerID := uuid.New()
	currencyCode := "EUR"
	now := time.Now()
	notes := "Reconstructed notes"
	price := 20000

	reconstructed := inventory.Reconstruct(
		id,
		workspaceID,
		itemID,
		locationID,
		&containerID,
		25,
		inventory.ConditionFair,
		inventory.StatusReserved,
		&now,
		&price,
		&currencyCode,
		&now,
		&now,
		&notes,
		true,
		now,
		now,
	)

	assert.NotNil(t, reconstructed)
	assert.Equal(t, id, reconstructed.ID())
	assert.Equal(t, workspaceID, reconstructed.WorkspaceID())
	assert.Equal(t, itemID, reconstructed.ItemID())
	assert.Equal(t, locationID, reconstructed.LocationID())
	assert.Equal(t, &containerID, reconstructed.ContainerID())
	assert.Equal(t, 25, reconstructed.Quantity())
	assert.Equal(t, inventory.ConditionFair, reconstructed.Condition())
	assert.Equal(t, inventory.StatusReserved, reconstructed.Status())
	assert.Equal(t, &now, reconstructed.DateAcquired())
	assert.Equal(t, &price, reconstructed.PurchasePrice())
	assert.Equal(t, &currencyCode, reconstructed.CurrencyCode())
	assert.Equal(t, &now, reconstructed.WarrantyExpires())
	assert.Equal(t, &now, reconstructed.ExpirationDate())
	assert.Equal(t, &notes, reconstructed.Notes())
	assert.True(t, reconstructed.IsArchived())
	assert.Equal(t, now, reconstructed.CreatedAt())
	assert.Equal(t, now, reconstructed.UpdatedAt())
}
