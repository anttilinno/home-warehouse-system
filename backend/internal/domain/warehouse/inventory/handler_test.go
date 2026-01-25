package inventory_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements inventory.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input inventory.CreateInput) (*inventory.Inventory, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input inventory.UpdateInput) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}

func (m *MockService) UpdateStatus(ctx context.Context, id, workspaceID uuid.UUID, status inventory.Status) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID, status)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}

func (m *MockService) UpdateQuantity(ctx context.Context, id, workspaceID uuid.UUID, quantity int) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID, quantity)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}

func (m *MockService) Move(ctx context.Context, id, workspaceID, locationID uuid.UUID, containerID *uuid.UUID) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID, locationID, containerID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}

func (m *MockService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) ListByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockService) ListByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, locationID)
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockService) ListByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, containerID)
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockService) GetAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Get(0).([]*inventory.Inventory), args.Error(1)
}

func (m *MockService) GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error) {
	args := m.Called(ctx, workspaceID, itemID)
	return args.Int(0), args.Error(1)
}

func (m *MockService) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*inventory.Inventory, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*inventory.Inventory), args.Int(1), args.Error(2)
}

// Tests

func TestInventoryHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("creates inventory successfully", func(t *testing.T) {
		itemID := uuid.New()
		locationID := uuid.New()
		dateAcquired := time.Now()

		testInv, _ := inventory.NewInventory(
			setup.WorkspaceID,
			itemID,
			locationID,
			nil,
			10,
			inventory.ConditionNew,
			inventory.StatusAvailable,
			nil,
		)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input inventory.CreateInput) bool {
			return input.ItemID == itemID && input.Quantity == 10 && input.Condition == inventory.ConditionNew
		})).Return(testInv, nil).Once()

		body := fmt.Sprintf(`{"item_id":"%s","location_id":"%s","quantity":10,"condition":"NEW","status":"AVAILABLE","date_acquired":"%s"}`,
			itemID, locationID, dateAcquired.Format(time.RFC3339))
		rec := setup.Post("/inventory", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid condition", func(t *testing.T) {
		// Huma validates enum at framework level before handler, returning 422
		body := `{"item_id":"00000000-0000-0000-0000-000000000000","location_id":"00000000-0000-0000-0000-000000000000","quantity":1,"condition":"INVALID","status":"AVAILABLE"}`
		rec := setup.Post("/inventory", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 422 for invalid quantity", func(t *testing.T) {
		// Huma validates minimum:1 at framework level, returning 422
		body := `{"item_id":"00000000-0000-0000-0000-000000000000","location_id":"00000000-0000-0000-0000-000000000000","quantity":0,"condition":"NEW","status":"AVAILABLE"}`
		rec := setup.Post("/inventory", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestInventoryHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets inventory by ID", func(t *testing.T) {
		itemID := uuid.New()
		locationID := uuid.New()
		testInv, _ := inventory.NewInventory(
			setup.WorkspaceID,
			itemID,
			locationID,
			nil,
			5,
			inventory.ConditionGood,
			inventory.StatusAvailable,
			nil,
		)
		invID := testInv.ID()

		mockSvc.On("GetByID", mock.Anything, invID, setup.WorkspaceID).
			Return(testInv, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s", invID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when inventory not found", func(t *testing.T) {
		invID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, invID, setup.WorkspaceID).
			Return(nil, inventory.ErrInventoryNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s", invID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestInventoryHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("updates inventory successfully", func(t *testing.T) {
		itemID := uuid.New()
		locationID := uuid.New()
		testInv, _ := inventory.NewInventory(
			setup.WorkspaceID,
			itemID,
			locationID,
			nil,
			15,
			inventory.ConditionExcellent,
			inventory.StatusAvailable,
			nil,
		)
		invID := testInv.ID()

		mockSvc.On("Update", mock.Anything, invID, setup.WorkspaceID, mock.Anything).
			Return(testInv, nil).Once()

		body := fmt.Sprintf(`{"location_id":"%s","quantity":15,"condition":"EXCELLENT"}`, locationID)
		rec := setup.Patch(fmt.Sprintf("/inventory/%s", invID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when inventory not found", func(t *testing.T) {
		invID := uuid.New()
		locationID := uuid.New()

		mockSvc.On("Update", mock.Anything, invID, setup.WorkspaceID, mock.Anything).
			Return(nil, inventory.ErrInventoryNotFound).Once()

		body := fmt.Sprintf(`{"location_id":"%s","quantity":10,"condition":"GOOD"}`, locationID)
		rec := setup.Patch(fmt.Sprintf("/inventory/%s", invID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestInventoryHandler_UpdateStatus(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("updates inventory status successfully", func(t *testing.T) {
		itemID := uuid.New()
		locationID := uuid.New()
		testInv, _ := inventory.NewInventory(
			setup.WorkspaceID,
			itemID,
			locationID,
			nil,
			5,
			inventory.ConditionGood,
			inventory.StatusReserved,
			nil,
		)
		invID := testInv.ID()

		mockSvc.On("UpdateStatus", mock.Anything, invID, setup.WorkspaceID, inventory.StatusReserved).
			Return(testInv, nil).Once()

		body := `{"status":"RESERVED"}`
		rec := setup.Patch(fmt.Sprintf("/inventory/%s/status", invID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid status", func(t *testing.T) {
		invID := uuid.New()

		// Huma validates enum at framework level before handler, returning 422
		body := `{"status":"INVALID"}`
		rec := setup.Patch(fmt.Sprintf("/inventory/%s/status", invID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestInventoryHandler_UpdateQuantity(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("updates inventory quantity successfully", func(t *testing.T) {
		itemID := uuid.New()
		locationID := uuid.New()
		testInv, _ := inventory.NewInventory(
			setup.WorkspaceID,
			itemID,
			locationID,
			nil,
			20,
			inventory.ConditionGood,
			inventory.StatusAvailable,
			nil,
		)
		invID := testInv.ID()

		mockSvc.On("UpdateQuantity", mock.Anything, invID, setup.WorkspaceID, 20).
			Return(testInv, nil).Once()

		body := `{"quantity":20}`
		rec := setup.Patch(fmt.Sprintf("/inventory/%s/quantity", invID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid quantity", func(t *testing.T) {
		invID := uuid.New()

		mockSvc.On("UpdateQuantity", mock.Anything, invID, setup.WorkspaceID, 0).
			Return(nil, inventory.ErrInsufficientQuantity).Once()

		body := `{"quantity":0}`
		rec := setup.Patch(fmt.Sprintf("/inventory/%s/quantity", invID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestInventoryHandler_Move(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("moves inventory successfully", func(t *testing.T) {
		itemID := uuid.New()
		newLocationID := uuid.New()
		testInv, _ := inventory.NewInventory(
			setup.WorkspaceID,
			itemID,
			newLocationID,
			nil,
			5,
			inventory.ConditionGood,
			inventory.StatusAvailable,
			nil,
		)
		invID := testInv.ID()

		mockSvc.On("Move", mock.Anything, invID, setup.WorkspaceID, newLocationID, (*uuid.UUID)(nil)).
			Return(testInv, nil).Once()

		body := fmt.Sprintf(`{"location_id":"%s"}`, newLocationID)
		rec := setup.Post(fmt.Sprintf("/inventory/%s/move", invID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when inventory not found", func(t *testing.T) {
		invID := uuid.New()
		locationID := uuid.New()

		mockSvc.On("Move", mock.Anything, invID, setup.WorkspaceID, locationID, (*uuid.UUID)(nil)).
			Return(nil, inventory.ErrInventoryNotFound).Once()

		body := fmt.Sprintf(`{"location_id":"%s"}`, locationID)
		rec := setup.Post(fmt.Sprintf("/inventory/%s/move", invID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestInventoryHandler_ListByItem(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists inventory by item successfully", func(t *testing.T) {
		itemID := uuid.New()
		locationID := uuid.New()
		inv1, _ := inventory.NewInventory(setup.WorkspaceID, itemID, locationID, nil, 5, inventory.ConditionGood, inventory.StatusAvailable, nil)
		inventories := []*inventory.Inventory{inv1}

		mockSvc.On("ListByItem", mock.Anything, setup.WorkspaceID, itemID).
			Return(inventories, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/by-item/%s", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestInventoryHandler_GetAvailable(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets available inventory for item", func(t *testing.T) {
		itemID := uuid.New()
		locationID := uuid.New()
		inv1, _ := inventory.NewInventory(setup.WorkspaceID, itemID, locationID, nil, 5, inventory.ConditionGood, inventory.StatusAvailable, nil)
		inventories := []*inventory.Inventory{inv1}

		mockSvc.On("GetAvailable", mock.Anything, setup.WorkspaceID, itemID).
			Return(inventories, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/available/%s", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestInventoryHandler_GetTotalQuantity(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets total quantity for item", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("GetTotalQuantity", mock.Anything, setup.WorkspaceID, itemID).
			Return(42, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/total-quantity/%s", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestInventoryHandler_Archive(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("archives inventory successfully", func(t *testing.T) {
		invID := uuid.New()

		mockSvc.On("Archive", mock.Anything, invID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/inventory/%s/archive", invID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when inventory not found", func(t *testing.T) {
		invID := uuid.New()

		mockSvc.On("Archive", mock.Anything, invID, setup.WorkspaceID).
			Return(inventory.ErrInventoryNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/inventory/%s/archive", invID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestInventoryHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists inventory with default pagination", func(t *testing.T) {
		itemID1 := uuid.New()
		itemID2 := uuid.New()
		locationID := uuid.New()

		inv1, _ := inventory.NewInventory(setup.WorkspaceID, itemID1, locationID, nil, 5, inventory.ConditionNew, inventory.StatusAvailable, nil)
		inv2, _ := inventory.NewInventory(setup.WorkspaceID, itemID2, locationID, nil, 3, inventory.ConditionGood, inventory.StatusAvailable, nil)

		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return([]*inventory.Inventory{inv1, inv2}, 2, nil).Once()

		rec := setup.Get("/inventory")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("lists inventory with custom pagination", func(t *testing.T) {
		itemID1 := uuid.New()
		locationID := uuid.New()

		inv1, _ := inventory.NewInventory(setup.WorkspaceID, itemID1, locationID, nil, 5, inventory.ConditionNew, inventory.StatusAvailable, nil)

		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return([]*inventory.Inventory{inv1}, 25, nil).Once()

		rec := setup.Get("/inventory?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no inventory found", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*inventory.Inventory{}, 0, nil).Once()

		rec := setup.Get("/inventory")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles page beyond total pages", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 999
		})).Return([]*inventory.Inventory{}, 10, nil).Once()

		rec := setup.Get("/inventory?page=999")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for limit exceeding maximum", func(t *testing.T) {
		// Huma validates maximum:100 at framework level, returning 422
		rec := setup.Get("/inventory?limit=500")

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 422 for invalid page number", func(t *testing.T) {
		// Huma validates minimum:1 at framework level, returning 422
		rec := setup.Get("/inventory?page=0")

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 422 for negative limit", func(t *testing.T) {
		// Huma validates minimum:1 at framework level, returning 422
		rec := setup.Get("/inventory?limit=-1")

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*inventory.Inventory{}, 0, fmt.Errorf("database error")).Once()

		rec := setup.Get("/inventory")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestInventoryHandler_Create_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	inventory.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	itemID := uuid.New()
	locationID := uuid.New()
	testInv, _ := inventory.NewInventory(
		setup.WorkspaceID,
		itemID,
		locationID,
		nil,
		10,
		inventory.ConditionNew,
		inventory.StatusAvailable,
		nil,
	)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input inventory.CreateInput) bool {
		return input.ItemID == itemID && input.Quantity == 10
	})).Return(testInv, nil).Once()

	body := fmt.Sprintf(`{"item_id":"%s","location_id":"%s","quantity":10,"condition":"NEW","status":"AVAILABLE"}`,
		itemID, locationID)
	rec := setup.Post("/inventory", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "inventory.created", event.Type)
	assert.Equal(t, "inventory", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, testInv.ID().String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, testInv.ID(), event.Data["id"])
	assert.Equal(t, testInv.ItemID(), event.Data["item_id"])
}

func TestInventoryHandler_Update_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	inventory.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	itemID := uuid.New()
	locationID := uuid.New()
	testInv, _ := inventory.NewInventory(
		setup.WorkspaceID,
		itemID,
		locationID,
		nil,
		15,
		inventory.ConditionExcellent,
		inventory.StatusAvailable,
		nil,
	)
	invID := testInv.ID()

	mockSvc.On("Update", mock.Anything, invID, setup.WorkspaceID, mock.Anything).
		Return(testInv, nil).Once()

	body := fmt.Sprintf(`{"location_id":"%s","quantity":15,"condition":"EXCELLENT"}`, locationID)
	rec := setup.Patch(fmt.Sprintf("/inventory/%s", invID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "inventory.updated", event.Type)
	assert.Equal(t, "inventory", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, invID.String(), event.EntityID)
}

func TestInventoryHandler_UpdateStatus_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	inventory.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	itemID := uuid.New()
	locationID := uuid.New()
	testInv, _ := inventory.NewInventory(
		setup.WorkspaceID,
		itemID,
		locationID,
		nil,
		5,
		inventory.ConditionGood,
		inventory.StatusInUse,
		nil,
	)
	invID := testInv.ID()

	mockSvc.On("UpdateStatus", mock.Anything, invID, setup.WorkspaceID, inventory.StatusInUse).
		Return(testInv, nil).Once()

	body := `{"status":"IN_USE"}`
	rec := setup.Patch(fmt.Sprintf("/inventory/%s/status", invID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event - UpdateStatus emits inventory.updated (not a specialized event type)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "inventory.updated", event.Type)
	assert.Equal(t, "inventory", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, invID.String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, inventory.StatusInUse, event.Data["status"])
}

func TestInventoryHandler_UpdateQuantity_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	inventory.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	itemID := uuid.New()
	locationID := uuid.New()
	testInv, _ := inventory.NewInventory(
		setup.WorkspaceID,
		itemID,
		locationID,
		nil,
		25,
		inventory.ConditionGood,
		inventory.StatusAvailable,
		nil,
	)
	invID := testInv.ID()

	mockSvc.On("UpdateQuantity", mock.Anything, invID, setup.WorkspaceID, 25).
		Return(testInv, nil).Once()

	body := `{"quantity":25}`
	rec := setup.Patch(fmt.Sprintf("/inventory/%s/quantity", invID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event - UpdateQuantity emits inventory.updated (not a specialized event type)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "inventory.updated", event.Type)
	assert.Equal(t, "inventory", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, invID.String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, 25, event.Data["quantity"])
}

func TestInventoryHandler_Move_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	inventory.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	itemID := uuid.New()
	newLocationID := uuid.New()
	testInv, _ := inventory.NewInventory(
		setup.WorkspaceID,
		itemID,
		newLocationID,
		nil,
		5,
		inventory.ConditionGood,
		inventory.StatusAvailable,
		nil,
	)
	invID := testInv.ID()

	mockSvc.On("Move", mock.Anything, invID, setup.WorkspaceID, newLocationID, (*uuid.UUID)(nil)).
		Return(testInv, nil).Once()

	body := fmt.Sprintf(`{"location_id":"%s"}`, newLocationID)
	rec := setup.Post(fmt.Sprintf("/inventory/%s/move", invID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event - Move emits inventory.updated (not a specialized event type)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "inventory.updated", event.Type)
	assert.Equal(t, "inventory", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, invID.String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, newLocationID, event.Data["location_id"])
}

func TestInventoryHandler_Archive_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	inventory.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	invID := uuid.New()

	mockSvc.On("Archive", mock.Anything, invID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/inventory/%s/archive", invID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "inventory.deleted", event.Type)
	assert.Equal(t, "inventory", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, invID.String(), event.EntityID)
}

func TestInventoryHandler_Restore_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	inventory.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	invID := uuid.New()

	mockSvc.On("Restore", mock.Anything, invID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/inventory/%s/restore", invID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event - Restore emits inventory.created (restore brings back)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "inventory.created", event.Type)
	assert.Equal(t, "inventory", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, invID.String(), event.EntityID)
}

func TestInventoryHandler_Create_NilBroadcaster_NoError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	// Register with nil broadcaster
	inventory.RegisterRoutes(setup.API, mockSvc, nil)

	itemID := uuid.New()
	locationID := uuid.New()
	testInv, _ := inventory.NewInventory(
		setup.WorkspaceID,
		itemID,
		locationID,
		nil,
		10,
		inventory.ConditionNew,
		inventory.StatusAvailable,
		nil,
	)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input inventory.CreateInput) bool {
		return input.ItemID == itemID
	})).Return(testInv, nil).Once()

	body := fmt.Sprintf(`{"item_id":"%s","location_id":"%s","quantity":10,"condition":"NEW","status":"AVAILABLE"}`,
		itemID, locationID)
	rec := setup.Post("/inventory", body)

	// Should not panic and should succeed
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}
