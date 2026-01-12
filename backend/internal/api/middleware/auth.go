package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
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

// JWTAuth creates an authentication middleware with JWT validation.
func JWTAuth(jwtService *jwt.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
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

			claims, err := jwtService.ValidateToken(token)
			if err != nil {
				if err == jwt.ErrExpiredToken {
					http.Error(w, `{"error":"unauthorized","message":"token has expired"}`, http.StatusUnauthorized)
					return
				}
				http.Error(w, `{"error":"unauthorized","message":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			user := &AuthUser{
				ID:          claims.UserID,
				Email:       claims.Email,
				IsSuperuser: claims.IsSuperuser,
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Auth is a deprecated middleware - use JWTAuth instead.
// Kept for backward compatibility during migration.
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

		// This is the legacy path - should not be used
		http.Error(w, `{"error":"unauthorized","message":"JWT service not configured"}`, http.StatusUnauthorized)
	})
}

// GetAuthUser retrieves the authenticated user from context.
func GetAuthUser(ctx context.Context) (*AuthUser, bool) {
	user, ok := ctx.Value(UserContextKey).(*AuthUser)
	return user, ok
}

// RequireSuperuser is a middleware that requires the user to be a superuser.
func RequireSuperuser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := GetAuthUser(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized","message":"not authenticated"}`, http.StatusUnauthorized)
			return
		}

		if !user.IsSuperuser {
			http.Error(w, `{"error":"forbidden","message":"superuser access required"}`, http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
