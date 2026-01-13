package movement_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/movement"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements movement.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) RecordMovement(ctx context.Context, input movement.RecordMovementInput) (*movement.InventoryMovement, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*movement.InventoryMovement), args.Error(1)
}

func (m *MockService) ListByInventory(ctx context.Context, inventoryID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*movement.InventoryMovement, error) {
	args := m.Called(ctx, inventoryID, workspaceID, pagination)
	return args.Get(0).([]*movement.InventoryMovement), args.Error(1)
}

func (m *MockService) ListByLocation(ctx context.Context, locationID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*movement.InventoryMovement, error) {
	args := m.Called(ctx, locationID, workspaceID, pagination)
	return args.Get(0).([]*movement.InventoryMovement), args.Error(1)
}

func (m *MockService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*movement.InventoryMovement, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*movement.InventoryMovement), args.Error(1)
}

// Tests

func TestMovementHandler_ListByWorkspace(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	movement.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists workspace movements successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		fromLocationID := uuid.New()
		toLocationID := uuid.New()
		mov1, _ := movement.NewInventoryMovement(
			setup.WorkspaceID,
			inventoryID,
			&fromLocationID,
			nil,
			&toLocationID,
			nil,
			1,
			&setup.UserID,
			nil,
		)
		movements := []*movement.InventoryMovement{mov1}

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(movements, nil).Once()

		rec := setup.Get("/movements")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 20
		})).Return([]*movement.InventoryMovement{}, nil).Once()

		rec := setup.Get("/movements?page=2&limit=20")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no movements", func(t *testing.T) {
		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*movement.InventoryMovement{}, nil).Once()

		rec := setup.Get("/movements")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestMovementHandler_ListByInventory(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	movement.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists inventory movements successfully", func(t *testing.T) {
		inventoryID := uuid.New()
		fromLocationID := uuid.New()
		toLocationID := uuid.New()
		mov1, _ := movement.NewInventoryMovement(
			setup.WorkspaceID,
			inventoryID,
			&fromLocationID,
			nil,
			&toLocationID,
			nil,
			1,
			&setup.UserID,
			nil,
		)
		movements := []*movement.InventoryMovement{mov1}

		mockSvc.On("ListByInventory", mock.Anything, inventoryID, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(movements, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/movements", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("ListByInventory", mock.Anything, inventoryID, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 3 && p.PageSize == 15
		})).Return([]*movement.InventoryMovement{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/movements?page=3&limit=15", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when inventory has no movements", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("ListByInventory", mock.Anything, inventoryID, setup.WorkspaceID, mock.Anything).
			Return([]*movement.InventoryMovement{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/inventory/%s/movements", inventoryID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestMovementHandler_ListByLocation(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	movement.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists location movements successfully", func(t *testing.T) {
		locationID := uuid.New()
		inventoryID := uuid.New()
		mov1, _ := movement.NewInventoryMovement(
			setup.WorkspaceID,
			inventoryID,
			&locationID,
			nil,
			&locationID,
			nil,
			1,
			&setup.UserID,
			nil,
		)
		movements := []*movement.InventoryMovement{mov1}

		mockSvc.On("ListByLocation", mock.Anything, locationID, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(movements, nil).Once()

		rec := setup.Get(fmt.Sprintf("/locations/%s/movements", locationID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		locationID := uuid.New()

		mockSvc.On("ListByLocation", mock.Anything, locationID, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 25
		})).Return([]*movement.InventoryMovement{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/locations/%s/movements?page=2&limit=25", locationID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when location has no movements", func(t *testing.T) {
		locationID := uuid.New()

		mockSvc.On("ListByLocation", mock.Anything, locationID, setup.WorkspaceID, mock.Anything).
			Return([]*movement.InventoryMovement{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/locations/%s/movements", locationID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}
