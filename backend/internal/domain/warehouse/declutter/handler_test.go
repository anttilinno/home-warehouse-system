package declutter_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/declutter"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements declutter.ServiceInterface for testing
type MockService struct {
	mock.Mock
}

func (m *MockService) ListUnused(ctx context.Context, params declutter.ListParams) (*declutter.ListUnusedResult, error) {
	args := m.Called(ctx, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*declutter.ListUnusedResult), args.Error(1)
}

func (m *MockService) GetCounts(ctx context.Context, workspaceID uuid.UUID) (*declutter.DeclutterCounts, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*declutter.DeclutterCounts), args.Error(1)
}

func (m *MockService) MarkUsed(ctx context.Context, inventoryID, workspaceID uuid.UUID) error {
	args := m.Called(ctx, inventoryID, workspaceID)
	return args.Error(0)
}

// Helper function to create a test declutter item
func newTestDeclutterItem(workspaceID uuid.UUID, daysUnused int) declutter.DeclutterItem {
	now := time.Now()
	itemID := uuid.New()
	locationID := uuid.New()
	price := 5000 // 50.00 in cents
	currency := "EUR"
	condition := "GOOD"
	status := "AVAILABLE"

	return declutter.DeclutterItem{
		ID:            uuid.New(),
		WorkspaceID:   workspaceID,
		ItemID:        itemID,
		LocationID:    locationID,
		ContainerID:   nil,
		Quantity:      1,
		Condition:     &condition,
		Status:        &status,
		PurchasePrice: &price,
		CurrencyCode:  &currency,
		LastUsedAt:    nil,
		CreatedAt:     now.AddDate(0, 0, -daysUnused),
		UpdatedAt:     now,
		ItemName:      "Test Item",
		ItemSKU:       "TEST-001",
		LocationName:  "Test Location",
		CategoryID:    nil,
		CategoryName:  nil,
		DaysUnused:    daysUnused,
		Score:         75,
	}
}

// Tests for List endpoint

func TestHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	declutter.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists unused inventory successfully", func(t *testing.T) {
		item1 := newTestDeclutterItem(setup.WorkspaceID, 100)
		item2 := newTestDeclutterItem(setup.WorkspaceID, 150)
		result := &declutter.ListUnusedResult{
			Items: []declutter.DeclutterItem{item1, item2},
			Total: 2,
		}

		mockSvc.On("ListUnused", mock.Anything, mock.MatchedBy(func(p declutter.ListParams) bool {
			return p.WorkspaceID == setup.WorkspaceID &&
				p.ThresholdDays == 90 && // default
				p.Page == 1 && // default
				p.PageSize == 50 // default
		})).Return(result, nil).Once()

		rec := setup.Get("/declutter")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles custom threshold_days parameter", func(t *testing.T) {
		result := &declutter.ListUnusedResult{
			Items: []declutter.DeclutterItem{},
			Total: 0,
		}

		mockSvc.On("ListUnused", mock.Anything, mock.MatchedBy(func(p declutter.ListParams) bool {
			return p.ThresholdDays == 180
		})).Return(result, nil).Once()

		rec := setup.Get("/declutter?threshold_days=180")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination parameters", func(t *testing.T) {
		result := &declutter.ListUnusedResult{
			Items: []declutter.DeclutterItem{},
			Total: 100,
		}

		mockSvc.On("ListUnused", mock.Anything, mock.MatchedBy(func(p declutter.ListParams) bool {
			return p.Page == 2 && p.PageSize == 25
		})).Return(result, nil).Once()

		rec := setup.Get("/declutter?page=2&limit=25")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles group_by parameter", func(t *testing.T) {
		result := &declutter.ListUnusedResult{
			Items: []declutter.DeclutterItem{},
			Total: 0,
		}

		mockSvc.On("ListUnused", mock.Anything, mock.MatchedBy(func(p declutter.ListParams) bool {
			return p.GroupBy == declutter.GroupByCategory
		})).Return(result, nil).Once()

		rec := setup.Get("/declutter?group_by=category")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles group_by=location parameter", func(t *testing.T) {
		result := &declutter.ListUnusedResult{
			Items: []declutter.DeclutterItem{},
			Total: 0,
		}

		mockSvc.On("ListUnused", mock.Anything, mock.MatchedBy(func(p declutter.ListParams) bool {
			return p.GroupBy == declutter.GroupByLocation
		})).Return(result, nil).Once()

		rec := setup.Get("/declutter?group_by=location")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no unused items", func(t *testing.T) {
		result := &declutter.ListUnusedResult{
			Items: []declutter.DeclutterItem{},
			Total: 0,
		}

		mockSvc.On("ListUnused", mock.Anything, mock.Anything).
			Return(result, nil).Once()

		rec := setup.Get("/declutter")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		mockSvc.On("ListUnused", mock.Anything, mock.Anything).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get("/declutter")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for GetCounts endpoint

func TestHandler_GetCounts(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	declutter.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets counts successfully", func(t *testing.T) {
		counts := &declutter.DeclutterCounts{
			Unused90:  10,
			Unused180: 5,
			Unused365: 2,
			Value90:   100000,
			Value180:  50000,
			Value365:  20000,
		}

		mockSvc.On("GetCounts", mock.Anything, setup.WorkspaceID).
			Return(counts, nil).Once()

		rec := setup.Get("/declutter/counts")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns zero counts when no unused inventory", func(t *testing.T) {
		counts := &declutter.DeclutterCounts{
			Unused90:  0,
			Unused180: 0,
			Unused365: 0,
			Value90:   0,
			Value180:  0,
			Value365:  0,
		}

		mockSvc.On("GetCounts", mock.Anything, setup.WorkspaceID).
			Return(counts, nil).Once()

		rec := setup.Get("/declutter/counts")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		mockSvc.On("GetCounts", mock.Anything, setup.WorkspaceID).
			Return(nil, errors.New("database error")).Once()

		rec := setup.Get("/declutter/counts")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Tests for MarkUsed endpoint

func TestHandler_MarkUsed(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	declutter.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("marks inventory as used successfully", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("MarkUsed", mock.Anything, inventoryID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/inventory/%s/mark-used", inventoryID), "")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on service error", func(t *testing.T) {
		inventoryID := uuid.New()

		mockSvc.On("MarkUsed", mock.Anything, inventoryID, setup.WorkspaceID).
			Return(errors.New("database error")).Once()

		rec := setup.Post(fmt.Sprintf("/inventory/%s/mark-used", inventoryID), "")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestHandler_MarkUsed_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	declutter.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	inventoryID := uuid.New()

	mockSvc.On("MarkUsed", mock.Anything, inventoryID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/inventory/%s/mark-used", inventoryID), "")

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "inventory.marked_used", event.Type)
	assert.Equal(t, "inventory", event.EntityType)
	assert.Equal(t, inventoryID.String(), event.EntityID)
}

func TestHandler_NilBroadcaster_NoPanic(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	declutter.RegisterRoutes(setup.API, mockSvc, nil) // nil broadcaster

	inventoryID := uuid.New()

	mockSvc.On("MarkUsed", mock.Anything, inventoryID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/inventory/%s/mark-used", inventoryID), "")

	// Should work without error even with nil broadcaster
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}
