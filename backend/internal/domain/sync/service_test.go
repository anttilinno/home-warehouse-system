package sync_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/sync"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// MockRepository is a mock implementation of sync.Repository
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) ListItemsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseItem, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseItem), args.Error(1)
}

func (m *MockRepository) ListLocationsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLocation, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseLocation), args.Error(1)
}

func (m *MockRepository) ListContainersModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseContainer, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseContainer), args.Error(1)
}

func (m *MockRepository) ListInventoryModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseInventory, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseInventory), args.Error(1)
}

func (m *MockRepository) ListCategoriesModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseCategory, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseCategory), args.Error(1)
}

func (m *MockRepository) ListLabelsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLabel, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseLabel), args.Error(1)
}

func (m *MockRepository) ListCompaniesModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseCompany, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseCompany), args.Error(1)
}

func (m *MockRepository) ListBorrowersModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseBorrower, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseBorrower), args.Error(1)
}

func (m *MockRepository) ListLoansModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLoan, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseLoan), args.Error(1)
}

func (m *MockRepository) ListDeletedRecordsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseDeletedRecord, error) {
	args := m.Called(ctx, workspaceID, modifiedSince, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseDeletedRecord), args.Error(1)
}

func TestService_GetDelta(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now()
	modifiedSince := now.Add(-24 * time.Hour)

	t.Run("returns items when requested", func(t *testing.T) {
		repo := new(MockRepository)
		svc := sync.NewService(repo)

		itemID := uuid.New()
		items := []queries.WarehouseItem{
			{
				ID:          itemID,
				WorkspaceID: workspaceID,
				Name:        "Test Item",
				Sku:         "SKU001",
				CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
				UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			},
		}

		repo.On("ListItemsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(items, nil)
		repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseDeletedRecord{}, nil)

		result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
			WorkspaceID:   workspaceID,
			ModifiedSince: &modifiedSince,
			EntityTypes:   []sync.EntityType{sync.EntityTypeItem},
			Limit:         100,
		})

		require.NoError(t, err)
		assert.Len(t, result.Items, 1)
		assert.Equal(t, itemID, result.Items[0].ID)
		assert.Equal(t, "Test Item", result.Items[0].Name)
		assert.NotZero(t, result.SyncedAt)
		assert.False(t, result.HasMore)
	})

	t.Run("returns all entity types when none specified", func(t *testing.T) {
		repo := new(MockRepository)
		svc := sync.NewService(repo)

		// Mock all entity types
		repo.On("ListItemsModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseItem{}, nil)
		repo.On("ListLocationsModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseLocation{}, nil)
		repo.On("ListContainersModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseContainer{}, nil)
		repo.On("ListInventoryModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseInventory{}, nil)
		repo.On("ListCategoriesModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseCategory{}, nil)
		repo.On("ListLabelsModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseLabel{}, nil)
		repo.On("ListCompaniesModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseCompany{}, nil)
		repo.On("ListBorrowersModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseBorrower{}, nil)
		repo.On("ListLoansModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseLoan{}, nil)
		repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, mock.Anything, int32(100)).Return([]queries.WarehouseDeletedRecord{}, nil)

		result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
			WorkspaceID:   workspaceID,
			ModifiedSince: &modifiedSince,
			EntityTypes:   nil, // No specific types - should fetch all
			Limit:         100,
		})

		require.NoError(t, err)
		assert.NotNil(t, result)

		// Verify all repos were called
		repo.AssertCalled(t, "ListItemsModifiedSince", ctx, workspaceID, mock.Anything, int32(100))
		repo.AssertCalled(t, "ListLocationsModifiedSince", ctx, workspaceID, mock.Anything, int32(100))
		repo.AssertCalled(t, "ListCategoriesModifiedSince", ctx, workspaceID, mock.Anything, int32(100))
	})

	t.Run("sets has_more when limit reached", func(t *testing.T) {
		repo := new(MockRepository)
		svc := sync.NewService(repo)

		// Return exactly limit items
		items := make([]queries.WarehouseItem, 10)
		for i := range items {
			items[i] = queries.WarehouseItem{
				ID:          uuid.New(),
				WorkspaceID: workspaceID,
				Name:        "Item",
				CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
				UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			}
		}

		repo.On("ListItemsModifiedSince", ctx, workspaceID, modifiedSince, int32(10)).Return(items, nil)
		repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, int32(10)).Return([]queries.WarehouseDeletedRecord{}, nil)

		result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
			WorkspaceID:   workspaceID,
			ModifiedSince: &modifiedSince,
			EntityTypes:   []sync.EntityType{sync.EntityTypeItem},
			Limit:         10,
		})

		require.NoError(t, err)
		assert.True(t, result.HasMore)
	})

	t.Run("includes deleted records for tombstone sync", func(t *testing.T) {
		repo := new(MockRepository)
		svc := sync.NewService(repo)

		deletedID := uuid.New()
		entityID := uuid.New()
		deleted := []queries.WarehouseDeletedRecord{
			{
				ID:         deletedID,
				EntityType: queries.WarehouseActivityEntityEnumITEM,
				EntityID:   entityID,
				DeletedAt:  now,
			},
		}

		repo.On("ListItemsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseItem{}, nil)
		repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(deleted, nil)

		result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
			WorkspaceID:   workspaceID,
			ModifiedSince: &modifiedSince,
			EntityTypes:   []sync.EntityType{sync.EntityTypeItem},
			Limit:         100,
		})

		require.NoError(t, err)
		assert.Len(t, result.Deleted, 1)
		assert.Equal(t, deletedID, result.Deleted[0].ID)
		assert.Equal(t, entityID, result.Deleted[0].EntityID)
		assert.Equal(t, "ITEM", result.Deleted[0].EntityType)
	})

	t.Run("handles full sync when modified_since is nil", func(t *testing.T) {
		repo := new(MockRepository)
		svc := sync.NewService(repo)

		// With nil modifiedSince, time.Time{} (zero) should be used
		zeroTime := time.Time{}

		repo.On("ListCategoriesModifiedSince", ctx, workspaceID, zeroTime, int32(100)).Return([]queries.WarehouseCategory{
			{
				ID:          uuid.New(),
				WorkspaceID: workspaceID,
				Name:        "Category 1",
				CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
				UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			},
		}, nil)
		repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, zeroTime, int32(100)).Return([]queries.WarehouseDeletedRecord{}, nil)

		result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
			WorkspaceID:   workspaceID,
			ModifiedSince: nil, // Full sync
			EntityTypes:   []sync.EntityType{sync.EntityTypeCategory},
			Limit:         100,
		})

		require.NoError(t, err)
		assert.Len(t, result.Categories, 1)
	})
}

func TestParseEntityTypes(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []sync.EntityType
	}{
		{
			name:     "empty string returns nil",
			input:    "",
			expected: nil,
		},
		{
			name:     "single entity type",
			input:    "item",
			expected: []sync.EntityType{sync.EntityTypeItem},
		},
		{
			name:     "multiple entity types",
			input:    "item,location,category",
			expected: []sync.EntityType{sync.EntityTypeItem, sync.EntityTypeLocation, sync.EntityTypeCategory},
		},
		{
			name:     "handles whitespace",
			input:    "item, location , category",
			expected: []sync.EntityType{sync.EntityTypeItem, sync.EntityTypeLocation, sync.EntityTypeCategory},
		},
		{
			name:     "ignores invalid types",
			input:    "item,invalid,category",
			expected: []sync.EntityType{sync.EntityTypeItem, sync.EntityTypeCategory},
		},
		{
			name:  "all valid types",
			input: "item,location,container,inventory,category,label,company,borrower,loan",
			expected: []sync.EntityType{
				sync.EntityTypeItem,
				sync.EntityTypeLocation,
				sync.EntityTypeContainer,
				sync.EntityTypeInventory,
				sync.EntityTypeCategory,
				sync.EntityTypeLabel,
				sync.EntityTypeCompany,
				sync.EntityTypeBorrower,
				sync.EntityTypeLoan,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sync.ParseEntityTypes(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestEntityType_IsValid(t *testing.T) {
	validTypes := []sync.EntityType{
		sync.EntityTypeItem,
		sync.EntityTypeLocation,
		sync.EntityTypeContainer,
		sync.EntityTypeInventory,
		sync.EntityTypeCategory,
		sync.EntityTypeLabel,
		sync.EntityTypeCompany,
		sync.EntityTypeBorrower,
		sync.EntityTypeLoan,
	}

	for _, et := range validTypes {
		t.Run(string(et), func(t *testing.T) {
			assert.True(t, et.IsValid())
		})
	}

	t.Run("invalid type returns false", func(t *testing.T) {
		assert.False(t, sync.EntityType("invalid").IsValid())
		assert.False(t, sync.EntityType("").IsValid())
	})
}

func TestAllEntityTypes(t *testing.T) {
	types := sync.AllEntityTypes()
	assert.Len(t, types, 9)
	assert.Contains(t, types, sync.EntityTypeItem)
	assert.Contains(t, types, sync.EntityTypeLocation)
	assert.Contains(t, types, sync.EntityTypeContainer)
	assert.Contains(t, types, sync.EntityTypeInventory)
	assert.Contains(t, types, sync.EntityTypeCategory)
	assert.Contains(t, types, sync.EntityTypeLabel)
	assert.Contains(t, types, sync.EntityTypeCompany)
	assert.Contains(t, types, sync.EntityTypeBorrower)
	assert.Contains(t, types, sync.EntityTypeLoan)
}

func TestService_GetDelta_EntityTypeErrors(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now()
	modifiedSince := now.Add(-24 * time.Hour)

	testCases := []struct {
		name       string
		entityType sync.EntityType
		setupMock  func(*MockRepository)
	}{
		{
			name:       "item error",
			entityType: sync.EntityTypeItem,
			setupMock: func(repo *MockRepository) {
				repo.On("ListItemsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
		{
			name:       "location error",
			entityType: sync.EntityTypeLocation,
			setupMock: func(repo *MockRepository) {
				repo.On("ListLocationsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
		{
			name:       "container error",
			entityType: sync.EntityTypeContainer,
			setupMock: func(repo *MockRepository) {
				repo.On("ListContainersModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
		{
			name:       "inventory error",
			entityType: sync.EntityTypeInventory,
			setupMock: func(repo *MockRepository) {
				repo.On("ListInventoryModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
		{
			name:       "category error",
			entityType: sync.EntityTypeCategory,
			setupMock: func(repo *MockRepository) {
				repo.On("ListCategoriesModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
		{
			name:       "label error",
			entityType: sync.EntityTypeLabel,
			setupMock: func(repo *MockRepository) {
				repo.On("ListLabelsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
		{
			name:       "company error",
			entityType: sync.EntityTypeCompany,
			setupMock: func(repo *MockRepository) {
				repo.On("ListCompaniesModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
		{
			name:       "borrower error",
			entityType: sync.EntityTypeBorrower,
			setupMock: func(repo *MockRepository) {
				repo.On("ListBorrowersModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
		{
			name:       "loan error",
			entityType: sync.EntityTypeLoan,
			setupMock: func(repo *MockRepository) {
				repo.On("ListLoansModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(MockRepository)
			svc := sync.NewService(repo)

			tc.setupMock(repo)

			result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
				WorkspaceID:   workspaceID,
				ModifiedSince: &modifiedSince,
				EntityTypes:   []sync.EntityType{tc.entityType},
				Limit:         100,
			})

			assert.Error(t, err)
			assert.Nil(t, result)
		})
	}
}

func TestService_GetDelta_DeletedRecordsError(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now()
	modifiedSince := now.Add(-24 * time.Hour)

	repo := new(MockRepository)
	svc := sync.NewService(repo)

	// Items succeed but deleted records fail
	repo.On("ListItemsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseItem{}, nil)
	repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return(nil, assert.AnError)

	result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
		WorkspaceID:   workspaceID,
		ModifiedSince: &modifiedSince,
		EntityTypes:   []sync.EntityType{sync.EntityTypeItem},
		Limit:         100,
	})

	assert.Error(t, err)
	assert.Nil(t, result)
}

func TestService_GetDelta_AllEntityTypesWithData(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now()
	modifiedSince := now.Add(-24 * time.Hour)

	repo := new(MockRepository)
	svc := sync.NewService(repo)

	locationID := uuid.New()
	parentLocID := uuid.New()
	containerID := uuid.New()
	itemID := uuid.New()
	labelID := uuid.New()
	companyID := uuid.New()
	borrowerID := uuid.New()
	loanID := uuid.New()
	inventoryID := uuid.New()

	// Setup all entity types with data including optional fields
	repo.On("ListLocationsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseLocation{
		{
			ID:             locationID,
			WorkspaceID:    workspaceID,
			Name:           "Location 1",
			ParentLocation: pgtype.UUID{Bytes: parentLocID, Valid: true},
			Description:    ptrString("Main storage area"),
			ShortCode:      "LOC-1",
			CreatedAt:      pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:      pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)

	capacity := "50"
	repo.On("ListContainersModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseContainer{
		{
			ID:          containerID,
			WorkspaceID: workspaceID,
			Name:        "Container 1",
			LocationID:  locationID,
			Capacity:    &capacity,
			ShortCode:   "CTN-1",
			CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)

	purchasePrice := int32(9999)
	repo.On("ListInventoryModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseInventory{
		{
			ID:            inventoryID,
			WorkspaceID:   workspaceID,
			ItemID:        itemID,
			LocationID:    locationID,
			ContainerID:   pgtype.UUID{Bytes: containerID, Valid: true},
			Quantity:      5,
			Condition:     queries.NullWarehouseItemConditionEnum{WarehouseItemConditionEnum: queries.WarehouseItemConditionEnumGOOD, Valid: true},
			Status:        queries.NullWarehouseItemStatusEnum{WarehouseItemStatusEnum: queries.WarehouseItemStatusEnumAVAILABLE, Valid: true},
			DateAcquired:  pgtype.Date{Time: now, Valid: true},
			PurchasePrice: &purchasePrice,
			CurrencyCode:  ptrString("USD"),
			CreatedAt:     pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:     pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)

	labelColor := "#FF0000"
	repo.On("ListLabelsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseLabel{
		{
			ID:          labelID,
			WorkspaceID: workspaceID,
			Name:        "Label 1",
			Color:       &labelColor,
			CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)

	repo.On("ListCompaniesModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseCompany{
		{
			ID:          companyID,
			WorkspaceID: workspaceID,
			Name:        "Company 1",
			Website:     ptrString("https://example.com"),
			CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)

	repo.On("ListBorrowersModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseBorrower{
		{
			ID:          borrowerID,
			WorkspaceID: workspaceID,
			Name:        "Borrower 1",
			Email:       ptrString("borrower@example.com"),
			Phone:       ptrString("123-456-7890"),
			CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)

	repo.On("ListLoansModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseLoan{
		{
			ID:          loanID,
			WorkspaceID: workspaceID,
			InventoryID: inventoryID,
			BorrowerID:  borrowerID,
			Quantity:    1,
			LoanedAt:    pgtype.Timestamptz{Time: now, Valid: true},
			DueDate:     pgtype.Date{Time: now.Add(7 * 24 * time.Hour), Valid: true},
			ReturnedAt:  pgtype.Timestamptz{Time: now.Add(5 * 24 * time.Hour), Valid: true},
			CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)

	userID := uuid.New()
	repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseDeletedRecord{
		{
			ID:         uuid.New(),
			EntityType: queries.WarehouseActivityEntityEnumITEM,
			EntityID:   itemID,
			DeletedAt:  now,
			DeletedBy:  pgtype.UUID{Bytes: userID, Valid: true},
		},
	}, nil)

	result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
		WorkspaceID:   workspaceID,
		ModifiedSince: &modifiedSince,
		EntityTypes: []sync.EntityType{
			sync.EntityTypeLocation,
			sync.EntityTypeContainer,
			sync.EntityTypeInventory,
			sync.EntityTypeLabel,
			sync.EntityTypeCompany,
			sync.EntityTypeBorrower,
			sync.EntityTypeLoan,
		},
		Limit: 100,
	})

	require.NoError(t, err)
	assert.Len(t, result.Locations, 1)
	assert.Equal(t, "Location 1", result.Locations[0].Name)
	assert.NotNil(t, result.Locations[0].ParentLocation)

	assert.Len(t, result.Containers, 1)
	assert.Equal(t, "Container 1", result.Containers[0].Name)

	assert.Len(t, result.Inventory, 1)
	assert.Equal(t, "GOOD", result.Inventory[0].Condition)
	assert.Equal(t, "AVAILABLE", result.Inventory[0].Status)

	assert.Len(t, result.Labels, 1)
	assert.Equal(t, "#FF0000", result.Labels[0].Color)

	assert.Len(t, result.Companies, 1)
	assert.Equal(t, "Company 1", result.Companies[0].Name)

	assert.Len(t, result.Borrowers, 1)
	assert.Equal(t, "Borrower 1", result.Borrowers[0].Name)

	assert.Len(t, result.Loans, 1)
	assert.NotNil(t, result.Loans[0].ReturnedAt)
	assert.NotNil(t, result.Loans[0].DueDate)

	assert.Len(t, result.Deleted, 1)
	assert.NotNil(t, result.Deleted[0].DeletedBy)
}

func TestService_GetDelta_InventoryWithNullEnums(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now()
	modifiedSince := now.Add(-24 * time.Hour)

	repo := new(MockRepository)
	svc := sync.NewService(repo)

	// Inventory with null condition and status
	repo.On("ListInventoryModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseInventory{
		{
			ID:          uuid.New(),
			WorkspaceID: workspaceID,
			ItemID:      uuid.New(),
			LocationID:  uuid.New(),
			Quantity:    1,
			Condition:   queries.NullWarehouseItemConditionEnum{Valid: false}, // Null
			Status:      queries.NullWarehouseItemStatusEnum{Valid: false},    // Null
			CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)
	repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseDeletedRecord{}, nil)

	result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
		WorkspaceID:   workspaceID,
		ModifiedSince: &modifiedSince,
		EntityTypes:   []sync.EntityType{sync.EntityTypeInventory},
		Limit:         100,
	})

	require.NoError(t, err)
	assert.Len(t, result.Inventory, 1)
	assert.Empty(t, result.Inventory[0].Condition)
	assert.Empty(t, result.Inventory[0].Status)
}

func TestService_GetDelta_LabelsWithNullColor(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now()
	modifiedSince := now.Add(-24 * time.Hour)

	repo := new(MockRepository)
	svc := sync.NewService(repo)

	repo.On("ListLabelsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseLabel{
		{
			ID:          uuid.New(),
			WorkspaceID: workspaceID,
			Name:        "Label Without Color",
			Color:       nil, // Null color
			CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		},
	}, nil)
	repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, int32(100)).Return([]queries.WarehouseDeletedRecord{}, nil)

	result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
		WorkspaceID:   workspaceID,
		ModifiedSince: &modifiedSince,
		EntityTypes:   []sync.EntityType{sync.EntityTypeLabel},
		Limit:         100,
	})

	require.NoError(t, err)
	assert.Len(t, result.Labels, 1)
	assert.Empty(t, result.Labels[0].Color)
}

func TestService_GetDelta_HasMoreFlags(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now()
	modifiedSince := now.Add(-24 * time.Hour)
	limit := int32(2)

	testCases := []struct {
		name       string
		entityType sync.EntityType
		setupMock  func(*MockRepository)
	}{
		{
			name:       "locations has_more",
			entityType: sync.EntityTypeLocation,
			setupMock: func(repo *MockRepository) {
				locations := make([]queries.WarehouseLocation, 2)
				for i := range locations {
					locations[i] = queries.WarehouseLocation{
						ID:          uuid.New(),
						WorkspaceID: workspaceID,
						Name:        "Loc",
						CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
					}
				}
				repo.On("ListLocationsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return(locations, nil)
				repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return([]queries.WarehouseDeletedRecord{}, nil)
			},
		},
		{
			name:       "containers has_more",
			entityType: sync.EntityTypeContainer,
			setupMock: func(repo *MockRepository) {
				containers := make([]queries.WarehouseContainer, 2)
				for i := range containers {
					containers[i] = queries.WarehouseContainer{
						ID:          uuid.New(),
						WorkspaceID: workspaceID,
						LocationID:  uuid.New(),
						Name:        "Ctn",
						CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
					}
				}
				repo.On("ListContainersModifiedSince", ctx, workspaceID, modifiedSince, limit).Return(containers, nil)
				repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return([]queries.WarehouseDeletedRecord{}, nil)
			},
		},
		{
			name:       "inventory has_more",
			entityType: sync.EntityTypeInventory,
			setupMock: func(repo *MockRepository) {
				inventory := make([]queries.WarehouseInventory, 2)
				for i := range inventory {
					inventory[i] = queries.WarehouseInventory{
						ID:          uuid.New(),
						WorkspaceID: workspaceID,
						ItemID:      uuid.New(),
						LocationID:  uuid.New(),
						Quantity:    1,
						CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
					}
				}
				repo.On("ListInventoryModifiedSince", ctx, workspaceID, modifiedSince, limit).Return(inventory, nil)
				repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return([]queries.WarehouseDeletedRecord{}, nil)
			},
		},
		{
			name:       "categories has_more",
			entityType: sync.EntityTypeCategory,
			setupMock: func(repo *MockRepository) {
				categories := make([]queries.WarehouseCategory, 2)
				for i := range categories {
					categories[i] = queries.WarehouseCategory{
						ID:          uuid.New(),
						WorkspaceID: workspaceID,
						Name:        "Cat",
						CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
					}
				}
				repo.On("ListCategoriesModifiedSince", ctx, workspaceID, modifiedSince, limit).Return(categories, nil)
				repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return([]queries.WarehouseDeletedRecord{}, nil)
			},
		},
		{
			name:       "labels has_more",
			entityType: sync.EntityTypeLabel,
			setupMock: func(repo *MockRepository) {
				labels := make([]queries.WarehouseLabel, 2)
				for i := range labels {
					labels[i] = queries.WarehouseLabel{
						ID:          uuid.New(),
						WorkspaceID: workspaceID,
						Name:        "Lbl",
						CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
					}
				}
				repo.On("ListLabelsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return(labels, nil)
				repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return([]queries.WarehouseDeletedRecord{}, nil)
			},
		},
		{
			name:       "companies has_more",
			entityType: sync.EntityTypeCompany,
			setupMock: func(repo *MockRepository) {
				companies := make([]queries.WarehouseCompany, 2)
				for i := range companies {
					companies[i] = queries.WarehouseCompany{
						ID:          uuid.New(),
						WorkspaceID: workspaceID,
						Name:        "Cmp",
						CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
					}
				}
				repo.On("ListCompaniesModifiedSince", ctx, workspaceID, modifiedSince, limit).Return(companies, nil)
				repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return([]queries.WarehouseDeletedRecord{}, nil)
			},
		},
		{
			name:       "borrowers has_more",
			entityType: sync.EntityTypeBorrower,
			setupMock: func(repo *MockRepository) {
				borrowers := make([]queries.WarehouseBorrower, 2)
				for i := range borrowers {
					borrowers[i] = queries.WarehouseBorrower{
						ID:          uuid.New(),
						WorkspaceID: workspaceID,
						Name:        "Brw",
						CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
					}
				}
				repo.On("ListBorrowersModifiedSince", ctx, workspaceID, modifiedSince, limit).Return(borrowers, nil)
				repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return([]queries.WarehouseDeletedRecord{}, nil)
			},
		},
		{
			name:       "loans has_more",
			entityType: sync.EntityTypeLoan,
			setupMock: func(repo *MockRepository) {
				loans := make([]queries.WarehouseLoan, 2)
				for i := range loans {
					loans[i] = queries.WarehouseLoan{
						ID:          uuid.New(),
						WorkspaceID: workspaceID,
						InventoryID: uuid.New(),
						BorrowerID:  uuid.New(),
						Quantity:    1,
						LoanedAt:    pgtype.Timestamptz{Time: now, Valid: true},
						CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
					}
				}
				repo.On("ListLoansModifiedSince", ctx, workspaceID, modifiedSince, limit).Return(loans, nil)
				repo.On("ListDeletedRecordsModifiedSince", ctx, workspaceID, modifiedSince, limit).Return([]queries.WarehouseDeletedRecord{}, nil)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			repo := new(MockRepository)
			svc := sync.NewService(repo)

			tc.setupMock(repo)

			result, err := svc.GetDelta(ctx, sync.DeltaSyncInput{
				WorkspaceID:   workspaceID,
				ModifiedSince: &modifiedSince,
				EntityTypes:   []sync.EntityType{tc.entityType},
				Limit:         limit,
			})

			require.NoError(t, err)
			assert.True(t, result.HasMore)
		})
	}
}

// Helper function to create string pointer
func ptrString(s string) *string {
	return &s
}
