package middleware

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Workspace validates workspace access and adds workspace ID to context.
// Note: For now, this is a simple middleware that just extracts and validates
// the workspace ID. Full access control checking should be done in handlers
// using the member service.
func Workspace(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get workspace ID from URL parameter
		workspaceIDStr := chi.URLParam(r, "workspace_id")
		workspaceID, err := uuid.Parse(workspaceIDStr)
		if err != nil {
			http.Error(w, `{"error":"bad_request","message":"invalid workspace ID"}`, http.StatusBadRequest)
			return
		}

		// Get authenticated user from context
		_, ok := GetAuthUser(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized","message":"not authenticated"}`, http.StatusUnauthorized)
			return
		}

		// Add workspace ID to context
		// Note: Role checking is deferred to individual handlers as they may have
		// different permission requirements
		ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetWorkspaceID retrieves the workspace ID from context.
func GetWorkspaceID(ctx context.Context) (uuid.UUID, bool) {
	workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
	return workspaceID, ok
}

// GetRole retrieves the user's role in the workspace from context.
func GetRole(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(RoleContextKey).(string)
	return role, ok
}
