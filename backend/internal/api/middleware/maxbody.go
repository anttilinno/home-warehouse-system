package middleware

import "net/http"

// DefaultMaxBodyBytes is the fallback global request body cap.
const DefaultMaxBodyBytes int64 = 64 << 20 // 64MB

// MaxBodySize caps the request body at limit bytes using http.MaxBytesReader.
// A non-positive limit falls back to DefaultMaxBodyBytes.
//
// Reads beyond the limit fail and make the http server reply with
// 413 Request Entity Too Large. This is a global DoS guard; individual
// handlers (uploads, imports) enforce their own tighter limits.
func MaxBodySize(limit int64) func(http.Handler) http.Handler {
	if limit <= 0 {
		limit = DefaultMaxBodyBytes
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}
