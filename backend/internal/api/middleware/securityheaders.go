package middleware

import "net/http"

// SecurityHeaders sets baseline security headers on every response.
//
// X-Content-Type-Options: nosniff prevents browsers from MIME-sniffing
// responses (in particular user-uploaded files served by the photo/avatar
// handlers) into executable content types.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}
