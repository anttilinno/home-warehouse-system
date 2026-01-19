package workspace_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements workspace.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input workspace.CreateWorkspaceInput) (*workspace.Workspace, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*workspace.Workspace), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id uuid.UUID) (*workspace.Workspace, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*workspace.Workspace), args.Error(1)
}

func (m *MockService) GetBySlug(ctx context.Context, slug string) (*workspace.Workspace, error) {
	args := m.Called(ctx, slug)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*workspace.Workspace), args.Error(1)
}

func (m *MockService) GetUserWorkspaces(ctx context.Context, userID uuid.UUID) ([]*workspace.WorkspaceWithRole, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*workspace.WorkspaceWithRole), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id uuid.UUID, input workspace.UpdateWorkspaceInput) (*workspace.Workspace, error) {
	args := m.Called(ctx, id, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*workspace.Workspace), args.Error(1)
}

func (m *MockService) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// Tests

func TestWorkspaceHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	workspace.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists user workspaces successfully", func(t *testing.T) {
		ws1, _ := workspace.NewWorkspace("Workspace 1", "workspace-1", nil, false)
		ws2, _ := workspace.NewWorkspace("Workspace 2", "workspace-2", nil, false)
		workspaces := []*workspace.WorkspaceWithRole{
			{Workspace: ws1, Role: "owner"},
			{Workspace: ws2, Role: "member"},
		}

		mockSvc.On("GetUserWorkspaces", mock.Anything, setup.UserID).
			Return(workspaces, nil).Once()

		rec := setup.Get("/workspaces")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no workspaces", func(t *testing.T) {
		mockSvc.On("GetUserWorkspaces", mock.Anything, setup.UserID).
			Return([]*workspace.WorkspaceWithRole{}, nil).Once()

		rec := setup.Get("/workspaces")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestWorkspaceHandler_GetBySlug(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	workspace.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets workspace by slug successfully", func(t *testing.T) {
		testWS, _ := workspace.NewWorkspace("Test Workspace", "test-workspace", nil, false)

		mockSvc.On("GetBySlug", mock.Anything, "test-workspace").
			Return(testWS, nil).Once()

		rec := setup.Get("/workspaces/by-slug/test-workspace")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when workspace not found", func(t *testing.T) {
		mockSvc.On("GetBySlug", mock.Anything, "nonexistent").
			Return(nil, workspace.ErrWorkspaceNotFound).Once()

		rec := setup.Get("/workspaces/by-slug/nonexistent")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestWorkspaceHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	workspace.RegisterRoutes(setup.API, mockSvc)

	t.Run("creates workspace successfully", func(t *testing.T) {
		testWS, _ := workspace.NewWorkspace("New Workspace", "new-workspace", nil, false)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input workspace.CreateWorkspaceInput) bool {
			return input.Name == "New Workspace" && input.Slug == "new-workspace" && input.CreatedBy == setup.UserID
		})).Return(testWS, nil).Once()

		body := `{"name":"New Workspace","slug":"new-workspace","is_personal":false}`
		rec := setup.Post("/workspaces", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for duplicate slug", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, workspace.ErrSlugTaken).Once()

		body := `{"name":"New Workspace","slug":"existing-slug","is_personal":false}`
		rec := setup.Post("/workspaces", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid slug format", func(t *testing.T) {
		body := `{"name":"New Workspace","slug":"Invalid Slug!","is_personal":false}`
		rec := setup.Post("/workspaces", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("creates workspace with description", func(t *testing.T) {
		desc := "Test description"
		testWS, _ := workspace.NewWorkspace("New Workspace", "new-workspace", &desc, false)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input workspace.CreateWorkspaceInput) bool {
			return input.Description != nil && *input.Description == "Test description"
		})).Return(testWS, nil).Once()

		body := `{"name":"New Workspace","slug":"new-workspace","description":"Test description","is_personal":false}`
		rec := setup.Post("/workspaces", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestWorkspaceHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	workspace.RegisterWorkspaceScopedRoutes(setup.API, mockSvc)

	t.Run("gets workspace successfully", func(t *testing.T) {
		testWS, _ := workspace.NewWorkspace("Test Workspace", "test-workspace", nil, false)

		mockSvc.On("GetByID", mock.Anything, setup.WorkspaceID).
			Return(testWS, nil).Once()

		rec := setup.Get("/")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when workspace not found", func(t *testing.T) {
		mockSvc.On("GetByID", mock.Anything, setup.WorkspaceID).
			Return(nil, workspace.ErrWorkspaceNotFound).Once()

		rec := setup.Get("/")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestWorkspaceHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	workspace.RegisterWorkspaceScopedRoutes(setup.API, mockSvc)

	t.Run("updates workspace successfully", func(t *testing.T) {
		testWS, _ := workspace.NewWorkspace("Updated Workspace", "test-workspace", nil, false)

		mockSvc.On("Update", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(input workspace.UpdateWorkspaceInput) bool {
			return input.Name == "Updated Workspace"
		})).Return(testWS, nil).Once()

		body := `{"name":"Updated Workspace"}`
		rec := setup.Patch("/", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("updates workspace description", func(t *testing.T) {
		desc := "New description"
		testWS, _ := workspace.NewWorkspace("Test Workspace", "test-workspace", &desc, false)

		mockSvc.On("Update", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(input workspace.UpdateWorkspaceInput) bool {
			return input.Description != nil && *input.Description == "New description"
		})).Return(testWS, nil).Once()

		body := `{"description":"New description"}`
		rec := setup.Patch("/", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when workspace not found", func(t *testing.T) {
		mockSvc.On("Update", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return(nil, workspace.ErrWorkspaceNotFound).Once()

		body := `{"name":"Updated"}`
		rec := setup.Patch("/", body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty name", func(t *testing.T) {
		body := `{"name":""}`
		rec := setup.Patch("/", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestWorkspaceHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	workspace.RegisterWorkspaceScopedRoutes(setup.API, mockSvc)

	t.Run("deletes workspace successfully", func(t *testing.T) {
		mockSvc.On("Delete", mock.Anything, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete("/")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when trying to delete personal workspace", func(t *testing.T) {
		mockSvc.On("Delete", mock.Anything, setup.WorkspaceID).
			Return(workspace.ErrCannotDeletePersonal).Once()

		rec := setup.Delete("/")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when workspace not found", func(t *testing.T) {
		mockSvc.On("Delete", mock.Anything, setup.WorkspaceID).
			Return(workspace.ErrWorkspaceNotFound).Once()

		rec := setup.Delete("/")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}
