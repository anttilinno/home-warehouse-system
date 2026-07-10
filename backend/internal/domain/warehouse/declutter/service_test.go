package declutter

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockRepository implements Repository for testing
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) FindUnused(ctx context.Context, params ListParams) ([]DeclutterItem, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]DeclutterItem), args.Error(1)
}

func (m *MockRepository) CountUnused(ctx context.Context, workspaceID uuid.UUID, thresholdDays int) (int, error) {
	args := m.Called(ctx, workspaceID, thresholdDays)
	return args.Int(0), args.Error(1)
}

func (m *MockRepository) GetCounts(ctx context.Context, workspaceID uuid.UUID) (*DeclutterCounts, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*DeclutterCounts), args.Error(1)
}

func (m *MockRepository) GetMaxValue(ctx context.Context, workspaceID uuid.UUID) (int, error) {
	args := m.Called(ctx, workspaceID)
	return args.Int(0), args.Error(1)
}

func (m *MockRepository) MarkUsed(ctx context.Context, inventoryID, workspaceID uuid.UUID) error {
	args := m.Called(ctx, inventoryID, workspaceID)
	return args.Error(0)
}

func newTestItem(workspaceID uuid.UUID, daysUnused int, priceCents *int) DeclutterItem {
	return DeclutterItem{
		ID:            uuid.New(),
		WorkspaceID:   workspaceID,
		ItemID:        uuid.New(),
		LocationID:    uuid.New(),
		Quantity:      1,
		PurchasePrice: priceCents,
		ItemName:      "Test Item",
		ItemSKU:       "TEST-001",
		LocationName:  "Test Location",
		DaysUnused:    daysUnused,
	}
}

func TestService_ListUnused(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	params := DefaultListParams(workspaceID)

	t.Run("returns items with calculated scores", func(t *testing.T) {
		repo := new(MockRepository)
		price := 5000
		items := []DeclutterItem{newTestItem(workspaceID, 100, &price)}

		repo.On("FindUnused", ctx, params).Return(items, nil)
		repo.On("CountUnused", ctx, workspaceID, params.ThresholdDays).Return(1, nil)
		repo.On("GetMaxValue", ctx, workspaceID).Return(10000, nil)

		svc := NewService(repo)
		result, err := svc.ListUnused(ctx, params)

		require.NoError(t, err)
		assert.Equal(t, 1, result.Total)
		require.Len(t, result.Items, 1)
		assert.Equal(t, CalculateScore(100, params.ThresholdDays, price, 10000), result.Items[0].Score)
		repo.AssertExpectations(t)
	})

	t.Run("treats nil purchase price as zero value", func(t *testing.T) {
		repo := new(MockRepository)
		items := []DeclutterItem{newTestItem(workspaceID, 100, nil)}

		repo.On("FindUnused", ctx, params).Return(items, nil)
		repo.On("CountUnused", ctx, workspaceID, params.ThresholdDays).Return(1, nil)
		repo.On("GetMaxValue", ctx, workspaceID).Return(10000, nil)

		svc := NewService(repo)
		result, err := svc.ListUnused(ctx, params)

		require.NoError(t, err)
		assert.Equal(t, CalculateScore(100, params.ThresholdDays, 0, 10000), result.Items[0].Score)
		repo.AssertExpectations(t)
	})

	t.Run("returns empty result when no unused items", func(t *testing.T) {
		repo := new(MockRepository)

		repo.On("FindUnused", ctx, params).Return([]DeclutterItem{}, nil)
		repo.On("CountUnused", ctx, workspaceID, params.ThresholdDays).Return(0, nil)
		repo.On("GetMaxValue", ctx, workspaceID).Return(0, nil)

		svc := NewService(repo)
		result, err := svc.ListUnused(ctx, params)

		require.NoError(t, err)
		assert.Equal(t, 0, result.Total)
		assert.Empty(t, result.Items)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when FindUnused fails", func(t *testing.T) {
		repo := new(MockRepository)
		expectedErr := errors.New("database error")
		repo.On("FindUnused", ctx, params).Return(nil, expectedErr)

		svc := NewService(repo)
		result, err := svc.ListUnused(ctx, params)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when CountUnused fails", func(t *testing.T) {
		repo := new(MockRepository)
		expectedErr := errors.New("database error")
		repo.On("FindUnused", ctx, params).Return([]DeclutterItem{}, nil)
		repo.On("CountUnused", ctx, workspaceID, params.ThresholdDays).Return(0, expectedErr)

		svc := NewService(repo)
		result, err := svc.ListUnused(ctx, params)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when GetMaxValue fails", func(t *testing.T) {
		repo := new(MockRepository)
		expectedErr := errors.New("database error")
		repo.On("FindUnused", ctx, params).Return([]DeclutterItem{}, nil)
		repo.On("CountUnused", ctx, workspaceID, params.ThresholdDays).Return(0, nil)
		repo.On("GetMaxValue", ctx, workspaceID).Return(0, expectedErr)

		svc := NewService(repo)
		result, err := svc.ListUnused(ctx, params)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_GetCounts(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("returns counts from repository", func(t *testing.T) {
		repo := new(MockRepository)
		counts := &DeclutterCounts{Unused90: 10, Unused180: 5, Unused365: 2, Value90: 100000}
		repo.On("GetCounts", ctx, workspaceID).Return(counts, nil)

		svc := NewService(repo)
		result, err := svc.GetCounts(ctx, workspaceID)

		require.NoError(t, err)
		assert.Equal(t, counts, result)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when repository fails", func(t *testing.T) {
		repo := new(MockRepository)
		expectedErr := errors.New("database error")
		repo.On("GetCounts", ctx, workspaceID).Return(nil, expectedErr)

		svc := NewService(repo)
		result, err := svc.GetCounts(ctx, workspaceID)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.Nil(t, result)
		repo.AssertExpectations(t)
	})
}

func TestService_MarkUsed(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	inventoryID := uuid.New()

	t.Run("marks inventory as used", func(t *testing.T) {
		repo := new(MockRepository)
		repo.On("MarkUsed", ctx, inventoryID, workspaceID).Return(nil)

		svc := NewService(repo)
		err := svc.MarkUsed(ctx, inventoryID, workspaceID)

		require.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("returns error when repository fails", func(t *testing.T) {
		repo := new(MockRepository)
		expectedErr := errors.New("database error")
		repo.On("MarkUsed", ctx, inventoryID, workspaceID).Return(expectedErr)

		svc := NewService(repo)
		err := svc.MarkUsed(ctx, inventoryID, workspaceID)

		require.Error(t, err)
		assert.Equal(t, expectedErr, err)
		repo.AssertExpectations(t)
	})
}
