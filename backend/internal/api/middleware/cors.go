package middleware

import (
	"net/http"
	"net/url"
	"os"
	"strings"
)

// allowedOrigins returns the list of allowed origins for CORS.
func allowedOrigins() []string {
	// Default allowed origins for development
	origins := []string{
		"http://localhost:3000",
		"http://localhost:3001",
		"http://127.0.0.1:3000",
	}

	// Add custom origins from environment variable (comma-separated)
	if envOrigins := os.Getenv("CORS_ALLOWED_ORIGINS"); envOrigins != "" {
		for _, origin := range strings.Split(envOrigins, ",") {
			origins = append(origins, strings.TrimSpace(origin))
		}
	}

	return origins
}

// isPrivateNetworkOrigin checks if the origin is from a private/LAN address.
func isPrivateNetworkOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	return strings.HasPrefix(host, "192.168.") ||
		strings.HasPrefix(host, "10.") ||
		strings.HasPrefix(host, "172.16.") ||
		strings.HasPrefix(host, "172.17.") ||
		strings.HasPrefix(host, "172.18.") ||
		strings.HasPrefix(host, "172.19.") ||
		strings.HasPrefix(host, "172.2") ||
		strings.HasPrefix(host, "172.30.") ||
		strings.HasPrefix(host, "172.31.")
}

// isAllowedOrigin checks if the given origin is in the allowed list or is from a private network.
func isAllowedOrigin(origin string, allowed []string) bool {
	for _, o := range allowed {
		if o == origin {
			return true
		}
	}
	return isPrivateNetworkOrigin(origin)
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
