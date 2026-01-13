package container_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements container.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input container.CreateInput) (*container.Container, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*container.Container), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*container.Container, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*container.Container), args.Error(1)
}

func (m *MockService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*container.Container], error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*shared.PagedResult[*container.Container]), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input container.UpdateInput) (*container.Container, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*container.Container), args.Error(1)
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

// Tests

func TestContainerHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	container.RegisterRoutes(setup.API, mockSvc)

	t.Run("creates container successfully", func(t *testing.T) {
		locationID := uuid.New()
		shortCode := "C001"
		testContainer, _ := container.NewContainer(setup.WorkspaceID, locationID, "Box A", nil, nil, &shortCode)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input container.CreateInput) bool {
			return input.Name == "Box A" && input.LocationID == locationID
		})).Return(testContainer, nil).Once()

		body := fmt.Sprintf(`{"location_id":"%s","name":"Box A","short_code":"C001"}`, locationID)
		rec := setup.Post("/containers", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("creates container without optional fields", func(t *testing.T) {
		locationID := uuid.New()
		testContainer, _ := container.NewContainer(setup.WorkspaceID, locationID, "Simple Box", nil, nil, nil)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input container.CreateInput) bool {
			return input.Name == "Simple Box" && input.ShortCode == nil
		})).Return(testContainer, nil).Once()

		body := fmt.Sprintf(`{"location_id":"%s","name":"Simple Box"}`, locationID)
		rec := setup.Post("/containers", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for duplicate short code", func(t *testing.T) {
		locationID := uuid.New()

		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, container.ErrShortCodeTaken).Once()

		body := fmt.Sprintf(`{"location_id":"%s","name":"Box","short_code":"DUP"}`, locationID)
		rec := setup.Post("/containers", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty name", func(t *testing.T) {
		locationID := uuid.New()

		body := fmt.Sprintf(`{"location_id":"%s","name":""}`, locationID)
		rec := setup.Post("/containers", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestContainerHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	container.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists containers successfully", func(t *testing.T) {
		locationID := uuid.New()
		cont1, _ := container.NewContainer(setup.WorkspaceID, locationID, "Container 1", nil, nil, nil)
		cont2, _ := container.NewContainer(setup.WorkspaceID, locationID, "Container 2", nil, nil, nil)
		containers := []*container.Container{cont1, cont2}

		pagination := shared.Pagination{Page: 1, PageSize: 50}
		result := shared.NewPagedResult(containers, 2, pagination)

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(&result, nil).Once()

		rec := setup.Get("/containers")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		pagination := shared.Pagination{Page: 2, PageSize: 10}
		result := shared.NewPagedResult([]*container.Container{}, 50, pagination)

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return(&result, nil).Once()

		rec := setup.Get("/containers?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no containers", func(t *testing.T) {
		pagination := shared.Pagination{Page: 1, PageSize: 50}
		result := shared.NewPagedResult([]*container.Container{}, 0, pagination)

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return(&result, nil).Once()

		rec := setup.Get("/containers")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestContainerHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	container.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets container by ID", func(t *testing.T) {
		locationID := uuid.New()
		testContainer, _ := container.NewContainer(setup.WorkspaceID, locationID, "Test Container", nil, nil, nil)
		containerID := testContainer.ID()

		mockSvc.On("GetByID", mock.Anything, containerID, setup.WorkspaceID).
			Return(testContainer, nil).Once()

		rec := setup.Get(fmt.Sprintf("/containers/%s", containerID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when container not found", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, containerID, setup.WorkspaceID).
			Return(nil, container.ErrContainerNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/containers/%s", containerID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestContainerHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	container.RegisterRoutes(setup.API, mockSvc)

	t.Run("updates container successfully", func(t *testing.T) {
		locationID := uuid.New()
		testContainer, _ := container.NewContainer(setup.WorkspaceID, locationID, "Updated Container", nil, nil, nil)
		containerID := testContainer.ID()

		// Mock GetByID first (handler calls it to get current container)
		currentContainer, _ := container.NewContainer(setup.WorkspaceID, locationID, "Original", nil, nil, nil)
		mockSvc.On("GetByID", mock.Anything, containerID, setup.WorkspaceID).
			Return(currentContainer, nil).Once()

		mockSvc.On("Update", mock.Anything, containerID, setup.WorkspaceID, mock.Anything).
			Return(testContainer, nil).Once()

		body := `{"name":"Updated Container"}`
		rec := setup.Patch(fmt.Sprintf("/containers/%s", containerID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when container not found", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, containerID, setup.WorkspaceID).
			Return(nil, container.ErrContainerNotFound).Once()

		body := `{"name":"Updated"}`
		rec := setup.Patch(fmt.Sprintf("/containers/%s", containerID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty name", func(t *testing.T) {
		containerID := uuid.New()

		body := `{"name":""}`
		rec := setup.Patch(fmt.Sprintf("/containers/%s", containerID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestContainerHandler_Archive(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	container.RegisterRoutes(setup.API, mockSvc)

	t.Run("archives container successfully", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("Archive", mock.Anything, containerID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/containers/%s/archive", containerID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when container not found", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("Archive", mock.Anything, containerID, setup.WorkspaceID).
			Return(container.ErrContainerNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/containers/%s/archive", containerID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestContainerHandler_Restore(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	container.RegisterRoutes(setup.API, mockSvc)

	t.Run("restores container successfully", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("Restore", mock.Anything, containerID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/containers/%s/restore", containerID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when container not found", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("Restore", mock.Anything, containerID, setup.WorkspaceID).
			Return(container.ErrContainerNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/containers/%s/restore", containerID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestContainerHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	container.RegisterRoutes(setup.API, mockSvc)

	t.Run("deletes container successfully", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("Delete", mock.Anything, containerID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/containers/%s", containerID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when container not found", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("Delete", mock.Anything, containerID, setup.WorkspaceID).
			Return(container.ErrContainerNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/containers/%s", containerID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when container has inventory", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("Delete", mock.Anything, containerID, setup.WorkspaceID).
			Return(container.ErrHasInventory).Once()

		rec := setup.Delete(fmt.Sprintf("/containers/%s", containerID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}
