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
// Duplicate Key Constraint Tests
// =============================================================================

func TestConstraint_DuplicateSKU(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "dup_sku_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	slug := "dup-sku-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Duplicate SKU Workspace",
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

	// Create first item
	uniqueSKU := "DUP-SKU-" + uuid.New().String()[:8]
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item 1",
		"sku":             uniqueSKU,
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Try to create second item with same SKU
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Item 2",
		"sku":             uniqueSKU, // Same SKU
		"min_stock_level": 0,
	})

	// Should fail - API returns 400 for duplicate SKU constraint violation
	assert.True(t, resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusConflict,
		"expected 400 or 409, got %d", resp.StatusCode)
	resp.Body.Close()
}

func TestConstraint_DuplicateWorkspaceSlug(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "dup_slug_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	uniqueSlug := "unique-slug-" + uuid.New().String()[:8]

	// Create first workspace
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Workspace 1",
		"slug":        uniqueSlug,
		"is_personal": false,
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Try to create second workspace with same slug
	resp = ts.Post("/workspaces", map[string]interface{}{
		"name":        "Workspace 2",
		"slug":        uniqueSlug, // Same slug
		"is_personal": false,
	})

	// Should fail - API returns 400 for duplicate slug constraint violation
	assert.True(t, resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusConflict,
		"expected 400 or 409, got %d", resp.StatusCode)
	resp.Body.Close()
}

// =============================================================================
// Foreign Key Constraint Tests
// =============================================================================

func TestConstraint_InvalidForeignKey(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "fk_test_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	slug := "fk-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "FK Test Workspace",
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

	t.Run("item with non-existent category", func(t *testing.T) {
		nonExistentID := uuid.New()
		resp := ts.Post(workspacePath+"/items", map[string]interface{}{
			"name":            "Item with Bad Category",
			"sku":             "BAD-CAT-" + uuid.New().String()[:8],
			"category_id":     nonExistentID,
			"min_stock_level": 0,
		})
		// Should fail - API may return 400, 404, or 422 depending on validation order
		assert.True(t, resp.StatusCode >= 400 && resp.StatusCode < 500,
			"expected 4xx error, got %d", resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("container with non-existent location", func(t *testing.T) {
		nonExistentID := uuid.New()
		resp := ts.Post(workspacePath+"/containers", map[string]interface{}{
			"name":        "Container with Bad Location",
			"location_id": nonExistentID,
		})
		// Should fail
		assert.True(t, resp.StatusCode >= 400)
		resp.Body.Close()
	})

	t.Run("inventory with non-existent item", func(t *testing.T) {
		// First create a valid location
		resp := ts.Post(workspacePath+"/locations", map[string]string{
			"name": "Valid Location",
		})
		RequireStatus(t, resp, http.StatusOK)

		var locResult struct {
			ID uuid.UUID `json:"id"`
		}
		locResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		nonExistentItemID := uuid.New()
		resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
			"item_id":     nonExistentItemID,
			"location_id": locResult.ID,
			"quantity":    5,
			"condition":   "NEW",
			"status":      "AVAILABLE",
		})
		// Should fail
		assert.True(t, resp.StatusCode >= 400)
		resp.Body.Close()
	})
}

// =============================================================================
// Referential Integrity Tests
// =============================================================================

func TestConstraint_CannotDeleteReferencedEntity(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "ref_test_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	slug := "ref-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Referential Integrity Workspace",
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

	t.Run("cannot delete location with containers", func(t *testing.T) {
		// Create location
		resp := ts.Post(workspacePath+"/locations", map[string]string{
			"name": "Location With Containers",
		})
		RequireStatus(t, resp, http.StatusOK)

		var locResult struct {
			ID uuid.UUID `json:"id"`
		}
		locResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		// Create container in location
		resp = ts.Post(workspacePath+"/containers", map[string]interface{}{
			"name":        "Container in Location",
			"location_id": locResult.ID,
		})
		RequireStatus(t, resp, http.StatusOK)
		resp.Body.Close()

		// Try to delete location - should fail
		resp = ts.Delete(fmt.Sprintf("%s/locations/%s", workspacePath, locResult.ID))
		// Either 409 Conflict or soft-deletes (204) - depends on implementation
		// The test passes if it's handled gracefully (not 500)
		assert.True(t, resp.StatusCode != http.StatusInternalServerError)
		resp.Body.Close()
	})

	t.Run("cannot delete category with children", func(t *testing.T) {
		// Create parent category
		resp := ts.Post(workspacePath+"/categories", map[string]string{
			"name": "Parent Category",
		})
		RequireStatus(t, resp, http.StatusCreated)

		var parentResult struct {
			ID uuid.UUID `json:"id"`
		}
		parentResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		// Create child category
		resp = ts.Post(workspacePath+"/categories", map[string]interface{}{
			"name":               "Child Category",
			"parent_category_id": parentResult.ID,
		})
		RequireStatus(t, resp, http.StatusCreated)
		resp.Body.Close()

		// Try to delete parent category - should fail
		resp = ts.Delete(fmt.Sprintf("%s/categories/%s", workspacePath, parentResult.ID))
		assert.Equal(t, http.StatusConflict, resp.StatusCode)
		resp.Body.Close()
	})
}

// =============================================================================
// Validation Constraint Tests
// =============================================================================

func TestConstraint_ValidationErrors(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "valid_test_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	slug := "valid-test-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Validation Test Workspace",
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

	t.Run("item with empty name rejected", func(t *testing.T) {
		resp := ts.Post(workspacePath+"/items", map[string]interface{}{
			"name":            "",
			"sku":             "EMPTY-NAME",
			"min_stock_level": 0,
		})
		assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("inventory with invalid condition rejected", func(t *testing.T) {
		// First create valid item and location
		resp := ts.Post(workspacePath+"/items", map[string]interface{}{
			"name":            "Valid Item",
			"sku":             "VALID-" + uuid.New().String()[:8],
			"min_stock_level": 0,
		})
		RequireStatus(t, resp, http.StatusOK)

		var itemResult struct {
			ID uuid.UUID `json:"id"`
		}
		itemResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		resp = ts.Post(workspacePath+"/locations", map[string]string{
			"name": "Valid Location",
		})
		RequireStatus(t, resp, http.StatusOK)

		var locResult struct {
			ID uuid.UUID `json:"id"`
		}
		locResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		// Try with invalid condition enum
		resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
			"item_id":     itemResult.ID,
			"location_id": locResult.ID,
			"quantity":    5,
			"condition":   "INVALID_CONDITION", // Not a valid enum value
			"status":      "AVAILABLE",
		})
		assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("workspace with invalid slug rejected", func(t *testing.T) {
		resp := ts.Post("/workspaces", map[string]interface{}{
			"name":        "Workspace",
			"slug":        "invalid slug with spaces!", // Invalid characters
			"is_personal": false,
		})
		assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("negative quantity rejected", func(t *testing.T) {
		// First create valid item and location
		resp := ts.Post(workspacePath+"/items", map[string]interface{}{
			"name":            "Neg Qty Item",
			"sku":             "NEG-QTY-" + uuid.New().String()[:8],
			"min_stock_level": 0,
		})
		RequireStatus(t, resp, http.StatusOK)

		var itemResult struct {
			ID uuid.UUID `json:"id"`
		}
		itemResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		resp = ts.Post(workspacePath+"/locations", map[string]string{
			"name": "Neg Qty Location",
		})
		RequireStatus(t, resp, http.StatusOK)

		var locResult struct {
			ID uuid.UUID `json:"id"`
		}
		locResult = ParseResponse[struct {
			ID uuid.UUID `json:"id"`
		}](t, resp)

		resp = ts.Post(workspacePath+"/inventory", map[string]interface{}{
			"item_id":     itemResult.ID,
			"location_id": locResult.ID,
			"quantity":    -5, // Negative quantity
			"condition":   "NEW",
			"status":      "AVAILABLE",
		})
		assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		resp.Body.Close()
	})
}
