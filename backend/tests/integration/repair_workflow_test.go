//go:build integration
// +build integration

package integration

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// Auth/Authz Tests for Repair Endpoints (API-04 Coverage)
// =============================================================================

// TestRepairEndpoints_Unauthenticated tests that all repair endpoints reject requests
// without authentication (401 Unauthorized)
func TestRepairEndpoints_Unauthenticated(t *testing.T) {
	ts := NewTestServer(t)

	// First, create a workspace and repair log with authenticated user
	email := "repair_unauth_setup_" + uuid.New().String()[:8] + "@example.com"
	token := ts.AuthHelper(t, email)
	ts.SetToken(token)

	// Create workspace
	slug := "repair-unauth-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Repair Auth Test Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var workspace struct {
		ID uuid.UUID `json:"id"`
	}
	workspace = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", workspace.ID)

	// Create location
	resp = ts.Post(workspacePath+"/locations", map[string]interface{}{
		"name": "Repair Test Location",
	})
	RequireStatusCreated(t, resp)

	var location struct {
		ID uuid.UUID `json:"id"`
	}
	location = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Repair Test Item",
		"sku":             "REPAIR-UNAUTH-" + uuid.New().String()[:8],
		"min_stock_level": 0,
	})
	RequireStatusCreated(t, resp)

	var item struct {
		ID uuid.UUID `json:"id"`
	}
	item = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create inventory
	resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
		"item_id":     item.ID,
		"location_id": location.ID,
		"quantity":    1,
		"condition":   "GOOD",
		"status":      "AVAILABLE",
	})
	RequireStatusCreated(t, resp)

	var inventory struct {
		ID uuid.UUID `json:"id"`
	}
	inventory = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create repair log to test access
	resp = ts.Post(workspacePath+"/repairs", map[string]interface{}{
		"inventory_id": inventory.ID,
		"description":  "Test repair for auth",
	})
	RequireStatusCreated(t, resp)

	var repair struct {
		ID uuid.UUID `json:"id"`
	}
	repair = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	t.Log("Setup complete: workspace, item, inventory, and repair created")

	// Clear token for unauthenticated tests
	ts.SetToken("")

	t.Run("cannot list repairs without auth", func(t *testing.T) {
		resp := ts.Get(workspacePath + "/repairs")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot create repair without auth", func(t *testing.T) {
		resp := ts.Post(workspacePath+"/repairs", map[string]interface{}{
			"inventory_id": inventory.ID,
			"description":  "Unauthorized repair",
		})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot get repair without auth", func(t *testing.T) {
		resp := ts.Get(fmt.Sprintf("%s/repairs/%s", workspacePath, repair.ID))
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot update repair without auth", func(t *testing.T) {
		resp := ts.Patch(fmt.Sprintf("%s/repairs/%s", workspacePath, repair.ID), map[string]interface{}{
			"description": "Updated without auth",
		})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot start repair without auth", func(t *testing.T) {
		resp := ts.Post(fmt.Sprintf("%s/repairs/%s/start", workspacePath, repair.ID), nil)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot complete repair without auth", func(t *testing.T) {
		resp := ts.Post(fmt.Sprintf("%s/repairs/%s/complete", workspacePath, repair.ID), nil)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot list repair photos without auth", func(t *testing.T) {
		resp := ts.Get(fmt.Sprintf("%s/repairs/%s/photos/list", workspacePath, repair.ID))
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot delete repair without auth", func(t *testing.T) {
		resp := ts.Delete(fmt.Sprintf("%s/repairs/%s", workspacePath, repair.ID))
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot get repair cost without auth", func(t *testing.T) {
		resp := ts.Get(fmt.Sprintf("%s/inventory/%s/repair-cost", workspacePath, inventory.ID))
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("cannot list inventory repairs without auth", func(t *testing.T) {
		resp := ts.Get(fmt.Sprintf("%s/inventory/%s/repairs", workspacePath, inventory.ID))
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})
}

// TestRepairEndpoints_InvalidToken tests that all repair endpoints reject requests
// with an invalid JWT token (401 Unauthorized)
func TestRepairEndpoints_InvalidToken(t *testing.T) {
	ts := NewTestServer(t)

	// Set an invalid token
	ts.SetToken("invalid.jwt.token")

	// Use a fake workspace ID for tests
	fakeWorkspaceID := uuid.New()
	workspacePath := fmt.Sprintf("/workspaces/%s", fakeWorkspaceID)
	fakeRepairID := uuid.New()
	fakeInventoryID := uuid.New()

	t.Run("invalid token rejected for list repairs", func(t *testing.T) {
		resp := ts.Get(workspacePath + "/repairs")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("invalid token rejected for create repair", func(t *testing.T) {
		resp := ts.Post(workspacePath+"/repairs", map[string]interface{}{
			"inventory_id": fakeInventoryID,
			"description":  "Test repair",
		})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("invalid token rejected for get repair", func(t *testing.T) {
		resp := ts.Get(fmt.Sprintf("%s/repairs/%s", workspacePath, fakeRepairID))
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("invalid token rejected for update repair", func(t *testing.T) {
		resp := ts.Patch(fmt.Sprintf("%s/repairs/%s", workspacePath, fakeRepairID), map[string]interface{}{
			"description": "Updated description",
		})
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("invalid token rejected for start repair", func(t *testing.T) {
		resp := ts.Post(fmt.Sprintf("%s/repairs/%s/start", workspacePath, fakeRepairID), nil)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("invalid token rejected for complete repair", func(t *testing.T) {
		resp := ts.Post(fmt.Sprintf("%s/repairs/%s/complete", workspacePath, fakeRepairID), nil)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("malformed token rejected", func(t *testing.T) {
		ts.SetToken("not-even-a-jwt")
		resp := ts.Get(workspacePath + "/repairs")
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
		resp.Body.Close()
	})
}

// =============================================================================
// Repair Workflow Tests
// =============================================================================

// TestRepairWorkflow tests the full lifecycle of a repair log including
// creation, status transitions, and verification of inventory interaction.
func TestRepairWorkflow(t *testing.T) {
	ts := NewTestServer(t)

	// Step 1: Register user and authenticate
	email := "repair_workflow_" + uuid.New().String()[:8] + "@example.com"
	token := ts.AuthHelper(t, email)
	ts.SetToken(token)

	t.Log("Step 1: User registered and authenticated")

	// Step 2: Create workspace
	slug := "repair-workflow-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Repair Workflow Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var workspace struct {
		ID uuid.UUID `json:"id"`
	}
	workspace = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", workspace.ID)

	t.Log("Step 2: Workspace created")

	// Step 3: Create location
	resp = ts.Post(workspacePath+"/locations", map[string]interface{}{
		"name":        "Workshop",
		"description": "Main workshop area",
	})
	RequireStatusCreated(t, resp)

	var location struct {
		ID uuid.UUID `json:"id"`
	}
	location = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	t.Log("Step 3: Location created")

	// Step 4: Create item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Power Tool",
		"sku":             "TOOL-REPAIR-" + uuid.New().String()[:8],
		"brand":           "Makita",
		"model":           "XDT12",
		"min_stock_level": 1,
	})
	RequireStatusCreated(t, resp)

	var item struct {
		ID uuid.UUID `json:"id"`
	}
	item = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	t.Log("Step 4: Item created")

	// Step 5: Create inventory (status AVAILABLE)
	resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
		"item_id":     item.ID,
		"location_id": location.ID,
		"quantity":    1,
		"condition":   "FAIR",
		"status":      "AVAILABLE",
	})
	RequireStatusCreated(t, resp)

	var inventory struct {
		ID        uuid.UUID `json:"id"`
		Condition string    `json:"condition"`
		Status    string    `json:"status"`
	}
	inventory = ParseResponse[struct {
		ID        uuid.UUID `json:"id"`
		Condition string    `json:"condition"`
		Status    string    `json:"status"`
	}](t, resp)

	assert.Equal(t, "FAIR", inventory.Condition)
	assert.Equal(t, "AVAILABLE", inventory.Status)

	t.Log("Step 5: Inventory created with FAIR condition and AVAILABLE status")

	// Step 6: Create repair log (should start with PENDING status)
	repairDate := time.Now()
	costCents := 5000 // $50.00
	currencyCode := "USD"
	serviceProvider := "Local Repair Shop"

	resp = ts.Post(workspacePath+"/repairs", map[string]interface{}{
		"inventory_id":     inventory.ID,
		"description":      "Motor needs replacement",
		"repair_date":      repairDate.Format(time.RFC3339),
		"cost":             costCents,
		"currency_code":    currencyCode,
		"service_provider": serviceProvider,
		"notes":            "Scheduled for next week",
	})
	RequireStatusCreated(t, resp)

	var repair struct {
		ID              uuid.UUID `json:"id"`
		InventoryID     uuid.UUID `json:"inventory_id"`
		Status          string    `json:"status"`
		Description     string    `json:"description"`
		Cost            *int      `json:"cost"`
		CurrencyCode    *string   `json:"currency_code"`
		ServiceProvider *string   `json:"service_provider"`
		CompletedAt     *string   `json:"completed_at"`
	}
	repair = ParseResponse[struct {
		ID              uuid.UUID `json:"id"`
		InventoryID     uuid.UUID `json:"inventory_id"`
		Status          string    `json:"status"`
		Description     string    `json:"description"`
		Cost            *int      `json:"cost"`
		CurrencyCode    *string   `json:"currency_code"`
		ServiceProvider *string   `json:"service_provider"`
		CompletedAt     *string   `json:"completed_at"`
	}](t, resp)

	require.NotEqual(t, uuid.Nil, repair.ID)
	assert.Equal(t, inventory.ID, repair.InventoryID)
	assert.Equal(t, "PENDING", repair.Status)
	assert.Equal(t, "Motor needs replacement", repair.Description)
	assert.Nil(t, repair.CompletedAt)

	t.Log("Step 6: Repair log created with PENDING status")

	// Step 7: Verify inventory status is unchanged (repairs don't change status like loans)
	resp = ts.Get(workspacePath + "/inventory/" + inventory.ID.String())
	RequireStatusCreated(t, resp)

	var inventoryAfterRepairCreated struct {
		Status string `json:"status"`
	}
	inventoryAfterRepairCreated = ParseResponse[struct {
		Status string `json:"status"`
	}](t, resp)

	assert.Equal(t, "AVAILABLE", inventoryAfterRepairCreated.Status)

	t.Log("Step 7: Inventory status unchanged after repair creation (still AVAILABLE)")

	// Step 8: Start repair (transition PENDING -> IN_PROGRESS)
	resp = ts.Post(fmt.Sprintf("%s/repairs/%s/start", workspacePath, repair.ID), nil)
	RequireStatusCreated(t, resp)

	var startedRepair struct {
		ID     uuid.UUID `json:"id"`
		Status string    `json:"status"`
	}
	startedRepair = ParseResponse[struct {
		ID     uuid.UUID `json:"id"`
		Status string    `json:"status"`
	}](t, resp)

	assert.Equal(t, repair.ID, startedRepair.ID)
	assert.Equal(t, "IN_PROGRESS", startedRepair.Status)

	t.Log("Step 8: Repair started (status changed to IN_PROGRESS)")

	// Step 9: Update repair cost and notes
	updatedCost := 7500 // $75.00
	updatedNotes := "Parts took longer than expected"
	resp = ts.Patch(fmt.Sprintf("%s/repairs/%s", workspacePath, repair.ID), map[string]interface{}{
		"cost":  updatedCost,
		"notes": updatedNotes,
	})
	RequireStatusCreated(t, resp)

	var updatedRepair struct {
		Cost  *int    `json:"cost"`
		Notes *string `json:"notes"`
	}
	updatedRepair = ParseResponse[struct {
		Cost  *int    `json:"cost"`
		Notes *string `json:"notes"`
	}](t, resp)

	require.NotNil(t, updatedRepair.Cost)
	assert.Equal(t, updatedCost, *updatedRepair.Cost)
	require.NotNil(t, updatedRepair.Notes)
	assert.Equal(t, updatedNotes, *updatedRepair.Notes)

	t.Log("Step 9: Repair cost and notes updated")

	// Step 10: Complete repair with new condition (transition IN_PROGRESS -> COMPLETED)
	newCondition := "GOOD"
	resp = ts.Post(fmt.Sprintf("%s/repairs/%s/complete", workspacePath, repair.ID), map[string]interface{}{
		"new_condition": newCondition,
	})
	RequireStatusCreated(t, resp)

	var completedRepair struct {
		ID           uuid.UUID `json:"id"`
		Status       string    `json:"status"`
		CompletedAt  *string   `json:"completed_at"`
		NewCondition *string   `json:"new_condition"`
	}
	completedRepair = ParseResponse[struct {
		ID           uuid.UUID `json:"id"`
		Status       string    `json:"status"`
		CompletedAt  *string   `json:"completed_at"`
		NewCondition *string   `json:"new_condition"`
	}](t, resp)

	assert.Equal(t, repair.ID, completedRepair.ID)
	assert.Equal(t, "COMPLETED", completedRepair.Status)
	require.NotNil(t, completedRepair.CompletedAt)
	require.NotNil(t, completedRepair.NewCondition)
	assert.Equal(t, newCondition, *completedRepair.NewCondition)

	t.Log("Step 10: Repair completed with new condition GOOD")

	// Step 11: Verify inventory condition was updated
	resp = ts.Get(workspacePath + "/inventory/" + inventory.ID.String())
	RequireStatusCreated(t, resp)

	var inventoryAfterRepair struct {
		Condition string `json:"condition"`
	}
	inventoryAfterRepair = ParseResponse[struct {
		Condition string `json:"condition"`
	}](t, resp)

	assert.Equal(t, "GOOD", inventoryAfterRepair.Condition)

	t.Log("Step 11: Inventory condition updated to GOOD after repair completion")

	// Step 12: Get total repair cost
	resp = ts.Get(fmt.Sprintf("%s/inventory/%s/repair-cost", workspacePath, inventory.ID))
	RequireStatusCreated(t, resp)

	var repairCost struct {
		Items []struct {
			CurrencyCode   *string `json:"currency_code"`
			TotalCostCents int     `json:"total_cost_cents"`
			RepairCount    int     `json:"repair_count"`
		} `json:"items"`
	}
	repairCost = ParseResponse[struct {
		Items []struct {
			CurrencyCode   *string `json:"currency_code"`
			TotalCostCents int     `json:"total_cost_cents"`
			RepairCount    int     `json:"repair_count"`
		} `json:"items"`
	}](t, resp)

	// Should have at least one cost summary
	assert.GreaterOrEqual(t, len(repairCost.Items), 1)
	// Find the USD summary
	var foundUSD bool
	for _, c := range repairCost.Items {
		if c.CurrencyCode != nil && *c.CurrencyCode == "USD" {
			assert.Equal(t, updatedCost, c.TotalCostCents)
			assert.Equal(t, 1, c.RepairCount)
			foundUSD = true
		}
	}
	assert.True(t, foundUSD, "Should have found USD cost summary")

	t.Log("Step 12: Total repair cost retrieved")

	// Step 13: List repairs by status (COMPLETED)
	resp = ts.Get(workspacePath + "/repairs?status=COMPLETED")
	RequireStatusCreated(t, resp)

	var completedRepairs struct {
		Items []struct {
			ID     uuid.UUID `json:"id"`
			Status string    `json:"status"`
		} `json:"items"`
	}
	completedRepairs = ParseResponse[struct {
		Items []struct {
			ID     uuid.UUID `json:"id"`
			Status string    `json:"status"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(completedRepairs.Items), 1)
	var foundRepair bool
	for _, r := range completedRepairs.Items {
		if r.ID == repair.ID {
			assert.Equal(t, "COMPLETED", r.Status)
			foundRepair = true
		}
	}
	assert.True(t, foundRepair, "Should find our completed repair in the list")

	t.Log("Step 13: Listed repairs by COMPLETED status")

	// Step 14: List repairs for inventory
	resp = ts.Get(fmt.Sprintf("%s/inventory/%s/repairs", workspacePath, inventory.ID))
	RequireStatusCreated(t, resp)

	var inventoryRepairs struct {
		Items []struct {
			ID          uuid.UUID `json:"id"`
			InventoryID uuid.UUID `json:"inventory_id"`
		} `json:"items"`
	}
	inventoryRepairs = ParseResponse[struct {
		Items []struct {
			ID          uuid.UUID `json:"id"`
			InventoryID uuid.UUID `json:"inventory_id"`
		} `json:"items"`
	}](t, resp)

	assert.GreaterOrEqual(t, len(inventoryRepairs.Items), 1)
	var foundInventoryRepair bool
	for _, r := range inventoryRepairs.Items {
		if r.ID == repair.ID {
			assert.Equal(t, inventory.ID, r.InventoryID)
			foundInventoryRepair = true
		}
	}
	assert.True(t, foundInventoryRepair, "Should find repair in inventory's repair list")

	t.Log("Step 14: Listed repairs for inventory")

	t.Log("\nRepair workflow test completed successfully")
}

// TestRepairWithWarrantyClaim tests creating and managing warranty claims
func TestRepairWithWarrantyClaim(t *testing.T) {
	ts := NewTestServer(t)

	// Setup: Register user, create workspace, item, and inventory
	email := "repair_warranty_" + uuid.New().String()[:8] + "@example.com"
	token := ts.AuthHelper(t, email)
	ts.SetToken(token)

	slug := "repair-warranty-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Repair Warranty Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var workspace struct {
		ID uuid.UUID `json:"id"`
	}
	workspace = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", workspace.ID)

	// Create location
	resp = ts.Post(workspacePath+"/locations", map[string]interface{}{
		"name": "Warranty Test Location",
	})
	RequireStatusCreated(t, resp)

	var location struct {
		ID uuid.UUID `json:"id"`
	}
	location = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Warranty Item",
		"sku":             "WARRANTY-" + uuid.New().String()[:8],
		"min_stock_level": 0,
	})
	RequireStatusCreated(t, resp)

	var item struct {
		ID uuid.UUID `json:"id"`
	}
	item = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create inventory
	resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
		"item_id":     item.ID,
		"location_id": location.ID,
		"quantity":    1,
		"condition":   "GOOD",
		"status":      "AVAILABLE",
	})
	RequireStatusCreated(t, resp)

	var inventory struct {
		ID uuid.UUID `json:"id"`
	}
	inventory = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	t.Log("Setup complete: workspace, item, and inventory created")

	// Step 1: Create repair with warranty claim
	resp = ts.Post(workspacePath+"/repairs", map[string]interface{}{
		"inventory_id":      inventory.ID,
		"description":       "Defective under warranty",
		"is_warranty_claim": true,
	})
	RequireStatusCreated(t, resp)

	var repair struct {
		ID              uuid.UUID `json:"id"`
		IsWarrantyClaim bool      `json:"is_warranty_claim"`
	}
	repair = ParseResponse[struct {
		ID              uuid.UUID `json:"id"`
		IsWarrantyClaim bool      `json:"is_warranty_claim"`
	}](t, resp)

	assert.True(t, repair.IsWarrantyClaim, "Repair should be marked as warranty claim")

	t.Log("Step 1: Repair created with warranty claim = true")

	// Step 2: Verify warranty claim flag is persisted
	resp = ts.Get(fmt.Sprintf("%s/repairs/%s", workspacePath, repair.ID))
	RequireStatusCreated(t, resp)

	var fetchedRepair struct {
		ID              uuid.UUID `json:"id"`
		IsWarrantyClaim bool      `json:"is_warranty_claim"`
	}
	fetchedRepair = ParseResponse[struct {
		ID              uuid.UUID `json:"id"`
		IsWarrantyClaim bool      `json:"is_warranty_claim"`
	}](t, resp)

	assert.True(t, fetchedRepair.IsWarrantyClaim, "Warranty claim should be persisted")

	t.Log("Step 2: Warranty claim flag verified as persisted")

	// Step 3: Create another repair without warranty claim
	resp = ts.Post(workspacePath+"/repairs", map[string]interface{}{
		"inventory_id":      inventory.ID,
		"description":       "Normal repair, not under warranty",
		"is_warranty_claim": false,
	})
	RequireStatusCreated(t, resp)

	var normalRepair struct {
		ID              uuid.UUID `json:"id"`
		IsWarrantyClaim bool      `json:"is_warranty_claim"`
	}
	normalRepair = ParseResponse[struct {
		ID              uuid.UUID `json:"id"`
		IsWarrantyClaim bool      `json:"is_warranty_claim"`
	}](t, resp)

	assert.False(t, normalRepair.IsWarrantyClaim, "Normal repair should not be warranty claim")

	t.Log("Step 3: Normal repair (non-warranty) created")

	t.Log("\nWarranty claim test completed successfully")
}

// TestRepairStatusTransitions tests invalid status transitions
func TestRepairStatusTransitions(t *testing.T) {
	ts := NewTestServer(t)

	// Setup: Register user, create workspace, item, and inventory
	email := "repair_status_" + uuid.New().String()[:8] + "@example.com"
	token := ts.AuthHelper(t, email)
	ts.SetToken(token)

	slug := "repair-status-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Repair Status Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var workspace struct {
		ID uuid.UUID `json:"id"`
	}
	workspace = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", workspace.ID)

	// Create location
	resp = ts.Post(workspacePath+"/locations", map[string]interface{}{
		"name": "Status Test Location",
	})
	RequireStatusCreated(t, resp)

	var location struct {
		ID uuid.UUID `json:"id"`
	}
	location = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Status Test Item",
		"sku":             "STATUS-" + uuid.New().String()[:8],
		"min_stock_level": 0,
	})
	RequireStatusCreated(t, resp)

	var item struct {
		ID uuid.UUID `json:"id"`
	}
	item = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create inventory
	resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
		"item_id":     item.ID,
		"location_id": location.ID,
		"quantity":    1,
		"condition":   "GOOD",
		"status":      "AVAILABLE",
	})
	RequireStatusCreated(t, resp)

	var inventory struct {
		ID uuid.UUID `json:"id"`
	}
	inventory = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	t.Log("Setup complete")

	// Step 1: Create repair (status = PENDING)
	resp = ts.Post(workspacePath+"/repairs", map[string]interface{}{
		"inventory_id": inventory.ID,
		"description":  "Status transition test",
	})
	RequireStatusCreated(t, resp)

	var repair struct {
		ID     uuid.UUID `json:"id"`
		Status string    `json:"status"`
	}
	repair = ParseResponse[struct {
		ID     uuid.UUID `json:"id"`
		Status string    `json:"status"`
	}](t, resp)

	assert.Equal(t, "PENDING", repair.Status)

	t.Log("Step 1: Repair created with PENDING status")

	// Step 2: Try to complete without starting - should fail
	resp = ts.Post(fmt.Sprintf("%s/repairs/%s/complete", workspacePath, repair.ID), nil)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()

	t.Log("Step 2: Correctly rejected completing PENDING repair (must start first)")

	// Step 3: Start repair (PENDING -> IN_PROGRESS)
	resp = ts.Post(fmt.Sprintf("%s/repairs/%s/start", workspacePath, repair.ID), nil)
	RequireStatusCreated(t, resp)

	var startedRepair struct {
		Status string `json:"status"`
	}
	startedRepair = ParseResponse[struct {
		Status string `json:"status"`
	}](t, resp)

	assert.Equal(t, "IN_PROGRESS", startedRepair.Status)

	t.Log("Step 3: Repair started (IN_PROGRESS)")

	// Step 4: Try to start again - should fail
	resp = ts.Post(fmt.Sprintf("%s/repairs/%s/start", workspacePath, repair.ID), nil)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()

	t.Log("Step 4: Correctly rejected starting already-in-progress repair")

	// Step 5: Complete repair (IN_PROGRESS -> COMPLETED)
	resp = ts.Post(fmt.Sprintf("%s/repairs/%s/complete", workspacePath, repair.ID), map[string]interface{}{})
	RequireStatusCreated(t, resp)

	var completedRepair struct {
		Status string `json:"status"`
	}
	completedRepair = ParseResponse[struct {
		Status string `json:"status"`
	}](t, resp)

	assert.Equal(t, "COMPLETED", completedRepair.Status)

	t.Log("Step 5: Repair completed")

	// Step 6: Try to update completed repair - should fail
	resp = ts.Patch(fmt.Sprintf("%s/repairs/%s", workspacePath, repair.ID), map[string]interface{}{
		"description": "Trying to update completed repair",
	})
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()

	t.Log("Step 6: Correctly rejected updating completed repair")

	// Step 7: Try to start completed repair - should fail
	resp = ts.Post(fmt.Sprintf("%s/repairs/%s/start", workspacePath, repair.ID), nil)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()

	t.Log("Step 7: Correctly rejected starting completed repair")

	// Step 8: Try to complete again - should fail
	resp = ts.Post(fmt.Sprintf("%s/repairs/%s/complete", workspacePath, repair.ID), nil)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()

	t.Log("Step 8: Correctly rejected completing already-completed repair")

	t.Log("\nStatus transition test completed successfully")
}

// TestRepairDelete tests deleting a repair log
func TestRepairDelete(t *testing.T) {
	ts := NewTestServer(t)

	// Setup
	email := "repair_delete_" + uuid.New().String()[:8] + "@example.com"
	token := ts.AuthHelper(t, email)
	ts.SetToken(token)

	slug := "repair-delete-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Repair Delete Workspace",
		"slug":        slug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var workspace struct {
		ID uuid.UUID `json:"id"`
	}
	workspace = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspacePath := fmt.Sprintf("/workspaces/%s", workspace.ID)

	// Create location
	resp = ts.Post(workspacePath+"/locations", map[string]interface{}{
		"name": "Delete Test Location",
	})
	RequireStatusCreated(t, resp)

	var location struct {
		ID uuid.UUID `json:"id"`
	}
	location = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create item
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Delete Test Item",
		"sku":             "DELETE-" + uuid.New().String()[:8],
		"min_stock_level": 0,
	})
	RequireStatusCreated(t, resp)

	var item struct {
		ID uuid.UUID `json:"id"`
	}
	item = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create inventory
	resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
		"item_id":     item.ID,
		"location_id": location.ID,
		"quantity":    1,
		"condition":   "GOOD",
		"status":      "AVAILABLE",
	})
	RequireStatusCreated(t, resp)

	var inventory struct {
		ID uuid.UUID `json:"id"`
	}
	inventory = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create repair
	resp = ts.Post(workspacePath+"/repairs", map[string]interface{}{
		"inventory_id": inventory.ID,
		"description":  "Repair to be deleted",
	})
	RequireStatusCreated(t, resp)

	var repair struct {
		ID uuid.UUID `json:"id"`
	}
	repair = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	t.Log("Setup complete: repair created")

	// Delete the repair
	resp = ts.Delete(fmt.Sprintf("%s/repairs/%s", workspacePath, repair.ID))
	RequireStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	t.Log("Repair deleted successfully")

	// Verify it's gone
	resp = ts.Get(fmt.Sprintf("%s/repairs/%s", workspacePath, repair.ID))
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	t.Log("Verified repair is no longer accessible")

	// Try to delete non-existent repair
	fakeID := uuid.New()
	resp = ts.Delete(fmt.Sprintf("%s/repairs/%s", workspacePath, fakeID))
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	resp.Body.Close()

	t.Log("Correctly returned 404 for non-existent repair")

	t.Log("\nDelete test completed successfully")
}
