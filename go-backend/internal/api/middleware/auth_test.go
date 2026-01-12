package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

// =============================================================================
// JWTAuth Middleware Tests
// =============================================================================

func TestJWTAuth_ValidToken(t *testing.T) {
	// Create a real JWT service for testing
	jwtService := jwt.NewService("test-secret", 24)
	userID := uuid.New()
	email := "test@example.com"

	// Generate a valid token
	token, err := jwtService.GenerateToken(userID, email, false)
	assert.NoError(t, err)

	// Track if next handler was called
	nextCalled := false
	var capturedUser *AuthUser

	handler := JWTAuth(jwtService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		user, ok := GetAuthUser(r.Context())
		assert.True(t, ok)
		capturedUser = user
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, nextCalled)
	assert.NotNil(t, capturedUser)
	assert.Equal(t, userID, capturedUser.ID)
	assert.Equal(t, email, capturedUser.Email)
	assert.False(t, capturedUser.IsSuperuser)
}

func TestJWTAuth_ValidTokenSuperuser(t *testing.T) {
	jwtService := jwt.NewService("test-secret", 24)
	userID := uuid.New()
	email := "admin@example.com"

	token, err := jwtService.GenerateToken(userID, email, true)
	assert.NoError(t, err)

	var capturedUser *AuthUser

	handler := JWTAuth(jwtService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := GetAuthUser(r.Context())
		assert.True(t, ok)
		capturedUser = user
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.NotNil(t, capturedUser)
	assert.True(t, capturedUser.IsSuperuser)
}

func TestJWTAuth_MissingAuthorizationHeader(t *testing.T) {
	jwtService := jwt.NewService("test-secret", 24)

	nextCalled := false
	handler := JWTAuth(jwtService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.False(t, nextCalled)
	assert.Contains(t, rec.Body.String(), "missing authorization header")
}

func TestJWTAuth_InvalidAuthorizationFormat(t *testing.T) {
	jwtService := jwt.NewService("test-secret", 24)

	tests := []struct {
		name   string
		header string
	}{
		{"no bearer prefix", "sometoken"},
		{"basic auth", "Basic sometoken"},
		{"lowercase bearer", "bearer sometoken"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nextCalled := false
			handler := JWTAuth(jwtService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				nextCalled = true
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("Authorization", tt.header)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			assert.Equal(t, http.StatusUnauthorized, rec.Code)
			assert.False(t, nextCalled)
			assert.Contains(t, rec.Body.String(), "invalid authorization format")
		})
	}
}

func TestJWTAuth_InvalidToken(t *testing.T) {
	jwtService := jwt.NewService("test-secret", 24)

	nextCalled := false
	handler := JWTAuth(jwtService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.False(t, nextCalled)
	assert.Contains(t, rec.Body.String(), "invalid token")
}

func TestJWTAuth_ExpiredToken(t *testing.T) {
	// Create a JWT service with 0 expiration hours to generate an expired token
	jwtService := jwt.NewService("test-secret", 0)
	userID := uuid.New()
	email := "test@example.com"

	// Generate token that expires immediately
	token, err := jwtService.GenerateToken(userID, email, false)
	assert.NoError(t, err)

	// Wait a tiny bit to ensure expiration (the token has 0 hour expiration)
	// Note: The token will be expired immediately since expirationHours is 0

	nextCalled := false
	handler := JWTAuth(jwtService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.False(t, nextCalled)
	assert.Contains(t, rec.Body.String(), "token has expired")
}

func TestJWTAuth_TokenWithWrongSecret(t *testing.T) {
	// Generate token with one secret
	jwtService1 := jwt.NewService("secret-1", 24)
	userID := uuid.New()
	email := "test@example.com"

	token, err := jwtService1.GenerateToken(userID, email, false)
	assert.NoError(t, err)

	// Try to validate with different secret
	jwtService2 := jwt.NewService("secret-2", 24)

	nextCalled := false
	handler := JWTAuth(jwtService2)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.False(t, nextCalled)
	assert.Contains(t, rec.Body.String(), "invalid token")
}

func TestJWTAuth_UserInContext(t *testing.T) {
	jwtService := jwt.NewService("test-secret", 24)
	userID := uuid.New()
	email := "context-test@example.com"

	token, err := jwtService.GenerateToken(userID, email, true)
	assert.NoError(t, err)

	var capturedContext context.Context

	handler := JWTAuth(jwtService)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedContext = r.Context()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.NotNil(t, capturedContext)

	// Verify user is in context using helper function
	user, ok := GetAuthUser(capturedContext)
	assert.True(t, ok)
	assert.Equal(t, userID, user.ID)
	assert.Equal(t, email, user.Email)
	assert.True(t, user.IsSuperuser)

	// Verify direct context value access
	contextValue := capturedContext.Value(UserContextKey)
	assert.NotNil(t, contextValue)
	authUser, ok := contextValue.(*AuthUser)
	assert.True(t, ok)
	assert.Equal(t, userID, authUser.ID)
}
