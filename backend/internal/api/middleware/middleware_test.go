package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Context Helper Tests
// =============================================================================

func TestGetWorkspaceID_WithValue(t *testing.T) {
	workspaceID := uuid.New()
	ctx := context.WithValue(context.Background(), WorkspaceContextKey, workspaceID)

	result, ok := GetWorkspaceID(ctx)

	assert.True(t, ok)
	assert.Equal(t, workspaceID, result)
}

func TestGetWorkspaceID_WithoutValue(t *testing.T) {
	ctx := context.Background()

	result, ok := GetWorkspaceID(ctx)

	assert.False(t, ok)
	assert.Equal(t, uuid.UUID{}, result)
}

func TestGetWorkspaceID_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), WorkspaceContextKey, "not-a-uuid")

	result, ok := GetWorkspaceID(ctx)

	assert.False(t, ok)
	assert.Equal(t, uuid.UUID{}, result)
}

func TestGetRole_WithValue(t *testing.T) {
	ctx := context.WithValue(context.Background(), RoleContextKey, "admin")

	result, ok := GetRole(ctx)

	assert.True(t, ok)
	assert.Equal(t, "admin", result)
}

func TestGetRole_WithoutValue(t *testing.T) {
	ctx := context.Background()

	result, ok := GetRole(ctx)

	assert.False(t, ok)
	assert.Equal(t, "", result)
}

func TestGetRole_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), RoleContextKey, 123)

	result, ok := GetRole(ctx)

	assert.False(t, ok)
	assert.Equal(t, "", result)
}

func TestGetAuthUser_WithValue(t *testing.T) {
	userID := uuid.New()
	user := &AuthUser{
		ID:          userID,
		Email:       "test@example.com",
		IsSuperuser: true,
	}
	ctx := context.WithValue(context.Background(), UserContextKey, user)

	result, ok := GetAuthUser(ctx)

	assert.True(t, ok)
	assert.Equal(t, userID, result.ID)
	assert.Equal(t, "test@example.com", result.Email)
	assert.True(t, result.IsSuperuser)
}

func TestGetAuthUser_WithoutValue(t *testing.T) {
	ctx := context.Background()

	result, ok := GetAuthUser(ctx)

	assert.False(t, ok)
	assert.Nil(t, result)
}

func TestGetAuthUser_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), UserContextKey, "not-a-user")

	result, ok := GetAuthUser(ctx)

	assert.False(t, ok)
	assert.Nil(t, result)
}

// =============================================================================
// AuthUser Struct Tests
// =============================================================================

func TestAuthUser_Fields(t *testing.T) {
	userID := uuid.New()
	user := AuthUser{
		ID:          userID,
		Email:       "test@example.com",
		IsSuperuser: false,
	}

	assert.Equal(t, userID, user.ID)
	assert.Equal(t, "test@example.com", user.Email)
	assert.False(t, user.IsSuperuser)
}

func TestAuthUser_Superuser(t *testing.T) {
	user := AuthUser{
		ID:          uuid.New(),
		Email:       "admin@example.com",
		IsSuperuser: true,
	}

	assert.True(t, user.IsSuperuser)
}

// =============================================================================
// Context Key Tests
// =============================================================================

func TestContextKeys(t *testing.T) {
	assert.Equal(t, contextKey("user"), UserContextKey)
	assert.Equal(t, contextKey("workspace"), WorkspaceContextKey)
	assert.Equal(t, contextKey("role"), RoleContextKey)
}

// =============================================================================
// RequireSuperuser Middleware Tests
// =============================================================================

func TestRequireSuperuser_NoAuth(t *testing.T) {
	handler := RequireSuperuser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "not authenticated")
}

func TestRequireSuperuser_NotSuperuser(t *testing.T) {
	handler := RequireSuperuser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	user := &AuthUser{
		ID:          uuid.New(),
		Email:       "user@example.com",
		IsSuperuser: false,
	}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(req.Context(), UserContextKey, user)
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), "superuser access required")
}

func TestRequireSuperuser_IsSuperuser(t *testing.T) {
	nextCalled := false
	handler := RequireSuperuser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	user := &AuthUser{
		ID:          uuid.New(),
		Email:       "admin@example.com",
		IsSuperuser: true,
	}

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(req.Context(), UserContextKey, user)
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, nextCalled)
}

// =============================================================================
// Auth (Legacy) Middleware Tests
// =============================================================================

func TestAuth_MissingHeader(t *testing.T) {
	handler := Auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "missing authorization header")
}

func TestAuth_InvalidFormat(t *testing.T) {
	handler := Auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Basic sometoken")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "invalid authorization format")
}

func TestAuth_ValidBearerToken_ReturnsError(t *testing.T) {
	// The legacy Auth middleware always returns an error since JWT service is not configured
	handler := Auth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer sometoken")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "JWT service not configured")
}

// =============================================================================
// CORS Middleware Tests
// =============================================================================

func TestCORS_SetsHeaders(t *testing.T) {
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "*", rec.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "GET, POST, PUT, PATCH, DELETE, OPTIONS", rec.Header().Get("Access-Control-Allow-Methods"))
	assert.Contains(t, rec.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	assert.Equal(t, "true", rec.Header().Get("Access-Control-Allow-Credentials"))
	assert.Equal(t, "300", rec.Header().Get("Access-Control-Max-Age"))
}

func TestCORS_OptionsRequest(t *testing.T) {
	nextCalled := false
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// OPTIONS requests should return 204 No Content and not call next handler
	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.False(t, nextCalled)

	// Still should have CORS headers
	assert.Equal(t, "*", rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_NonOptionsRequest(t *testing.T) {
	nextCalled := false
	handler := CORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, nextCalled)
}
