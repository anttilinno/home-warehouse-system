//go:build integration
// +build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// Registration Tests
// =============================================================================

func TestRegister_Success(t *testing.T) {
	ts := NewTestServer(t)

	email := "register_success_" + uuid.New().String()[:8] + "@example.com"
	resp := ts.Post("/auth/register", map[string]string{
		"email":     email,
		"full_name": "Test User",
		"password":  "password123",
	})

	RequireStatus(t, resp, http.StatusOK)

	var result struct {
		ID       uuid.UUID `json:"id"`
		Email    string    `json:"email"`
		FullName string    `json:"full_name"`
	}
	result = ParseResponse[struct {
		ID       uuid.UUID `json:"id"`
		Email    string    `json:"email"`
		FullName string    `json:"full_name"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, result.ID)
	assert.Equal(t, email, result.Email)
	assert.Equal(t, "Test User", result.FullName)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	ts := NewTestServer(t)

	// First registration
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "duplicate@example.com",
		"full_name": "Test User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Duplicate registration
	resp = ts.Post("/auth/register", map[string]string{
		"email":     "duplicate@example.com",
		"full_name": "Another User",
		"password":  "password456",
	})
	RequireStatus(t, resp, http.StatusConflict)
	resp.Body.Close()
}

func TestRegister_InvalidEmail(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/register", map[string]string{
		"email":     "invalid-email",
		"full_name": "Test User",
		"password":  "password123",
	})

	RequireStatus(t, resp, http.StatusUnprocessableEntity)
	resp.Body.Close()
}

func TestRegister_ShortPassword(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/register", map[string]string{
		"email":     "test@example.com",
		"full_name": "Test User",
		"password":  "short",
	})

	RequireStatus(t, resp, http.StatusUnprocessableEntity)
	resp.Body.Close()
}

func TestRegister_MissingFields(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/register", map[string]string{
		"email": "test@example.com",
	})

	RequireStatus(t, resp, http.StatusUnprocessableEntity)
	resp.Body.Close()
}

// =============================================================================
// Login Tests
// =============================================================================

func TestLogin_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register user first
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "login@example.com",
		"full_name": "Login User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Login
	resp = ts.Post("/auth/login", map[string]string{
		"email":    "login@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var result struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
		User         struct {
			ID       uuid.UUID `json:"id"`
			Email    string    `json:"email"`
			FullName string    `json:"full_name"`
		} `json:"user"`
	}
	result = ParseResponse[struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
		User         struct {
			ID       uuid.UUID `json:"id"`
			Email    string    `json:"email"`
			FullName string    `json:"full_name"`
		} `json:"user"`
	}](t, resp)

	assert.NotEmpty(t, result.Token)
	assert.NotEmpty(t, result.RefreshToken)
	assert.Equal(t, "login@example.com", result.User.Email)
	assert.Equal(t, "Login User", result.User.FullName)
}

func TestLogin_InvalidCredentials(t *testing.T) {
	ts := NewTestServer(t)

	// Register user first
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "cred@example.com",
		"full_name": "Cred User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Login with wrong password
	resp = ts.Post("/auth/login", map[string]string{
		"email":    "cred@example.com",
		"password": "wrongpassword",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestLogin_NonExistentUser(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/login", map[string]string{
		"email":    "nonexistent@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

// =============================================================================
// Token Refresh Tests
// =============================================================================

func TestRefreshToken_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register and login
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "refresh@example.com",
		"full_name": "Refresh User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = ts.Post("/auth/login", map[string]string{
		"email":    "refresh@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var loginResult struct {
		RefreshToken string `json:"refresh_token"`
	}
	loginResult = ParseResponse[struct {
		RefreshToken string `json:"refresh_token"`
	}](t, resp)

	// Refresh token
	resp = ts.Post("/auth/refresh", map[string]string{
		"refresh_token": loginResult.RefreshToken,
	})
	RequireStatus(t, resp, http.StatusOK)

	var refreshResult struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
	refreshResult = ParseResponse[struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}](t, resp)

	assert.NotEmpty(t, refreshResult.Token)
	assert.NotEmpty(t, refreshResult.RefreshToken)
}

func TestRefreshToken_InvalidToken(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/refresh", map[string]string{
		"refresh_token": "invalid-token",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

// =============================================================================
// User Profile Tests
// =============================================================================

func TestGetMe_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register and login
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "me@example.com",
		"full_name": "Me User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = ts.Post("/auth/login", map[string]string{
		"email":    "me@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var loginResult struct {
		Token string `json:"token"`
	}
	loginResult = ParseResponse[struct {
		Token string `json:"token"`
	}](t, resp)

	// Get me
	ts.SetToken(loginResult.Token)
	resp = ts.Get("/users/me")
	RequireStatus(t, resp, http.StatusOK)

	var meResult struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	}
	meResult = ParseResponse[struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	}](t, resp)

	assert.Equal(t, "me@example.com", meResult.Email)
	assert.Equal(t, "Me User", meResult.FullName)
}

func TestGetMe_Unauthorized(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/users/me")
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestUpdateMe_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register and login
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "update@example.com",
		"full_name": "Original Name",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = ts.Post("/auth/login", map[string]string{
		"email":    "update@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var loginResult struct {
		Token string `json:"token"`
	}
	loginResult = ParseResponse[struct {
		Token string `json:"token"`
	}](t, resp)

	// Update profile
	ts.SetToken(loginResult.Token)
	resp = ts.Patch("/users/me", map[string]string{
		"full_name": "Updated Name",
	})
	RequireStatus(t, resp, http.StatusOK)

	var updateResult struct {
		FullName string `json:"full_name"`
	}
	updateResult = ParseResponse[struct {
		FullName string `json:"full_name"`
	}](t, resp)

	assert.Equal(t, "Updated Name", updateResult.FullName)
}

func TestUpdatePassword_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register and login
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "password@example.com",
		"full_name": "Password User",
		"password":  "oldpassword123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = ts.Post("/auth/login", map[string]string{
		"email":    "password@example.com",
		"password": "oldpassword123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var loginResult struct {
		Token string `json:"token"`
	}
	loginResult = ParseResponse[struct {
		Token string `json:"token"`
	}](t, resp)

	// Update password
	ts.SetToken(loginResult.Token)
	resp = ts.Patch("/users/me/password", map[string]string{
		"current_password": "oldpassword123",
		"new_password":     "newpassword456",
	})
	RequireStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	// Verify can login with new password
	ts.SetToken("")
	resp = ts.Post("/auth/login", map[string]string{
		"email":    "password@example.com",
		"password": "newpassword456",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Verify cannot login with old password
	resp = ts.Post("/auth/login", map[string]string{
		"email":    "password@example.com",
		"password": "oldpassword123",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

// =============================================================================
// Health Check Tests
// =============================================================================

func TestHealthCheck(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/health")
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var result struct {
		Status string `json:"status"`
	}
	result = ParseResponse[struct {
		Status string `json:"status"`
	}](t, resp)

	assert.Equal(t, "ok", result.Status)
}
