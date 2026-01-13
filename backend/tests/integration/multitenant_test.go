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
// Multi-Tenant Isolation Tests
// =============================================================================
// These tests verify that data is properly isolated between workspaces and
// users cannot access data from workspaces they don't belong to.

func TestMultiTenant_DataIsolationBetweenWorkspaces(t *testing.T) {
	ts := NewTestServer(t)

	// Create two users with their own workspaces
	user1Email := "tenant1_" + uuid.New().String()[:8] + "@example.com"
	user2Email := "tenant2_" + uuid.New().String()[:8] + "@example.com"

	token1 := ts.AuthHelper(t, user1Email)
	token2 := ts.AuthHelper(t, user2Email)

	// User 1 creates workspace and data
	ts.SetToken(token1)
	slug1 := "tenant1-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Tenant 1 Workspace",
		"slug":        slug1,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var ws1 struct {
		ID uuid.UUID `json:"id"`
	}
	ws1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace1Path := fmt.Sprintf("/workspaces/%s", ws1.ID)

	// User 1 creates a category
	resp = ts.Post(workspace1Path+"/categories", map[string]interface{}{
		"name": "User 1 Category",
	})
	RequireStatusCreated(t, resp)

	var cat1 struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	}
	cat1 = ParseResponse[struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
	}](t, resp)

	// User 1 creates a location
	resp = ts.Post(workspace1Path+"/locations", map[string]interface{}{
		"name": "User 1 Location",
	})
	RequireStatus(t, resp, http.StatusOK)

	_ = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// User 1 creates an item
	resp = ts.Post(workspace1Path+"/items", map[string]interface{}{
		"sku":             "USER1-ITEM-001",
		"name":            "User 1 Item",
		"category_id":     cat1.ID,
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var item1 struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
		SKU  string    `json:"sku"`
	}
	item1 = ParseResponse[struct {
		ID   uuid.UUID `json:"id"`
		Name string    `json:"name"`
		SKU  string    `json:"sku"`
	}](t, resp)

	// User 2 creates their own workspace
	ts.SetToken(token2)
	slug2 := "tenant2-ws-" + uuid.New().String()[:8]
	resp = ts.Post("/workspaces", map[string]interface{}{
		"name":        "Tenant 2 Workspace",
		"slug":        slug2,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var ws2 struct {
		ID uuid.UUID `json:"id"`
	}
	ws2 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace2Path := fmt.Sprintf("/workspaces/%s", ws2.ID)

	// Test: User 2 cannot see User 1's workspace in list
	t.Run("user cannot see other workspaces in list", func(t *testing.T) {
		resp := ts.Get("/workspaces")
		RequireStatus(t, resp, http.StatusOK)

		var workspaces struct {
			Items []struct {
				ID   uuid.UUID `json:"id"`
				Name string    `json:"name"`
			} `json:"items"`
		}
		workspaces = ParseResponse[struct {
			Items []struct {
				ID   uuid.UUID `json:"id"`
				Name string    `json:"name"`
			} `json:"items"`
		}](t, resp)

		// User 2 should only see their own workspace
		for _, ws := range workspaces.Items {
			assert.NotEqual(t, ws1.ID, ws.ID, "User 2 should not see User 1's workspace")
		}
	})

	// Test: User 2 cannot access User 1's categories
	t.Run("user cannot access categories from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/categories")
		// Should get 403 Forbidden or 404 Not Found, not 200 with data
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's categories")
		resp.Body.Close()

		// User 2's own workspace should be accessible
		resp = ts.Get(workspace2Path + "/categories")
		RequireStatus(t, resp, http.StatusOK)
		resp.Body.Close()
	})

	// Test: User 2 cannot access User 1's specific category
	t.Run("user cannot access specific category from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/categories/" + cat1.ID.String())
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's category")
		resp.Body.Close()
	})

	// Test: User 2 cannot access User 1's locations
	t.Run("user cannot access locations from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/locations")
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's locations")
		resp.Body.Close()
	})

	// Test: User 2 cannot access User 1's items
	t.Run("user cannot access items from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/items")
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's items")
		resp.Body.Close()
	})

	// Test: User 2 cannot access User 1's specific item
	t.Run("user cannot access specific item from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/items/" + item1.ID.String())
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's item")
		resp.Body.Close()
	})

	// Test: User 2 cannot modify User 1's data
	t.Run("user cannot modify data in another workspace", func(t *testing.T) {
		// Try to update User 1's category
		resp := ts.Put(workspace1Path+"/categories/"+cat1.ID.String(), map[string]interface{}{
			"name": "Hacked Category",
		})
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not update User 1's category")
		resp.Body.Close()

		// Try to delete User 1's item
		resp = ts.Post(workspace1Path+"/items/"+item1.ID.String()+"/archive", nil)
		assert.NotEqual(t, http.StatusNoContent, resp.StatusCode, "User 2 should not delete User 1's item")
		resp.Body.Close()
	})

	t.Log("✓ Multi-tenant data isolation verified")
}

func TestMultiTenant_InventoryIsolation(t *testing.T) {
	ts := NewTestServer(t)

	// Create two users
	user1Email := "inventory1_" + uuid.New().String()[:8] + "@example.com"
	user2Email := "inventory2_" + uuid.New().String()[:8] + "@example.com"

	token1 := ts.AuthHelper(t, user1Email)
	token2 := ts.AuthHelper(t, user2Email)

	// User 1 setup
	ts.SetToken(token1)
	slug1 := "inv1-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name": "Inventory 1 Workspace",
		"slug":        slug1,
		"is_personal": false,})
	RequireStatus(t, resp, http.StatusOK)

	var ws1 struct {
		ID uuid.UUID `json:"id"`
	}
	ws1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace1Path := fmt.Sprintf("/workspaces/%s", ws1.ID)

	// Create location and item for User 1
	resp = ts.Post(workspace1Path+"/locations", map[string]interface{}{
		"name": "User 1 Warehouse",
	})
	RequireStatus(t, resp, http.StatusOK)
	var loc1 struct {
		ID uuid.UUID `json:"id"`
	}
	loc1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	resp = ts.Post(workspace1Path+"/items", map[string]interface{}{
		"sku":             "INV1-001",
		"name":            "User 1 Product",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)
	var item1 struct {
		ID uuid.UUID `json:"id"`
	}
	item1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// Create inventory for User 1
	resp = ts.Post(workspace1Path+"/inventory", map[string]interface{}{
		"item_id":     item1.ID,
		"location_id": loc1.ID,
		"quantity":    100,
		"condition":   "NEW",
		"status":      "AVAILABLE",
	})
	RequireStatus(t, resp, http.StatusOK)
	var inv1 struct {
		ID       uuid.UUID `json:"id"`
		Quantity int       `json:"quantity"`
	}
	inv1 = ParseResponse[struct {
		ID       uuid.UUID `json:"id"`
		Quantity int       `json:"quantity"`
	}](t, resp)

	// User 2 setup
	ts.SetToken(token2)
	slug2 := "inv2-ws-" + uuid.New().String()[:8]
	resp = ts.Post("/workspaces", map[string]interface{}{
		"name": "Inventory 2 Workspace",
		"slug": slug2,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)

	var ws2 struct {
		ID uuid.UUID `json:"id"`
	}
	ws2 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace2Path := fmt.Sprintf("/workspaces/%s", ws2.ID)

	// Test: User 2 cannot see User 1's inventory
	t.Run("user cannot access inventory from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/inventory")
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's inventory")
		resp.Body.Close()
	})

	// Test: User 2 cannot access specific inventory record
	t.Run("user cannot access specific inventory from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/inventory/" + inv1.ID.String())
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's inventory record")
		resp.Body.Close()
	})

	// Test: User 2 cannot move User 1's inventory
	t.Run("user cannot move inventory in another workspace", func(t *testing.T) {
		resp := ts.Post(workspace1Path+"/inventory/"+inv1.ID.String()+"/move", map[string]interface{}{
			"location_id": loc1.ID,
		})
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not move User 1's inventory")
		resp.Body.Close()
	})

	// Test: User 2's own workspace remains accessible
	t.Run("user can access their own workspace", func(t *testing.T) {
		resp := ts.Get(workspace2Path + "/inventory")
		RequireStatus(t, resp, http.StatusOK)
		resp.Body.Close()
	})

	t.Log("✓ Inventory isolation verified")
}

func TestMultiTenant_LoanIsolation(t *testing.T) {
	ts := NewTestServer(t)

	// Create two users
	user1Email := "loan1_" + uuid.New().String()[:8] + "@example.com"
	user2Email := "loan2_" + uuid.New().String()[:8] + "@example.com"

	token1 := ts.AuthHelper(t, user1Email)
	token2 := ts.AuthHelper(t, user2Email)

	// User 1 creates complete loan setup
	ts.SetToken(token1)
	slug1 := "loan1-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name": "Loan 1 Workspace",
		"slug":        slug1,
		"is_personal": false,})
	RequireStatus(t, resp, http.StatusOK)

	var ws1 struct {
		ID uuid.UUID `json:"id"`
	}
	ws1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace1Path := fmt.Sprintf("/workspaces/%s", ws1.ID)

	// Create location, item, inventory, borrower, and loan for User 1
	resp = ts.Post(workspace1Path+"/locations", map[string]interface{}{
		"name": "User 1 Storage",
	})
	RequireStatus(t, resp, http.StatusOK)
	var loc1 struct {
		ID uuid.UUID `json:"id"`
	}
	loc1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	resp = ts.Post(workspace1Path+"/items", map[string]interface{}{
		"sku":             "LOAN1-001",
		"name":            "Loanable Item",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)
	var item1 struct {
		ID uuid.UUID `json:"id"`
	}
	item1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	resp = ts.Post(workspace1Path+"/inventory", map[string]interface{}{
		"item_id":     item1.ID,
		"location_id": loc1.ID,
		"quantity":    5,
		"condition":   "GOOD",
		"status":      "AVAILABLE",
	})
	RequireStatus(t, resp, http.StatusOK)
	var inv1 struct {
		ID uuid.UUID `json:"id"`
	}
	inv1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	resp = ts.Post(workspace1Path+"/borrowers", map[string]interface{}{
		"name":  "John Doe",
		"email": "john@example.com",
	})
	RequireStatus(t, resp, http.StatusOK)
	var borrower1 struct {
		ID uuid.UUID `json:"id"`
	}
	borrower1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	resp = ts.Post(workspace1Path+"/loans", map[string]interface{}{
		"inventory_id": inv1.ID,
		"borrower_id":  borrower1.ID,
		"quantity":     1,
	})
	RequireStatusCreated(t, resp)
	var loan1 struct {
		ID uuid.UUID `json:"id"`
	}
	loan1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	// User 2 creates their workspace
	ts.SetToken(token2)
	slug2 := "loan2-ws-" + uuid.New().String()[:8]
	resp = ts.Post("/workspaces", map[string]interface{}{
		"name": "Loan 2 Workspace",
		"slug":        slug2,
		"is_personal": false,})
	RequireStatus(t, resp, http.StatusOK)

	// Test: User 2 cannot see User 1's loans
	t.Run("user cannot access loans from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/loans")
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's loans")
		resp.Body.Close()
	})

	// Test: User 2 cannot access User 1's specific loan
	t.Run("user cannot access specific loan from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/loans/" + loan1.ID.String())
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's loan")
		resp.Body.Close()
	})

	// Test: User 2 cannot return User 1's loan
	t.Run("user cannot return loan in another workspace", func(t *testing.T) {
		resp := ts.Post(workspace1Path+"/loans/"+loan1.ID.String()+"/return", nil)
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not return User 1's loan")
		resp.Body.Close()
	})

	// Test: User 2 cannot see User 1's borrowers
	t.Run("user cannot access borrowers from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace1Path + "/borrowers")
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "User 2 should not access User 1's borrowers")
		resp.Body.Close()
	})

	t.Log("✓ Loan data isolation verified")
}

func TestMultiTenant_SearchIsolation(t *testing.T) {
	ts := NewTestServer(t)

	// Create two users
	user1Email := "search1_" + uuid.New().String()[:8] + "@example.com"
	user2Email := "search2_" + uuid.New().String()[:8] + "@example.com"

	token1 := ts.AuthHelper(t, user1Email)
	token2 := ts.AuthHelper(t, user2Email)

	// User 1 creates workspace with unique items
	ts.SetToken(token1)
	slug1 := "search1-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name": "Search 1 Workspace",
		"slug":        slug1,
		"is_personal": false,})
	RequireStatus(t, resp, http.StatusOK)

	var ws1 struct {
		ID uuid.UUID `json:"id"`
	}
	ws1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace1Path := fmt.Sprintf("/workspaces/%s", ws1.ID)

	// Create items with unique identifiable names
	uniqueID := uuid.New().String()[:8]
	resp = ts.Post(workspace1Path+"/items", map[string]interface{}{
		"sku":             "SEARCH-" + uniqueID,
		"name":            "SecretItem_" + uniqueID,
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	// User 2 creates their workspace
	ts.SetToken(token2)
	slug2 := "search2-ws-" + uuid.New().String()[:8]
	resp = ts.Post("/workspaces", map[string]interface{}{
		"name": "Search 2 Workspace",
		"slug":        slug2,
		"is_personal": false,})
	RequireStatus(t, resp, http.StatusOK)

	var ws2 struct {
		ID uuid.UUID `json:"id"`
	}
	ws2 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace2Path := fmt.Sprintf("/workspaces/%s", ws2.ID)

	// Test: User 2's search should not return User 1's items
	t.Run("search does not return items from other workspaces", func(t *testing.T) {
		resp := ts.Get(workspace2Path + "/items?search=SecretItem_" + uniqueID)
		RequireStatus(t, resp, http.StatusOK)

		var items struct {
			Items []struct {
				ID   uuid.UUID `json:"id"`
				Name string    `json:"name"`
			} `json:"items"`
		}
		items = ParseResponse[struct {
			Items []struct {
				ID   uuid.UUID `json:"id"`
				Name string    `json:"name"`
			} `json:"items"`
		}](t, resp)

		// Should return 0 items since User 2 shouldn't see User 1's data
		assert.Empty(t, items.Items, "Search should not return items from other workspaces")
	})

	t.Log("✓ Search isolation verified")
}

func TestMultiTenant_FavoriteIsolation(t *testing.T) {
	ts := NewTestServer(t)

	// Create two users
	user1Email := "fav1_" + uuid.New().String()[:8] + "@example.com"
	user2Email := "fav2_" + uuid.New().String()[:8] + "@example.com"

	token1 := ts.AuthHelper(t, user1Email)
	token2 := ts.AuthHelper(t, user2Email)

	// User 1 setup
	ts.SetToken(token1)
	slug1 := "fav1-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name": "Fav 1 Workspace",
		"slug":        slug1,
		"is_personal": false,})
	RequireStatus(t, resp, http.StatusOK)

	var ws1 struct {
		ID uuid.UUID `json:"id"`
	}
	ws1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace1Path := fmt.Sprintf("/workspaces/%s", ws1.ID)

	// User 1 creates item and favorites it
	resp = ts.Post(workspace1Path+"/items", map[string]interface{}{
		"sku":             "FAV1-001",
		"name":            "Favorite Item",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)
	var item1 struct {
		ID uuid.UUID `json:"id"`
	}
	item1 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	resp = ts.Post(workspace1Path+"/favorites", map[string]interface{}{
		"favorite_type": "ITEM",
		"target_id":     item1.ID,
	})
	RequireStatusCreated(t, resp)

	// User 2 setup
	ts.SetToken(token2)
	slug2 := "fav2-ws-" + uuid.New().String()[:8]
	resp = ts.Post("/workspaces", map[string]interface{}{
		"name": "Fav 2 Workspace",
		"slug":        slug2,
		"is_personal": false,})
	RequireStatus(t, resp, http.StatusOK)

	var ws2 struct {
		ID uuid.UUID `json:"id"`
	}
	ws2 = ParseResponse[struct {
		ID uuid.UUID `json:"id"`
	}](t, resp)

	workspace2Path := fmt.Sprintf("/workspaces/%s", ws2.ID)

	// Test: User 2 cannot see User 1's favorites
	t.Run("user cannot see favorites from another workspace", func(t *testing.T) {
		resp := ts.Get(workspace2Path + "/favorites")
		RequireStatus(t, resp, http.StatusOK)

		var favs struct {
			Items []struct {
				ID     uuid.UUID `json:"id"`
				ItemID uuid.UUID `json:"item_id"`
			} `json:"items"`
		}
		favs = ParseResponse[struct {
			Items []struct {
				ID     uuid.UUID `json:"id"`
				ItemID uuid.UUID `json:"item_id"`
			} `json:"items"`
		}](t, resp)

		// User 2's favorites should be empty
		assert.Empty(t, favs.Items, "User 2 should not see User 1's favorites")
	})

	t.Log("✓ Favorite isolation verified")
}
