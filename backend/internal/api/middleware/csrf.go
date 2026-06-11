package middleware

import (
	"net/http"
	"strings"
)

// CSRFProtect is a defense-in-depth CSRF check for cookie-authenticated
// mutating requests. SameSite=Lax on the auth cookies is the primary defense;
// this middleware adds a second, independent layer based on the browser-set
// Sec-Fetch-Site and Origin headers.
//
// Rules (mutating methods only — POST/PUT/PATCH/DELETE):
//   - Requests carrying an Authorization: Bearer header are skipped: header
//     tokens cannot be attached cross-site by a victim's browser.
//   - Sec-Fetch-Site: cross-site is rejected unless the Origin is in the
//     CORS allowlist (allowedOrigins — the same config value used by the
//     CORS middleware, covering intentionally split frontend/API origins).
//   - If only an Origin header is present, it must be in the allowlist.
//   - Requests without either header (curl, native clients, old browsers)
//     are allowed: they are not CSRF-deliverable in the first place.
func CSRFProtect(next http.Handler) http.Handler {
	allowed := allowedOrigins()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}

		// Bearer-token requests are not cookie-authenticated; skip.
		if strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
			next.ServeHTTP(w, r)
			return
		}

		// Modern browsers send Sec-Fetch-Site on every request.
		switch r.Header.Get("Sec-Fetch-Site") {
		case "same-origin", "same-site", "none":
			next.ServeHTTP(w, r)
			return
		case "cross-site":
			if origin := r.Header.Get("Origin"); origin != "" && isAllowedOrigin(origin, allowed) {
				next.ServeHTTP(w, r)
				return
			}
			http.Error(w, `{"error":"forbidden","message":"cross-site request rejected"}`, http.StatusForbidden)
			return
		}

		// No Sec-Fetch-Site: fall back to Origin validation.
		if origin := r.Header.Get("Origin"); origin != "" && !isAllowedOrigin(origin, allowed) {
			http.Error(w, `{"error":"forbidden","message":"cross-site request rejected"}`, http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
