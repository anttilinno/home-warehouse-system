package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// TimeoutWithSkip returns a timeout middleware that skips routes whose path
// contains any of the given suffixes (e.g. "/sse"). This allows long-lived
// connections like SSE to be exempt from the request timeout.
func TimeoutWithSkip(timeout time.Duration, skipSuffixes ...string) func(http.Handler) http.Handler {
	timeoutMiddleware := middleware.Timeout(timeout)

	return func(next http.Handler) http.Handler {
		withTimeout := timeoutMiddleware(next)

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			for _, suffix := range skipSuffixes {
				if strings.HasSuffix(r.URL.Path, suffix) {
					next.ServeHTTP(w, r)
					return
				}
			}
			withTimeout.ServeHTTP(w, r)
		})
	}
}
