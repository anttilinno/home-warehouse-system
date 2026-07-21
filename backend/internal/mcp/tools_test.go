package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// item_update must PATCH /workspaces/<ws>/items/<id> with a body that carries
// only the patchable fields — never the id (that's a path param). Regression
// guard for the body-struct split in updateHandler.
func TestUpdateHandler_DropsIDFromBody(t *testing.T) {
	var gotPath string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/login" {
			_ = json.NewEncoder(w).Encode(map[string]string{"token": "tok"})
			return
		}
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "item1"})
	}))
	defer srv.Close()

	c := New(srv.URL, "e@x", "pw", "ws1")
	name := "Renamed"
	res, _, _ := updateHandler(c)(context.Background(), nil, updateArgs{ID: "item1", Name: &name})
	if res.IsError {
		t.Fatalf("unexpected tool error: %v", res.Content)
	}
	if gotPath != "/workspaces/ws1/items/item1" {
		t.Fatalf("path = %q", gotPath)
	}
	if _, ok := gotBody["id"]; ok {
		t.Fatalf("id leaked into PATCH body: %v", gotBody)
	}
	if gotBody["name"] != "Renamed" {
		t.Fatalf("name not forwarded: %v", gotBody)
	}
}

// inventory_move must POST to /inventory/<id>/move with location_id in the body
// and no inventory_id (path param).
func TestMoveHandler_BodyShape(t *testing.T) {
	var gotPath string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/login" {
			_ = json.NewEncoder(w).Encode(map[string]string{"token": "tok"})
			return
		}
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "inv1"})
	}))
	defer srv.Close()

	c := New(srv.URL, "e@x", "pw", "ws1")
	res, _, _ := moveHandler(c)(context.Background(), nil, moveArgs{InventoryID: "inv1", LocationID: "loc9"})
	if res.IsError {
		t.Fatalf("unexpected tool error: %v", res.Content)
	}
	if gotPath != "/workspaces/ws1/inventory/inv1/move" {
		t.Fatalf("path = %q", gotPath)
	}
	if _, ok := gotBody["inventory_id"]; ok {
		t.Fatalf("inventory_id leaked into body: %v", gotBody)
	}
	if gotBody["location_id"] != "loc9" {
		t.Fatalf("location_id not forwarded: %v", gotBody)
	}
}
