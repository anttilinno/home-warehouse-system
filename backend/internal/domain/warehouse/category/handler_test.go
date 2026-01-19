package category

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// MockService is a mock implementation of Service for testing handlers.
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input CreateInput) (*Category, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Category), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Category, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Category), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Category, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Category), args.Error(1)
}

func (m *MockService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Category), args.Error(1)
}

func (m *MockService) ListByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*Category, error) {
	args := m.Called(ctx, workspaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Category), args.Error(1)
}

func (m *MockService) ListRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Category), args.Error(1)
}

func (m *MockService) GetBreadcrumb(ctx context.Context, categoryID, workspaceID uuid.UUID) ([]BreadcrumbItem, error) {
	args := m.Called(ctx, categoryID, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]BreadcrumbItem), args.Error(1)
}

// Test helpers
func setupTestRouter(svc *MockService) (http.Handler, *chi.Mux) {
	r := chi.NewRouter()

	// Add middleware to inject workspace context
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
			ctx := context.WithValue(r.Context(), appMiddleware.WorkspaceContextKey, workspaceID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})

	config := huma.DefaultConfig("Test API", "1.0.0")
	api := humachi.New(r, config)

	RegisterRoutes(api, svc, nil)

	return r, r
}

func TestHandler_CreateCategory(t *testing.T) {
	t.Run("creates category successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input CreateInput) bool {
			return input.Name == "Electronics" && input.WorkspaceID == workspaceID
		})).Return(cat, nil)

		body := `{"name":"Electronics"}`
		req := httptest.NewRequest("POST", "/categories", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		// Check response body structure
		var response CategoryResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "Electronics", response.Name)

		mockSvc.AssertExpectations(t)
	})

	t.Run("validates required fields", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		body := `{}`
		req := httptest.NewRequest("POST", "/categories", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
	})
}

func TestHandler_GetCategory(t *testing.T) {
	t.Run("gets category successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		categoryID := uuid.New()
		cat, _ := NewCategory(workspaceID, "Electronics", nil, nil)

		mockSvc.On("GetByID", mock.Anything, categoryID, workspaceID).Return(cat, nil)

		req := httptest.NewRequest("GET", "/categories/"+categoryID.String(), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response CategoryResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "Electronics", response.Name)

		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 for non-existent category", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		categoryID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, categoryID, workspaceID).Return(nil, ErrCategoryNotFound)

		req := httptest.NewRequest("GET", "/categories/"+categoryID.String(), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("validates UUID format", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		req := httptest.NewRequest("GET", "/categories/invalid-uuid", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
	})
}

func TestHandler_UpdateCategory(t *testing.T) {
	t.Run("updates category successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		categoryID := uuid.New()
		cat, _ := NewCategory(workspaceID, "Updated Electronics", nil, nil)

		mockSvc.On("Update", mock.Anything, categoryID, workspaceID, mock.MatchedBy(func(input UpdateInput) bool {
			return input.Name == "Updated Electronics"
		})).Return(cat, nil)

		body := `{"name":"Updated Electronics"}`
		req := httptest.NewRequest("PATCH", "/categories/"+categoryID.String(), strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_DeleteCategory(t *testing.T) {
	t.Run("deletes category successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		categoryID := uuid.New()

		mockSvc.On("Delete", mock.Anything, categoryID, workspaceID).Return(nil)

		req := httptest.NewRequest("DELETE", "/categories/"+categoryID.String(), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNoContent, w.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 409 when category has children", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		categoryID := uuid.New()

		mockSvc.On("Delete", mock.Anything, categoryID, workspaceID).Return(ErrHasChildren)

		req := httptest.NewRequest("DELETE", "/categories/"+categoryID.String(), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusConflict, w.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_ArchiveCategory(t *testing.T) {
	t.Run("archives category successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		categoryID := uuid.New()

		mockSvc.On("Archive", mock.Anything, categoryID, workspaceID).Return(nil)

		req := httptest.NewRequest("POST", "/categories/"+categoryID.String()+"/archive", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNoContent, w.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_RestoreCategory(t *testing.T) {
	t.Run("restores category successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		categoryID := uuid.New()

		mockSvc.On("Restore", mock.Anything, categoryID, workspaceID).Return(nil)

		req := httptest.NewRequest("POST", "/categories/"+categoryID.String()+"/restore", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNoContent, w.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_ListCategories(t *testing.T) {
	t.Run("lists categories successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		cat1, _ := NewCategory(workspaceID, "Category 1", nil, nil)
		cat2, _ := NewCategory(workspaceID, "Category 2", nil, nil)
		categories := []*Category{cat1, cat2}

		mockSvc.On("ListByWorkspace", mock.Anything, workspaceID).Return(categories, nil)

		req := httptest.NewRequest("GET", "/categories", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response CategoryListResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Len(t, response.Items, 2)

		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_ListRootCategories(t *testing.T) {
	t.Run("lists root categories successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		root1, _ := NewCategory(workspaceID, "Root 1", nil, nil)
		root2, _ := NewCategory(workspaceID, "Root 2", nil, nil)
		roots := []*Category{root1, root2}

		mockSvc.On("ListRootCategories", mock.Anything, workspaceID).Return(roots, nil)

		req := httptest.NewRequest("GET", "/categories/root", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response CategoryListResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Len(t, response.Items, 2)

		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_ListChildCategories(t *testing.T) {
	t.Run("lists child categories successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		parentID := uuid.New()

		child1, _ := NewCategory(workspaceID, "Child 1", &parentID, nil)
		child2, _ := NewCategory(workspaceID, "Child 2", &parentID, nil)
		children := []*Category{child1, child2}

		mockSvc.On("ListByParent", mock.Anything, workspaceID, parentID).Return(children, nil)

		req := httptest.NewRequest("GET", "/categories/"+parentID.String()+"/children", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var response CategoryListResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Len(t, response.Items, 2)

		mockSvc.AssertExpectations(t)
	})
}

func TestHandler_GetBreadcrumb(t *testing.T) {
	t.Run("gets breadcrumb trail successfully", func(t *testing.T) {
		mockSvc := new(MockService)
		router, _ := setupTestRouter(mockSvc)

		workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		categoryID := uuid.New()

		breadcrumb := []BreadcrumbItem{
			{ID: uuid.New(), Name: "Root"},
			{ID: uuid.New(), Name: "Parent"},
			{ID: categoryID, Name: "Current"},
		}

		mockSvc.On("GetBreadcrumb", mock.Anything, categoryID, workspaceID).Return(breadcrumb, nil)

		req := httptest.NewRequest("GET", "/categories/"+categoryID.String()+"/breadcrumb", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response []BreadcrumbItem
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Len(t, response, 3)
		assert.Equal(t, "Root", response[0].Name)
		assert.Equal(t, "Parent", response[1].Name)
		assert.Equal(t, "Current", response[2].Name)

		mockSvc.AssertExpectations(t)
	})
}
