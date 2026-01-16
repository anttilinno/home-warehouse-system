// Package middleware provides HTTP middleware for the Home Warehouse System API,
// including the approval pipeline middleware for role-based change control.
package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// PendingChangeCreator defines the interface for creating pending changes in the approval pipeline.
// This interface avoids import cycles by not directly importing the pendingchange package.
// Implementations are responsible for storing the change request and publishing appropriate events.
type PendingChangeCreator interface {
	CreatePendingChange(
		ctx context.Context,
		workspaceID uuid.UUID,
		requesterID uuid.UUID,
		entityType string,
		entityID *uuid.UUID,
		action string,
		payload json.RawMessage,
	) (changeID uuid.UUID, err error)
}

// ApprovalMiddleware intercepts CRUD operations from workspace members and routes them through the approval pipeline.
//
// This middleware enforces role-based change control:
//   - Owner/Admin: Changes are applied immediately (bypass approval)
//   - Member: Create/update/delete operations return 202 Accepted and create a pending change
//   - Viewer: Read-only access (no interception needed, handled by permission checks)
//
// The middleware:
//  1. Checks the user's role from the request context (set by Workspace middleware)
//  2. Identifies the operation type (create, update, delete) from HTTP method
//  3. Extracts entity type and ID from the URL path
//  4. Captures the request payload (JSON body)
//  5. Creates a pending change instead of executing the operation
//  6. Returns 202 Accepted with pending change details
//
// Supported entity types: item, category, location, container, inventory, borrower, loan, label
//
// See docs/APPROVAL_PIPELINE.md for complete documentation.
func ApprovalMiddleware(pendingChangeCreator PendingChangeCreator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get the user's role from context (set by Workspace middleware)
			role, ok := GetRole(r.Context())
			if !ok {
				// No role in context, let the request proceed (will be caught by other middleware)
				next.ServeHTTP(w, r)
				return
			}

			// Only intercept operations from members
			// Owners, admins, and viewers bypass approval pipeline
			if role != "member" {
				next.ServeHTTP(w, r)
				return
			}

			// Extract operation details
			action := extractAction(r.Method)
			if action == "" {
				// Non-CRUD operation (GET requests), let it proceed
				next.ServeHTTP(w, r)
				return
			}

			// Extract entity type from URL path
			entityType := extractEntityType(r)
			if entityType == "" {
				// Not a supported entity endpoint, let it proceed
				next.ServeHTTP(w, r)
				return
			}

			// Extract entity ID for update/delete operations
			entityID := extractEntityID(r, action)

			// Extract and buffer the request payload
			payload, err := extractPayload(r)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"bad_request","message":"failed to read request body: %v"}`, err), http.StatusBadRequest)
				return
			}

			// Get workspace ID and user ID from context
			workspaceID, _ := GetWorkspaceID(r.Context())
			authUser, _ := GetAuthUser(r.Context())

			// Create pending change instead of executing operation
			changeID, err := pendingChangeCreator.CreatePendingChange(
				r.Context(),
				workspaceID,
				authUser.ID,
				entityType,
				entityID,
				action,
				payload,
			)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"internal_error","message":"failed to create pending change: %v"}`, err), http.StatusInternalServerError)
				return
			}

			// Return 202 Accepted with pending change details
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			response := map[string]interface{}{
				"pending_change_id": changeID,
				"status":            "pending_approval",
				"message":           "Your change is pending approval from workspace admin",
				"entity_type":       entityType,
				"action":            action,
			}
			json.NewEncoder(w).Encode(response)
		})
	}
}

// extractAction determines the action type (create, update, delete) from the HTTP method.
// Returns an empty string for GET requests and other non-CRUD methods.
func extractAction(method string) string {
	switch method {
	case http.MethodPost:
		return "create"
	case http.MethodPut, http.MethodPatch:
		return "update"
	case http.MethodDelete:
		return "delete"
	default:
		return "" // GET, OPTIONS, etc. are not CRUD operations
	}
}

// extractEntityType extracts and normalizes the entity type from the URL path.
//
// Supported URL patterns:
//   - /workspaces/{workspace_id}/items[/{id}]
//   - /workspaces/{workspace_id}/categories[/{id}]
//   - /workspaces/{workspace_id}/locations[/{id}]
//   - /workspaces/{workspace_id}/containers[/{id}]
//   - /workspaces/{workspace_id}/inventory[/{id}]
//   - /workspaces/{workspace_id}/borrowers[/{id}]
//   - /workspaces/{workspace_id}/loans[/{id}]
//   - /workspaces/{workspace_id}/labels[/{id}]
//
// Returns the singular form (e.g., "item" for "/items") or empty string if unsupported.
func extractEntityType(r *http.Request) string {
	path := r.URL.Path

	// Extract the entity type from the path
	// Pattern: /workspaces/{workspace_id}/{entity_type}[/{entity_id}][/sub-resource]
	parts := strings.Split(strings.Trim(path, "/"), "/")

	// Need at least: ["workspaces", "{workspace_id}", "{entity_type}"]
	if len(parts) < 3 {
		return ""
	}

	// The entity type is the 3rd part (index 2)
	entityType := parts[2]

	// Normalize entity types
	switch entityType {
	case "items":
		return "item"
	case "categories":
		return "category"
	case "locations":
		return "location"
	case "containers":
		return "container"
	case "inventory":
		return "inventory"
	case "borrowers":
		return "borrower"
	case "loans":
		return "loan"
	case "labels":
		return "label"
	default:
		return "" // Unsupported entity type
	}
}

// extractEntityID extracts the entity ID from URL parameters for update/delete operations.
// Returns nil for create operations or if no valid UUID is found in the path.
// Attempts to match common URL parameter patterns like {id}, {item_id}, {category_id}, etc.
func extractEntityID(r *http.Request, action string) *uuid.UUID {
	// Only update and delete operations need entity_id
	if action != "update" && action != "delete" {
		return nil
	}

	// Try to get ID from URL parameter (Chi router pattern)
	// Common patterns: {id}, {item_id}, {category_id}, etc.
	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		// Try entity-specific patterns
		entityType := extractEntityType(r)
		if entityType != "" {
			idStr = chi.URLParam(r, entityType+"_id")
		}
	}

	if idStr == "" {
		return nil
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil
	}

	return &id
}

// extractPayload reads and buffers the request body, validating it as JSON.
// The body is restored after reading so downstream handlers can still access it if needed.
// Returns empty JSON object "{}" if the body is nil or empty.
// Returns an error if the body is not valid JSON.
func extractPayload(r *http.Request) (json.RawMessage, error) {
	if r.Body == nil {
		return json.RawMessage("{}"), nil
	}

	// Read the entire body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()

	// Restore the body so downstream handlers can read it if needed
	r.Body = io.NopCloser(bytes.NewBuffer(body))

	// If body is empty, return empty JSON object
	if len(body) == 0 {
		return json.RawMessage("{}"), nil
	}

	// Validate that it's valid JSON
	if !json.Valid(body) {
		return nil, fmt.Errorf("invalid JSON payload")
	}

	return json.RawMessage(body), nil
}
