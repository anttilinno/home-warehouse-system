package sync_test

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/sync"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements sync.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) GetDelta(ctx context.Context, input sync.DeltaSyncInput) (*sync.SyncResult, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*sync.SyncResult), args.Error(1)
}

// Tests

func TestSyncHandler_GetDelta(t *testing.T) {
	t.Run("performs full sync successfully", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)
		result := &sync.SyncResult{
			Items: []sync.ItemSyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "Test Item",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Locations: []sync.LocationSyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "Test Location",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Deleted:  []sync.DeletedRecord{},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return input.WorkspaceID == setup.WorkspaceID &&
				input.ModifiedSince == nil
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("performs incremental sync successfully", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		modifiedSince := time.Now().Add(-1 * time.Hour)
		result := &sync.SyncResult{
			Items: []sync.ItemSyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "Updated Item",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Deleted: []sync.DeletedRecord{
				{
					ID:         uuid.New(),
					EntityType: "item",
					EntityID:   uuid.New(),
					DeletedAt:  time.Now(),
				},
			},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return input.WorkspaceID == setup.WorkspaceID &&
				input.ModifiedSince != nil
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta?modified_since=" + url.QueryEscape(modifiedSince.Format(time.RFC3339)))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("syncs specific entity types", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		result := &sync.SyncResult{
			Items: []sync.ItemSyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "Test Item",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Deleted:  []sync.DeletedRecord{},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return len(input.EntityTypes) == 2 &&
				input.EntityTypes[0] == sync.EntityTypeItem &&
				input.EntityTypes[1] == sync.EntityTypeLocation
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta?entity_types=item,location")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles custom limit", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		result := &sync.SyncResult{
			Items:    []sync.ItemSyncData{},
			Deleted:  []sync.DeletedRecord{},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return input.Limit == 100
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta?limit=100")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination with has_more", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		result := &sync.SyncResult{
			Items: make([]sync.ItemSyncData, 500),
			Deleted:  []sync.DeletedRecord{},
			SyncedAt: time.Now(),
			HasMore:  true,
		}

		// Fill with dummy data
		for i := range result.Items {
			result.Items[i] = sync.ItemSyncData{
				ID:          uuid.New(),
				WorkspaceID: setup.WorkspaceID,
				Name:        "Item",
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return input.Limit == 500
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta?limit=500")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("syncs all entity types", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		result := &sync.SyncResult{
			Items:      []sync.ItemSyncData{},
			Locations:  []sync.LocationSyncData{},
			Containers: []sync.ContainerSyncData{},
			Inventory:  []sync.InventorySyncData{},
			Categories: []sync.CategorySyncData{},
			Labels:     []sync.LabelSyncData{},
			Companies:  []sync.CompanySyncData{},
			Borrowers:  []sync.BorrowerSyncData{},
			Loans:      []sync.LoanSyncData{},
			Deleted:    []sync.DeletedRecord{},
			SyncedAt:   time.Now(),
			HasMore:    false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return len(input.EntityTypes) == 0 // Empty means all types
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("includes deleted records", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		deletedBy := uuid.New()
		result := &sync.SyncResult{
			Items: []sync.ItemSyncData{},
			Deleted: []sync.DeletedRecord{
				{
					ID:         uuid.New(),
					EntityType: "item",
					EntityID:   uuid.New(),
					DeletedAt:  time.Now(),
					DeletedBy:  &deletedBy,
				},
				{
					ID:         uuid.New(),
					EntityType: "location",
					EntityID:   uuid.New(),
					DeletedAt:  time.Now(),
					DeletedBy:  &deletedBy,
				},
			},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.Anything).
			Return(result, nil).Once()

		rec := setup.Get("/sync/delta")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid timestamp format", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		rec := setup.Get("/sync/delta?modified_since=invalid-timestamp")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("handles service error", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		mockSvc.On("GetDelta", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("test error")).Once()

		rec := setup.Get("/sync/delta")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})

	t.Run("syncs containers successfully", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		result := &sync.SyncResult{
			Containers: []sync.ContainerSyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "Test Container",
					LocationID:  uuid.New(),
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Deleted:  []sync.DeletedRecord{},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return len(input.EntityTypes) == 1 &&
				input.EntityTypes[0] == sync.EntityTypeContainer
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta?entity_types=container")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("syncs inventory successfully", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		result := &sync.SyncResult{
			Inventory: []sync.InventorySyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					ItemID:      uuid.New(),
					LocationID:  uuid.New(),
					Quantity:    10,
					Condition:   "NEW",
					Status:      "AVAILABLE",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Deleted:  []sync.DeletedRecord{},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return len(input.EntityTypes) == 1 &&
				input.EntityTypes[0] == sync.EntityTypeInventory
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta?entity_types=inventory")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("syncs categories successfully", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		result := &sync.SyncResult{
			Categories: []sync.CategorySyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "Electronics",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Deleted:  []sync.DeletedRecord{},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return len(input.EntityTypes) == 1 &&
				input.EntityTypes[0] == sync.EntityTypeCategory
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta?entity_types=category")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("syncs labels, companies, borrowers, and loans", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		handler := sync.NewHandler(mockSvc)
		handler.RegisterRoutes(setup.API)

		result := &sync.SyncResult{
			Labels: []sync.LabelSyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "Urgent",
					Color:       "#ff0000",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Companies: []sync.CompanySyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "ACME Corp",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Borrowers: []sync.BorrowerSyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					Name:        "John Doe",
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Loans: []sync.LoanSyncData{
				{
					ID:          uuid.New(),
					WorkspaceID: setup.WorkspaceID,
					InventoryID: uuid.New(),
					BorrowerID:  uuid.New(),
					Quantity:    1,
					LoanedAt:    time.Now(),
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				},
			},
			Deleted:  []sync.DeletedRecord{},
			SyncedAt: time.Now(),
			HasMore:  false,
		}

		mockSvc.On("GetDelta", mock.Anything, mock.MatchedBy(func(input sync.DeltaSyncInput) bool {
			return len(input.EntityTypes) == 4
		})).Return(result, nil).Once()

		rec := setup.Get("/sync/delta?entity_types=label,company,borrower,loan")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}
