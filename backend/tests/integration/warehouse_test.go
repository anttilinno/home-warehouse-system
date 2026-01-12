//go:build integration
// +build integration

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Container Tests
// =============================================================================

func TestContainerCRUD(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "container_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "container-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Container Test Workspace",
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

	// Create location first (required for container)
	resp = ts.Post(workspacePath+"/locations", map[string]string{
		"name": "Test Location",
	})
	RequireStatus(t, resp, http.StatusOK)

	var locResult struct {
		ID uuid.UUID `json:"id"`
	}
	locResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create container
	resp = ts.Post(workspacePath+"/containers", map[string]interface{}{
		"name":        "Box A",
		"location_id": locResult.ID,
		"description": "Storage box",
		"capacity":    "50 items",
	})
	RequireStatus(t, resp, http.StatusOK)

	var contResult struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}
	contResult = ParseResponse[struct {
		ID          uuid.UUID `json:"id"`
		Name        string    `json:"name"`
		Description string    `json:"description"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, contResult.ID)
	assert.Equal(t, "Box A", contResult.Name)

	// Get container
	resp = ts.Get(fmt.Sprintf("%s/containers/%s", workspacePath, contResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	var getResult struct {
		Name string `json:"name"`
	}
	getResult = ParseResponse[struct {
		Name string `json:"name"`
	}](t, resp)

	assert.Equal(t, "Box A", getResult.Name)

	// List containers
	resp = ts.Get(workspacePath + "/containers")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(listResult.Items), 1)

	// Delete container
	resp = ts.Delete(fmt.Sprintf("%s/containers/%s", workspacePath, contResult.ID))
	RequireStatus(t, resp, http.StatusNoContent)
}

// =============================================================================
// Inventory Tests
// =============================================================================

func TestInventoryCRUD(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "inventory_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "inventory-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Inventory Test Workspace",
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

	// Create item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Inventory Item",
		"sku":             "INV-SKU-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create location
	resp = ts.Post(workspacePath+"/locations", map[string]string{
		"name": "Inventory Location",
	})
	RequireStatus(t, resp, http.StatusOK)

	var locResult struct {
		ID uuid.UUID `json:"id"`
	}
	locResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create inventory
	resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
		"item_id":     itemResult.ID,
		"location_id": locResult.ID,
		"quantity":    10,
		"condition":   "NEW",
		"status":      "AVAILABLE",
	})
	RequireStatus(t, resp, http.StatusOK)

	var invResult struct {
		ID        uuid.UUID `json:"id"`
		Quantity  int       `json:"quantity"`
		Condition string    `json:"condition"`
		Status    string    `json:"status"`
	}
	invResult = ParseResponse[struct {
		ID        uuid.UUID `json:"id"`
		Quantity  int       `json:"quantity"`
		Condition string    `json:"condition"`
		Status    string    `json:"status"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, invResult.ID)
	assert.Equal(t, 10, invResult.Quantity)
	assert.Equal(t, "NEW", invResult.Condition)
	assert.Equal(t, "AVAILABLE", invResult.Status)

	// Get inventory
	resp = ts.Get(fmt.Sprintf("%s/inventory/%s", workspacePath, invResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	// Get total quantity for item
	resp = ts.Get(fmt.Sprintf("%s/inventory/total-quantity/%s", workspacePath, itemResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	var totalResult struct {
		TotalQuantity int `json:"total_quantity"`
	}
	totalResult = ParseResponse[struct {
		TotalQuantity int `json:"total_quantity"`
	}](t, resp)

	assert.Equal(t, 10, totalResult.TotalQuantity)

	// Get inventory by location
	resp = ts.Get(fmt.Sprintf("%s/inventory/by-location/%s", workspacePath, locResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	var byLocResult struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}
	byLocResult = ParseResponse[struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(byLocResult.Items), 1)
}

// =============================================================================
// Borrower Tests
// =============================================================================

func TestBorrowerCRUD(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "borrower_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "borrower-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Borrower Test Workspace",
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

	// Create borrower
	resp = ts.Post(workspacePath+"/borrowers", map[string]interface{}{
		"name":  "John Doe",
		"email": "john@example.com",
		"phone": "+1234567890",
	})
	RequireStatus(t, resp, http.StatusOK)

	var borrowerResult struct {
		ID    uuid.UUID `json:"id"`
		Name  string    `json:"name"`
		Email string    `json:"email"`
	}
	borrowerResult = ParseResponse[struct {
		ID    uuid.UUID `json:"id"`
		Name  string    `json:"name"`
		Email string    `json:"email"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, borrowerResult.ID)
	assert.Equal(t, "John Doe", borrowerResult.Name)

	// Get borrower
	resp = ts.Get(fmt.Sprintf("%s/borrowers/%s", workspacePath, borrowerResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	// List borrowers
	resp = ts.Get(workspacePath + "/borrowers")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(listResult.Items), 1)
}

// =============================================================================
// Loan Tests
// =============================================================================

func TestLoanEndpoints(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "loan_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "loan-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Loan Test Workspace",
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

	// List loans (empty initially)
	resp = ts.Get(workspacePath + "/loans")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}](t, resp)

	assert.NotNil(t, listResult.Items)

	// List active loans
	resp = ts.Get(workspacePath + "/loans/active")
	RequireStatus(t, resp, http.StatusOK)

	// List overdue loans
	resp = ts.Get(workspacePath + "/loans/overdue")
	RequireStatus(t, resp, http.StatusOK)
}

// =============================================================================
// Company Tests
// =============================================================================

func TestCompanyCRUD(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "company_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "company-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Company Test Workspace",
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

	// Create company
	resp = ts.Post(workspacePath+"/companies", map[string]interface{}{
		"name":    "Acme Corp",
		"website": "https://acme.example.com",
		"notes":   "Important supplier",
	})
	RequireStatus(t, resp, http.StatusOK)

	var companyResult struct {
		ID      uuid.UUID `json:"id"`
		Name    string    `json:"name"`
		Website string    `json:"website"`
	}
	companyResult = ParseResponse[struct {
		ID      uuid.UUID `json:"id"`
		Name    string    `json:"name"`
		Website string    `json:"website"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, companyResult.ID)
	assert.Equal(t, "Acme Corp", companyResult.Name)

	// Get company
	resp = ts.Get(fmt.Sprintf("%s/companies/%s", workspacePath, companyResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	// List companies
	resp = ts.Get(workspacePath + "/companies")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(listResult.Items), 1)
}

// =============================================================================
// Label Tests
// =============================================================================

func TestLabelCRUD(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "label_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "label-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Label Test Workspace",
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

	// Create label
	resp = ts.Post(workspacePath+"/labels", map[string]interface{}{
		"name":        "Important",
		"color":       "#FF0000",
		"description": "High priority items",
	})
	RequireStatus(t, resp, http.StatusOK)

	var labelResult struct {
		ID    uuid.UUID `json:"id"`
		Name  string    `json:"name"`
		Color string    `json:"color"`
	}
	labelResult = ParseResponse[struct {
		ID    uuid.UUID `json:"id"`
		Name  string    `json:"name"`
		Color string    `json:"color"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, labelResult.ID)
	assert.Equal(t, "Important", labelResult.Name)
	assert.Equal(t, "#FF0000", labelResult.Color)

	// Get label
	resp = ts.Get(fmt.Sprintf("%s/labels/%s", workspacePath, labelResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	// List labels
	resp = ts.Get(workspacePath + "/labels")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID   uuid.UUID `json:"id"`
			Name string    `json:"name"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(listResult.Items), 1)
}

// =============================================================================
// Favorite Tests
// =============================================================================

func TestFavoriteToggle(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "favorite_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "favorite-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Favorite Test Workspace",
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

	// Create item to favorite
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Favorite Item",
		"sku":             "FAV-SKU-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Toggle favorite (add)
	resp = ts.Post(workspacePath+"/favorites", map[string]interface{}{
		"favorite_type": "ITEM",
		"target_id":     itemResult.ID,
	})
	RequireStatus(t, resp, http.StatusOK)

	var favResult struct {
		Added bool `json:"added"`
	}
	favResult = ParseResponse[struct {
		Added bool `json:"added"`
	}](t, resp)

	assert.True(t, favResult.Added)

	// List favorites
	resp = ts.Get(workspacePath + "/favorites")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(listResult.Items), 1)

	// Toggle favorite again (remove)
	resp = ts.Post(workspacePath+"/favorites", map[string]interface{}{
		"favorite_type": "ITEM",
		"target_id":     itemResult.ID,
	})
	RequireStatus(t, resp, http.StatusOK)

	var removeResult struct {
		Added bool `json:"added"`
	}
	removeResult = ParseResponse[struct {
		Added bool `json:"added"`
	}](t, resp)

	assert.False(t, removeResult.Added)
}

// =============================================================================
// Movement Tests
// =============================================================================

func TestMovementList(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "movement_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "movement-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Movement Test Workspace",
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

	// List movements (empty initially)
	resp = ts.Get(workspacePath + "/movements")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}](t, resp)

	// Should be empty or have items
	assert.NotNil(t, listResult.Items)
}

// =============================================================================
// Activity Tests
// =============================================================================

func TestActivityList(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "activity_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "activity-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Activity Test Workspace",
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

	// List activity (empty initially)
	resp = ts.Get(workspacePath + "/activity")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}](t, resp)

	// Should be empty or have items
	assert.NotNil(t, listResult.Items)
}

// =============================================================================
// Member Tests
// =============================================================================

func TestMemberList(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "member_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "member-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Member Test Workspace",
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

	// List members - should have at least the creator (owner)
	resp = ts.Get(workspacePath + "/members")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID     uuid.UUID `json:"id"`
			UserID uuid.UUID `json:"user_id"`
			Role   string    `json:"role"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID     uuid.UUID `json:"id"`
			UserID uuid.UUID `json:"user_id"`
			Role   string    `json:"role"`
		} `json:"items"`
	}](t, resp)

	// Workspace creator should be owner
	assert.GreaterOrEqual(t, len(listResult.Items), 1)
	assert.Equal(t, "owner", listResult.Items[0].Role)
}

// =============================================================================
// Notification Tests
// =============================================================================

func TestNotificationEndpoints(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "notif_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Notifications are user-scoped (not workspace-scoped)
	// List notifications (empty initially)
	resp := ts.Get("/notifications")
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items      []struct{} `json:"items"`
		Total      int        `json:"total"`
		Page       int        `json:"page"`
		TotalPages int        `json:"total_pages"`
	}
	listResult = ParseResponse[struct {
		Items      []struct{} `json:"items"`
		Total      int        `json:"total"`
		Page       int        `json:"page"`
		TotalPages int        `json:"total_pages"`
	}](t, resp)

	assert.NotNil(t, listResult.Items)
	assert.Equal(t, 1, listResult.Page)

	// Get unread notifications
	resp = ts.Get("/notifications/unread")
	RequireStatus(t, resp, http.StatusOK)

	// Get unread count
	resp = ts.Get("/notifications/unread/count")
	RequireStatus(t, resp, http.StatusOK)

	var countResult struct {
		Count int64 `json:"count"`
	}
	countResult = ParseResponse[struct {
		Count int64 `json:"count"`
	}](t, resp)

	assert.GreaterOrEqual(t, countResult.Count, int64(0))

	// Mark all as read
	resp = ts.Post("/notifications/read-all", map[string]interface{}{})
	RequireStatus(t, resp, http.StatusNoContent)
}

// =============================================================================
// Analytics Tests
// =============================================================================

func TestAnalyticsEndpoints(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "analytics_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "analytics-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Analytics Test Workspace",
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

	// Dashboard stats
	resp = ts.Get(workspacePath + "/analytics/dashboard")
	RequireStatus(t, resp, http.StatusOK)

	var dashboardResult struct {
		TotalItems     int `json:"total_items"`
		TotalInventory int `json:"total_inventory"`
		TotalLocations int `json:"total_locations"`
	}
	dashboardResult = ParseResponse[struct {
		TotalItems     int `json:"total_items"`
		TotalInventory int `json:"total_inventory"`
		TotalLocations int `json:"total_locations"`
	}](t, resp)

	assert.GreaterOrEqual(t, dashboardResult.TotalItems, 0)

	// Category stats
	resp = ts.Get(workspacePath + "/analytics/categories")
	RequireStatus(t, resp, http.StatusOK)

	// Loan stats
	resp = ts.Get(workspacePath + "/analytics/loans")
	RequireStatus(t, resp, http.StatusOK)

	// Location values
	resp = ts.Get(workspacePath + "/analytics/locations")
	RequireStatus(t, resp, http.StatusOK)

	// Recent activity
	resp = ts.Get(workspacePath + "/analytics/activity")
	RequireStatus(t, resp, http.StatusOK)

	// Condition breakdown
	resp = ts.Get(workspacePath + "/analytics/conditions")
	RequireStatus(t, resp, http.StatusOK)

	// Status breakdown
	resp = ts.Get(workspacePath + "/analytics/statuses")
	RequireStatus(t, resp, http.StatusOK)

	// Top borrowers
	resp = ts.Get(workspacePath + "/analytics/borrowers")
	RequireStatus(t, resp, http.StatusOK)

	// Analytics summary
	resp = ts.Get(workspacePath + "/analytics/summary")
	RequireStatus(t, resp, http.StatusOK)

	// Monthly loan activity
	resp = ts.Get(workspacePath + "/analytics/loans/monthly")
	RequireStatus(t, resp, http.StatusOK)
}

// =============================================================================
// Sync Tests
// =============================================================================

func TestSyncEndpoints(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "sync_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "sync-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Sync Test Workspace",
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

	// Test delta sync endpoint (full sync - no modified_since)
	resp = ts.Get(workspacePath + "/sync/delta")
	RequireStatus(t, resp, http.StatusOK)

	var syncResult struct {
		SyncedAt    string `json:"synced_at"`
		EntityTypes int    `json:"entity_types"`
	}
	syncResult = ParseResponse[struct {
		SyncedAt    string `json:"synced_at"`
		EntityTypes int    `json:"entity_types"`
	}](t, resp)

	assert.NotEmpty(t, syncResult.SyncedAt)

	// Test delta sync with entity type filter
	resp = ts.Get(workspacePath + "/sync/delta?entity_types=item,location")
	RequireStatus(t, resp, http.StatusOK)

	// Test delta sync with modified_since (incremental sync)
	resp = ts.Get(workspacePath + "/sync/delta?modified_since=2024-01-01T00:00:00Z")
	RequireStatus(t, resp, http.StatusOK)
}

// =============================================================================
// Deleted Records Tests
// =============================================================================

func TestDeletedRecordsEndpoint(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "deleted_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "deleted-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Deleted Test Workspace",
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

	// Get deleted records (empty initially)
	resp = ts.Get(workspacePath + "/sync/deleted")
	RequireStatus(t, resp, http.StatusOK)

	var deletedResult struct {
		Items []struct {
			ID         uuid.UUID `json:"id"`
			EntityType string    `json:"entity_type"`
			EntityID   uuid.UUID `json:"entity_id"`
		} `json:"items"`
	}
	deletedResult = ParseResponse[struct {
		Items []struct {
			ID         uuid.UUID `json:"id"`
			EntityType string    `json:"entity_type"`
			EntityID   uuid.UUID `json:"entity_id"`
		} `json:"items"`
	}](t, resp)

	assert.NotNil(t, deletedResult.Items)

	// Test with since parameter
	resp = ts.Get(workspacePath + "/sync/deleted?since=2024-01-01T00:00:00Z")
	RequireStatus(t, resp, http.StatusOK)
}

// =============================================================================
// Attachment Tests
// =============================================================================

func TestAttachmentEndpoints(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "attach_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "attach-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Attachment Test Workspace",
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

	// Create item for attachments
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Attachment Test Item",
		"sku":             "ATT-SKU-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID uuid.UUID `json:"id"`
	}
	itemResult = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// List attachments for item (empty initially)
	resp = ts.Get(fmt.Sprintf("%s/items/%s/attachments", workspacePath, itemResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	var listResult struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}
	listResult = ParseResponse[struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}](t, resp)

	assert.NotNil(t, listResult.Items)

	// Create attachment without file (external link)
	resp = ts.Post(fmt.Sprintf("%s/items/%s/attachments", workspacePath, itemResult.ID), map[string]interface{}{
		"attachment_type":  "OTHER",
		"title":            "External Link",
		"is_primary":       false,
		"docspell_item_id": "ext-12345",
	})
	RequireStatus(t, resp, http.StatusOK)

	var attachResult struct {
		ID             uuid.UUID `json:"id"`
		AttachmentType string    `json:"attachment_type"`
		Title          string    `json:"title"`
	}
	attachResult = ParseResponse[struct {
		ID             uuid.UUID `json:"id"`
		AttachmentType string    `json:"attachment_type"`
		Title          string    `json:"title"`
	}](t, resp)

	assert.NotEqual(t, uuid.Nil, attachResult.ID)
	assert.Equal(t, "OTHER", attachResult.AttachmentType)

	// Get attachment by ID
	resp = ts.Get(fmt.Sprintf("%s/attachments/%s", workspacePath, attachResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	// List attachments again (should have one now)
	resp = ts.Get(fmt.Sprintf("%s/items/%s/attachments", workspacePath, itemResult.ID))
	RequireStatus(t, resp, http.StatusOK)

	listResult = ParseResponse[struct {
		Items []struct {
			ID uuid.UUID `json:"id"`
		} `json:"items"`
	}](t, resp)

	assert.Equal(t, 1, len(listResult.Items))

	// Delete attachment
	resp = ts.Delete(fmt.Sprintf("%s/attachments/%s", workspacePath, attachResult.ID))
	RequireStatus(t, resp, http.StatusNoContent)
}

// =============================================================================
// Import/Export Tests
// =============================================================================

func TestExportEndpoint(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "export_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "export-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Export Test Workspace",
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

	// Create an item to export
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Export Test Item",
		"sku":             "EXP-SKU-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	// Export items as CSV
	resp = ts.Get(workspacePath + "/export/item?format=csv")
	RequireStatus(t, resp, http.StatusOK)

	// Export items as JSON
	resp = ts.Get(workspacePath + "/export/item?format=json")
	RequireStatus(t, resp, http.StatusOK)

	// Export locations (empty)
	resp = ts.Get(workspacePath + "/export/location?format=csv")
	RequireStatus(t, resp, http.StatusOK)
}

// =============================================================================
// Batch Operations Tests
// =============================================================================

func TestBatchOperations(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "batch_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "batch-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Batch Test Workspace",
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

	// Create batch operations
	resp = ts.Post(workspacePath+"/sync/batch", map[string]interface{}{
		"operations": []map[string]interface{}{
			{
				"entity_type": "item",
				"operation":   "create",
				"data": map[string]interface{}{
					"name":            "Batch Item 1",
					"sku":             "BATCH-001",
					"min_stock_level": 0,
				},
			},
			{
				"entity_type": "item",
				"operation":   "create",
				"data": map[string]interface{}{
					"name":            "Batch Item 2",
					"sku":             "BATCH-002",
					"min_stock_level": 0,
				},
			},
		},
	})
	RequireStatus(t, resp, http.StatusOK)

	var batchResult struct {
		Succeeded int               `json:"succeeded"`
		Failed    int               `json:"failed"`
		Results   []json.RawMessage `json:"results"`
	}
	batchResult = ParseResponse[struct {
		Succeeded int               `json:"succeeded"`
		Failed    int               `json:"failed"`
		Results   []json.RawMessage `json:"results"`
	}](t, resp)

	// Batch endpoint should process all operations (regardless of success/failure)
	assert.Equal(t, 2, len(batchResult.Results))
}
