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
// Batch Operations Tests
// =============================================================================

func TestBatchOperations_Items(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "batch_item_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "batch-item-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Batch Item Test Workspace",
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

	// Create an item first
	resp = ts.Post(workspacePath+"/items", map[string]interface{}{
		"name":            "Test Item",
		"sku":             "TEST-001",
		"min_stock_level": 0,
	})
	RequireStatus(t, resp, http.StatusOK)

	var itemResult struct {
		ID        uuid.UUID  `json:"id"`
		Name      string     `json:"name"`
		SKU       string     `json:"sku"`
		UpdatedAt *time.Time `json:"updated_at"`
	}
	itemResult = ParseResponse[struct {
		ID        uuid.UUID  `json:"id"`
		Name      string     `json:"name"`
		SKU       string     `json:"sku"`
		UpdatedAt *time.Time `json:"updated_at"`
	}](t, resp)

	require.NotEqual(t, uuid.Nil, itemResult.ID)
	require.Equal(t, "Test Item", itemResult.Name)
	require.NotNil(t, itemResult.UpdatedAt)

	// Test batch update operation
	t.Run("update item via batch", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "update",
					"entity_type": "item",
					"entity_id":   itemResult.ID.String(),
					"data": map[string]interface{}{
						"name": "Updated Item Name",
					},
				},
			},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
			Conflicts int `json:"conflicts"`
			Results   []struct {
				Status    string      `json:"status"`
				EntityID  *uuid.UUID  `json:"entity_id"`
				Error     *string     `json:"error"`
				ErrorCode *string     `json:"error_code"`
			} `json:"results"`
		}
		batchResp = ParseResponse[struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
			Conflicts int `json:"conflicts"`
			Results   []struct {
				Status    string      `json:"status"`
				EntityID  *uuid.UUID  `json:"entity_id"`
				Error     *string     `json:"error"`
				ErrorCode *string     `json:"error_code"`
			} `json:"results"`
		}](t, resp)

		if len(batchResp.Results) > 0 && batchResp.Results[0].Error != nil {
			t.Logf("Batch error: %s (code: %v)", *batchResp.Results[0].Error, batchResp.Results[0].ErrorCode)
		}
		assert.Equal(t, 1, batchResp.Succeeded)
		assert.Equal(t, 0, batchResp.Failed)
		assert.Equal(t, 0, batchResp.Conflicts)
		assert.Len(t, batchResp.Results, 1)
		assert.Equal(t, "success", batchResp.Results[0].Status)
		assert.NotNil(t, batchResp.Results[0].EntityID)
		assert.Equal(t, itemResult.ID, *batchResp.Results[0].EntityID)
	})

	// Test batch delete operation
	t.Run("delete item via batch", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "delete",
					"entity_type": "item",
					"entity_id":   itemResult.ID.String(),
				},
			},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
		}
		batchResp = ParseResponse[struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
		}](t, resp)

		assert.Equal(t, 1, batchResp.Succeeded)
		assert.Equal(t, 0, batchResp.Failed)
	})

	// Test conflict detection
	t.Run("detect conflict on stale update", func(t *testing.T) {
		// Create another item
		resp := ts.Post(workspacePath+"/items", map[string]interface{}{
			"name":            "Conflict Test Item",
			"sku":             "CONFLICT-001",
			"min_stock_level": 0,
		})
		RequireStatus(t, resp, http.StatusOK)

		var newItem struct {
			ID        uuid.UUID  `json:"id"`
			UpdatedAt *time.Time `json:"updated_at"`
		}
		newItem = ParseResponse[struct {
			ID        uuid.UUID  `json:"id"`
			UpdatedAt *time.Time `json:"updated_at"`
		}](t, resp)

		// Use a very old timestamp to simulate conflict
		oldTimestamp := time.Now().Add(-24 * time.Hour)

		// For conflict testing, use the old timestamp
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "update",
					"entity_type": "item",
					"entity_id":   newItem.ID.String(),
					"updated_at":  oldTimestamp.Format(time.RFC3339Nano),
					"data": map[string]interface{}{
						"name": "Should Conflict",
					},
				},
			},
		}

		resp = ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
			Conflicts int `json:"conflicts"`
			Results   []struct {
				Status string `json:"status"`
			} `json:"results"`
		}
		batchResp = ParseResponse[struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
			Conflicts int `json:"conflicts"`
			Results   []struct {
				Status string `json:"status"`
			} `json:"results"`
		}](t, resp)

		assert.Equal(t, 0, batchResp.Succeeded)
		assert.Equal(t, 0, batchResp.Failed)
		assert.Equal(t, 1, batchResp.Conflicts)
		assert.Len(t, batchResp.Results, 1)
		assert.Equal(t, "conflict", batchResp.Results[0].Status)
	})
}

func TestBatchOperations_Locations(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "batch_loc_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "batch-loc-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Batch Location Test",
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

	// Create a location
	resp = ts.Post(workspacePath+"/locations", map[string]interface{}{
		"name": "Test Location",
	})
	RequireStatus(t, resp, http.StatusOK)

	var locResult struct {
		ID        uuid.UUID  `json:"id"`
		Name      string     `json:"name"`
		UpdatedAt *time.Time `json:"updated_at"`
	}
	locResult = ParseResponse[struct {
		ID        uuid.UUID  `json:"id"`
		Name      string     `json:"name"`
		UpdatedAt *time.Time `json:"updated_at"`
	}](t, resp)

	// Test batch update location
	t.Run("update location via batch", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "update",
					"entity_type": "location",
					"entity_id":   locResult.ID.String(),
					"data": map[string]interface{}{
						"name": "Updated Location",
						"zone": "Zone A",
					},
				},
			},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Succeeded int `json:"succeeded"`
		}
		batchResp = ParseResponse[struct {
			Succeeded int `json:"succeeded"`
		}](t, resp)

		assert.Equal(t, 1, batchResp.Succeeded)
	})

	// Test batch delete location
	t.Run("delete location via batch", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "delete",
					"entity_type": "location",
					"entity_id":   locResult.ID.String(),
				},
			},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Succeeded int `json:"succeeded"`
		}
		batchResp = ParseResponse[struct {
			Succeeded int `json:"succeeded"`
		}](t, resp)

		assert.Equal(t, 1, batchResp.Succeeded)
	})
}

func TestBatchOperations_MultipleEntities(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "batch_multi_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "batch-multi-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Batch Multi Entity Test",
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

	// Create category, label, and company
	resp = ts.Post(workspacePath+"/categories", map[string]interface{}{
		"name": "Test Category",
	})
	RequireStatus(t, resp, http.StatusOK)
	var catResult struct {
		ID        uuid.UUID  `json:"id"`
		UpdatedAt *time.Time `json:"updated_at"`
	}
	catResult = ParseResponse[struct {
		ID        uuid.UUID  `json:"id"`
		UpdatedAt *time.Time `json:"updated_at"`
	}](t, resp)

	resp = ts.Post(workspacePath+"/labels", map[string]interface{}{
		"name":  "Test Label",
		"color": "#FF0000",
	})
	RequireStatus(t, resp, http.StatusOK)
	var labelResult struct {
		ID        uuid.UUID  `json:"id"`
		UpdatedAt *time.Time `json:"updated_at"`
	}
	labelResult = ParseResponse[struct {
		ID        uuid.UUID  `json:"id"`
		UpdatedAt *time.Time `json:"updated_at"`
	}](t, resp)

	resp = ts.Post(workspacePath+"/companies", map[string]interface{}{
		"name": "Test Company",
	})
	RequireStatus(t, resp, http.StatusOK)
	var companyResult struct {
		ID        uuid.UUID  `json:"id"`
		UpdatedAt *time.Time `json:"updated_at"`
	}
	companyResult = ParseResponse[struct {
		ID        uuid.UUID  `json:"id"`
		UpdatedAt *time.Time `json:"updated_at"`
	}](t, resp)

	// Test batch with multiple entity types in one request
	t.Run("batch update multiple entity types", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "update",
					"entity_type": "category",
					"entity_id":   catResult.ID.String(),
					"data": map[string]interface{}{
						"name": "Updated Category",
					},
				},
				{
					"operation":   "update",
					"entity_type": "label",
					"entity_id":   labelResult.ID.String(),
					"data": map[string]interface{}{
						"name":  "Updated Label",
						"color": "#00FF00",
					},
				},
				{
					"operation":   "update",
					"entity_type": "company",
					"entity_id":   companyResult.ID.String(),
					"data": map[string]interface{}{
						"name": "Updated Company",
					},
				},
			},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
			Conflicts int `json:"conflicts"`
		}
		batchResp = ParseResponse[struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
			Conflicts int `json:"conflicts"`
		}](t, resp)

		assert.Equal(t, 3, batchResp.Succeeded)
		assert.Equal(t, 0, batchResp.Failed)
		assert.Equal(t, 0, batchResp.Conflicts)
	})
}

func TestBatchOperations_Errors(t *testing.T) {
	ts := NewTestServer(t)

	token := ts.AuthHelper(t, "batch_err_"+uuid.New().String()[:8]+"@example.com")
	ts.SetToken(token)

	// Create workspace
	slug := "batch-err-ws-" + uuid.New().String()[:8]
	resp := ts.Post("/workspaces", map[string]interface{}{
		"name":        "Batch Error Test",
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

	// Test empty operations
	t.Run("empty operations", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusBadRequest)
	})

	// Test too many operations
	t.Run("too many operations", func(t *testing.T) {
		operations := make([]map[string]interface{}, 101)
		for i := 0; i < 101; i++ {
			operations[i] = map[string]interface{}{
				"operation":   "update",
				"entity_type": "item",
				"entity_id":   uuid.New().String(),
			}
		}

		batchReq := map[string]interface{}{
			"operations": operations,
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusBadRequest)
	})

	// Test non-existent entity
	t.Run("non-existent entity", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "update",
					"entity_type": "item",
					"entity_id":   uuid.New().String(),
					"data": map[string]interface{}{
						"name": "Should Fail",
					},
				},
			},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
			Results   []struct {
				Status    string  `json:"status"`
				ErrorCode *string `json:"error_code"`
			} `json:"results"`
		}
		batchResp = ParseResponse[struct {
			Succeeded int `json:"succeeded"`
			Failed    int `json:"failed"`
			Results   []struct {
				Status    string  `json:"status"`
				ErrorCode *string `json:"error_code"`
			} `json:"results"`
		}](t, resp)

		assert.Equal(t, 0, batchResp.Succeeded)
		assert.Equal(t, 1, batchResp.Failed)
		assert.Len(t, batchResp.Results, 1)
		assert.Equal(t, "error", batchResp.Results[0].Status)
		assert.NotNil(t, batchResp.Results[0].ErrorCode)
	})

	// Test unsupported create operation
	t.Run("unsupported create operation", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "create",
					"entity_type": "item",
					"data": map[string]interface{}{
						"name": "New Item",
						"sku":  "NEW-001",
					},
				},
			},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Failed  int `json:"failed"`
			Results []struct {
				Status    string  `json:"status"`
				ErrorCode *string `json:"error_code"`
			} `json:"results"`
		}
		batchResp = ParseResponse[struct {
			Failed  int `json:"failed"`
			Results []struct {
				Status    string  `json:"status"`
				ErrorCode *string `json:"error_code"`
			} `json:"results"`
		}](t, resp)

		assert.Equal(t, 1, batchResp.Failed)
		assert.Equal(t, "error", batchResp.Results[0].Status)
		assert.NotNil(t, batchResp.Results[0].ErrorCode)
		assert.Equal(t, "UNSUPPORTED_OPERATION", *batchResp.Results[0].ErrorCode)
	})

	// Test missing entity_id for update/delete
	t.Run("missing entity_id for update", func(t *testing.T) {
		batchReq := map[string]interface{}{
			"operations": []map[string]interface{}{
				{
					"operation":   "update",
					"entity_type": "item",
					"data": map[string]interface{}{
						"name": "Update without ID",
					},
				},
			},
		}

		resp := ts.Post(workspacePath+"/sync/batch", batchReq)
		RequireStatus(t, resp, http.StatusOK)

		var batchResp struct {
			Failed  int `json:"failed"`
			Results []struct {
				Status    string  `json:"status"`
				ErrorCode *string `json:"error_code"`
			} `json:"results"`
		}
		batchResp = ParseResponse[struct {
			Failed  int `json:"failed"`
			Results []struct {
				Status    string  `json:"status"`
				ErrorCode *string `json:"error_code"`
			} `json:"results"`
		}](t, resp)

		assert.Equal(t, 1, batchResp.Failed)
		assert.Equal(t, "error", batchResp.Results[0].Status)
		assert.NotNil(t, batchResp.Results[0].ErrorCode)
		assert.Equal(t, "MISSING_ENTITY_ID", *batchResp.Results[0].ErrorCode)
	})
}
