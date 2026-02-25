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

// =============================================================================
// Cross-Workspace Foreign Key Constraint Tests
// =============================================================================
// These tests verify that entities from one workspace cannot be referenced as
// foreign keys in another workspace. This prevents data leaking across tenant
// boundaries via relationship fields (e.g. creating inventory in workspace B
// that references an item_id from workspace A).

// crossWorkspaceSetup creates two fully independent workspaces with their own
// items, locations, categories, borrowers, and inventory. Returns paths and IDs
// needed for cross-workspace FK tests.
type crossWorkspaceFixture struct {
	ts             *TestServer
	workspace1Path string
	workspace2Path string
	// Workspace 1 entity IDs
	ws1CategoryID  uuid.UUID
	ws1LocationID  uuid.UUID
	ws1ItemID      uuid.UUID
	ws1InventoryID uuid.UUID
	ws1BorrowerID  uuid.UUID
	// Workspace 2 entity IDs
	ws2CategoryID  uuid.UUID
	ws2LocationID  uuid.UUID
	ws2ItemID      uuid.UUID
	ws2InventoryID uuid.UUID
	ws2BorrowerID  uuid.UUID
	// Auth tokens
	token1 string
	token2 string
}

func setupCrossWorkspaceFixture(t *testing.T) *crossWorkspaceFixture {
	t.Helper()

	ts := NewTestServer(t)
	f := &crossWorkspaceFixture{ts: ts}

	// Create two separate users
	user1Email := "xws_fk1_" + uuid.New().String()[:8] + "@example.com"
	user2Email := "xws_fk2_" + uuid.New().String()[:8] + "@example.com"

	f.token1 = ts.AuthHelper(t, user1Email)
	f.token2 = ts.AuthHelper(t, user2Email)

	// --- Workspace 1 setup ---
	ts.SetToken(f.token1)

	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "XWS FK Workspace 1",
		"slug":        "xws-fk1-" + uuid.New().String()[:8],
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws1 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.workspace1Path = fmt.Sprintf("/workspaces/%s", ws1.ID)

	// Category
	resp = ts.Post(f.workspace1Path+"/categories", map[string]interface{}{
		"name": "WS1 Category",
	})
	RequireStatusCreated(t, resp)
	cat1 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws1CategoryID = cat1.ID

	// Location
	resp = ts.Post(f.workspace1Path+"/locations", map[string]interface{}{
		"name": "WS1 Location",
	})
	RequireStatus(t, resp, http.StatusOK)
	loc1 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws1LocationID = loc1.ID

	// Item
	resp = ts.Post(f.workspace1Path+"/items", map[string]interface{}{
		"name":            "WS1 Item",
		"sku":             "XWS1-" + uuid.New().String()[:8],
		"category_id":     f.ws1CategoryID,
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)
	item1 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws1ItemID = item1.ID

	// Inventory
	resp = ts.Post(f.workspace1Path+"/inventory", map[string]interface{}{
		"item_id":     f.ws1ItemID,
		"location_id": f.ws1LocationID,
		"quantity":    10,
		"condition":   "NEW",
		"status":      "AVAILABLE",
	})
	RequireStatus(t, resp, http.StatusOK)
	inv1 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws1InventoryID = inv1.ID

	// Borrower
	resp = ts.Post(f.workspace1Path+"/borrowers", map[string]interface{}{
		"name":  "WS1 Borrower",
		"email": "ws1borrower@example.com",
	})
	RequireStatus(t, resp, http.StatusOK)
	borrower1 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws1BorrowerID = borrower1.ID

	// --- Workspace 2 setup ---
	ts.SetToken(f.token2)

	resp = ts.Post("/workspaces", map[string]interface{}{
		"name":        "XWS FK Workspace 2",
		"slug":        "xws-fk2-" + uuid.New().String()[:8],
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	ws2 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.workspace2Path = fmt.Sprintf("/workspaces/%s", ws2.ID)

	// Category
	resp = ts.Post(f.workspace2Path+"/categories", map[string]interface{}{
		"name": "WS2 Category",
	})
	RequireStatusCreated(t, resp)
	cat2 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws2CategoryID = cat2.ID

	// Location
	resp = ts.Post(f.workspace2Path+"/locations", map[string]interface{}{
		"name": "WS2 Location",
	})
	RequireStatus(t, resp, http.StatusOK)
	loc2 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws2LocationID = loc2.ID

	// Item
	resp = ts.Post(f.workspace2Path+"/items", map[string]interface{}{
		"name":            "WS2 Item",
		"sku":             "XWS2-" + uuid.New().String()[:8],
		"category_id":     f.ws2CategoryID,
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)
	item2 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws2ItemID = item2.ID

	// Inventory
	resp = ts.Post(f.workspace2Path+"/inventory", map[string]interface{}{
		"item_id":     f.ws2ItemID,
		"location_id": f.ws2LocationID,
		"quantity":    5,
		"condition":   "GOOD",
		"status":      "AVAILABLE",
	})
	RequireStatus(t, resp, http.StatusOK)
	inv2 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws2InventoryID = inv2.ID

	// Borrower
	resp = ts.Post(f.workspace2Path+"/borrowers", map[string]interface{}{
		"name":  "WS2 Borrower",
		"email": "ws2borrower@example.com",
	})
	RequireStatus(t, resp, http.StatusOK)
	borrower2 := ParseResponse[struct{ ID uuid.UUID `json:"id"` }](t, resp)
	f.ws2BorrowerID = borrower2.ID

	return f
}

// =============================================================================
// Inventory Cross-Workspace FK Tests
// =============================================================================

func TestCrossWorkspaceFK_InventoryWithItemFromOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to create inventory in WS2 referencing item from WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/inventory", map[string]interface{}{
		"item_id":     f.ws1ItemID, // item from workspace 1
		"location_id": f.ws2LocationID,
		"quantity":    1,
		"condition":   "NEW",
		"status":      "AVAILABLE",
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"creating inventory with item_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

func TestCrossWorkspaceFK_InventoryWithLocationFromOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to create inventory in WS2 referencing location from WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/inventory", map[string]interface{}{
		"item_id":     f.ws2ItemID,
		"location_id": f.ws1LocationID, // location from workspace 1
		"quantity":    1,
		"condition":   "NEW",
		"status":      "AVAILABLE",
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"creating inventory with location_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

func TestCrossWorkspaceFK_InventoryWithBothFromOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to create inventory in WS2 referencing both item and location from WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/inventory", map[string]interface{}{
		"item_id":     f.ws1ItemID,     // item from workspace 1
		"location_id": f.ws1LocationID, // location from workspace 1
		"quantity":    1,
		"condition":   "NEW",
		"status":      "AVAILABLE",
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"creating inventory with item_id and location_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

// =============================================================================
// Item Cross-Workspace FK Tests
// =============================================================================

func TestCrossWorkspaceFK_ItemWithCategoryFromOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to create item in WS2 referencing category from WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/items", map[string]interface{}{
		"name":            "Cross-WS Item",
		"sku":             "XWS-CAT-" + uuid.New().String()[:8],
		"category_id":     f.ws1CategoryID, // category from workspace 1
		"min_stock_level": 0,
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"creating item with category_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

// =============================================================================
// Category Cross-Workspace FK Tests
// =============================================================================

func TestCrossWorkspaceFK_CategoryWithParentFromOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to create child category in WS2 referencing parent category from WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/categories", map[string]interface{}{
		"name":               "Cross-WS Child Category",
		"parent_category_id": f.ws1CategoryID, // parent from workspace 1
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"creating category with parent_category_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

// =============================================================================
// Container Cross-Workspace FK Tests
// =============================================================================

func TestCrossWorkspaceFK_ContainerWithLocationFromOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to create container in WS2 referencing location from WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/containers", map[string]interface{}{
		"name":        "Cross-WS Container",
		"location_id": f.ws1LocationID, // location from workspace 1
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"creating container with location_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

// =============================================================================
// Loan Cross-Workspace FK Tests
// =============================================================================

func TestCrossWorkspaceFK_LoanWithInventoryFromOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to create loan in WS2 referencing inventory from WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/loans", map[string]interface{}{
		"inventory_id": f.ws1InventoryID, // inventory from workspace 1
		"borrower_id":  f.ws2BorrowerID,
		"quantity":     1,
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"creating loan with inventory_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

func TestCrossWorkspaceFK_LoanWithBorrowerFromOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to create loan in WS2 referencing borrower from WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/loans", map[string]interface{}{
		"inventory_id": f.ws2InventoryID,
		"borrower_id":  f.ws1BorrowerID, // borrower from workspace 1
		"quantity":     1,
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"creating loan with borrower_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

// =============================================================================
// Inventory Move Cross-Workspace FK Tests
// =============================================================================

func TestCrossWorkspaceFK_MoveInventoryToLocationInOtherWorkspace(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	// User 2 tries to move their own inventory to a location in WS1
	f.ts.SetToken(f.token2)
	resp := f.ts.Post(f.workspace2Path+"/inventory/"+f.ws2InventoryID.String()+"/move", map[string]interface{}{
		"location_id": f.ws1LocationID, // location from workspace 1
	})

	assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
		"moving inventory to location_id from another workspace should fail with 4xx, got %d", resp.StatusCode)
	resp.Body.Close()
}

// =============================================================================
// Positive Control Tests
// =============================================================================
// Verify that same-workspace FK references still work correctly.

func TestCrossWorkspaceFK_SameWorkspaceReferencesSucceed(t *testing.T) {
	f := setupCrossWorkspaceFixture(t)

	f.ts.SetToken(f.token2)

	t.Run("inventory with same-workspace item and location", func(t *testing.T) {
		resp := f.ts.Post(f.workspace2Path+"/inventory", map[string]interface{}{
			"item_id":     f.ws2ItemID,
			"location_id": f.ws2LocationID,
			"quantity":    3,
			"condition":   "NEW",
			"status":      "AVAILABLE",
		})
		RequireStatus(t, resp, http.StatusOK)
		resp.Body.Close()
	})

	// Note: loan positive test omitted here — cross-workspace loan tests
	// (LoanWithInventoryFromOtherWorkspace, LoanWithBorrowerFromOtherWorkspace)
	// already PASS, confirming the loan service validates workspace boundaries.
	// The positive control is covered by TestMultiTenant_LoanIsolation.

	t.Run("container with same-workspace location", func(t *testing.T) {
		resp := f.ts.Post(f.workspace2Path+"/containers", map[string]interface{}{
			"name":        "Same-WS Container",
			"location_id": f.ws2LocationID,
		})
		RequireStatus(t, resp, http.StatusOK)
		resp.Body.Close()
	})
}
