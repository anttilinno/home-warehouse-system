package middleware

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// WorkspaceMember represents a minimal interface for workspace membership.
type WorkspaceMember interface {
	Role() string
}

// MemberRepository defines the repository interface we need for checking membership.
type MemberRepository interface {
	FindByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID) (WorkspaceMember, error)
}

// memberAdapter wraps any repository and adapts its return type to WorkspaceMember.
type memberAdapter struct {
	findByWorkspaceAndUser func(ctx context.Context, workspaceID, userID uuid.UUID) (WorkspaceMember, error)
}

func (a *memberAdapter) FindByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID) (WorkspaceMember, error) {
	return a.findByWorkspaceAndUser(ctx, workspaceID, userID)
}

// NewMemberAdapter creates an adapter that wraps a member repository.
// The repository must have a FindByWorkspaceAndUser method that returns a type with a Role() string method.
func NewMemberAdapter[T any](repo interface {
	FindByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID) (T, error)
}) MemberRepository {
	return &memberAdapter{
		findByWorkspaceAndUser: func(ctx context.Context, workspaceID, userID uuid.UUID) (WorkspaceMember, error) {
			result, err := repo.FindByWorkspaceAndUser(ctx, workspaceID, userID)
			if err != nil {
				return nil, err
			}
			// Check if result is nil
			var zero T
			if any(result) == any(zero) || any(result) == nil {
				return nil, nil
			}
			// Type assert to WorkspaceMember interface
			if member, ok := any(result).(WorkspaceMember); ok {
				return member, nil
			}
			// If it doesn't directly implement WorkspaceMember, wrap it
			return &roleMember{role: getRoleString(result)}, nil
		},
	}
}

// roleMember is a simple wrapper for objects with a Role() method.
type roleMember struct {
	role string
}

func (r *roleMember) Role() string {
	return r.role
}

// getRoleString extracts the role string from an object with a Role() method.
func getRoleString(obj any) string {
	if obj == nil {
		return ""
	}
	// Try to call Role() method via interface
	type roleGetter interface {
		Role() string
	}
	if rg, ok := obj.(roleGetter); ok {
		return rg.Role()
	}
	// Try role() string method
	type roleStringMethod interface {
		Role() string
	}
	if rsm, ok := obj.(roleStringMethod); ok {
		return rsm.Role()
	}
	return ""
}

// Workspace validates workspace access and adds workspace ID and role to context.
// This middleware enforces multi-tenant isolation by verifying the authenticated
// user is a member of the requested workspace.
func Workspace(memberRepo MemberRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get workspace ID from URL parameter
			workspaceIDStr := chi.URLParam(r, "workspace_id")
			workspaceID, err := uuid.Parse(workspaceIDStr)
			if err != nil {
				http.Error(w, `{"error":"bad_request","message":"invalid workspace ID"}`, http.StatusBadRequest)
				return
			}

			// Get authenticated user from context
			authUser, ok := GetAuthUser(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthorized","message":"not authenticated"}`, http.StatusUnauthorized)
				return
			}

			// Check if user is a member of this workspace
			membership, err := memberRepo.FindByWorkspaceAndUser(r.Context(), workspaceID, authUser.ID)
			if err != nil {
				// Log error but treat as forbidden for security
				http.Error(w, `{"error":"forbidden","message":"access denied to workspace"}`, http.StatusForbidden)
				return
			}
			if membership == nil {
				// User is not a member of this workspace
				http.Error(w, `{"error":"forbidden","message":"you are not a member of this workspace"}`, http.StatusForbidden)
				return
			}

			// Add workspace ID and role to context
			ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
			ctx = context.WithValue(ctx, RoleContextKey, string(membership.Role()))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
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

// RequireWorkspaceID extracts workspace ID from context or returns an error.
// Use this in handlers to reduce boilerplate workspace ID extraction.
func RequireWorkspaceID(ctx context.Context) (uuid.UUID, error) {
	workspaceID, ok := GetWorkspaceID(ctx)
	if !ok {
		return uuid.Nil, ErrWorkspaceRequired
	}
	return workspaceID, nil
}

// ErrWorkspaceRequired is returned when workspace context is missing.
var ErrWorkspaceRequired = &WorkspaceRequiredError{}

// WorkspaceRequiredError indicates missing workspace context.
type WorkspaceRequiredError struct{}

func (e *WorkspaceRequiredError) Error() string {
	return "workspace context required"
}
