package middleware

import (
	"net/http"
	"os"
	"strings"
)

// allowedOrigins returns the explicit list of allowed origins for CORS.
//
// The list is built from:
//   - a small set of local development defaults,
//   - APP_URL (the deployed frontend origin),
//   - CORS_ALLOWED_ORIGINS (comma-separated extra origins).
//
// There is deliberately NO private-network auto-allow: with
// Access-Control-Allow-Credentials true, reflecting arbitrary LAN origins
// would let any site on a private IP (or a DNS-rebinding attacker) make
// credentialed requests and read the responses.
func allowedOrigins() []string {
	// Default allowed origins for development
	origins := []string{
		"http://localhost:3000",
		"http://localhost:3001",
		"http://127.0.0.1:3000",
	}

	// Add the configured frontend origin
	if appURL := strings.TrimRight(os.Getenv("APP_URL"), "/"); appURL != "" {
		origins = append(origins, appURL)
	}

	// Add custom origins from environment variable (comma-separated)
	if envOrigins := os.Getenv("CORS_ALLOWED_ORIGINS"); envOrigins != "" {
		for _, origin := range strings.Split(envOrigins, ",") {
			if trimmed := strings.TrimSpace(origin); trimmed != "" {
				origins = append(origins, trimmed)
			}
		}
	}

	return origins
}

// isAllowedOrigin checks if the given origin is in the allowed list.
func isAllowedOrigin(origin string, allowed []string) bool {
	for _, o := range allowed {
		if o == origin {
			return true
		}
	}
	return false
}

// CORS adds CORS headers to responses.
func CORS(next http.Handler) http.Handler {
	allowed := allowedOrigins()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Always set Vary header to prevent caching issues with different origins
		w.Header().Set("Vary", "Origin")

		// Set the specific origin if allowed (required for credentials)
		if origin != "" && isAllowedOrigin(origin, allowed) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, Idempotency-Key, X-CSRF-Token, X-Workspace-ID")
		w.Header().Set("Access-Control-Max-Age", "300")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
