package middleware

import (
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimiter tracks request counts per IP address.
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string]*ipRequestInfo
	limit    int
	window   time.Duration
}

type ipRequestInfo struct {
	count     int
	windowEnd time.Time
}

// NewRateLimiter creates a new rate limiter.
// limit: maximum number of requests allowed per window
// window: time duration for the rate limit window
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		requests: make(map[string]*ipRequestInfo),
		limit:    limit,
		window:   window,
	}

	// Start cleanup goroutine to prevent memory leaks
	go rl.cleanup()

	return rl
}

// cleanup periodically removes expired entries
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, info := range rl.requests {
			if now.After(info.windowEnd) {
				delete(rl.requests, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks if a request from the given IP should be allowed.
// Returns (allowed, secondsUntilReset)
func (rl *RateLimiter) Allow(ip string) (bool, int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	info, exists := rl.requests[ip]

	// New IP or expired window
	if !exists || now.After(info.windowEnd) {
		rl.requests[ip] = &ipRequestInfo{
			count:     1,
			windowEnd: now.Add(rl.window),
		}
		return true, 0
	}

	// Within window - check limit
	if info.count >= rl.limit {
		retryAfter := int(info.windowEnd.Sub(now).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, retryAfter
	}

	// Increment and allow
	info.count++
	return true, 0
}

// RateLimit creates a middleware that limits requests by IP address.
func RateLimit(limiter *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)

			allowed, retryAfter := limiter.Allow(ip)
			if !allowed {
				w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"too_many_requests","message":"too many requests, please try again later"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// getClientIP extracts the client IP from the request.
// It checks X-Forwarded-For and X-Real-IP headers for proxied requests.
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (may contain multiple IPs)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP (original client)
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
