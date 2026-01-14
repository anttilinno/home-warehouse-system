package middleware

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// StructuredLogger creates a middleware that logs requests with user/workspace context.
// Logs include: method, path, status, duration, request_id, user_id, workspace_id, role.
func StructuredLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Wrap response writer to capture status code
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			// Process request
			next.ServeHTTP(ww, r)

			// Calculate duration
			duration := time.Since(start)

			// Build log attributes
			attrs := []any{
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"duration_ms", duration.Milliseconds(),
				"request_id", middleware.GetReqID(r.Context()),
				"remote_addr", r.RemoteAddr,
			}

			// Add user context if available
			if user, ok := GetAuthUser(r.Context()); ok {
				attrs = append(attrs, "user_id", user.ID.String())
				attrs = append(attrs, "user_email", user.Email)
				if user.IsSuperuser {
					attrs = append(attrs, "is_superuser", true)
				}
			}

			// Add workspace context if available
			if workspaceID, ok := GetWorkspaceID(r.Context()); ok {
				attrs = append(attrs, "workspace_id", workspaceID.String())
			}

			// Add role if available
			if role, ok := GetRole(r.Context()); ok {
				attrs = append(attrs, "workspace_role", role)
			}

			// Determine log level based on status code
			level := slog.LevelInfo
			message := "request completed"

			if ww.Status() >= 500 {
				level = slog.LevelError
				message = "server error"
			} else if ww.Status() >= 400 {
				level = slog.LevelWarn
				message = "client error"
			}

			// Log with appropriate level
			logger.Log(r.Context(), level, message, attrs...)
		})
	}
}

// NewLogger creates a new structured logger with JSON output.
// Use debug=true for development (adds source location), false for production.
func NewLogger(debug bool) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level:     slog.LevelInfo,
		AddSource: debug, // Add source file/line in debug mode
	}

	if debug {
		// Development: text format for readability
		return slog.New(slog.NewTextHandler(os.Stderr, opts))
	}

	// Production: JSON format for log aggregation
	return slog.New(slog.NewJSONHandler(os.Stderr, opts))
}
