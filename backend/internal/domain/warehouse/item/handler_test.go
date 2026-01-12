package item_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements item.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input item.CreateInput) (*item.Item, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockService) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*item.Item), args.Int(1), args.Error(2)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input item.UpdateInput) (*item.Item, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*item.Item, error) {
	args := m.Called(ctx, workspaceID, query, limit)
	return args.Get(0).([]*item.Item), args.Error(1)
}

func (m *MockService) ListByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*item.Item, error) {
	args := m.Called(ctx, workspaceID, categoryID, pagination)
	return args.Get(0).([]*item.Item), args.Error(1)
}

func (m *MockService) AttachLabel(ctx context.Context, itemID, labelID, workspaceID uuid.UUID) error {
	args := m.Called(ctx, itemID, labelID, workspaceID)
	return args.Error(0)
}

func (m *MockService) DetachLabel(ctx context.Context, itemID, labelID, workspaceID uuid.UUID) error {
	args := m.Called(ctx, itemID, labelID, workspaceID)
	return args.Error(0)
}

func (m *MockService) GetItemLabels(ctx context.Context, itemID, workspaceID uuid.UUID) ([]uuid.UUID, error) {
	args := m.Called(ctx, itemID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

// Tests

func TestItemHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("creates item successfully", func(t *testing.T) {
		testItem, _ := item.NewItem(setup.WorkspaceID, "Laptop", "LAP-001", 0)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input item.CreateInput) bool {
			return input.Name == "Laptop" && input.SKU == "LAP-001"
		})).Return(testItem, nil).Once()

		body := `{"name":"Laptop","sku":"LAP-001","min_stock_level":0}`
		rec := setup.Post("/items", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for duplicate SKU", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, item.ErrSKUTaken).Once()

		body := `{"name":"Laptop","sku":"LAP-001","min_stock_level":0}`
		rec := setup.Post("/items", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for duplicate short code", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, item.ErrShortCodeTaken).Once()

		body := `{"name":"Laptop","sku":"LAP-001","short_code":"SC001","min_stock_level":0}`
		rec := setup.Post("/items", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid min stock level", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		body := `{"name":"Laptop","sku":"LAP-001","min_stock_level":-1}`
		rec := setup.Post("/items", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestItemHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists items successfully", func(t *testing.T) {
		item1, _ := item.NewItem(setup.WorkspaceID, "Item 1", "IT-001", 0)
		item2, _ := item.NewItem(setup.WorkspaceID, "Item 2", "IT-002", 0)
		items := []*item.Item{item1, item2}

		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(items, 2, nil).Once()

		rec := setup.Get("/items")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return([]*item.Item{}, 50, nil).Once()

		rec := setup.Get("/items?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no items", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*item.Item{}, 0, nil).Once()

		rec := setup.Get("/items")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets item by ID", func(t *testing.T) {
		testItem, _ := item.NewItem(setup.WorkspaceID, "Laptop", "LAP-001", 0)
		itemID := testItem.ID()

		mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
			Return(testItem, nil).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when item not found", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
			Return(nil, item.ErrItemNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s", itemID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("updates item successfully", func(t *testing.T) {
		testItem, _ := item.NewItem(setup.WorkspaceID, "Updated Laptop", "LAP-001", 0)
		itemID := testItem.ID()

		// Mock GetByID first (handler calls it to get current item)
		currentItem, _ := item.NewItem(setup.WorkspaceID, "Laptop", "LAP-001", 0)
		mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
			Return(currentItem, nil).Once()

		mockSvc.On("Update", mock.Anything, itemID, setup.WorkspaceID, mock.Anything).
			Return(testItem, nil).Once()

		body := `{"name":"Updated Laptop"}`
		rec := setup.Patch(fmt.Sprintf("/items/%s", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when item not found", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
			Return(nil, item.ErrItemNotFound).Once()

		body := `{"name":"Updated"}`
		rec := setup.Patch(fmt.Sprintf("/items/%s", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid min stock level", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		itemID := uuid.New()

		body := `{"min_stock_level":-1}`
		rec := setup.Patch(fmt.Sprintf("/items/%s", itemID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestItemHandler_Archive(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("archives item successfully", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("Archive", mock.Anything, itemID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/items/%s/archive", itemID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when item not found", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("Archive", mock.Anything, itemID, setup.WorkspaceID).
			Return(item.ErrItemNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/items/%s/archive", itemID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_Restore(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("restores item successfully", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("Restore", mock.Anything, itemID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/items/%s/restore", itemID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when item not found", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("Restore", mock.Anything, itemID, setup.WorkspaceID).
			Return(item.ErrItemNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/items/%s/restore", itemID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_Search(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("searches items successfully", func(t *testing.T) {
		testItem, _ := item.NewItem(setup.WorkspaceID, "Laptop", "LAP-001", 0)
		items := []*item.Item{testItem}

		mockSvc.On("Search", mock.Anything, setup.WorkspaceID, "laptop", 50).
			Return(items, nil).Once()

		rec := setup.Get("/items/search?q=laptop")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles custom limit", func(t *testing.T) {
		mockSvc.On("Search", mock.Anything, setup.WorkspaceID, "laptop", 10).
			Return([]*item.Item{}, nil).Once()

		rec := setup.Get("/items/search?q=laptop&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty results when no matches", func(t *testing.T) {
		mockSvc.On("Search", mock.Anything, setup.WorkspaceID, "nonexistent", 50).
			Return([]*item.Item{}, nil).Once()

		rec := setup.Get("/items/search?q=nonexistent")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_ListByCategory(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists items by category successfully", func(t *testing.T) {
		categoryID := uuid.New()
		testItem, _ := item.NewItem(setup.WorkspaceID, "Laptop", "LAP-001", 0)
		items := []*item.Item{testItem}

		mockSvc.On("ListByCategory", mock.Anything, setup.WorkspaceID, categoryID, mock.Anything).
			Return(items, nil).Once()

		rec := setup.Get(fmt.Sprintf("/items/by-category/%s", categoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when category has no items", func(t *testing.T) {
		categoryID := uuid.New()

		mockSvc.On("ListByCategory", mock.Anything, setup.WorkspaceID, categoryID, mock.Anything).
			Return([]*item.Item{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/items/by-category/%s", categoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_GetItemLabels(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets item labels successfully", func(t *testing.T) {
		itemID := uuid.New()
		labelIDs := []uuid.UUID{uuid.New(), uuid.New()}

		mockSvc.On("GetItemLabels", mock.Anything, itemID, setup.WorkspaceID).
			Return(labelIDs, nil).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s/labels", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when item not found", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("GetItemLabels", mock.Anything, itemID, setup.WorkspaceID).
			Return(nil, item.ErrItemNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/items/%s/labels", itemID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_AttachLabel(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("attaches label successfully", func(t *testing.T) {
		itemID := uuid.New()
		labelID := uuid.New()

		mockSvc.On("AttachLabel", mock.Anything, itemID, labelID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/items/%s/labels/%s", itemID, labelID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when item not found", func(t *testing.T) {
		itemID := uuid.New()
		labelID := uuid.New()

		mockSvc.On("AttachLabel", mock.Anything, itemID, labelID, setup.WorkspaceID).
			Return(item.ErrItemNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/items/%s/labels/%s", itemID, labelID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_DetachLabel(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("detaches label successfully", func(t *testing.T) {
		itemID := uuid.New()
		labelID := uuid.New()

		mockSvc.On("DetachLabel", mock.Anything, itemID, labelID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/items/%s/labels/%s", itemID, labelID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when item not found", func(t *testing.T) {
		itemID := uuid.New()
		labelID := uuid.New()

		mockSvc.On("DetachLabel", mock.Anything, itemID, labelID, setup.WorkspaceID).
			Return(item.ErrItemNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/items/%s/labels/%s", itemID, labelID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}
