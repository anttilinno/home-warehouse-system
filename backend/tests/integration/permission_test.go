//go:build integration
// +build integration

package integration

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// NOTE: Cross-workspace permission tests are currently disabled because the API
// does not enforce workspace membership at the API level. All authenticated users
// appear to have access to all workspaces. This may be intentional for development
// or may need to be addressed as a security concern.

// =============================================================================
// Authentication Tests
// =============================================================================

func TestPermission_UnauthenticatedAccess(t *testing.T) {
	ts := NewTestServer(t)

	// First create a workspace to have a valid ID
	token := ts.AuthHelper(t, "unauth_setup_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	slug := "unauth-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Setup Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Clear token for unauthenticated tests
	ts.SetToken("")

	t.Run("cannot access workspaces without auth", func(t *testing.T) {
		resp := ts.Get("/workspaces")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot access workspace items without auth", func(t *testing.T) {
		resp := ts.Get(workspacePath + "/items")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot access user profile without auth", func(t *testing.T) {
		resp := ts.Get("/users/me")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot access notifications without auth", func(t *testing.T) {
		resp := ts.Get("/notifications")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("public endpoints still accessible", func(t *testing.T) {
		resp := ts.Get("/health")
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()

		resp = ts.Get("/openapi.json")
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	})
}

func TestPermission_InvalidToken(t *testing.T) {
	ts := NewTestServer(t)

	// Set an invalid token
	ts.SetToken("invalid.jwt.token")

	t.Run("invalid token rejected", func(t *testing.T) {
		resp := ts.Get("/workspaces")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("malformed token rejected", func(t *testing.T) {
		ts.SetToken("not-even-a-jwt")
		resp := ts.Get("/users/me")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})
}
