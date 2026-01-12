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
