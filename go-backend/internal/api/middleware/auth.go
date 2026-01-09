package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type contextKey string

const (
	UserContextKey      contextKey = "user"
	WorkspaceContextKey contextKey = "workspace"
	RoleContextKey      contextKey = "role"
)

// AuthUser represents the authenticated user in context.
type AuthUser struct {
	ID          uuid.UUID
	Email       string
	IsSuperuser bool
}

// Auth validates JWT tokens and adds user to context.
func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"unauthorized","message":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			http.Error(w, `{"error":"unauthorized","message":"invalid authorization format"}`, http.StatusUnauthorized)
			return
		}

		// TODO: Validate JWT and extract user claims
		// For now, this is a placeholder that needs proper JWT validation
		user, err := validateToken(token)
		if err != nil {
			http.Error(w, `{"error":"unauthorized","message":"invalid token"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetAuthUser retrieves the authenticated user from context.
func GetAuthUser(ctx context.Context) (*AuthUser, bool) {
	user, ok := ctx.Value(UserContextKey).(*AuthUser)
	return user, ok
}

// validateToken validates a JWT token and returns user claims.
// TODO: Implement proper JWT validation.
func validateToken(token string) (*AuthUser, error) {
	// Placeholder implementation
	// This should be replaced with actual JWT validation using a library like golang-jwt
	return nil, nil
}
