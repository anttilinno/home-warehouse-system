package movement

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, movement *InventoryMovement) error {
	args := m.Called(ctx, movement)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*InventoryMovement, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*InventoryMovement), args.Error(1)
}

func (m *MockRepository) FindByInventory(ctx context.Context, inventoryID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error) {
	args := m.Called(ctx, inventoryID, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*InventoryMovement), args.Error(1)
}

func (m *MockRepository) FindByLocation(ctx context.Context, locationID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error) {
	args := m.Called(ctx, locationID, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*InventoryMovement), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*InventoryMovement), args.Error(1)
}

// Helper functions
func ptrString(s string) *string {
	return &s
}

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewInventoryMovement(t *testing.T) {
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	fromLocationID := uuid.New()
	fromContainerID := uuid.New()
	toLocationID := uuid.New()
	toContainerID := uuid.New()
	movedBy := uuid.New()

	tests := []struct {
		testName        string
		workspaceID     uuid.UUID
		inventoryID     uuid.UUID
		fromLocationID  *uuid.UUID
		fromContainerID *uuid.UUID
		toLocationID    *uuid.UUID
		toContainerID   *uuid.UUID
		quantity        int
		movedBy         *uuid.UUID
		reason          *string
		expectError     bool
		errorType       error
	}{
		{
			testName:        "valid movement with all fields",
			workspaceID:     workspaceID,
			inventoryID:     inventoryID,
			fromLocationID:  &fromLocationID,
			fromContainerID: &fromContainerID,
			toLocationID:    &toLocationID,
			toContainerID:   &toContainerID,
			quantity:        5,
			movedBy:         &movedBy,
			reason:          ptrString("Reorganization"),
			expectError:     false,
		},
		{
			testName:        "valid movement - location to location",
			workspaceID:     workspaceID,
			inventoryID:     inventoryID,
			fromLocationID:  &fromLocationID,
			fromContainerID: nil,
			toLocationID:    &toLocationID,
			toContainerID:   nil,
			quantity:        10,
			movedBy:         nil,
			reason:          nil,
			expectError:     false,
		},
		{
			testName:        "valid movement - into container",
			workspaceID:     workspaceID,
			inventoryID:     inventoryID,
			fromLocationID:  &fromLocationID,
			fromContainerID: nil,
			toLocationID:    &toLocationID,
			toContainerID:   &toContainerID,
			quantity:        1,
			movedBy:         &movedBy,
			reason:          ptrString("Placing in storage box"),
			expectError:     false,
		},
		{
			testName:        "valid movement - out of container",
			workspaceID:     workspaceID,
			inventoryID:     inventoryID,
			fromLocationID:  &fromLocationID,
			fromContainerID: &fromContainerID,
			toLocationID:    &toLocationID,
			toContainerID:   nil,
			quantity:        3,
			movedBy:         nil,
			reason:          nil,
			expectError:     false,
		},
		{
			testName:        "valid movement - new inventory (no from location)",
			workspaceID:     workspaceID,
			inventoryID:     inventoryID,
			fromLocationID:  nil,
			fromContainerID: nil,
			toLocationID:    &toLocationID,
			toContainerID:   nil,
			quantity:        100,
			movedBy:         &movedBy,
			reason:          ptrString("Initial stock"),
			expectError:     false,
		},
		{
			testName:        "invalid workspace ID",
			workspaceID:     uuid.Nil,
			inventoryID:     inventoryID,
			fromLocationID:  &fromLocationID,
			fromContainerID: nil,
			toLocationID:    &toLocationID,
			toContainerID:   nil,
			quantity:        5,
			movedBy:         nil,
			reason:          nil,
			expectError:     true,
		},
		{
			testName:        "invalid inventory ID",
			workspaceID:     workspaceID,
			inventoryID:     uuid.Nil,
			fromLocationID:  &fromLocationID,
			fromContainerID: nil,
			toLocationID:    &toLocationID,
			toContainerID:   nil,
			quantity:        5,
			movedBy:         nil,
			reason:          nil,
			expectError:     true,
		},
		{
			testName:        "zero quantity",
			workspaceID:     workspaceID,
			inventoryID:     inventoryID,
			fromLocationID:  &fromLocationID,
			fromContainerID: nil,
			toLocationID:    &toLocationID,
			toContainerID:   nil,
			quantity:        0,
			movedBy:         nil,
			reason:          nil,
			expectError:     true,
			errorType:       ErrInvalidQuantity,
		},
		{
			testName:        "negative quantity",
			workspaceID:     workspaceID,
			inventoryID:     inventoryID,
			fromLocationID:  &fromLocationID,
			fromContainerID: nil,
			toLocationID:    &toLocationID,
			toContainerID:   nil,
			quantity:        -5,
			movedBy:         nil,
			reason:          nil,
			expectError:     true,
			errorType:       ErrInvalidQuantity,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			movement, err := NewInventoryMovement(
				tt.workspaceID,
				tt.inventoryID,
				tt.fromLocationID,
				tt.fromContainerID,
				tt.toLocationID,
				tt.toContainerID,
				tt.quantity,
				tt.movedBy,
				tt.reason,
			)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, movement)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, movement)
				assert.NotEqual(t, uuid.Nil, movement.ID())
				assert.Equal(t, tt.workspaceID, movement.WorkspaceID())
				assert.Equal(t, tt.inventoryID, movement.InventoryID())
				assert.Equal(t, tt.fromLocationID, movement.FromLocationID())
				assert.Equal(t, tt.fromContainerID, movement.FromContainerID())
				assert.Equal(t, tt.toLocationID, movement.ToLocationID())
				assert.Equal(t, tt.toContainerID, movement.ToContainerID())
				assert.Equal(t, tt.quantity, movement.Quantity())
				assert.Equal(t, tt.movedBy, movement.MovedBy())
				assert.Equal(t, tt.reason, movement.Reason())
				assert.False(t, movement.CreatedAt().IsZero())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	fromLocationID := uuid.New()
	fromContainerID := uuid.New()
	toLocationID := uuid.New()
	toContainerID := uuid.New()
	movedBy := uuid.New()
	now := time.Now()

	movement := Reconstruct(
		id,
		workspaceID,
		inventoryID,
		&fromLocationID,
		&fromContainerID,
		&toLocationID,
		&toContainerID,
		25,
		&movedBy,
		ptrString("Test reason"),
		now,
	)

	assert.Equal(t, id, movement.ID())
	assert.Equal(t, workspaceID, movement.WorkspaceID())
	assert.Equal(t, inventoryID, movement.InventoryID())
	assert.Equal(t, fromLocationID, *movement.FromLocationID())
	assert.Equal(t, fromContainerID, *movement.FromContainerID())
	assert.Equal(t, toLocationID, *movement.ToLocationID())
	assert.Equal(t, toContainerID, *movement.ToContainerID())
	assert.Equal(t, 25, movement.Quantity())
	assert.Equal(t, movedBy, *movement.MovedBy())
	assert.Equal(t, "Test reason", *movement.Reason())
	assert.Equal(t, now, movement.CreatedAt())
}

func TestReconstruct_MinimalFields(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	toLocationID := uuid.New()
	now := time.Now()

	movement := Reconstruct(
		id,
		workspaceID,
		inventoryID,
		nil, // no from location
		nil, // no from container
		&toLocationID,
		nil, // no to container
		1,
		nil, // no moved by
		nil, // no reason
		now,
	)

	assert.Equal(t, id, movement.ID())
	assert.Nil(t, movement.FromLocationID())
	assert.Nil(t, movement.FromContainerID())
	assert.Equal(t, toLocationID, *movement.ToLocationID())
	assert.Nil(t, movement.ToContainerID())
	assert.Nil(t, movement.MovedBy())
	assert.Nil(t, movement.Reason())
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_RecordMovement(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()
	fromLocationID := uuid.New()
	toLocationID := uuid.New()
	movedBy := uuid.New()

	tests := []struct {
		testName    string
		input       RecordMovementInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful record movement",
			input: RecordMovementInput{
				WorkspaceID:    workspaceID,
				InventoryID:    inventoryID,
				FromLocationID: &fromLocationID,
				ToLocationID:   &toLocationID,
				Quantity:       5,
				MovedBy:        &movedBy,
				Reason:         ptrString("Reorganization"),
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*movement.InventoryMovement")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful record movement - minimal fields",
			input: RecordMovementInput{
				WorkspaceID:  workspaceID,
				InventoryID:  inventoryID,
				ToLocationID: &toLocationID,
				Quantity:     1,
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*movement.InventoryMovement")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "invalid workspace ID",
			input: RecordMovementInput{
				WorkspaceID:  uuid.Nil,
				InventoryID:  inventoryID,
				ToLocationID: &toLocationID,
				Quantity:     5,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
		},
		{
			testName: "invalid inventory ID",
			input: RecordMovementInput{
				WorkspaceID:  workspaceID,
				InventoryID:  uuid.Nil,
				ToLocationID: &toLocationID,
				Quantity:     5,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
		},
		{
			testName: "zero quantity",
			input: RecordMovementInput{
				WorkspaceID:  workspaceID,
				InventoryID:  inventoryID,
				ToLocationID: &toLocationID,
				Quantity:     0,
			},
			setupMock:   func(m *MockRepository) {},
			expectError: true,
			errorType:   ErrInvalidQuantity,
		},
		{
			testName: "save returns error",
			input: RecordMovementInput{
				WorkspaceID:  workspaceID,
				InventoryID:  inventoryID,
				ToLocationID: &toLocationID,
				Quantity:     5,
			},
			setupMock: func(m *MockRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*movement.InventoryMovement")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			movement, err := svc.RecordMovement(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, movement)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, movement)
				assert.Equal(t, tt.input.WorkspaceID, movement.WorkspaceID())
				assert.Equal(t, tt.input.InventoryID, movement.InventoryID())
				assert.Equal(t, tt.input.FromLocationID, movement.FromLocationID())
				assert.Equal(t, tt.input.ToLocationID, movement.ToLocationID())
				assert.Equal(t, tt.input.Quantity, movement.Quantity())
				assert.Equal(t, tt.input.MovedBy, movement.MovedBy())
				assert.Equal(t, tt.input.Reason, movement.Reason())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByInventory(t *testing.T) {
	ctx := context.Background()
	inventoryID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName:   "list with results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				movements := []*InventoryMovement{
					{id: uuid.New(), workspaceID: workspaceID, inventoryID: inventoryID, quantity: 5},
					{id: uuid.New(), workspaceID: workspaceID, inventoryID: inventoryID, quantity: 3},
				}
				m.On("FindByInventory", ctx, inventoryID, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(movements, nil)
			},
			expectLen:   2,
			expectError: false,
		},
		{
			testName:   "empty results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByInventory", ctx, inventoryID, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return([]*InventoryMovement{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName:   "repository returns error",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByInventory", ctx, inventoryID, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, errors.New("database error"))
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

			movements, err := svc.ListByInventory(ctx, inventoryID, workspaceID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, movements)
			} else {
				assert.NoError(t, err)
				assert.Len(t, movements, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByLocation(t *testing.T) {
	ctx := context.Background()
	locationID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName:   "list with results",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				movements := []*InventoryMovement{
					{id: uuid.New(), workspaceID: workspaceID, quantity: 10},
					{id: uuid.New(), workspaceID: workspaceID, quantity: 20},
					{id: uuid.New(), workspaceID: workspaceID, quantity: 15},
				}
				m.On("FindByLocation", ctx, locationID, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(movements, nil)
			},
			expectLen:   3,
			expectError: false,
		},
		{
			testName:   "repository returns error",
			pagination: shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByLocation", ctx, locationID, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, errors.New("database error"))
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

			movements, err := svc.ListByLocation(ctx, locationID, workspaceID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, movements)
			} else {
				assert.NoError(t, err)
				assert.Len(t, movements, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName:   "list with results",
			pagination: shared.Pagination{Page: 1, PageSize: 20},
			setupMock: func(m *MockRepository) {
				movements := []*InventoryMovement{
					{id: uuid.New(), workspaceID: workspaceID, quantity: 5},
					{id: uuid.New(), workspaceID: workspaceID, quantity: 10},
					{id: uuid.New(), workspaceID: workspaceID, quantity: 15},
					{id: uuid.New(), workspaceID: workspaceID, quantity: 20},
				}
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 20}).Return(movements, nil)
			},
			expectLen:   4,
			expectError: false,
		},
		{
			testName:   "empty workspace",
			pagination: shared.Pagination{Page: 1, PageSize: 20},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 20}).Return([]*InventoryMovement{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName:   "repository returns error",
			pagination: shared.Pagination{Page: 1, PageSize: 20},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 20}).Return(nil, errors.New("database error"))
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

			movements, err := svc.ListByWorkspace(ctx, workspaceID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, movements)
			} else {
				assert.NoError(t, err)
				assert.Len(t, movements, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
