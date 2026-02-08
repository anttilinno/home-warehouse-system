package user_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements user.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input user.CreateUserInput) (*user.User, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id uuid.UUID) (*user.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockService) GetByEmail(ctx context.Context, email string) (*user.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockService) Authenticate(ctx context.Context, email, password string) (*user.User, error) {
	args := m.Called(ctx, email, password)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockService) UpdateProfile(ctx context.Context, id uuid.UUID, input user.UpdateProfileInput) (*user.User, error) {
	args := m.Called(ctx, id, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockService) UpdatePassword(ctx context.Context, id uuid.UUID, currentPassword, newPassword string) error {
	args := m.Called(ctx, id, currentPassword, newPassword)
	return args.Error(0)
}

func (m *MockService) UpdatePreferences(ctx context.Context, id uuid.UUID, input user.UpdatePreferencesInput) (*user.User, error) {
	args := m.Called(ctx, id, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockService) List(ctx context.Context, pagination shared.Pagination) (*shared.PagedResult[*user.User], error) {
	args := m.Called(ctx, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*shared.PagedResult[*user.User]), args.Error(1)
}

func (m *MockService) Deactivate(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockService) Activate(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockService) UpdateAvatar(ctx context.Context, id uuid.UUID, avatarPath *string) (*user.User, error) {
	args := m.Called(ctx, id, avatarPath)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockService) UpdateEmail(ctx context.Context, id uuid.UUID, newEmail string) (*user.User, error) {
	args := m.Called(ctx, id, newEmail)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockService) CanDelete(ctx context.Context, userID uuid.UUID) (bool, []user.BlockingWorkspace, error) {
	args := m.Called(ctx, userID)
	if args.Get(1) == nil {
		return args.Bool(0), nil, args.Error(2)
	}
	return args.Bool(0), args.Get(1).([]user.BlockingWorkspace), args.Error(2)
}

func (m *MockService) Delete(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

// MockWorkspaceService implements workspace.ServiceInterface
type MockWorkspaceService struct {
	mock.Mock
}

func (m *MockWorkspaceService) Create(ctx context.Context, input workspace.CreateWorkspaceInput) (*workspace.Workspace, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*workspace.Workspace), args.Error(1)
}

func (m *MockWorkspaceService) GetByID(ctx context.Context, id uuid.UUID) (*workspace.Workspace, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*workspace.Workspace), args.Error(1)
}

func (m *MockWorkspaceService) GetBySlug(ctx context.Context, slug string) (*workspace.Workspace, error) {
	args := m.Called(ctx, slug)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*workspace.Workspace), args.Error(1)
}

func (m *MockWorkspaceService) GetUserWorkspaces(ctx context.Context, userID uuid.UUID) ([]*workspace.WorkspaceWithRole, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*workspace.WorkspaceWithRole), args.Error(1)
}

func (m *MockWorkspaceService) Update(ctx context.Context, id uuid.UUID, input workspace.UpdateWorkspaceInput) (*workspace.Workspace, error) {
	args := m.Called(ctx, id, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*workspace.Workspace), args.Error(1)
}

func (m *MockWorkspaceService) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// Tests

func TestUserHandler_Register(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockWsSvc := new(MockWorkspaceService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, mockWsSvc)
	handler.RegisterPublicRoutes(setup.API)

	t.Run("registers user successfully and creates workspace", func(t *testing.T) {
		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
		testWorkspace, _ := workspace.NewWorkspace("Test User's Workspace", "user-"+testUser.ID().String(), nil, true)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input user.CreateUserInput) bool {
			return input.Email == "test@example.com" && input.FullName == "Test User"
		})).Return(testUser, nil).Once()

		mockWsSvc.On("Create", mock.Anything, mock.MatchedBy(func(input workspace.CreateWorkspaceInput) bool {
			return input.Name == "Test User's Workspace" &&
				input.Slug == "user-"+testUser.ID().String() &&
				input.IsPersonal == true &&
				input.CreatedBy == testUser.ID()
		})).Return(testWorkspace, nil).Once()

		body := `{"email":"test@example.com","full_name":"Test User","password":"password123"}`
		rec := setup.Post("/auth/register", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
		mockWsSvc.AssertExpectations(t)
	})

	t.Run("registration continues if workspace creation fails", func(t *testing.T) {
		testUser, _ := user.NewUser("test2@example.com", "Test User 2", "password123")

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input user.CreateUserInput) bool {
			return input.Email == "test2@example.com" && input.FullName == "Test User 2"
		})).Return(testUser, nil).Once()

		mockWsSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("workspace creation failed")).Once()

		body := `{"email":"test2@example.com","full_name":"Test User 2","password":"password123"}`
		rec := setup.Post("/auth/register", body)

		// Registration should succeed even if workspace creation fails
		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
		mockWsSvc.AssertExpectations(t)
	})

	t.Run("returns 409 for duplicate email", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, user.ErrEmailTaken).Once()

		body := `{"email":"test@example.com","full_name":"Test User","password":"password123"}`
		rec := setup.Post("/auth/register", body)

		testutil.AssertStatus(t, rec, http.StatusConflict)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid email format", func(t *testing.T) {
		body := `{"email":"invalid-email","full_name":"Test User","password":"password123"}`
		rec := setup.Post("/auth/register", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 422 for short password", func(t *testing.T) {
		body := `{"email":"test@example.com","full_name":"Test User","password":"short"}`
		rec := setup.Post("/auth/register", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 500 for service error", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("database error")).Once()

		body := `{"email":"test@example.com","full_name":"Test User","password":"password123"}`
		rec := setup.Post("/auth/register", body)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

// getCookie finds a cookie by name in the response
func getCookie(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}

func TestUserHandler_Login(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterPublicRoutes(setup.API)

	t.Run("authenticates user successfully", func(t *testing.T) {
		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")

		mockSvc.On("Authenticate", mock.Anything, "test@example.com", "password123").
			Return(testUser, nil).Once()

		body := `{"email":"test@example.com","password":"password123"}`
		rec := setup.Post("/auth/login", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("sets auth cookies on successful login", func(t *testing.T) {
		testUser, _ := user.NewUser("cookie@example.com", "Cookie User", "password123")

		mockSvc.On("Authenticate", mock.Anything, "cookie@example.com", "password123").
			Return(testUser, nil).Once()

		body := `{"email":"cookie@example.com","password":"password123"}`
		rec := setup.Post("/auth/login", body)

		testutil.AssertStatus(t, rec, http.StatusOK)

		// Check access_token cookie
		accessCookie := getCookie(rec, "access_token")
		if accessCookie == nil {
			t.Fatal("access_token cookie not set")
		}
		if accessCookie.Value == "" {
			t.Error("access_token cookie value is empty")
		}
		if !accessCookie.HttpOnly {
			t.Error("access_token cookie should be HttpOnly")
		}
		if accessCookie.Path != "/" {
			t.Errorf("access_token cookie path should be '/', got '%s'", accessCookie.Path)
		}

		// Check refresh_token cookie
		refreshCookie := getCookie(rec, "refresh_token")
		if refreshCookie == nil {
			t.Fatal("refresh_token cookie not set")
		}
		if refreshCookie.Value == "" {
			t.Error("refresh_token cookie value is empty")
		}
		if !refreshCookie.HttpOnly {
			t.Error("refresh_token cookie should be HttpOnly")
		}

		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 401 for invalid credentials", func(t *testing.T) {
		mockSvc.On("Authenticate", mock.Anything, "test@example.com", "wrongpassword").
			Return(nil, user.ErrInvalidPassword).Once()

		body := `{"email":"test@example.com","password":"wrongpassword"}`
		rec := setup.Post("/auth/login", body)

		testutil.AssertStatus(t, rec, http.StatusUnauthorized)
		mockSvc.AssertExpectations(t)
	})
}

func TestUserHandler_Logout(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterPublicRoutes(setup.API)

	t.Run("clears auth cookies on logout", func(t *testing.T) {
		rec := setup.Post("/auth/logout", "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)

		// Check access_token cookie is cleared (MaxAge < 0)
		accessCookie := getCookie(rec, "access_token")
		if accessCookie == nil {
			t.Fatal("access_token cookie not set")
		}
		if accessCookie.MaxAge >= 0 {
			t.Errorf("access_token cookie MaxAge should be negative to clear, got %d", accessCookie.MaxAge)
		}
		if accessCookie.Value != "" {
			t.Error("access_token cookie value should be empty")
		}

		// Check refresh_token cookie is cleared
		refreshCookie := getCookie(rec, "refresh_token")
		if refreshCookie == nil {
			t.Fatal("refresh_token cookie not set")
		}
		if refreshCookie.MaxAge >= 0 {
			t.Errorf("refresh_token cookie MaxAge should be negative to clear, got %d", refreshCookie.MaxAge)
		}
		if refreshCookie.Value != "" {
			t.Error("refresh_token cookie value should be empty")
		}
	})
}

func TestUserHandler_RefreshToken(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterPublicRoutes(setup.API)

	t.Run("refreshes token successfully", func(t *testing.T) {
		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
		userID := testUser.ID()

		// Generate a valid refresh token
		refreshToken, _ := jwtSvc.GenerateRefreshToken(userID)

		mockSvc.On("GetByID", mock.Anything, userID).
			Return(testUser, nil).Once()

		body := fmt.Sprintf(`{"refresh_token":"%s"}`, refreshToken)
		rec := setup.Post("/auth/refresh", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 401 for invalid refresh token", func(t *testing.T) {
		body := `{"refresh_token":"invalid-token"}`
		rec := setup.Post("/auth/refresh", body)

		testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	})

	t.Run("returns 401 for inactive user", func(t *testing.T) {
		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
		userID := testUser.ID()
		testUser.Deactivate()

		refreshToken, _ := jwtSvc.GenerateRefreshToken(userID)

		mockSvc.On("GetByID", mock.Anything, userID).
			Return(testUser, nil).Once()

		body := fmt.Sprintf(`{"refresh_token":"%s"}`, refreshToken)
		rec := setup.Post("/auth/refresh", body)

		testutil.AssertStatus(t, rec, http.StatusUnauthorized)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 401 when user not found", func(t *testing.T) {
		userID := uuid.New()
		refreshToken, _ := jwtSvc.GenerateRefreshToken(userID)

		mockSvc.On("GetByID", mock.Anything, userID).
			Return(nil, user.ErrUserNotFound).Once()

		body := fmt.Sprintf(`{"refresh_token":"%s"}`, refreshToken)
		rec := setup.Post("/auth/refresh", body)

		testutil.AssertStatus(t, rec, http.StatusUnauthorized)
		mockSvc.AssertExpectations(t)
	})
}

func TestUserHandler_GetMe(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterProtectedRoutes(setup.API)

	t.Run("gets current user successfully", func(t *testing.T) {
		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")

		mockSvc.On("GetByID", mock.Anything, setup.UserID).
			Return(testUser, nil).Once()

		rec := setup.Get("/users/me")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when user not found", func(t *testing.T) {
		mockSvc.On("GetByID", mock.Anything, setup.UserID).
			Return(nil, user.ErrUserNotFound).Once()

		rec := setup.Get("/users/me")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestUserHandler_GetMyWorkspaces(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockWsSvc := new(MockWorkspaceService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, mockWsSvc)
	handler.RegisterProtectedRoutes(setup.API)

	t.Run("gets user workspaces successfully", func(t *testing.T) {
		ws1, _ := workspace.NewWorkspace("Workspace 1", "ws-1", nil, false)
		ws2, _ := workspace.NewWorkspace("Personal Workspace", "personal-ws", nil, true)
		workspaces := []*workspace.WorkspaceWithRole{
			{Workspace: ws1, Role: "owner"},
			{Workspace: ws2, Role: "member"},
		}

		mockWsSvc.On("GetUserWorkspaces", mock.Anything, setup.UserID).
			Return(workspaces, nil).Once()

		rec := setup.Get("/users/me/workspaces")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockWsSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when user has no workspaces", func(t *testing.T) {
		mockWsSvc.On("GetUserWorkspaces", mock.Anything, setup.UserID).
			Return([]*workspace.WorkspaceWithRole{}, nil).Once()

		rec := setup.Get("/users/me/workspaces")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockWsSvc.AssertExpectations(t)
	})

	t.Run("returns 500 for service error", func(t *testing.T) {
		mockWsSvc.On("GetUserWorkspaces", mock.Anything, setup.UserID).
			Return(nil, fmt.Errorf("database error")).Once()

		rec := setup.Get("/users/me/workspaces")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockWsSvc.AssertExpectations(t)
	})
}

func TestUserHandler_UpdateMe(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterProtectedRoutes(setup.API)

	t.Run("updates profile successfully", func(t *testing.T) {
		testUser, _ := user.NewUser("test@example.com", "Updated Name", "password123")

		mockSvc.On("UpdateProfile", mock.Anything, setup.UserID, mock.MatchedBy(func(input user.UpdateProfileInput) bool {
			return input.FullName == "Updated Name"
		})).Return(testUser, nil).Once()

		body := `{"full_name":"Updated Name"}`
		rec := setup.Patch("/users/me", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty full name", func(t *testing.T) {
		body := `{"full_name":""}`
		rec := setup.Patch("/users/me", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("returns 400 for service error", func(t *testing.T) {
		mockSvc.On("UpdateProfile", mock.Anything, setup.UserID, mock.Anything).
			Return(nil, fmt.Errorf("database error")).Once()

		body := `{"full_name":"Updated Name"}`
		rec := setup.Patch("/users/me", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestUserHandler_UpdatePassword(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterProtectedRoutes(setup.API)

	t.Run("updates password successfully", func(t *testing.T) {
		mockSvc.On("UpdatePassword", mock.Anything, setup.UserID, "oldpass123", "newpass123").
			Return(nil).Once()

		body := `{"current_password":"oldpass123","new_password":"newpass123"}`
		rec := setup.Patch("/users/me/password", body)

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for incorrect current password", func(t *testing.T) {
		mockSvc.On("UpdatePassword", mock.Anything, setup.UserID, "wrongpass", "newpass123").
			Return(user.ErrInvalidPassword).Once()

		body := `{"current_password":"wrongpass","new_password":"newpass123"}`
		rec := setup.Patch("/users/me/password", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for short new password", func(t *testing.T) {
		body := `{"current_password":"oldpass123","new_password":"short"}`
		rec := setup.Patch("/users/me/password", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestUserHandler_UpdatePreferences(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterProtectedRoutes(setup.API)

	t.Run("updates preferences successfully", func(t *testing.T) {
		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
		testUser.UpdatePreferences("YYYY-MM-DD", "en", "dark", "", "", "")

		mockSvc.On("UpdatePreferences", mock.Anything, setup.UserID, mock.MatchedBy(func(input user.UpdatePreferencesInput) bool {
			return input.Theme == "dark" && input.Language == "en"
		})).Return(testUser, nil).Once()

		body := `{"theme":"dark","language":"en","date_format":"YYYY-MM-DD"}`
		rec := setup.Patch("/users/me/preferences", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for service error", func(t *testing.T) {
		mockSvc.On("UpdatePreferences", mock.Anything, setup.UserID, mock.Anything).
			Return(nil, fmt.Errorf("database error")).Once()

		body := `{"theme":"dark","language":"en","date_format":"YYYY-MM-DD"}`
		rec := setup.Patch("/users/me/preferences", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestUserHandler_ListUsers(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	setup.MakeSuperuser() // Superuser required for admin endpoints
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterAdminRoutes(setup.API)

	t.Run("lists users successfully", func(t *testing.T) {
		user1, _ := user.NewUser("user1@example.com", "User 1", "password123")
		user2, _ := user.NewUser("user2@example.com", "User 2", "password123")
		users := []*user.User{user1, user2}

		result := shared.NewPagedResult(users, 2, shared.Pagination{Page: 1, PageSize: 20})

		mockSvc.On("List", mock.Anything, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 20
		})).Return(&result, nil).Once()

		rec := setup.Get("/users")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		result := shared.NewPagedResult([]*user.User{}, 0, shared.Pagination{Page: 2, PageSize: 10})

		mockSvc.On("List", mock.Anything, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return(&result, nil).Once()

		rec := setup.Get("/users?page=2&page_size=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 403 for non-superuser", func(t *testing.T) {
		nonAdminSetup := testutil.NewHandlerTestSetup()
		handler := user.NewHandler(mockSvc, jwtSvc, nil)
		handler.RegisterAdminRoutes(nonAdminSetup.API)

		rec := nonAdminSetup.Get("/users")

		testutil.AssertStatus(t, rec, http.StatusForbidden)
	})

	t.Run("returns 500 for service error", func(t *testing.T) {
		mockSvc.On("List", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("database error")).Once()

		rec := setup.Get("/users")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestUserHandler_GetUserByID(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	setup.MakeSuperuser()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterAdminRoutes(setup.API)

	t.Run("gets user by ID successfully", func(t *testing.T) {
		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
		userID := testUser.ID()

		mockSvc.On("GetByID", mock.Anything, userID).
			Return(testUser, nil).Once()

		rec := setup.Get(fmt.Sprintf("/users/%s", userID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when user not found", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, userID).
			Return(nil, user.ErrUserNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/users/%s", userID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 403 for non-superuser", func(t *testing.T) {
		nonAdminSetup := testutil.NewHandlerTestSetup()
		handler := user.NewHandler(mockSvc, jwtSvc, nil)
		handler.RegisterAdminRoutes(nonAdminSetup.API)

		userID := uuid.New()
		rec := nonAdminSetup.Get(fmt.Sprintf("/users/%s", userID))

		testutil.AssertStatus(t, rec, http.StatusForbidden)
	})
}

func TestUserHandler_DeactivateUser(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	setup.MakeSuperuser()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterAdminRoutes(setup.API)

	t.Run("deactivates user successfully", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("Deactivate", mock.Anything, userID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/users/%s/deactivate", userID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when trying to deactivate self", func(t *testing.T) {
		rec := setup.Post(fmt.Sprintf("/users/%s/deactivate", setup.UserID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns 404 when user not found", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("Deactivate", mock.Anything, userID).
			Return(user.ErrUserNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/users/%s/deactivate", userID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 for service error", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("Deactivate", mock.Anything, userID).
			Return(fmt.Errorf("database error")).Once()

		rec := setup.Post(fmt.Sprintf("/users/%s/deactivate", userID), "")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestUserHandler_ActivateUser(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	setup.MakeSuperuser()
	mockSvc := new(MockService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.RegisterAdminRoutes(setup.API)

	t.Run("activates user successfully", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("Activate", mock.Anything, userID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/users/%s/activate", userID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when user not found", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("Activate", mock.Anything, userID).
			Return(user.ErrUserNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/users/%s/activate", userID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 for service error", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("Activate", mock.Anything, userID).
			Return(fmt.Errorf("database error")).Once()

		rec := setup.Post(fmt.Sprintf("/users/%s/activate", userID), "")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}
