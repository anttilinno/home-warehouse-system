package wishlist

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MockRepository is a mock implementation of the Repository interface.
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, wish *Item) error {
	args := m.Called(ctx, wish)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Item), args.Error(1)
}

func (m *MockRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, status *Status, pagination shared.Pagination) ([]*Item, int, error) {
	args := m.Called(ctx, workspaceID, status, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*Item), args.Int(1), args.Error(2)
}

func (m *MockRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

// MockCategoryRepository is a mock implementation of the category.Repository interface.
type MockCategoryRepository struct {
	mock.Mock
}

func (m *MockCategoryRepository) Save(ctx context.Context, cat *category.Category) error {
	args := m.Called(ctx, cat)
	return args.Error(0)
}

func (m *MockCategoryRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*category.Category, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockCategoryRepository) HasChildren(ctx context.Context, workspaceID, parentID uuid.UUID) (bool, error) {
	args := m.Called(ctx, workspaceID, parentID)
	return args.Bool(0), args.Error(1)
}

// MockItemRepository is a mock implementation of the item.Repository interface.
type MockItemRepository struct {
	mock.Mock
}

func (m *MockItemRepository) Save(ctx context.Context, it *item.Item) error {
	args := m.Called(ctx, it)
	return args.Error(0)
}

func (m *MockItemRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) FindBySKU(ctx context.Context, workspaceID uuid.UUID, sku string) (*item.Item, error) {
	args := m.Called(ctx, workspaceID, sku)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*item.Item, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) FindByBarcode(ctx context.Context, workspaceID uuid.UUID, barcode string) (*item.Item, error) {
	args := m.Called(ctx, workspaceID, barcode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*item.Item), args.Int(1), args.Error(2)
}

func (m *MockItemRepository) FindByWorkspaceFiltered(ctx context.Context, workspaceID uuid.UUID, filters item.ListFilters, pagination shared.Pagination) ([]*item.Item, int, error) {
	args := m.Called(ctx, workspaceID, filters, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*item.Item), args.Int(1), args.Error(2)
}

func (m *MockItemRepository) FindNeedingReview(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*item.Item), args.Int(1), args.Error(2)
}

func (m *MockItemRepository) FindByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*item.Item, error) {
	args := m.Called(ctx, workspaceID, categoryID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*item.Item), args.Error(1)
}

func (m *MockItemRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*item.Item, error) {
	args := m.Called(ctx, workspaceID, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*item.Item), args.Error(1)
}

func (m *MockItemRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockItemRepository) SKUExists(ctx context.Context, workspaceID uuid.UUID, sku string) (bool, error) {
	args := m.Called(ctx, workspaceID, sku)
	return args.Bool(0), args.Error(1)
}

func (m *MockItemRepository) ShortCodeExists(ctx context.Context, shortCode string) (bool, error) {
	args := m.Called(ctx, shortCode)
	return args.Bool(0), args.Error(1)
}

func (m *MockItemRepository) AttachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	args := m.Called(ctx, itemID, labelID)
	return args.Error(0)
}

func (m *MockItemRepository) DetachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	args := m.Called(ctx, itemID, labelID)
	return args.Error(0)
}

func (m *MockItemRepository) GetItemLabels(ctx context.Context, itemID uuid.UUID) ([]uuid.UUID, error) {
	args := m.Called(ctx, itemID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

func newTestService(repo *MockRepository, catRepo *MockCategoryRepository, itemRepo *MockItemRepository) *Service {
	return NewService(repo, catRepo, itemRepo)
}

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("success without category", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		input := CreateInput{
			WorkspaceID: workspaceID,
			Name:        "Cordless Drill",
			Priority:    2,
		}

		repo.On("Save", ctx, mock.AnythingOfType("*wishlist.Item")).Return(nil)

		wish, err := svc.Create(ctx, input)

		assert.NoError(t, err)
		assert.NotNil(t, wish)
		assert.Equal(t, "Cordless Drill", wish.Name())
		assert.Equal(t, StatusWanted, wish.Status())
		repo.AssertExpectations(t)
		catRepo.AssertNotCalled(t, "FindByID")
	})

	t.Run("defaults priority when zero", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		input := CreateInput{
			WorkspaceID: workspaceID,
			Name:        "Spare Cables",
		}

		repo.On("Save", ctx, mock.AnythingOfType("*wishlist.Item")).Return(nil)

		wish, err := svc.Create(ctx, input)

		assert.NoError(t, err)
		assert.Equal(t, PriorityDefault, wish.Priority())
	})

	t.Run("validates desired category exists in workspace", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		categoryID := uuid.New()
		input := CreateInput{
			WorkspaceID:       workspaceID,
			Name:              "Cordless Drill",
			Priority:          1,
			DesiredCategoryID: &categoryID,
		}

		catRepo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, category.ErrCategoryNotFound)

		wish, err := svc.Create(ctx, input)

		assert.ErrorIs(t, err, category.ErrCategoryNotFound)
		assert.Nil(t, wish)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("error on invalid name", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		input := CreateInput{
			WorkspaceID: workspaceID,
			Name:        "   ",
			Priority:    1,
		}

		wish, err := svc.Create(ctx, input)

		assert.ErrorIs(t, err, ErrInvalidName)
		assert.Nil(t, wish)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("error on save", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		input := CreateInput{
			WorkspaceID: workspaceID,
			Name:        "Cordless Drill",
			Priority:    1,
		}

		repo.On("Save", ctx, mock.AnythingOfType("*wishlist.Item")).Return(assert.AnError)

		wish, err := svc.Create(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, wish)
	})
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	id := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish, _ := NewItem(workspaceID, "Drill", nil, nil, nil, nil, 1, nil, nil)
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)

		result, err := svc.GetByID(ctx, id, workspaceID)

		assert.NoError(t, err)
		assert.Equal(t, wish, result)
	})

	t.Run("not found", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		repo.On("FindByID", ctx, id, workspaceID).Return(nil, ErrItemNotFound)

		result, err := svc.GetByID(ctx, id, workspaceID)

		assert.ErrorIs(t, err, ErrItemNotFound)
		assert.Nil(t, result)
	})
}

func TestService_Update(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	id := uuid.New()

	newWish := func() *Item {
		wish, _ := NewItem(workspaceID, "Drill", nil, nil, nil, nil, 1, nil, nil)
		return wish
	}

	t.Run("updates details", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish := newWish()
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)
		repo.On("Save", ctx, wish).Return(nil)

		newName := "Better Drill"
		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{Name: &newName})

		assert.NoError(t, err)
		assert.Equal(t, "Better Drill", result.Name())
	})

	t.Run("not found", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		repo.On("FindByID", ctx, id, workspaceID).Return(nil, ErrItemNotFound)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{})

		assert.ErrorIs(t, err, ErrItemNotFound)
		assert.Nil(t, result)
	})

	t.Run("validates new desired category exists", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish := newWish()
		categoryID := uuid.New()
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)
		catRepo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, category.ErrCategoryNotFound)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{DesiredCategoryID: &categoryID})

		assert.ErrorIs(t, err, category.ErrCategoryNotFound)
		assert.Nil(t, result)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("status transition to acquired links item and does not require lookup when item id absent", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish := newWish()
		status := StatusAcquired
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)
		repo.On("Save", ctx, wish).Return(nil)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{Status: &status})

		assert.NoError(t, err)
		assert.Equal(t, StatusAcquired, result.Status())
		assert.Nil(t, result.AcquiredItemID())
		itemRepo.AssertNotCalled(t, "FindByID")
	})

	t.Run("status transition to acquired validates linked item exists in workspace", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish := newWish()
		status := StatusAcquired
		acquiredItemID := uuid.New()
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)
		itemRepo.On("FindByID", ctx, acquiredItemID, workspaceID).Return(nil, item.ErrItemNotFound)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{Status: &status, AcquiredItemID: &acquiredItemID})

		assert.ErrorIs(t, err, item.ErrItemNotFound)
		assert.Nil(t, result)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("plain status transition", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish := newWish()
		status := StatusOrdered
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)
		repo.On("Save", ctx, wish).Return(nil)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{Status: &status})

		assert.NoError(t, err)
		assert.Equal(t, StatusOrdered, result.Status())
	})

	t.Run("invalid status transition rejected before save", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish := newWish()
		_ = wish.TransitionStatus(StatusAcquired) // now terminal
		status := StatusOrdered
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{Status: &status})

		assert.ErrorIs(t, err, ErrInvalidStatusTransition)
		assert.Nil(t, result)
		repo.AssertNotCalled(t, "Save")
	})

	t.Run("late link of acquired item id without status change", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish := newWish()
		acquiredItemID := uuid.New()
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)
		itemRepo.On("FindByID", ctx, acquiredItemID, workspaceID).Return(&item.Item{}, nil)
		repo.On("Save", ctx, wish).Return(nil)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{AcquiredItemID: &acquiredItemID})

		assert.NoError(t, err)
		assert.Equal(t, StatusAcquired, result.Status())
		assert.Equal(t, &acquiredItemID, result.AcquiredItemID())
	})

	t.Run("error on save", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish := newWish()
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)
		repo.On("Save", ctx, wish).Return(assert.AnError)

		result, err := svc.Update(ctx, id, workspaceID, UpdateInput{})

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestService_Delete(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	id := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish, _ := NewItem(workspaceID, "Drill", nil, nil, nil, nil, 1, nil, nil)
		repo.On("FindByID", ctx, id, workspaceID).Return(wish, nil)
		repo.On("Delete", ctx, id, workspaceID).Return(nil)

		err := svc.Delete(ctx, id, workspaceID)

		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("not found", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		repo.On("FindByID", ctx, id, workspaceID).Return(nil, ErrItemNotFound)

		err := svc.Delete(ctx, id, workspaceID)

		assert.ErrorIs(t, err, ErrItemNotFound)
		repo.AssertNotCalled(t, "Delete")
	})
}

func TestService_List(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish, _ := NewItem(workspaceID, "Drill", nil, nil, nil, nil, 1, nil, nil)
		items := []*Item{wish}
		pagination := shared.DefaultPagination()
		repo.On("FindByWorkspace", ctx, workspaceID, (*Status)(nil), pagination).Return(items, 1, nil)

		result, total, err := svc.List(ctx, workspaceID, nil, pagination)

		assert.NoError(t, err)
		assert.Equal(t, 1, total)
		assert.Len(t, result, 1)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		pagination := shared.DefaultPagination()
		repo.On("FindByWorkspace", ctx, workspaceID, (*Status)(nil), pagination).Return(nil, 0, assert.AnError)

		result, total, err := svc.List(ctx, workspaceID, nil, pagination)

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Equal(t, 0, total)
	})

	t.Run("filters by status", func(t *testing.T) {
		repo := new(MockRepository)
		catRepo := new(MockCategoryRepository)
		itemRepo := new(MockItemRepository)
		svc := newTestService(repo, catRepo, itemRepo)

		wish, _ := NewItem(workspaceID, "Drill", nil, nil, nil, nil, 1, nil, nil)
		items := []*Item{wish}
		pagination := shared.DefaultPagination()
		status := StatusWanted
		repo.On("FindByWorkspace", ctx, workspaceID, &status, pagination).Return(items, 1, nil)

		result, total, err := svc.List(ctx, workspaceID, &status, pagination)

		assert.NoError(t, err)
		assert.Equal(t, 1, total)
		assert.Len(t, result, 1)
	})
}
