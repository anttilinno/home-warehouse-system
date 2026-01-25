package location_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements location.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input location.CreateInput) (*location.Location, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*location.Location, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}

func (m *MockService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*location.Location], error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*shared.PagedResult[*location.Location]), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input location.UpdateInput) (*location.Location, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}

func (m *MockService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) GetBreadcrumb(ctx context.Context, locationID, workspaceID uuid.UUID) ([]location.BreadcrumbItem, error) {
	args := m.Called(ctx, locationID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]location.BreadcrumbItem), args.Error(1)
}

func (m *MockService) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*location.Location, error) {
	args := m.Called(ctx, workspaceID, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*location.Location), args.Error(1)
}

// Tests

func TestLocationHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	location.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("creates location successfully", func(t *testing.T) {
		testLoc, _ := location.NewLocation(setup.WorkspaceID, "Warehouse A", nil, nil, "WH-A")

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input location.CreateInput) bool {
			return input.Name == "Warehouse A"
		})).Return(testLoc, nil).Once()

		body := `{"name":"Warehouse A"}`
		rec := setup.Post("/locations", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for duplicate short code", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, location.ErrShortCodeTaken).Once()

		body := `{"name":"Warehouse A","short_code":"WH-A"}`
		rec := setup.Post("/locations", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLocationHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	location.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists locations successfully", func(t *testing.T) {
		loc1, _ := location.NewLocation(setup.WorkspaceID, "Location 1", nil, nil, "LOC-1")
		loc2, _ := location.NewLocation(setup.WorkspaceID, "Location 2", nil, nil, "LOC-2")
		items := []*location.Location{loc1, loc2}
		result := shared.NewPagedResult(items, 2, shared.Pagination{Page: 1, PageSize: 50})

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return(&result, nil).Once()

		rec := setup.Get("/locations")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		result := shared.NewPagedResult([]*location.Location{}, 50, shared.Pagination{Page: 2, PageSize: 10})

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return(&result, nil).Once()

		rec := setup.Get("/locations?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestLocationHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	location.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets location by ID", func(t *testing.T) {
		testLoc, _ := location.NewLocation(setup.WorkspaceID, "Warehouse A", nil, nil, "WH-A")
		locID := testLoc.ID()

		mockSvc.On("GetByID", mock.Anything, locID, setup.WorkspaceID).
			Return(testLoc, nil).Once()

		rec := setup.Get(fmt.Sprintf("/locations/%s", locID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when location not found", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, locID, setup.WorkspaceID).
			Return(nil, location.ErrLocationNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/locations/%s", locID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestLocationHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	location.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("updates location successfully", func(t *testing.T) {
		testLoc, _ := location.NewLocation(setup.WorkspaceID, "Updated Warehouse", nil, nil, "UPD-WH")
		locID := testLoc.ID()

		existingLoc, _ := location.NewLocation(setup.WorkspaceID, "Warehouse A", nil, nil, "WH-A")
		mockSvc.On("GetByID", mock.Anything, locID, setup.WorkspaceID).
			Return(existingLoc, nil).Once()

		mockSvc.On("Update", mock.Anything, locID, setup.WorkspaceID, mock.Anything).
			Return(testLoc, nil).Once()

		body := `{"name":"Updated Warehouse"}`
		rec := setup.Patch(fmt.Sprintf("/locations/%s", locID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when location not found", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, locID, setup.WorkspaceID).
			Return(nil, location.ErrLocationNotFound).Once()

		body := `{"name":"Updated"}`
		rec := setup.Patch(fmt.Sprintf("/locations/%s", locID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestLocationHandler_Archive(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	location.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("archives location successfully", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("Archive", mock.Anything, locID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/locations/%s/archive", locID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when location not found", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("Archive", mock.Anything, locID, setup.WorkspaceID).
			Return(location.ErrLocationNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/locations/%s/archive", locID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLocationHandler_Restore(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	location.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("restores location successfully", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("Restore", mock.Anything, locID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/locations/%s/restore", locID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when location not found", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("Restore", mock.Anything, locID, setup.WorkspaceID).
			Return(location.ErrLocationNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/locations/%s/restore", locID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLocationHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	location.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("deletes location successfully", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("Delete", mock.Anything, locID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/locations/%s", locID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when location not found", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("Delete", mock.Anything, locID, setup.WorkspaceID).
			Return(location.ErrLocationNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/locations/%s", locID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when location has containers", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("Delete", mock.Anything, locID, setup.WorkspaceID).
			Return(location.ErrHasContainers).Once()

		rec := setup.Delete(fmt.Sprintf("/locations/%s", locID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestLocationHandler_GetBreadcrumb(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	location.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets breadcrumb trail successfully", func(t *testing.T) {
		locID := uuid.New()
		breadcrumb := []location.BreadcrumbItem{
			{ID: uuid.New(), Name: "Root"},
			{ID: uuid.New(), Name: "Parent"},
			{ID: locID, Name: "Current"},
		}

		mockSvc.On("GetBreadcrumb", mock.Anything, locID, setup.WorkspaceID).
			Return(breadcrumb, nil).Once()

		rec := setup.Get(fmt.Sprintf("/locations/%s/breadcrumb", locID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 on error", func(t *testing.T) {
		locID := uuid.New()

		mockSvc.On("GetBreadcrumb", mock.Anything, locID, setup.WorkspaceID).
			Return(nil, location.ErrLocationNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/locations/%s/breadcrumb", locID))

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestLocationHandler_Create_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	location.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	testLoc, _ := location.NewLocation(setup.WorkspaceID, "Warehouse", nil, nil, "WH-A")

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input location.CreateInput) bool {
		return input.Name == "Warehouse"
	})).Return(testLoc, nil).Once()

	body := `{"name":"Warehouse","short_code":"WH-A"}`
	rec := setup.Post("/locations", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "location.created", event.Type)
	assert.Equal(t, "location", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, testLoc.ID().String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, testLoc.ID(), event.Data["id"])
	assert.Equal(t, testLoc.Name(), event.Data["name"])
}

func TestLocationHandler_Update_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	location.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	testLoc, _ := location.NewLocation(setup.WorkspaceID, "Updated Warehouse", nil, nil, "WH-U")
	locID := testLoc.ID()

	// Mock GetByID first (handler calls it to get current location)
	existingLoc, _ := location.NewLocation(setup.WorkspaceID, "Warehouse", nil, nil, "WH-A")
	mockSvc.On("GetByID", mock.Anything, locID, setup.WorkspaceID).
		Return(existingLoc, nil).Once()

	mockSvc.On("Update", mock.Anything, locID, setup.WorkspaceID, mock.Anything).
		Return(testLoc, nil).Once()

	body := `{"name":"Updated Warehouse"}`
	rec := setup.Patch(fmt.Sprintf("/locations/%s", locID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "location.updated", event.Type)
	assert.Equal(t, "location", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, locID.String(), event.EntityID)
}

func TestLocationHandler_Archive_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	location.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	locID := uuid.New()

	mockSvc.On("Archive", mock.Anything, locID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/locations/%s/archive", locID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event (archive emits location.deleted)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "location.deleted", event.Type)
	assert.Equal(t, "location", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, locID.String(), event.EntityID)
}

func TestLocationHandler_Restore_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	location.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	locID := uuid.New()

	mockSvc.On("Restore", mock.Anything, locID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/locations/%s/restore", locID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event (restore emits location.created)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "location.created", event.Type)
	assert.Equal(t, "location", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, locID.String(), event.EntityID)
}

func TestLocationHandler_Delete_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	location.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	locID := uuid.New()

	mockSvc.On("Delete", mock.Anything, locID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Delete(fmt.Sprintf("/locations/%s", locID))

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "location.deleted", event.Type)
	assert.Equal(t, "location", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, locID.String(), event.EntityID)
}

func TestLocationHandler_Create_NilBroadcaster_NoError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	// Register with nil broadcaster
	location.RegisterRoutes(setup.API, mockSvc, nil)

	testLoc, _ := location.NewLocation(setup.WorkspaceID, "Warehouse", nil, nil, "WH-A")

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input location.CreateInput) bool {
		return input.Name == "Warehouse"
	})).Return(testLoc, nil).Once()

	body := `{"name":"Warehouse","short_code":"WH-A"}`
	rec := setup.Post("/locations", body)

	// Should not panic and should succeed
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}
