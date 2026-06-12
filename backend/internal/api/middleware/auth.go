package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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

// SessionResolver is the minimal session-lookup surface CurrentSession needs.
// It is defined here (rather than importing the session package) to avoid an
// import cycle: session/handler.go already imports this middleware package for
// GetCurrentSessionID/GetAuthUser. *session.Service satisfies this interface
// structurally via FindByTokenHash; the returned value exposes its id via the
// IdentifiedSession interface.
type SessionResolver interface {
	FindByTokenHash(ctx context.Context, tokenHash string) (IdentifiedSession, error)
}

// IdentifiedSession is the minimal session view CurrentSession reads: just its id.
type IdentifiedSession interface {
	ID() uuid.UUID
}

// hashRefreshToken mirrors session.HashToken (SHA-256, hex) without importing
// the session package, keeping middleware free of the import cycle. The hash
// scheme is a stable primitive shared by both call sites.
func hashRefreshToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// CurrentSession resolves the server-side session row for the request and
// populates the context with its id via WithCurrentSessionID. It MUST run
// AFTER JWTAuth (it does not authenticate — JWTAuth already did).
//
// The access JWT is stateless and carries no session/jti, so the only
// request-bound handle to the session row is the refresh_token cookie. This
// middleware hashes that cookie and looks the row up via the resolver.
//
// Resolution is best-effort and NEVER a hard auth gate: a missing cookie, a
// lookup miss, or a revoked session all pass the request through unchanged.
// SSE query-param auth and programmatic Bearer callers carry no refresh
// cookie and MUST still reach their handlers. The resolved id is display/UX
// only (is_current badge, revoke-all-others target) — revoke authorization
// is still enforced by ownership checks in the session service, so a missing
// or mis-resolved id can never grant privilege. Lookup errors are swallowed
// by design (not wrapped/surfaced) for exactly this reason.
func CurrentSession(resolver SessionResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if resolver != nil {
				if cookie, err := r.Cookie("refresh_token"); err == nil && cookie.Value != "" {
					tokenHash := hashRefreshToken(cookie.Value)
					if sess, err := resolver.FindByTokenHash(r.Context(), tokenHash); err == nil && sess != nil {
						ctx := WithCurrentSessionID(r.Context(), sess.ID())
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
				}
			}
			// No cookie / lookup miss / revoked: pass through unchanged.
			next.ServeHTTP(w, r)
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
