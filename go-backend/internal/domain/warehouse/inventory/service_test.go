package inventory

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, inventory *Inventory) error {
	args := m.Called(ctx, inventory)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Inventory, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Inventory), args.Error(1)
}

func (m *MockRepository) FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*Inventory, error) {
	args := m.Called(ctx, workspaceID, itemID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Inventory), args.Error(1)
}

func (m *MockRepository) FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*Inventory, error) {
	args := m.Called(ctx, workspaceID, locationID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Inventory), args.Error(1)
}

func (m *MockRepository) FindByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*Inventory, error) {
	args := m.Called(ctx, workspaceID, containerID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Inventory), args.Error(1)
}

func (m *MockRepository) FindAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*Inventory, error) {
	args := m.Called(ctx, workspaceID, itemID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Inventory), args.Error(1)
}

func (m *MockRepository) GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Int(0), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// Helper functions
func ptrString(s string) *string {
	return &s
}

func ptrInt(i int) *int {
	return &i
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

// =============================================================================
// Entity Tests - Condition and Status validation
// =============================================================================

func TestCondition_IsValid(t *testing.T) {
	tests := []struct {
		testName  string
		condition Condition
		expected  bool
	}{
		{"NEW is valid", ConditionNew, true},
		{"EXCELLENT is valid", ConditionExcellent, true},
		{"GOOD is valid", ConditionGood, true},
		{"FAIR is valid", ConditionFair, true},
		{"POOR is valid", ConditionPoor, true},
		{"DAMAGED is valid", ConditionDamaged, true},
		{"FOR_REPAIR is valid", ConditionForRepair, true},
		{"empty string is invalid", Condition(""), false},
		{"random string is invalid", Condition("RANDOM"), false},
		{"lowercase is invalid", Condition("new"), false},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.condition.IsValid())
		})
	}
}

func TestStatus_IsValid(t *testing.T) {
	tests := []struct {
		testName string
		status   Status
		expected bool
	}{
		{"AVAILABLE is valid", StatusAvailable, true},
		{"IN_USE is valid", StatusInUse, true},
		{"RESERVED is valid", StatusReserved, true},
		{"ON_LOAN is valid", StatusOnLoan, true},
		{"IN_TRANSIT is valid", StatusInTransit, true},
		{"DISPOSED is valid", StatusDisposed, true},
		{"MISSING is valid", StatusMissing, true},
		{"empty string is invalid", Status(""), false},
		{"random string is invalid", Status("RANDOM"), false},
		{"lowercase is invalid", Status("available"), false},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.status.IsValid())
		})
	}
}

// =============================================================================
// Entity Tests - NewInventory
// =============================================================================

func TestNewInventory(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	containerID := uuid.New()

	tests := []struct {
		testName     string
		workspaceID  uuid.UUID
		itemID       uuid.UUID
		locationID   uuid.UUID
		containerID  *uuid.UUID
		quantity     int
		condition    Condition
		status       Status
		currencyCode *string
		expectError  bool
		errorType    error
		errorField   string
	}{
		{
			testName:    "valid inventory with all fields",
			workspaceID: workspaceID,
			itemID:      itemID,
			locationID:  locationID,
			containerID: &containerID,
			quantity:    10,
			condition:   ConditionNew,
			status:      StatusAvailable,
			expectError: false,
		},
		{
			testName:     "valid inventory with currency",
			workspaceID:  workspaceID,
			itemID:       itemID,
			locationID:   locationID,
			containerID:  nil,
			quantity:     5,
			condition:    ConditionGood,
			status:       StatusInUse,
			currencyCode: ptrString("EUR"),
			expectError:  false,
		},
		{
			testName:    "valid inventory without container",
			workspaceID: workspaceID,
			itemID:      itemID,
			locationID:  locationID,
			containerID: nil,
			quantity:    1,
			condition:   ConditionExcellent,
			status:      StatusReserved,
			expectError: false,
		},
		{
			testName:    "invalid workspace ID",
			workspaceID: uuid.Nil,
			itemID:      itemID,
			locationID:  locationID,
			containerID: nil,
			quantity:    10,
			condition:   ConditionNew,
			status:      StatusAvailable,
			expectError: true,
			errorField:  "workspace_id",
		},
		{
			testName:    "invalid item ID",
			workspaceID: workspaceID,
			itemID:      uuid.Nil,
			locationID:  locationID,
			containerID: nil,
			quantity:    10,
			condition:   ConditionNew,
			status:      StatusAvailable,
			expectError: true,
			errorField:  "item_id",
		},
		{
			testName:    "invalid location ID",
			workspaceID: workspaceID,
			itemID:      itemID,
			locationID:  uuid.Nil,
			containerID: nil,
			quantity:    10,
			condition:   ConditionNew,
			status:      StatusAvailable,
			expectError: true,
			errorField:  "location_id",
		},
		{
			testName:    "zero quantity",
			workspaceID: workspaceID,
			itemID:      itemID,
			locationID:  locationID,
			containerID: nil,
			quantity:    0,
			condition:   ConditionNew,
			status:      StatusAvailable,
			expectError: true,
			errorType:   ErrInsufficientQuantity,
		},
		{
			testName:    "negative quantity",
			workspaceID: workspaceID,
			itemID:      itemID,
			locationID:  locationID,
			containerID: nil,
			quantity:    -5,
			condition:   ConditionNew,
			status:      StatusAvailable,
			expectError: true,
			errorType:   ErrInsufficientQuantity,
		},
		{
			testName:    "invalid condition",
			workspaceID: workspaceID,
			itemID:      itemID,
			locationID:  locationID,
			containerID: nil,
			quantity:    10,
			condition:   Condition("INVALID"),
			status:      StatusAvailable,
			expectError: true,
			errorType:   ErrInvalidCondition,
		},
		{
			testName:    "invalid status",
			workspaceID: workspaceID,
			itemID:      itemID,
			locationID:  locationID,
			containerID: nil,
			quantity:    10,
			condition:   ConditionNew,
			status:      Status("INVALID"),
			expectError: true,
			errorType:   ErrInvalidStatus,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			inv, err := NewInventory(
				tt.workspaceID,
				tt.itemID,
				tt.locationID,
				tt.containerID,
				tt.quantity,
				tt.condition,
				tt.status,
				tt.currencyCode,
			)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, inv)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, inv)
				assert.NotEqual(t, uuid.Nil, inv.ID())
				assert.Equal(t, tt.workspaceID, inv.WorkspaceID())
				assert.Equal(t, tt.itemID, inv.ItemID())
				assert.Equal(t, tt.locationID, inv.LocationID())
				assert.Equal(t, tt.containerID, inv.ContainerID())
				assert.Equal(t, tt.quantity, inv.Quantity())
				assert.Equal(t, tt.condition, inv.Condition())
				assert.Equal(t, tt.status, inv.Status())
				assert.Equal(t, tt.currencyCode, inv.CurrencyCode())
				assert.False(t, inv.IsArchived())
				assert.False(t, inv.CreatedAt().IsZero())
				assert.False(t, inv.UpdatedAt().IsZero())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	containerID := uuid.New()
	now := time.Now()
	dateAcquired := now.AddDate(-1, 0, 0)
	warrantyExpires := now.AddDate(2, 0, 0)
	expirationDate := now.AddDate(3, 0, 0)

	inv := Reconstruct(
		id,
		workspaceID,
		itemID,
		locationID,
		&containerID,
		25,
		ConditionGood,
		StatusAvailable,
		&dateAcquired,
		ptrInt(9999), // $99.99 in cents
		ptrString("USD"),
		&warrantyExpires,
		&expirationDate,
		ptrString("Test notes"),
		false,
		now,
		now,
	)

	assert.Equal(t, id, inv.ID())
	assert.Equal(t, workspaceID, inv.WorkspaceID())
	assert.Equal(t, itemID, inv.ItemID())
	assert.Equal(t, locationID, inv.LocationID())
	assert.Equal(t, containerID, *inv.ContainerID())
	assert.Equal(t, 25, inv.Quantity())
	assert.Equal(t, ConditionGood, inv.Condition())
	assert.Equal(t, StatusAvailable, inv.Status())
	assert.Equal(t, dateAcquired, *inv.DateAcquired())
	assert.Equal(t, 9999, *inv.PurchasePrice())
	assert.Equal(t, "USD", *inv.CurrencyCode())
	assert.Equal(t, warrantyExpires, *inv.WarrantyExpires())
	assert.Equal(t, expirationDate, *inv.ExpirationDate())
	assert.Equal(t, "Test notes", *inv.Notes())
	assert.False(t, inv.IsArchived())
	assert.Equal(t, now, inv.CreatedAt())
	assert.Equal(t, now, inv.UpdatedAt())
}

func TestReconstruct_MinimalFields(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	inv := Reconstruct(
		id,
		workspaceID,
		itemID,
		locationID,
		nil, // no container
		1,
		ConditionNew,
		StatusAvailable,
		nil, nil, nil, nil, nil, nil,
		false,
		now,
		now,
	)

	assert.Equal(t, id, inv.ID())
	assert.Nil(t, inv.ContainerID())
	assert.Nil(t, inv.DateAcquired())
	assert.Nil(t, inv.PurchasePrice())
	assert.Nil(t, inv.CurrencyCode())
	assert.Nil(t, inv.WarrantyExpires())
	assert.Nil(t, inv.ExpirationDate())
	assert.Nil(t, inv.Notes())
}

// =============================================================================
// Entity Tests - Update methods
// =============================================================================

func TestInventory_Update(t *testing.T) {
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	newLocationID := uuid.New()
	containerID := uuid.New()
	dateAcquired := time.Now().AddDate(-1, 0, 0)

	tests := []struct {
		testName    string
		input       UpdateInput
		expectError bool
		errorType   error
	}{
		{
			testName: "update all fields",
			input: UpdateInput{
				LocationID:      newLocationID,
				ContainerID:     &containerID,
				Quantity:        50,
				Condition:       ConditionExcellent,
				DateAcquired:    &dateAcquired,
				PurchasePrice:   ptrInt(19999),
				CurrencyCode:    ptrString("EUR"),
				WarrantyExpires: ptrTime(time.Now().AddDate(2, 0, 0)),
				ExpirationDate:  ptrTime(time.Now().AddDate(5, 0, 0)),
				Notes:           ptrString("Updated notes"),
			},
			expectError: false,
		},
		{
			testName: "update with minimal fields",
			input: UpdateInput{
				LocationID: newLocationID,
				Quantity:   1,
				Condition:  ConditionGood,
			},
			expectError: false,
		},
		{
			testName: "invalid location ID",
			input: UpdateInput{
				LocationID: uuid.Nil,
				Quantity:   10,
				Condition:  ConditionGood,
			},
			expectError: true,
		},
		{
			testName: "zero quantity",
			input: UpdateInput{
				LocationID: newLocationID,
				Quantity:   0,
				Condition:  ConditionGood,
			},
			expectError: true,
			errorType:   ErrInsufficientQuantity,
		},
		{
			testName: "negative quantity",
			input: UpdateInput{
				LocationID: newLocationID,
				Quantity:   -10,
				Condition:  ConditionGood,
			},
			expectError: true,
			errorType:   ErrInsufficientQuantity,
		},
		{
			testName: "invalid condition",
			input: UpdateInput{
				LocationID: newLocationID,
				Quantity:   10,
				Condition:  Condition("INVALID"),
			},
			expectError: true,
			errorType:   ErrInvalidCondition,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			inv, _ := NewInventory(workspaceID, itemID, locationID, nil, 10, ConditionNew, StatusAvailable, nil)
			originalUpdatedAt := inv.UpdatedAt()
			time.Sleep(time.Millisecond)

			err := inv.Update(tt.input)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.input.LocationID, inv.LocationID())
				assert.Equal(t, tt.input.ContainerID, inv.ContainerID())
				assert.Equal(t, tt.input.Quantity, inv.Quantity())
				assert.Equal(t, tt.input.Condition, inv.Condition())
				assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestInventory_UpdateStatus(t *testing.T) {
	tests := []struct {
		testName    string
		newStatus   Status
		expectError bool
		errorType   error
	}{
		{"update to AVAILABLE", StatusAvailable, false, nil},
		{"update to IN_USE", StatusInUse, false, nil},
		{"update to RESERVED", StatusReserved, false, nil},
		{"update to ON_LOAN", StatusOnLoan, false, nil},
		{"update to IN_TRANSIT", StatusInTransit, false, nil},
		{"update to DISPOSED", StatusDisposed, false, nil},
		{"update to MISSING", StatusMissing, false, nil},
		{"invalid status", Status("INVALID"), true, ErrInvalidStatus},
		{"empty status", Status(""), true, ErrInvalidStatus},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			inv, _ := NewInventory(uuid.New(), uuid.New(), uuid.New(), nil, 10, ConditionNew, StatusAvailable, nil)
			originalUpdatedAt := inv.UpdatedAt()
			time.Sleep(time.Millisecond)

			err := inv.UpdateStatus(tt.newStatus)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, tt.errorType, err)
				assert.Equal(t, StatusAvailable, inv.Status()) // Should not change
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.newStatus, inv.Status())
				assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestInventory_UpdateQuantity(t *testing.T) {
	tests := []struct {
		testName    string
		newQuantity int
		expectError bool
		errorType   error
	}{
		{"update to positive quantity", 100, false, nil},
		{"update to 1", 1, false, nil},
		{"update to zero (allowed for UpdateQuantity)", 0, false, nil},
		{"negative quantity", -1, true, ErrInsufficientQuantity},
		{"large negative quantity", -100, true, ErrInsufficientQuantity},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			inv, _ := NewInventory(uuid.New(), uuid.New(), uuid.New(), nil, 10, ConditionNew, StatusAvailable, nil)
			originalUpdatedAt := inv.UpdatedAt()
			time.Sleep(time.Millisecond)

			err := inv.UpdateQuantity(tt.newQuantity)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, tt.errorType, err)
				assert.Equal(t, 10, inv.Quantity()) // Should not change
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.newQuantity, inv.Quantity())
				assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestInventory_Move(t *testing.T) {
	newLocationID := uuid.New()
	newContainerID := uuid.New()

	tests := []struct {
		testName      string
		newLocationID uuid.UUID
		newContainer  *uuid.UUID
		expectError   bool
	}{
		{"move to new location", newLocationID, nil, false},
		{"move to new location with container", newLocationID, &newContainerID, false},
		{"move to nil location", uuid.Nil, nil, true},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			inv, _ := NewInventory(uuid.New(), uuid.New(), uuid.New(), nil, 10, ConditionNew, StatusAvailable, nil)
			originalUpdatedAt := inv.UpdatedAt()
			time.Sleep(time.Millisecond)

			err := inv.Move(tt.newLocationID, tt.newContainer)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.newLocationID, inv.LocationID())
				assert.Equal(t, tt.newContainer, inv.ContainerID())
				assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestInventory_Archive(t *testing.T) {
	inv, _ := NewInventory(uuid.New(), uuid.New(), uuid.New(), nil, 10, ConditionNew, StatusAvailable, nil)
	assert.False(t, inv.IsArchived())
	originalUpdatedAt := inv.UpdatedAt()
	time.Sleep(time.Millisecond)

	inv.Archive()

	assert.True(t, inv.IsArchived())
	assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
}

func TestInventory_Restore(t *testing.T) {
	inv, _ := NewInventory(uuid.New(), uuid.New(), uuid.New(), nil, 10, ConditionNew, StatusAvailable, nil)
	inv.Archive()
	assert.True(t, inv.IsArchived())
	originalUpdatedAt := inv.UpdatedAt()
	time.Sleep(time.Millisecond)

	inv.Restore()

	assert.False(t, inv.IsArchived())
	assert.True(t, inv.UpdatedAt().After(originalUpdatedAt))
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	containerID := uuid.New()

	tests := []struct {
		testName    string
		input       CreateInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful creation with all fields",
			input: CreateInput{
				WorkspaceID:     workspaceID,
				ItemID:          itemID,
				LocationID:      locationID,
				ContainerID:     &containerID,
				Quantity:        10,
				Condition:       ConditionNew,
				Status:          StatusAvailable,
				DateAcquired:    ptrTime(time.Now()),
				PurchasePrice:   ptrInt(9999),
				CurrencyCode:    ptrString("USD"),
				WarrantyExpires: ptrTime(time.Now().AddDate(2, 0, 0)),
				Notes:           ptrString("Test notes"),
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful creation with minimal fields",
			input: CreateInput{
				WorkspaceID: workspaceID,
				ItemID:      itemID,
				LocationID:  locationID,
				Quantity:    1,
				Condition:   ConditionGood,
				Status:      StatusInUse,
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "invalid workspace ID",
			input: CreateInput{
				WorkspaceID: uuid.Nil,
				ItemID:      itemID,
				LocationID:  locationID,
				Quantity:    10,
				Condition:   ConditionNew,
				Status:      StatusAvailable,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
		},
		{
			testName: "invalid item ID",
			input: CreateInput{
				WorkspaceID: workspaceID,
				ItemID:      uuid.Nil,
				LocationID:  locationID,
				Quantity:    10,
				Condition:   ConditionNew,
				Status:      StatusAvailable,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
		},
		{
			testName: "invalid location ID",
			input: CreateInput{
				WorkspaceID: workspaceID,
				ItemID:      itemID,
				LocationID:  uuid.Nil,
				Quantity:    10,
				Condition:   ConditionNew,
				Status:      StatusAvailable,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
		},
		{
			testName: "zero quantity",
			input: CreateInput{
				WorkspaceID: workspaceID,
				ItemID:      itemID,
				LocationID:  locationID,
				Quantity:    0,
				Condition:   ConditionNew,
				Status:      StatusAvailable,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
			errorType:   ErrInsufficientQuantity,
		},
		{
			testName: "invalid condition",
			input: CreateInput{
				WorkspaceID: workspaceID,
				ItemID:      itemID,
				LocationID:  locationID,
				Quantity:    10,
				Condition:   Condition("INVALID"),
				Status:      StatusAvailable,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
			errorType:   ErrInvalidCondition,
		},
		{
			testName: "invalid status",
			input: CreateInput{
				WorkspaceID: workspaceID,
				ItemID:      itemID,
				LocationID:  locationID,
				Quantity:    10,
				Condition:   ConditionNew,
				Status:      Status("INVALID"),
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
			errorType:   ErrInvalidStatus,
		},
		{
			testName: "save returns error",
			input: CreateInput{
				WorkspaceID: workspaceID,
				ItemID:      itemID,
				LocationID:  locationID,
				Quantity:    10,
				Condition:   ConditionNew,
				Status:      StatusAvailable,
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			inv, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, inv)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, inv)
				assert.Equal(t, tt.input.WorkspaceID, inv.WorkspaceID())
				assert.Equal(t, tt.input.ItemID, inv.ItemID())
				assert.Equal(t, tt.input.LocationID, inv.LocationID())
				assert.Equal(t, tt.input.Quantity, inv.Quantity())
				assert.Equal(t, tt.input.Condition, inv.Condition())
				assert.Equal(t, tt.input.Status, inv.Status())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	invID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		invID       uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "inventory found",
			invID:       invID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				inv := &Inventory{id: invID, workspaceID: workspaceID, quantity: 10}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
			},
			expectError: false,
		},
		{
			testName:    "inventory not found - returns nil",
			invID:       invID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, invID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInventoryNotFound,
		},
		{
			testName:    "repository returns error",
			invID:       invID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, invID, workspaceID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			inv, err := svc.GetByID(ctx, tt.invID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, inv)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, inv)
				assert.Equal(t, tt.invID, inv.ID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	invID := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	newLocationID := uuid.New()

	tests := []struct {
		testName    string
		invID       uuid.UUID
		workspaceID uuid.UUID
		input       UpdateInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "successful update",
			invID:       invID,
			workspaceID: workspaceID,
			input: UpdateInput{
				LocationID: newLocationID,
				Quantity:   20,
				Condition:  ConditionGood,
			},
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					itemID:      itemID,
					locationID:  locationID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "inventory not found",
			invID:       uuid.New(),
			workspaceID: workspaceID,
			input: UpdateInput{
				LocationID: newLocationID,
				Quantity:   20,
				Condition:  ConditionGood,
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInventoryNotFound,
		},
		{
			testName:    "invalid update input",
			invID:       invID,
			workspaceID: workspaceID,
			input: UpdateInput{
				LocationID: uuid.Nil,
				Quantity:   20,
				Condition:  ConditionGood,
			},
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					itemID:      itemID,
					locationID:  locationID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
			},
			expectError: true,
		},
		{
			testName:    "save returns error",
			invID:       invID,
			workspaceID: workspaceID,
			input: UpdateInput{
				LocationID: newLocationID,
				Quantity:   20,
				Condition:  ConditionGood,
			},
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					itemID:      itemID,
					locationID:  locationID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			inv, err := svc.Update(ctx, tt.invID, tt.workspaceID, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, inv)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, inv)
				assert.Equal(t, tt.input.LocationID, inv.LocationID())
				assert.Equal(t, tt.input.Quantity, inv.Quantity())
				assert.Equal(t, tt.input.Condition, inv.Condition())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_UpdateStatus(t *testing.T) {
	ctx := context.Background()
	invID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		newStatus   Status
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:  "successful status update",
			newStatus: StatusOnLoan,
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:  "inventory not found",
			newStatus: StatusOnLoan,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, invID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInventoryNotFound,
		},
		{
			testName:  "invalid status",
			newStatus: Status("INVALID"),
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
			},
			expectError: true,
			errorType:   ErrInvalidStatus,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			inv, err := svc.UpdateStatus(ctx, invID, workspaceID, tt.newStatus)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, inv)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, inv)
				assert.Equal(t, tt.newStatus, inv.Status())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_UpdateQuantity(t *testing.T) {
	ctx := context.Background()
	invID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		newQuantity int
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "successful quantity update",
			newQuantity: 50,
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "update to zero",
			newQuantity: 0,
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "inventory not found",
			newQuantity: 50,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, invID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInventoryNotFound,
		},
		{
			testName:    "negative quantity",
			newQuantity: -10,
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
			},
			expectError: true,
			errorType:   ErrInsufficientQuantity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			inv, err := svc.UpdateQuantity(ctx, invID, workspaceID, tt.newQuantity)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, inv)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, inv)
				assert.Equal(t, tt.newQuantity, inv.Quantity())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Move(t *testing.T) {
	ctx := context.Background()
	invID := uuid.New()
	workspaceID := uuid.New()
	newLocationID := uuid.New()
	newContainerID := uuid.New()

	tests := []struct {
		testName       string
		newLocationID  uuid.UUID
		newContainerID *uuid.UUID
		setupMock      func(*MockRepository)
		expectError    bool
		errorType      error
	}{
		{
			testName:       "successful move",
			newLocationID:  newLocationID,
			newContainerID: &newContainerID,
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					locationID:  uuid.New(),
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:       "move without container",
			newLocationID:  newLocationID,
			newContainerID: nil,
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					locationID:  uuid.New(),
					containerID: &newContainerID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:       "inventory not found",
			newLocationID:  newLocationID,
			newContainerID: nil,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, invID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInventoryNotFound,
		},
		{
			testName:       "invalid location ID",
			newLocationID:  uuid.Nil,
			newContainerID: nil,
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					locationID:  uuid.New(),
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			inv, err := svc.Move(ctx, invID, workspaceID, tt.newLocationID, tt.newContainerID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, inv)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, inv)
				assert.Equal(t, tt.newLocationID, inv.LocationID())
				assert.Equal(t, tt.newContainerID, inv.ContainerID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Archive(t *testing.T) {
	ctx := context.Background()
	invID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful archive",
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
					isArchived:  false,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "inventory not found",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, invID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInventoryNotFound,
		},
		{
			testName: "save returns error",
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
					isArchived:  false,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Archive(ctx, invID, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Restore(t *testing.T) {
	ctx := context.Background()
	invID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful restore",
			setupMock: func(m *MockRepository) {
				inv := &Inventory{
					id:          invID,
					workspaceID: workspaceID,
					quantity:    10,
					condition:   ConditionNew,
					status:      StatusAvailable,
					isArchived:  true,
				}
				m.On("FindByID", ctx, invID, workspaceID).Return(inv, nil)
				m.On("Save", ctx, mock.AnythingOfType("*inventory.Inventory")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "inventory not found",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, invID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInventoryNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Restore(ctx, invID, workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByItem(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "list with results",
			setupMock: func(m *MockRepository) {
				invs := []*Inventory{
					{id: uuid.New(), workspaceID: workspaceID, itemID: itemID, quantity: 10},
					{id: uuid.New(), workspaceID: workspaceID, itemID: itemID, quantity: 5},
				}
				m.On("FindByItem", ctx, workspaceID, itemID).Return(invs, nil)
			},
			expectLen:   2,
			expectError: false,
		},
		{
			testName: "empty results",
			setupMock: func(m *MockRepository) {
				m.On("FindByItem", ctx, workspaceID, itemID).Return([]*Inventory{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindByItem", ctx, workspaceID, itemID).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			invs, err := svc.ListByItem(ctx, workspaceID, itemID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, invs)
			} else {
				assert.NoError(t, err)
				assert.Len(t, invs, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByLocation(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locationID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "list with results",
			setupMock: func(m *MockRepository) {
				invs := []*Inventory{
					{id: uuid.New(), workspaceID: workspaceID, locationID: locationID, quantity: 10},
					{id: uuid.New(), workspaceID: workspaceID, locationID: locationID, quantity: 5},
					{id: uuid.New(), workspaceID: workspaceID, locationID: locationID, quantity: 3},
				}
				m.On("FindByLocation", ctx, workspaceID, locationID).Return(invs, nil)
			},
			expectLen:   3,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindByLocation", ctx, workspaceID, locationID).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			invs, err := svc.ListByLocation(ctx, workspaceID, locationID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, invs)
			} else {
				assert.NoError(t, err)
				assert.Len(t, invs, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByContainer(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	containerID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "list with results",
			setupMock: func(m *MockRepository) {
				invs := []*Inventory{
					{id: uuid.New(), workspaceID: workspaceID, containerID: &containerID, quantity: 10},
				}
				m.On("FindByContainer", ctx, workspaceID, containerID).Return(invs, nil)
			},
			expectLen:   1,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindByContainer", ctx, workspaceID, containerID).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			invs, err := svc.ListByContainer(ctx, workspaceID, containerID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, invs)
			} else {
				assert.NoError(t, err)
				assert.Len(t, invs, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetAvailable(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()

	tests := []struct {
		testName    string
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "available items found",
			setupMock: func(m *MockRepository) {
				invs := []*Inventory{
					{id: uuid.New(), workspaceID: workspaceID, itemID: itemID, status: StatusAvailable, quantity: 10},
					{id: uuid.New(), workspaceID: workspaceID, itemID: itemID, status: StatusAvailable, quantity: 5},
				}
				m.On("FindAvailable", ctx, workspaceID, itemID).Return(invs, nil)
			},
			expectLen:   2,
			expectError: false,
		},
		{
			testName: "no available items",
			setupMock: func(m *MockRepository) {
				m.On("FindAvailable", ctx, workspaceID, itemID).Return([]*Inventory{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("FindAvailable", ctx, workspaceID, itemID).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			invs, err := svc.GetAvailable(ctx, workspaceID, itemID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, invs)
			} else {
				assert.NoError(t, err)
				assert.Len(t, invs, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetTotalQuantity(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()

	tests := []struct {
		testName      string
		setupMock     func(*MockRepository)
		expectedTotal int
		expectError   bool
	}{
		{
			testName: "total quantity found",
			setupMock: func(m *MockRepository) {
				m.On("GetTotalQuantity", ctx, workspaceID, itemID).Return(150, nil)
			},
			expectedTotal: 150,
			expectError:   false,
		},
		{
			testName: "zero quantity",
			setupMock: func(m *MockRepository) {
				m.On("GetTotalQuantity", ctx, workspaceID, itemID).Return(0, nil)
			},
			expectedTotal: 0,
			expectError:   false,
		},
		{
			testName: "repository returns error",
			setupMock: func(m *MockRepository) {
				m.On("GetTotalQuantity", ctx, workspaceID, itemID).Return(0, errors.New("database error"))
			},
			expectedTotal: 0,
			expectError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			total, err := svc.GetTotalQuantity(ctx, workspaceID, itemID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedTotal, total)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
