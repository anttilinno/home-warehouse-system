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

// AuthHelper creates a user and returns the token.
func (ts *TestServer) AuthHelper(t *testing.T, email string) string {
	t.Helper()

	// Register
	resp := ts.Post("/auth/register", map[string]string{
		"email":     email,
		"full_name": "Test User",
		"password":  "password123",
	})
	if resp.StatusCode != http.StatusOK {
		// User might already exist, try login
		resp.Body.Close()
	} else {
		resp.Body.Close()
	}

	// Login
	resp = ts.Post("/auth/login", map[string]string{
		"email":    email,
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var result struct {
		Token string `json:"token"`
	}
	result = ParseResponse[struct {
		Token string `json:"token"`
	}](t, resp)

	return result.Token
}

// =============================================================================
// Workspace CRUD Tests
// =============================================================================

func TestCreateWorkspace_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "workspace@example.com")
	ts.SetToken(token)

	resp := ts.Post("/workspaces", map[string]string{
		"name":        "My Workspace",
		"description": "A test workspace",
	})
	RequireStatus(t, resp, http.StatusOK)

	var result struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}
	result = ParseResponse[struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, result.ID)
	assert.Equal(t, "My Workspace", result.Name)
	assert.Equal(t, "A test workspace", result.Description)
}

func TestCreateWorkspace_Unauthorized(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/workspaces", map[string]string{
		"name": "My Workspace",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestListWorkspaces_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "listws@example.com")
	ts.SetToken(token)

	// Create workspaces
	for i := 1; i <= 3; i++ {
		resp := ts.Post("/workspaces", map[string]string{
			"name": fmt.Sprintf("Workspace %d", i),
		})
		RequireStatus(t, resp, http.StatusOK)
		resp.Body.Close()
	}

	// List workspaces
	resp := ts.Get("/workspaces")
	RequireStatus(t, resp, http.StatusOK)

	var result struct {
		Workspaces []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"workspaces"`
	}
	result = ParseResponse[struct {
		Workspaces []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"workspaces"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(result.Workspaces), 3)
}

func TestGetWorkspace_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "getws@example.com")
	ts.SetToken(token)

	// Create workspace
	resp := ts.Post("/workspaces", map[string]string{
		"name":        "Get Test Workspace",
		"description": "Test description",
	})
	RequireStatus(t, resp, http.StatusOK)

	var createResult struct {
		ID uuid.UUID `json:"id"`
	}
	createResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Get workspace
	resp = ts.Get(fmt.Sprintf("/workspaces/%s", createResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	var getResult struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}
	getResult = ParseResponse[struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}](t, resp)

	assert.Equal(t, createResult.ID, getResult.ID)
	assert.Equal(t, "Get Test Workspace", getResult.Name)
	assert.Equal(t, "Test description", getResult.Description)
}

func TestUpdateWorkspace_Success(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "updatews@example.com")
	ts.SetToken(token)

	// Create workspace
	resp := ts.Post("/workspaces", map[string]string{
		"name": "Original Name",
	})
	RequireStatus(t, resp, http.StatusOK)

	var createResult struct {
		ID uuid.UUID `json:"id"`
	}
	createResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Update workspace
	resp = ts.Patch(fmt.Sprintf("/workspaces/%s", createResult.ID), map[string]string{
		"name":        "Updated Name",
		"description": "New description",
	})
	RequireStatus(t, resp, http.StatusOK)

	var updateResult struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	updateResult = ParseResponse[struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}](t, resp)

	assert.Equal(t, "Updated Name", updateResult.Name)
	assert.Equal(t, "New description", updateResult.Description)
}

// =============================================================================
// Workspace-Scoped Resource Tests
// =============================================================================

func TestCategoryCRUD(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "category@example.com")
	ts.SetToken(token)

	// Create workspace
	resp := ts.Post("/workspaces", map[string]string{
		"name": "Category Test Workspace",
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create category
	resp = ts.Post(workspacePath+"/categories", map[string]string{
		"name":        "Electronics",
		"description": "Electronic devices",
	})
	RequireStatus(t, resp, http.StatusOK)

	var catResult struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}
	catResult = ParseResponse[struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, catResult.ID)
	assert.Equal(t, "Electronics", catResult.Name)

	// List categories
	resp = ts.Get(workspacePath + "/categories")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Categories []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"categories"`
	}
	listResult = ParseResponse[struct {
		Categories []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"categories"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(listResult.Categories), 1)

	// Update category
	resp = ts.Patch(fmt.Sprintf("%s/categories/%s", workspacePath, catResult.ID), map[string]string{
		"name": "Updated Electronics",
	})
	RequireStatus(t, resp, http.StatusOK)

	var updateResult struct {
		Name string `json:"name"`
	}
	updateResult = ParseResponse[struct {
		Name string `json:"name"`
	}](t, resp)

	assert.Equal(t, "Updated Electronics", updateResult.Name)

	// Delete category
	resp = ts.Delete(fmt.Sprintf("%s/categories/%s", workspacePath, catResult.ID))
	RequireStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()
}

func TestLocationCRUD(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "location@example.com")
	ts.SetToken(token)

	// Create workspace
	resp := ts.Post("/workspaces", map[string]string{
		"name": "Location Test Workspace",
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create location
	resp = ts.Post(workspacePath+"/locations", map[string]string{
		"name":        "Warehouse A",
		"description": "Main warehouse",
	})
	RequireStatus(t, resp, http.StatusOK)

	var locResult struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}
	locResult = ParseResponse[struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, locResult.ID)
	assert.Equal(t, "Warehouse A", locResult.Name)

	// Get location with breadcrumb
	resp = ts.Get(fmt.Sprintf("%s/locations/%s/breadcrumb", workspacePath, locResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	var breadcrumbResult struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}
	breadcrumbResult = ParseResponse[struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(breadcrumbResult.Items), 1)
}

func TestItemCRUD(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "item@example.com")
	ts.SetToken(token)

	// Create workspace
	resp := ts.Post("/workspaces", map[string]string{
		"name": "Item Test Workspace",
	})
	RequireStatus(t, resp, http.StatusOK)

	var wsResult struct {
		ID uuid.UUID `json:"id"`
	}
	wsResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

	// Create item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Test Item",
		"sku":             "SKU-001",
		"description":     "A test item",
		"min_stock_level": 5,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		SKU         string    `json:"sku"`
		Description string    `json:"description"`
		ObsidianURI string    `json:"obsidian_uri"`
	}
	itemResult = ParseResponse[struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		SKU         string    `json:"sku"`
		Description string    `json:"description"`
		ObsidianURI string    `json:"obsidian_uri"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, itemResult.ID)
	assert.Equal(t, "Test Item", itemResult.Name)
	assert.Equal(t, "SKU-001", itemResult.SKU)
	assert.NotEmpty(t, itemResult.ObsidianURI) // Verify Obsidian deep link is generated

	// Search items
	resp = ts.Get(workspacePath + "/items/search?q=Test")
	RequireStatus(t, resp, http.StatusOK)

	var searchResult struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}
	searchResult = ParseResponse[struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(searchResult.Items), 1)
}
