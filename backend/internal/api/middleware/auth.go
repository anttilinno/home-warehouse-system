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
	UserContextKey           contextKey = "user"
	WorkspaceContextKey      contextKey = "workspace"
	RoleContextKey           contextKey = "role"
	CurrentSessionIDKey      contextKey = "current_session_id"
)

// AuthUser represents the authenticated user in context.
type AuthUser struct {
	ID          uuid.UUID
	Email       string
	FullName    string
	IsSuperuser bool
}

// JWTAuth creates an authentication middleware with JWT validation.
// Supports multiple token sources in order of priority:
// 1. Authorization header (Bearer token)
// 2. Cookie (access_token)
// 3. Query parameter (token=...) - for SSE since EventSource doesn't support custom headers
func JWTAuth(jwtService *jwt.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var token string

			// First try Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				token = strings.TrimPrefix(authHeader, "Bearer ")
				if token == authHeader {
					http.Error(w, `{"error":"unauthorized","message":"invalid authorization format"}`, http.StatusUnauthorized)
					return
				}
			}

			// Fall back to cookie
			if token == "" {
				if cookie, err := r.Cookie("access_token"); err == nil {
					token = cookie.Value
				}
			}

			// Fall back to query parameter (for SSE connections as last resort)
			if token == "" {
				token = r.URL.Query().Get("token")
			}

			if token == "" {
				http.Error(w, `{"error":"unauthorized","message":"missing authorization"}`, http.StatusUnauthorized)
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
				FullName:    claims.FullName,
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

// WithCurrentSessionID adds the current session ID to context.
func WithCurrentSessionID(ctx context.Context, sessionID uuid.UUID) context.Context {
	return context.WithValue(ctx, CurrentSessionIDKey, sessionID)
}

// GetCurrentSessionID retrieves the current session ID from context.
func GetCurrentSessionID(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(CurrentSessionIDKey).(uuid.UUID)
	return id, ok
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

// GetUserDisplayName extracts the user's full name from auth context.
// Falls back to email username or "Unknown User" if not available.
func GetUserDisplayName(ctx context.Context) string {
	authUser, ok := GetAuthUser(ctx)
	if !ok {
		return "Unknown User"
	}

	// Use full name if available
	if authUser.FullName != "" {
		return authUser.FullName
	}

	// Fallback to email prefix if no full name
	if authUser.Email != "" {
		// Extract name part from email (before @)
		parts := strings.Split(authUser.Email, "@")
		if len(parts) > 0 && parts[0] != "" {
			return parts[0]
		}
	}

	return "User"
}
