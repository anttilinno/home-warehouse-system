package item_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
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

func (m *MockService) ListFiltered(ctx context.Context, workspaceID uuid.UUID, filters item.ListFilters, pagination shared.Pagination) ([]*item.Item, int, error) {
	args := m.Called(ctx, workspaceID, filters, pagination)
	return args.Get(0).([]*item.Item), args.Int(1), args.Error(2)
}

func (m *MockService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) ListNeedingReview(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
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

func (m *MockService) LookupByBarcode(ctx context.Context, workspaceID uuid.UUID, code string) (*item.Item, error) {
	args := m.Called(ctx, workspaceID, code)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	t.Run("lists items successfully", func(t *testing.T) {
		item1, _ := item.NewItem(setup.WorkspaceID, "Item 1", "IT-001", 0)
		item2, _ := item.NewItem(setup.WorkspaceID, "Item 2", "IT-002", 0)
		items := []*item.Item{item1, item2}

		mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID, mock.Anything, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 25
		})).Return(items, 2, nil).Once()

		rec := setup.Get("/items")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID, mock.Anything, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return([]*item.Item{}, 50, nil).Once()

		rec := setup.Get("/items?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no items", func(t *testing.T) {
		mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID, mock.Anything, mock.Anything).
			Return([]*item.Item{}, 0, nil).Once()

		rec := setup.Get("/items")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

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

// NeedsReview Tests

func TestItemHandler_ListItems_FilterByNeedsReview(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	t.Run("filters items by needs_review=true", func(t *testing.T) {
		item1, _ := item.NewItem(setup.WorkspaceID, "Review Item", "REV-001", 0)
		item1.SetNeedsReview(true)
		items := []*item.Item{item1}

		mockSvc.On("ListNeedingReview", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 25
		})).Return(items, 1, nil).Once()

		rec := setup.Get("/items?needs_review=true")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("without needs_review filter calls ListFiltered", func(t *testing.T) {
		item1, _ := item.NewItem(setup.WorkspaceID, "Normal Item", "NRM-001", 0)
		items := []*item.Item{item1}

		mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID, mock.Anything, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 25
		})).Return(items, 1, nil).Once()

		rec := setup.Get("/items")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestItemHandler_CreateItem_WithNeedsReview(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	testItem, _ := item.NewItem(setup.WorkspaceID, "Quick Capture", "QC-001", 0)
	testItem.SetNeedsReview(true)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input item.CreateInput) bool {
		return input.Name == "Quick Capture" && input.NeedsReview != nil && *input.NeedsReview == true
	})).Return(testItem, nil).Once()

	body := `{"name":"Quick Capture","sku":"QC-001","min_stock_level":0,"needs_review":true}`
	rec := setup.Post("/items", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	assert.Contains(t, rec.Body.String(), `"needs_review":true`)
	mockSvc.AssertExpectations(t)
}

func TestItemHandler_UpdateItem_ClearNeedsReview(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	currentItem, _ := item.NewItem(setup.WorkspaceID, "Review Item", "REV-001", 0)
	currentItem.SetNeedsReview(true)
	itemID := currentItem.ID()

	updatedItem, _ := item.NewItem(setup.WorkspaceID, "Review Item", "REV-001", 0)
	// needs_review stays false (default)

	mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
		Return(currentItem, nil).Once()
	mockSvc.On("Update", mock.Anything, itemID, setup.WorkspaceID, mock.MatchedBy(func(input item.UpdateInput) bool {
		return input.NeedsReview != nil && *input.NeedsReview == false
	})).Return(updatedItem, nil).Once()

	body := `{"needs_review":false}`
	rec := setup.Patch(fmt.Sprintf("/items/%s", itemID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

// Event Publishing Tests

func TestItemHandler_Create_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	item.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), nil, nil)

	testItem, _ := item.NewItem(setup.WorkspaceID, "Test Item", "TEST-001", 0)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input item.CreateInput) bool {
		return input.Name == "Test Item" && input.SKU == "TEST-001"
	})).Return(testItem, nil).Once()

	body := `{"name":"Test Item","sku":"TEST-001","min_stock_level":0}`
	rec := setup.Post("/items", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "item.created", event.Type)
	assert.Equal(t, "item", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, testItem.ID().String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, testItem.ID(), event.Data["id"])
	assert.Equal(t, testItem.Name(), event.Data["name"])
	assert.Equal(t, testItem.SKU(), event.Data["sku"])
}

func TestItemHandler_Update_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	item.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), nil, nil)

	testItem, _ := item.NewItem(setup.WorkspaceID, "Updated Item", "TEST-001", 0)
	itemID := testItem.ID()

	// Mock GetByID first (handler calls it to get current item)
	currentItem, _ := item.NewItem(setup.WorkspaceID, "Original Item", "TEST-001", 0)
	mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
		Return(currentItem, nil).Once()

	mockSvc.On("Update", mock.Anything, itemID, setup.WorkspaceID, mock.Anything).
		Return(testItem, nil).Once()

	body := `{"name":"Updated Item"}`
	rec := setup.Patch(fmt.Sprintf("/items/%s", itemID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "item.updated", event.Type)
	assert.Equal(t, "item", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, itemID.String(), event.EntityID)
}

func TestItemHandler_Archive_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	item.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), nil, nil)

	itemID := uuid.New()

	mockSvc.On("Archive", mock.Anything, itemID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/items/%s/archive", itemID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "item.deleted", event.Type)
	assert.Equal(t, "item", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, itemID.String(), event.EntityID)
}

func TestItemHandler_Create_NilBroadcaster_NoError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	// Register with nil broadcaster
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	testItem, _ := item.NewItem(setup.WorkspaceID, "Test Item", "TEST-001", 0)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input item.CreateInput) bool {
		return input.Name == "Test Item"
	})).Return(testItem, nil).Once()

	body := `{"name":"Test Item","sku":"TEST-001","min_stock_level":0}`
	rec := setup.Post("/items", body)

	// Should not panic and should succeed
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

// Phase 60-01: Delete + filtered list tests

func TestItemHandler_Delete_Success(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	item.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), nil, nil)

	itemID := uuid.New()

	mockSvc.On("Delete", mock.Anything, itemID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Delete(fmt.Sprintf("/items/%s", itemID))

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "expected item.deleted event")
	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "item.deleted", event.Type)
	assert.Equal(t, "item", event.EntityType)
	assert.Equal(t, itemID.String(), event.EntityID)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	// Event payload must not leak item details (only user_name).
	if assert.NotNil(t, event.Data) {
		_, hasSKU := event.Data["sku"]
		_, hasName := event.Data["name"]
		assert.False(t, hasSKU, "event.data must not contain sku")
		assert.False(t, hasName, "event.data must not contain name")
	}
}

func TestItemHandler_Delete_CrossWorkspace_Returns404(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	itemID := uuid.New()
	mockSvc.On("Delete", mock.Anything, itemID, setup.WorkspaceID).
		Return(item.ErrItemNotFound).Once()

	rec := setup.Delete(fmt.Sprintf("/items/%s", itemID))

	testutil.AssertStatus(t, rec, http.StatusNotFound)
	mockSvc.AssertExpectations(t)
}

func TestItemHandler_List_Search_ForwardsToService(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID,
		mock.MatchedBy(func(f item.ListFilters) bool { return f.Search == "drill" }),
		mock.Anything).Return([]*item.Item{}, 0, nil).Once()

	rec := setup.Get("/items?search=drill")

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

func TestItemHandler_List_ArchivedTrue_ForwardsToService(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID,
		mock.MatchedBy(func(f item.ListFilters) bool { return f.IncludeArchived }),
		mock.Anything).Return([]*item.Item{}, 0, nil).Once()

	rec := setup.Get("/items?archived=true")

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

func TestItemHandler_List_Sort_ForwardsToService(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID,
		mock.MatchedBy(func(f item.ListFilters) bool {
			return f.Sort == "created_at" && f.SortDir == "desc"
		}),
		mock.Anything).Return([]*item.Item{}, 0, nil).Once()

	rec := setup.Get("/items?sort=created_at&sort_dir=desc")

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

func TestItemHandler_List_Sort_ValidatesEnum(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	rec := setup.Get("/items?sort=bogus")

	// huma enum validation rejects before reaching the service — accept
	// either 400 or 422 depending on huma's version mapping.
	assert.Contains(t, []int{http.StatusBadRequest, http.StatusUnprocessableEntity}, rec.Code,
		"expected 400 or 422 for invalid sort enum, got %d", rec.Code)
	// Service must not be invoked on validation failure.
	mockSvc.AssertNotCalled(t, "ListFiltered", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestItemHandler_List_Category_InvalidUUID_IgnoredNotErrored(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID,
		mock.MatchedBy(func(f item.ListFilters) bool { return f.CategoryID == nil }),
		mock.Anything).Return([]*item.Item{}, 0, nil).Once()

	rec := setup.Get("/items?category_id=not-a-uuid")

	// 200 OK, not 400 — malformed UUID is silently ignored per Pitfall 10.
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

func TestItemHandler_List_Category_ValidUUID_ForwardsPointer(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	catID := uuid.New()
	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID,
		mock.MatchedBy(func(f item.ListFilters) bool { return f.CategoryID != nil && *f.CategoryID == catID }),
		mock.Anything).Return([]*item.Item{}, 0, nil).Once()

	rec := setup.Get(fmt.Sprintf("/items?category_id=%s", catID))

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}

func TestItemHandler_List_TotalComputedCorrectly(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	// Two rows on the page, 47 total — with limit=25 expect TotalPages=2.
	it1, _ := item.NewItem(setup.WorkspaceID, "A", "TP-001", 0)
	it2, _ := item.NewItem(setup.WorkspaceID, "B", "TP-002", 0)
	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID, mock.Anything, mock.Anything).
		Return([]*item.Item{it1, it2}, 47, nil).Once()

	rec := setup.Get("/items?limit=25")

	testutil.AssertStatus(t, rec, http.StatusOK)

	var body struct {
		Total      int `json:"total"`
		Page       int `json:"page"`
		TotalPages int `json:"total_pages"`
	}
	require := assert.New(t)
	require.NoError(json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, 47, body.Total)
	assert.Equal(t, 2, body.TotalPages)
	assert.Equal(t, 1, body.Page)
	mockSvc.AssertExpectations(t)
}

// mockPrimaryPhotoLookup implements item.PrimaryPhotoLookup for tests that
// exercise the primary-photo decoration path.
type mockPrimaryPhotoLookup struct {
	mock.Mock
}

func (m *mockPrimaryPhotoLookup) GetPrimary(ctx context.Context, itemID, workspaceID uuid.UUID) (*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, itemID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*itemphoto.ItemPhoto), args.Error(1)
}

func (m *mockPrimaryPhotoLookup) ListPrimaryByItemIDs(ctx context.Context, workspaceID uuid.UUID, itemIDs []uuid.UUID) (map[uuid.UUID]*itemphoto.ItemPhoto, error) {
	args := m.Called(ctx, workspaceID, itemIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[uuid.UUID]*itemphoto.ItemPhoto), args.Error(1)
}

func testPhotoURLGen(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
	if isThumbnail {
		return fmt.Sprintf("/ws/%s/items/%s/photos/%s/thumbnail", workspaceID, itemID, photoID)
	}
	return fmt.Sprintf("/ws/%s/items/%s/photos/%s", workspaceID, itemID, photoID)
}

func TestItemHandler_List_IncludesPrimaryPhotoThumbnailURL(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockPhotos := new(mockPrimaryPhotoLookup)
	item.RegisterRoutes(setup.API, mockSvc, nil, mockPhotos, testPhotoURLGen)

	testItem, _ := item.NewItem(setup.WorkspaceID, "HasPhoto", "PH-001", 0)
	photoID := uuid.New()
	primaryPhoto := &itemphoto.ItemPhoto{
		ID:              photoID,
		ItemID:          testItem.ID(),
		WorkspaceID:     setup.WorkspaceID,
		Filename:        "primary.jpg",
		IsPrimary:       true,
		ThumbnailStatus: itemphoto.ThumbnailStatusComplete,
	}

	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID, mock.Anything, mock.Anything).
		Return([]*item.Item{testItem}, 1, nil).Once()
	mockPhotos.On("ListPrimaryByItemIDs", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(ids []uuid.UUID) bool {
		return len(ids) == 1 && ids[0] == testItem.ID()
	})).Return(map[uuid.UUID]*itemphoto.ItemPhoto{testItem.ID(): primaryPhoto}, nil).Once()

	rec := setup.Get("/items")

	testutil.AssertStatus(t, rec, http.StatusOK)
	assert.Contains(t, rec.Body.String(), `"primary_photo_thumbnail_url"`,
		"list response must include primary_photo_thumbnail_url when a primary photo exists")
	assert.Contains(t, rec.Body.String(), `"primary_photo_url"`,
		"list response must include primary_photo_url when a primary photo exists")
	mockSvc.AssertExpectations(t)
	mockPhotos.AssertExpectations(t)
}

func TestItemHandler_List_OmitsPrimaryPhotoFieldsWhenNoPrimary(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockPhotos := new(mockPrimaryPhotoLookup)
	item.RegisterRoutes(setup.API, mockSvc, nil, mockPhotos, testPhotoURLGen)

	testItem, _ := item.NewItem(setup.WorkspaceID, "NoPhoto", "NP-001", 0)

	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID, mock.Anything, mock.Anything).
		Return([]*item.Item{testItem}, 1, nil).Once()
	mockPhotos.On("ListPrimaryByItemIDs", mock.Anything, setup.WorkspaceID, mock.Anything).
		Return(map[uuid.UUID]*itemphoto.ItemPhoto{}, nil).Once()

	rec := setup.Get("/items")

	testutil.AssertStatus(t, rec, http.StatusOK)
	assert.NotContains(t, rec.Body.String(), `"primary_photo_thumbnail_url"`,
		"omitempty must hide primary_photo_thumbnail_url when no primary exists")
	assert.NotContains(t, rec.Body.String(), `"primary_photo_url"`,
		"omitempty must hide primary_photo_url when no primary exists")
	mockSvc.AssertExpectations(t)
	mockPhotos.AssertExpectations(t)
}

func TestItemHandler_Detail_IncludesPrimaryPhotoURL(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockPhotos := new(mockPrimaryPhotoLookup)
	item.RegisterRoutes(setup.API, mockSvc, nil, mockPhotos, testPhotoURLGen)

	testItem, _ := item.NewItem(setup.WorkspaceID, "DetailItem", "DT-001", 0)
	itemID := testItem.ID()
	photoID := uuid.New()
	primaryPhoto := &itemphoto.ItemPhoto{
		ID:              photoID,
		ItemID:          itemID,
		WorkspaceID:     setup.WorkspaceID,
		Filename:        "primary.jpg",
		IsPrimary:       true,
		ThumbnailStatus: itemphoto.ThumbnailStatusComplete,
	}

	mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
		Return(testItem, nil).Once()
	mockPhotos.On("GetPrimary", mock.Anything, itemID, setup.WorkspaceID).
		Return(primaryPhoto, nil).Once()

	rec := setup.Get(fmt.Sprintf("/items/%s", itemID))

	testutil.AssertStatus(t, rec, http.StatusOK)
	assert.Contains(t, rec.Body.String(), `"primary_photo_thumbnail_url"`,
		"detail response must include primary_photo_thumbnail_url when a primary exists")
	mockSvc.AssertExpectations(t)
	mockPhotos.AssertExpectations(t)
}

func TestItemHandler_List_PhotoLookupErrorDegradesToNoThumbnail(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockPhotos := new(mockPrimaryPhotoLookup)
	item.RegisterRoutes(setup.API, mockSvc, nil, mockPhotos, testPhotoURLGen)

	testItem, _ := item.NewItem(setup.WorkspaceID, "ErrItem", "ER-001", 0)

	mockSvc.On("ListFiltered", mock.Anything, setup.WorkspaceID, mock.Anything, mock.Anything).
		Return([]*item.Item{testItem}, 1, nil).Once()
	mockPhotos.On("ListPrimaryByItemIDs", mock.Anything, setup.WorkspaceID, mock.Anything).
		Return(nil, errors.New("db down")).Once()

	rec := setup.Get("/items")

	// Photo lookup failure must NOT fail the request — thumbnails are decorative.
	testutil.AssertStatus(t, rec, http.StatusOK)
	assert.NotContains(t, rec.Body.String(), `"primary_photo_thumbnail_url"`)
	mockSvc.AssertExpectations(t)
	mockPhotos.AssertExpectations(t)
}

func TestItemHandler_Restore_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	item.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster(), nil, nil)

	itemID := uuid.New()

	mockSvc.On("Restore", mock.Anything, itemID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/items/%s/restore", itemID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event (restore emits item.created event)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "item.created", event.Type) // Restore emits created event
	assert.Equal(t, "item", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, itemID.String(), event.EntityID)
}

// TestItemHandler_LookupByBarcode covers the Phase 65 Gap G-65-01 closure
// handler-level surface: GET /items/by-barcode/{code} exposed because the FTS
// search_vector only covers (name, brand, model, description) — barcode scans
// from the frontend were returning total:0 for real barcodes. The handler
// delegates to svc.LookupByBarcode (btree ix_items_barcode) and maps
// ErrItemNotFound → 404, invalid path params → 400/422.
//
// NOTE on test coverage scope: at the handler unit-test layer with a mocked
// service, "item exists in another workspace" is indistinguishable from
// "item never existed" — both surface as svc.LookupByBarcode returning
// ErrItemNotFound. Cross-tenant scoping is enforced at the repo SQL layer
// (items.sql: WHERE workspace_id = $1 AND barcode = $2) and is verified at
// the integration-test layer (65-11 Option B if chosen). This test asserts
// the handler contract: 404 when the service says not-found, regardless of
// why.
func TestItemHandler_LookupByBarcode(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	item.RegisterRoutes(setup.API, mockSvc, nil, nil, nil)

	t.Run("returns 200 with item on exact-barcode match (G-65-01 happy path)", func(t *testing.T) {
		// NewItem(workspaceID, name, sku, minStockLevel) — does NOT accept
		// barcode (see entity.go). There is no public SetBarcode setter; the
		// only in-place path is (*Item).Update(UpdateInput{...}), which is
		// overkill for a handler test where the service is mocked. We assert
		// on ID / Name / WorkspaceID / SKU only — the Barcode response-field
		// shape is locked by the ItemResponse struct + toItemResponse mapping.
		testItem, _ := item.NewItem(setup.WorkspaceID, "Coca-Cola Original Taste", "ITEM-1", 0)

		mockSvc.On("LookupByBarcode", mock.Anything, setup.WorkspaceID, "5449000000996").
			Return(testItem, nil).Once()

		rec := setup.Get("/items/by-barcode/5449000000996")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)

		var body item.ItemResponse
		err := json.Unmarshal(rec.Body.Bytes(), &body)
		assert.NoError(t, err)
		assert.Equal(t, testItem.ID(), body.ID)
		assert.Equal(t, setup.WorkspaceID, body.WorkspaceID)
		assert.Equal(t, "Coca-Cola Original Taste", body.Name)
		assert.Equal(t, "ITEM-1", body.SKU)
	})

	t.Run("returns 404 when no item matches (covers not-exists and cross-workspace cases at this layer)", func(t *testing.T) {
		// Per D-08 + the repo-layer WHERE workspace_id = $1, a code that
		// exists only in another workspace is equivalent to "not found" from
		// THIS workspace's perspective — FindByBarcode's SQL clause guarantees
		// this at the DB layer, and svc.LookupByBarcode surfaces ErrItemNotFound
		// in both cases. The handler test asserts the same 404 surface holds.
		mockSvc.On("LookupByBarcode", mock.Anything, setup.WorkspaceID, "UNKNOWN-CODE").
			Return(nil, item.ErrItemNotFound).Once()

		rec := setup.Get("/items/by-barcode/UNKNOWN-CODE")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on unexpected service error", func(t *testing.T) {
		mockSvc.On("LookupByBarcode", mock.Anything, setup.WorkspaceID, "OPAQUE").
			Return(nil, errors.New("db connection reset")).Once()

		rec := setup.Get("/items/by-barcode/OPAQUE")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422/400 when code exceeds maxLength:64 (huma path validation)", func(t *testing.T) {
		longCode := strings.Repeat("A", 65)
		rec := setup.Get(fmt.Sprintf("/items/by-barcode/%s", longCode))

		// Huma maps path minLength/maxLength violations to 422 by default but
		// some middleware stacks surface 400 — accept either per the
		// convention used elsewhere in the suite for validator rejections.
		assert.Contains(t, []int{http.StatusBadRequest, http.StatusUnprocessableEntity}, rec.Code,
			"expected 400 or 422 for oversize barcode, got %d; body=%s", rec.Code, rec.Body.String())

		// Service must NOT be called when validation rejects the input
		mockSvc.AssertNotCalled(t, "LookupByBarcode", mock.Anything, mock.Anything, longCode)
	})

	t.Run("case-sensitivity: uppercase and lowercase are distinct codes (D-07 at the HTTP boundary)", func(t *testing.T) {
		// The service is asked with the EXACT path-param value — no
		// normalisation at the handler layer. Upper-case code gets an
		// upper-case call; lower-case gets lower-case. This is a behavioural
		// guard that the handler does not lowercase the path param before
		// passing to the service.
		mockSvc.On("LookupByBarcode", mock.Anything, setup.WorkspaceID, "ABC-123").
			Return(nil, item.ErrItemNotFound).Once()
		mockSvc.On("LookupByBarcode", mock.Anything, setup.WorkspaceID, "abc-123").
			Return(nil, item.ErrItemNotFound).Once()

		rec1 := setup.Get("/items/by-barcode/ABC-123")
		rec2 := setup.Get("/items/by-barcode/abc-123")

		testutil.AssertStatus(t, rec1, http.StatusNotFound)
		testutil.AssertStatus(t, rec2, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}
