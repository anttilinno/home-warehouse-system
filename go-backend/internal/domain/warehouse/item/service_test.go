package item

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

func (m *MockRepository) Save(ctx context.Context, item *Item) error {
	args := m.Called(ctx, item)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Item), args.Error(1)
}

func (m *MockRepository) FindBySKU(ctx context.Context, workspaceID uuid.UUID, sku string) (*Item, error) {
	args := m.Called(ctx, workspaceID, sku)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Item), args.Error(1)
}

func (m *MockRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*Item, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Item), args.Error(1)
}

func (m *MockRepository) FindByBarcode(ctx context.Context, workspaceID uuid.UUID, barcode string) (*Item, error) {
	args := m.Called(ctx, workspaceID, barcode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Item), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Item, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*Item), args.Int(1), args.Error(2)
}

func (m *MockRepository) FindByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*Item, error) {
	args := m.Called(ctx, workspaceID, categoryID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Item), args.Error(1)
}

func (m *MockRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Item, error) {
	args := m.Called(ctx, workspaceID, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Item), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) SKUExists(ctx context.Context, workspaceID uuid.UUID, sku string) (bool, error) {
	args := m.Called(ctx, workspaceID, sku)
	return args.Bool(0), args.Error(1)
}

func (m *MockRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	return args.Bool(0), args.Error(1)
}

func (m *MockRepository) AttachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	args := m.Called(ctx, itemID, labelID)
	return args.Error(0)
}

func (m *MockRepository) DetachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	args := m.Called(ctx, itemID, labelID)
	return args.Error(0)
}

func (m *MockRepository) GetItemLabels(ctx context.Context, itemID uuid.UUID) ([]uuid.UUID, error) {
	args := m.Called(ctx, itemID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

// Helper functions
func ptrString(s string) *string {
	return &s
}

func ptrBool(b bool) *bool {
	return &b
}

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

func ptrInt(i int) *int {
	return &i
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewItem(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		testName      string
		workspaceID   uuid.UUID
		name          string
		sku           string
		minStockLevel int
		expectError   bool
		errorField    string
		errorType     error
	}{
		{
			testName:      "valid item with minimum fields",
			workspaceID:   workspaceID,
			name:          "Test Item",
			sku:           "SKU-001",
			minStockLevel: 5,
			expectError:   false,
		},
		{
			testName:      "valid item with zero min stock",
			workspaceID:   workspaceID,
			name:          "Another Item",
			sku:           "SKU-002",
			minStockLevel: 0,
			expectError:   false,
		},
		{
			testName:      "invalid workspace ID",
			workspaceID:   uuid.Nil,
			name:          "Test Item",
			sku:           "SKU-001",
			minStockLevel: 5,
			expectError:   true,
			errorField:    "workspace_id",
		},
		{
			testName:      "empty name",
			workspaceID:   workspaceID,
			name:          "",
			sku:           "SKU-001",
			minStockLevel: 5,
			expectError:   true,
			errorField:    "name",
		},
		{
			testName:      "empty SKU",
			workspaceID:   workspaceID,
			name:          "Test Item",
			sku:           "",
			minStockLevel: 5,
			expectError:   true,
			errorField:    "sku",
		},
		{
			testName:      "negative min stock level",
			workspaceID:   workspaceID,
			name:          "Test Item",
			sku:           "SKU-001",
			minStockLevel: -1,
			expectError:   true,
			errorType:     ErrInvalidMinStock,
		},
		{
			testName:      "large negative min stock level",
			workspaceID:   workspaceID,
			name:          "Test Item",
			sku:           "SKU-001",
			minStockLevel: -100,
			expectError:   true,
			errorType:     ErrInvalidMinStock,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			item, err := NewItem(tt.workspaceID, tt.name, tt.sku, tt.minStockLevel)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, item)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
				if tt.errorField != "" {
					if domainErr, ok := err.(*shared.DomainError); ok {
						assert.Equal(t, tt.errorField, domainErr.Field)
					}
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, item)
				assert.NotEqual(t, uuid.Nil, item.ID())
				assert.Equal(t, tt.workspaceID, item.WorkspaceID())
				assert.Equal(t, tt.name, item.Name())
				assert.Equal(t, tt.sku, item.SKU())
				assert.Equal(t, tt.minStockLevel, item.MinStockLevel())
				// Check defaults
				assert.NotNil(t, item.IsInsured())
				assert.False(t, *item.IsInsured())
				assert.NotNil(t, item.IsArchived())
				assert.False(t, *item.IsArchived())
				assert.NotNil(t, item.LifetimeWarranty())
				assert.False(t, *item.LifetimeWarranty())
				assert.Nil(t, item.Description())
				assert.Nil(t, item.CategoryID())
				assert.Nil(t, item.Brand())
				assert.False(t, item.CreatedAt().IsZero())
				assert.False(t, item.UpdatedAt().IsZero())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	categoryID := uuid.New()
	purchasedFrom := uuid.New()
	now := time.Now()

	item := Reconstruct(
		id,
		workspaceID,
		"SKU-001",
		"Test Item",
		ptrString("Description"),
		&categoryID,
		ptrString("BrandName"),
		ptrString("ModelX"),
		ptrString("https://example.com/image.jpg"),
		ptrString("SN-12345"),
		ptrString("ManufacturerCorp"),
		ptrString("1234567890123"),
		ptrBool(true),
		ptrBool(false),
		ptrBool(true),
		ptrString("2 year warranty"),
		&purchasedFrom,
		10,
		ptrString("SHORT1"),
		ptrString("/vault/path"),
		ptrString("/note/path"),
		now,
		now,
	)

	assert.Equal(t, id, item.ID())
	assert.Equal(t, workspaceID, item.WorkspaceID())
	assert.Equal(t, "SKU-001", item.SKU())
	assert.Equal(t, "Test Item", item.Name())
	assert.Equal(t, "Description", *item.Description())
	assert.Equal(t, categoryID, *item.CategoryID())
	assert.Equal(t, "BrandName", *item.Brand())
	assert.Equal(t, "ModelX", *item.Model())
	assert.Equal(t, "https://example.com/image.jpg", *item.ImageURL())
	assert.Equal(t, "SN-12345", *item.SerialNumber())
	assert.Equal(t, "ManufacturerCorp", *item.Manufacturer())
	assert.Equal(t, "1234567890123", *item.Barcode())
	assert.True(t, *item.IsInsured())
	assert.False(t, *item.IsArchived())
	assert.True(t, *item.LifetimeWarranty())
	assert.Equal(t, "2 year warranty", *item.WarrantyDetails())
	assert.Equal(t, purchasedFrom, *item.PurchasedFrom())
	assert.Equal(t, 10, item.MinStockLevel())
	assert.Equal(t, "SHORT1", *item.ShortCode())
	assert.Equal(t, "/vault/path", *item.ObsidianVaultPath())
	assert.Equal(t, "/note/path", *item.ObsidianNotePath())
	assert.Equal(t, now, item.CreatedAt())
	assert.Equal(t, now, item.UpdatedAt())
}

func TestReconstruct_MinimalFields(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()

	item := Reconstruct(
		id,
		workspaceID,
		"SKU-001",
		"Test Item",
		nil, nil, nil, nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil,
		0,
		nil, nil, nil,
		now,
		now,
	)

	assert.Equal(t, id, item.ID())
	assert.Equal(t, workspaceID, item.WorkspaceID())
	assert.Equal(t, "SKU-001", item.SKU())
	assert.Equal(t, "Test Item", item.Name())
	assert.Nil(t, item.Description())
	assert.Nil(t, item.CategoryID())
	assert.Nil(t, item.Brand())
	assert.Equal(t, 0, item.MinStockLevel())
}

func TestItem_Update(t *testing.T) {
	workspaceID := uuid.New()
	item, err := NewItem(workspaceID, "Original Name", "SKU-001", 5)
	assert.NoError(t, err)

	originalUpdatedAt := item.UpdatedAt()
	categoryID := uuid.New()
	purchasedFrom := uuid.New()

	tests := []struct {
		testName    string
		input       UpdateInput
		expectError bool
		errorType   error
	}{
		{
			testName: "update all fields",
			input: UpdateInput{
				Name:              "Updated Name",
				Description:       ptrString("Updated description"),
				CategoryID:        &categoryID,
				Brand:             ptrString("New Brand"),
				Model:             ptrString("New Model"),
				ImageURL:          ptrString("https://new-image.com/img.jpg"),
				SerialNumber:      ptrString("NEW-SN-123"),
				Manufacturer:      ptrString("New Manufacturer"),
				Barcode:           ptrString("9876543210987"),
				IsInsured:         ptrBool(true),
				LifetimeWarranty:  ptrBool(true),
				WarrantyDetails:   ptrString("Lifetime warranty"),
				PurchasedFrom:     &purchasedFrom,
				MinStockLevel:     20,
				ObsidianVaultPath: ptrString("/new/vault"),
				ObsidianNotePath:  ptrString("/new/note"),
			},
			expectError: false,
		},
		{
			testName: "empty name returns error",
			input: UpdateInput{
				Name:          "",
				MinStockLevel: 5,
			},
			expectError: true,
		},
		{
			testName: "negative min stock level returns error",
			input: UpdateInput{
				Name:          "Valid Name",
				MinStockLevel: -1,
			},
			expectError: true,
			errorType:   ErrInvalidMinStock,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			// Create fresh item for each test
			testItem, _ := NewItem(workspaceID, "Original Name", "SKU-001", 5)
			time.Sleep(time.Millisecond) // Ensure time difference

			err := testItem.Update(tt.input)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
				// Ensure fields weren't changed on error
				assert.Equal(t, "Original Name", testItem.Name())
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.input.Name, testItem.Name())
				assert.Equal(t, tt.input.Description, testItem.Description())
				assert.Equal(t, tt.input.CategoryID, testItem.CategoryID())
				assert.Equal(t, tt.input.Brand, testItem.Brand())
				assert.Equal(t, tt.input.Model, testItem.Model())
				assert.Equal(t, tt.input.ImageURL, testItem.ImageURL())
				assert.Equal(t, tt.input.SerialNumber, testItem.SerialNumber())
				assert.Equal(t, tt.input.Manufacturer, testItem.Manufacturer())
				assert.Equal(t, tt.input.Barcode, testItem.Barcode())
				assert.Equal(t, tt.input.IsInsured, testItem.IsInsured())
				assert.Equal(t, tt.input.LifetimeWarranty, testItem.LifetimeWarranty())
				assert.Equal(t, tt.input.WarrantyDetails, testItem.WarrantyDetails())
				assert.Equal(t, tt.input.PurchasedFrom, testItem.PurchasedFrom())
				assert.Equal(t, tt.input.MinStockLevel, testItem.MinStockLevel())
				assert.True(t, testItem.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestItem_SetSKU(t *testing.T) {
	item, err := NewItem(uuid.New(), "Test Item", "OLD-SKU", 5)
	assert.NoError(t, err)

	originalUpdatedAt := item.UpdatedAt()
	time.Sleep(time.Millisecond)

	item.SetSKU("NEW-SKU")

	assert.Equal(t, "NEW-SKU", item.SKU())
	assert.True(t, item.UpdatedAt().After(originalUpdatedAt))
}

func TestItem_SetShortCode(t *testing.T) {
	item, err := NewItem(uuid.New(), "Test Item", "SKU-001", 5)
	assert.NoError(t, err)

	assert.Nil(t, item.ShortCode())
	originalUpdatedAt := item.UpdatedAt()
	time.Sleep(time.Millisecond)

	item.SetShortCode("ABC123")

	assert.Equal(t, "ABC123", *item.ShortCode())
	assert.True(t, item.UpdatedAt().After(originalUpdatedAt))
}

func TestItem_Archive(t *testing.T) {
	item, err := NewItem(uuid.New(), "Test Item", "SKU-001", 5)
	assert.NoError(t, err)

	assert.False(t, *item.IsArchived())
	originalUpdatedAt := item.UpdatedAt()
	time.Sleep(time.Millisecond)

	item.Archive()

	assert.True(t, *item.IsArchived())
	assert.True(t, item.UpdatedAt().After(originalUpdatedAt))
}

func TestItem_Restore(t *testing.T) {
	item, err := NewItem(uuid.New(), "Test Item", "SKU-001", 5)
	assert.NoError(t, err)

	item.Archive()
	assert.True(t, *item.IsArchived())
	originalUpdatedAt := item.UpdatedAt()
	time.Sleep(time.Millisecond)

	item.Restore()

	assert.False(t, *item.IsArchived())
	assert.True(t, item.UpdatedAt().After(originalUpdatedAt))
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	tests := []struct {
		testName    string
		input       CreateInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful creation with minimal fields",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-001",
				Name:          "Test Item",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-001").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful creation with all fields",
			input: CreateInput{
				WorkspaceID:       workspaceID,
				SKU:               "SKU-002",
				Name:              "Full Item",
				Description:       ptrString("Full description"),
				CategoryID:        &categoryID,
				Brand:             ptrString("Test Brand"),
				Model:             ptrString("Model X"),
				ImageURL:          ptrString("https://example.com/image.jpg"),
				SerialNumber:      ptrString("SN-12345"),
				Manufacturer:      ptrString("Test Manufacturer"),
				Barcode:           ptrString("1234567890123"),
				IsInsured:         ptrBool(true),
				LifetimeWarranty:  ptrBool(false),
				WarrantyDetails:   ptrString("1 year warranty"),
				MinStockLevel:     10,
				ShortCode:         ptrString("SHORT1"),
				ObsidianVaultPath: ptrString("/vault/path"),
				ObsidianNotePath:  ptrString("/note/path"),
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-002").Return(false, nil)
				m.On("ShortCodeExists", ctx, workspaceID, "SHORT1").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "creation without short code",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-003",
				Name:          "No Short Code",
				MinStockLevel: 0,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-003").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "SKU already taken",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "EXISTING-SKU",
				Name:          "Test Item",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "EXISTING-SKU").Return(true, nil)
			},
			expectError: true,
			errorType:   ErrSKUTaken,
		},
		{
			testName: "short code already taken",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-004",
				Name:          "Test Item",
				MinStockLevel: 5,
				ShortCode:     ptrString("TAKEN"),
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-004").Return(false, nil)
				m.On("ShortCodeExists", ctx, workspaceID, "TAKEN").Return(true, nil)
			},
			expectError: true,
			errorType:   ErrShortCodeTaken,
		},
		{
			testName: "invalid workspace ID",
			input: CreateInput{
				WorkspaceID:   uuid.Nil,
				SKU:           "SKU-005",
				Name:          "Test Item",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, uuid.Nil, "SKU-005").Return(false, nil)
			},
			expectError: true,
		},
		{
			testName: "empty name",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-006",
				Name:          "",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-006").Return(false, nil)
			},
			expectError: true,
		},
		{
			testName: "empty SKU",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "",
				Name:          "Test Item",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "").Return(false, nil)
			},
			expectError: true,
		},
		{
			testName: "negative min stock level",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-007",
				Name:          "Test Item",
				MinStockLevel: -1,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-007").Return(false, nil)
			},
			expectError: true,
			errorType:   ErrInvalidMinStock,
		},
		{
			testName: "SKU check returns error",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-008",
				Name:          "Test Item",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-008").Return(false, errors.New("database error"))
			},
			expectError: true,
		},
		{
			testName: "short code check returns error",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-009",
				Name:          "Test Item",
				MinStockLevel: 5,
				ShortCode:     ptrString("CODE1"),
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-009").Return(false, nil)
				m.On("ShortCodeExists", ctx, workspaceID, "CODE1").Return(false, errors.New("database error"))
			},
			expectError: true,
		},
		{
			testName: "save returns error",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-010",
				Name:          "Test Item",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-010").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(errors.New("save error"))
			},
			expectError: true,
		},
		{
			testName: "empty short code is ignored",
			input: CreateInput{
				WorkspaceID:   workspaceID,
				SKU:           "SKU-011",
				Name:          "Test Item",
				MinStockLevel: 5,
				ShortCode:     ptrString(""),
			},
			setupMock: func(m *MockRepository) {
				m.On("SKUExists", ctx, workspaceID, "SKU-011").Return(false, nil)
				// Note: ShortCodeExists should NOT be called for empty string
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			item, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, item)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, item)
				assert.Equal(t, tt.input.WorkspaceID, item.WorkspaceID())
				assert.Equal(t, tt.input.SKU, item.SKU())
				assert.Equal(t, tt.input.Name, item.Name())
				assert.Equal(t, tt.input.MinStockLevel, item.MinStockLevel())
				assert.Equal(t, tt.input.Description, item.Description())
				assert.Equal(t, tt.input.CategoryID, item.CategoryID())
				assert.Equal(t, tt.input.Brand, item.Brand())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		itemID      uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "item found",
			itemID:      itemID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				item := &Item{id: itemID, workspaceID: workspaceID, name: "Test Item", sku: "SKU-001"}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
			},
			expectError: false,
		},
		{
			testName:    "item not found - returns nil",
			itemID:      itemID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, itemID, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrItemNotFound,
		},
		{
			testName:    "repository returns error",
			itemID:      itemID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, itemID, workspaceID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
		{
			testName:    "different workspace returns not found",
			itemID:      itemID,
			workspaceID: uuid.New(),
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, itemID, mock.Anything).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrItemNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			item, err := svc.GetByID(ctx, tt.itemID, tt.workspaceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, item)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, item)
				assert.Equal(t, tt.itemID, item.ID())
				assert.Equal(t, tt.workspaceID, item.WorkspaceID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		itemID      uuid.UUID
		workspaceID uuid.UUID
		input       UpdateInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "successful update",
			itemID:      itemID,
			workspaceID: workspaceID,
			input: UpdateInput{
				Name:          "Updated Name",
				Description:   ptrString("Updated description"),
				MinStockLevel: 10,
			},
			setupMock: func(m *MockRepository) {
				item := &Item{
					id:            itemID,
					workspaceID:   workspaceID,
					name:          "Original Name",
					sku:           "SKU-001",
					minStockLevel: 5,
				}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "item not found",
			itemID:      uuid.New(),
			workspaceID: workspaceID,
			input: UpdateInput{
				Name:          "Updated Name",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrItemNotFound,
		},
		{
			testName:    "update with empty name",
			itemID:      itemID,
			workspaceID: workspaceID,
			input: UpdateInput{
				Name:          "",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				item := &Item{
					id:            itemID,
					workspaceID:   workspaceID,
					name:          "Original Name",
					sku:           "SKU-001",
					minStockLevel: 5,
				}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
			},
			expectError: true,
		},
		{
			testName:    "update with negative min stock",
			itemID:      itemID,
			workspaceID: workspaceID,
			input: UpdateInput{
				Name:          "Valid Name",
				MinStockLevel: -1,
			},
			setupMock: func(m *MockRepository) {
				item := &Item{
					id:            itemID,
					workspaceID:   workspaceID,
					name:          "Original Name",
					sku:           "SKU-001",
					minStockLevel: 5,
				}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
			},
			expectError: true,
			errorType:   ErrInvalidMinStock,
		},
		{
			testName:    "save returns error",
			itemID:      itemID,
			workspaceID: workspaceID,
			input: UpdateInput{
				Name:          "Updated Name",
				MinStockLevel: 5,
			},
			setupMock: func(m *MockRepository) {
				item := &Item{
					id:            itemID,
					workspaceID:   workspaceID,
					name:          "Original Name",
					sku:           "SKU-001",
					minStockLevel: 5,
				}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			item, err := svc.Update(ctx, tt.itemID, tt.workspaceID, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, item)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, item)
				assert.Equal(t, tt.input.Name, item.Name())
				assert.Equal(t, tt.input.Description, item.Description())
				assert.Equal(t, tt.input.MinStockLevel, item.MinStockLevel())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Archive(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		itemID      uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "successful archive",
			itemID:      itemID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				falseVal := false
				item := &Item{
					id:          itemID,
					workspaceID: workspaceID,
					name:        "Test Item",
					sku:         "SKU-001",
					isArchived:  &falseVal,
				}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "item not found",
			itemID:      uuid.New(),
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrItemNotFound,
		},
		{
			testName:    "save returns error",
			itemID:      itemID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				falseVal := false
				item := &Item{
					id:          itemID,
					workspaceID: workspaceID,
					name:        "Test Item",
					sku:         "SKU-001",
					isArchived:  &falseVal,
				}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Archive(ctx, tt.itemID, tt.workspaceID)

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
	itemID := uuid.New()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		itemID      uuid.UUID
		workspaceID uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			testName:    "successful restore",
			itemID:      itemID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				trueVal := true
				item := &Item{
					id:          itemID,
					workspaceID: workspaceID,
					name:        "Test Item",
					sku:         "SKU-001",
					isArchived:  &trueVal,
				}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
			},
			expectError: false,
		},
		{
			testName:    "item not found",
			itemID:      uuid.New(),
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything, workspaceID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrItemNotFound,
		},
		{
			testName:    "save returns error",
			itemID:      itemID,
			workspaceID: workspaceID,
			setupMock: func(m *MockRepository) {
				trueVal := true
				item := &Item{
					id:          itemID,
					workspaceID: workspaceID,
					name:        "Test Item",
					sku:         "SKU-001",
					isArchived:  &trueVal,
				}
				m.On("FindByID", ctx, itemID, workspaceID).Return(item, nil)
				m.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Restore(ctx, tt.itemID, tt.workspaceID)

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

func TestService_Search(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		query       string
		limit       int
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName:    "search with results",
			workspaceID: workspaceID,
			query:       "test",
			limit:       10,
			setupMock: func(m *MockRepository) {
				items := []*Item{
					{id: uuid.New(), workspaceID: workspaceID, name: "Test Item 1", sku: "SKU-001"},
					{id: uuid.New(), workspaceID: workspaceID, name: "Test Item 2", sku: "SKU-002"},
				}
				m.On("Search", ctx, workspaceID, "test", 10).Return(items, nil)
			},
			expectLen:   2,
			expectError: false,
		},
		{
			testName:    "search with no results",
			workspaceID: workspaceID,
			query:       "nonexistent",
			limit:       10,
			setupMock: func(m *MockRepository) {
				m.On("Search", ctx, workspaceID, "nonexistent", 10).Return([]*Item{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName:    "search with zero limit uses default",
			workspaceID: workspaceID,
			query:       "test",
			limit:       0,
			setupMock: func(m *MockRepository) {
				items := []*Item{
					{id: uuid.New(), workspaceID: workspaceID, name: "Test Item", sku: "SKU-001"},
				}
				m.On("Search", ctx, workspaceID, "test", 50).Return(items, nil)
			},
			expectLen:   1,
			expectError: false,
		},
		{
			testName:    "search with negative limit uses default",
			workspaceID: workspaceID,
			query:       "test",
			limit:       -5,
			setupMock: func(m *MockRepository) {
				items := []*Item{
					{id: uuid.New(), workspaceID: workspaceID, name: "Test Item", sku: "SKU-001"},
				}
				m.On("Search", ctx, workspaceID, "test", 50).Return(items, nil)
			},
			expectLen:   1,
			expectError: false,
		},
		{
			testName:    "search returns error",
			workspaceID: workspaceID,
			query:       "test",
			limit:       10,
			setupMock: func(m *MockRepository) {
				m.On("Search", ctx, workspaceID, "test", 10).Return(nil, errors.New("search error"))
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

			items, err := svc.Search(ctx, tt.workspaceID, tt.query, tt.limit)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, items)
			} else {
				assert.NoError(t, err)
				assert.Len(t, items, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_List(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectTotal int
		expectError bool
	}{
		{
			testName:    "list with results",
			workspaceID: workspaceID,
			pagination:  shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				items := []*Item{
					{id: uuid.New(), workspaceID: workspaceID, name: "Item 1", sku: "SKU-001"},
					{id: uuid.New(), workspaceID: workspaceID, name: "Item 2", sku: "SKU-002"},
					{id: uuid.New(), workspaceID: workspaceID, name: "Item 3", sku: "SKU-003"},
				}
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(items, 3, nil)
			},
			expectLen:   3,
			expectTotal: 3,
			expectError: false,
		},
		{
			testName:    "list with pagination",
			workspaceID: workspaceID,
			pagination:  shared.Pagination{Page: 2, PageSize: 2},
			setupMock: func(m *MockRepository) {
				items := []*Item{
					{id: uuid.New(), workspaceID: workspaceID, name: "Item 3", sku: "SKU-003"},
				}
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 2, PageSize: 2}).Return(items, 5, nil)
			},
			expectLen:   1,
			expectTotal: 5,
			expectError: false,
		},
		{
			testName:    "list empty workspace",
			workspaceID: uuid.New(),
			pagination:  shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, mock.Anything, shared.Pagination{Page: 1, PageSize: 10}).Return([]*Item{}, 0, nil)
			},
			expectLen:   0,
			expectTotal: 0,
			expectError: false,
		},
		{
			testName:    "list returns error",
			workspaceID: workspaceID,
			pagination:  shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspace", ctx, workspaceID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, 0, errors.New("database error"))
			},
			expectLen:   0,
			expectTotal: 0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			items, total, err := svc.List(ctx, tt.workspaceID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, items)
			} else {
				assert.NoError(t, err)
				assert.Len(t, items, tt.expectLen)
				assert.Equal(t, tt.expectTotal, total)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByCategory(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()

	tests := []struct {
		testName    string
		workspaceID uuid.UUID
		categoryID  uuid.UUID
		pagination  shared.Pagination
		setupMock   func(*MockRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName:    "list items in category",
			workspaceID: workspaceID,
			categoryID:  categoryID,
			pagination:  shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				items := []*Item{
					{id: uuid.New(), workspaceID: workspaceID, name: "Item 1", sku: "SKU-001", categoryID: &categoryID},
					{id: uuid.New(), workspaceID: workspaceID, name: "Item 2", sku: "SKU-002", categoryID: &categoryID},
				}
				m.On("FindByCategory", ctx, workspaceID, categoryID, shared.Pagination{Page: 1, PageSize: 10}).Return(items, nil)
			},
			expectLen:   2,
			expectError: false,
		},
		{
			testName:    "category with no items",
			workspaceID: workspaceID,
			categoryID:  uuid.New(),
			pagination:  shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByCategory", ctx, workspaceID, mock.Anything, shared.Pagination{Page: 1, PageSize: 10}).Return([]*Item{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName:    "repository returns error",
			workspaceID: workspaceID,
			categoryID:  categoryID,
			pagination:  shared.Pagination{Page: 1, PageSize: 10},
			setupMock: func(m *MockRepository) {
				m.On("FindByCategory", ctx, workspaceID, categoryID, shared.Pagination{Page: 1, PageSize: 10}).Return(nil, errors.New("database error"))
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

			items, err := svc.ListByCategory(ctx, tt.workspaceID, tt.categoryID, tt.pagination)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, items)
			} else {
				assert.NoError(t, err)
				assert.Len(t, items, tt.expectLen)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// =============================================================================
// Obsidian URI Tests
// =============================================================================

func TestItem_ObsidianURI(t *testing.T) {
	now := time.Now()

	tests := []struct {
		testName    string
		vaultPath   *string
		notePath    *string
		expectNil   bool
		expectedURI string
	}{
		{
			testName:    "both paths set - generates valid URI",
			vaultPath:   ptrString("MyVault"),
			notePath:    ptrString("notes/item-note"),
			expectNil:   false,
			expectedURI: "obsidian://open?vault=MyVault&file=notes%2Fitem-note",
		},
		{
			testName:    "paths with spaces - properly escaped",
			vaultPath:   ptrString("My Vault"),
			notePath:    ptrString("notes/item note"),
			expectNil:   false,
			expectedURI: "obsidian://open?vault=My%20Vault&file=notes%2Fitem%20note",
		},
		{
			testName:  "vault path nil - returns nil",
			vaultPath: nil,
			notePath:  ptrString("notes/item-note"),
			expectNil: true,
		},
		{
			testName:  "note path nil - returns nil",
			vaultPath: ptrString("MyVault"),
			notePath:  nil,
			expectNil: true,
		},
		{
			testName:  "both paths nil - returns nil",
			vaultPath: nil,
			notePath:  nil,
			expectNil: true,
		},
		{
			testName:  "vault path empty string - returns nil",
			vaultPath: ptrString(""),
			notePath:  ptrString("notes/item-note"),
			expectNil: true,
		},
		{
			testName:  "note path empty string - returns nil",
			vaultPath: ptrString("MyVault"),
			notePath:  ptrString(""),
			expectNil: true,
		},
		{
			testName:  "both paths empty strings - returns nil",
			vaultPath: ptrString(""),
			notePath:  ptrString(""),
			expectNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			item := Reconstruct(
				uuid.New(),
				uuid.New(),
				"SKU-001",
				"Test Item",
				nil, nil, nil, nil, nil, nil, nil, nil,
				nil, nil, nil, nil, nil,
				0,
				nil,
				tt.vaultPath,
				tt.notePath,
				now,
				now,
			)

			uri := item.ObsidianURI()

			if tt.expectNil {
				assert.Nil(t, uri)
			} else {
				assert.NotNil(t, uri)
				assert.Equal(t, tt.expectedURI, *uri)
			}
		})
	}
}

// =============================================================================
// Label Association Tests
// =============================================================================

func TestService_AttachLabel(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	labelID := uuid.New()
	now := time.Now()

	createItem := func() *Item {
		return Reconstruct(itemID, workspaceID, "SKU-001", "Test Item", nil, nil, nil, nil, nil, nil, nil, nil, ptrBool(false), ptrBool(false), ptrBool(false), nil, nil, 0, ptrString("ABC123"), nil, nil, now, now)
	}

	t.Run("successful attach", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(createItem(), nil)
		mockRepo.On("AttachLabel", ctx, itemID, labelID).Return(nil)

		err := svc.AttachLabel(ctx, itemID, labelID, workspaceID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("item not found", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(nil, nil)

		err := svc.AttachLabel(ctx, itemID, labelID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrItemNotFound, err)
	})

	t.Run("repository error on find", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		repoErr := errors.New("database error")
		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(nil, repoErr)

		err := svc.AttachLabel(ctx, itemID, labelID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, repoErr, err)
	})

	t.Run("repository error on attach", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(createItem(), nil)
		repoErr := errors.New("attach error")
		mockRepo.On("AttachLabel", ctx, itemID, labelID).Return(repoErr)

		err := svc.AttachLabel(ctx, itemID, labelID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, repoErr, err)
	})
}

func TestService_DetachLabel(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	labelID := uuid.New()
	now := time.Now()

	createItem := func() *Item {
		return Reconstruct(itemID, workspaceID, "SKU-001", "Test Item", nil, nil, nil, nil, nil, nil, nil, nil, ptrBool(false), ptrBool(false), ptrBool(false), nil, nil, 0, ptrString("ABC123"), nil, nil, now, now)
	}

	t.Run("successful detach", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(createItem(), nil)
		mockRepo.On("DetachLabel", ctx, itemID, labelID).Return(nil)

		err := svc.DetachLabel(ctx, itemID, labelID, workspaceID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("item not found", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(nil, nil)

		err := svc.DetachLabel(ctx, itemID, labelID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, ErrItemNotFound, err)
	})

	t.Run("repository error on detach", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(createItem(), nil)
		repoErr := errors.New("detach error")
		mockRepo.On("DetachLabel", ctx, itemID, labelID).Return(repoErr)

		err := svc.DetachLabel(ctx, itemID, labelID, workspaceID)

		assert.Error(t, err)
		assert.Equal(t, repoErr, err)
	})
}

func TestService_GetItemLabels(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now()

	createItem := func() *Item {
		return Reconstruct(itemID, workspaceID, "SKU-001", "Test Item", nil, nil, nil, nil, nil, nil, nil, nil, ptrBool(false), ptrBool(false), ptrBool(false), nil, nil, 0, ptrString("ABC123"), nil, nil, now, now)
	}

	t.Run("successful get labels", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		expectedLabels := []uuid.UUID{uuid.New(), uuid.New()}
		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(createItem(), nil)
		mockRepo.On("GetItemLabels", ctx, itemID).Return(expectedLabels, nil)

		labels, err := svc.GetItemLabels(ctx, itemID, workspaceID)

		assert.NoError(t, err)
		assert.Equal(t, expectedLabels, labels)
		mockRepo.AssertExpectations(t)
	})

	t.Run("item not found", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(nil, nil)

		labels, err := svc.GetItemLabels(ctx, itemID, workspaceID)

		assert.Error(t, err)
		assert.Nil(t, labels)
		assert.Equal(t, ErrItemNotFound, err)
	})

	t.Run("repository error on get labels", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByID", ctx, itemID, workspaceID).Return(createItem(), nil)
		repoErr := errors.New("get labels error")
		mockRepo.On("GetItemLabels", ctx, itemID).Return(nil, repoErr)

		labels, err := svc.GetItemLabels(ctx, itemID, workspaceID)

		assert.Error(t, err)
		assert.Nil(t, labels)
		assert.Equal(t, repoErr, err)
	})
}
