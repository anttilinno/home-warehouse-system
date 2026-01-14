package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// =============================================================================
// RateLimit Middleware Tests
// =============================================================================

func TestRateLimit_AllowsRequestsUnderLimit(t *testing.T) {
	// Allow 5 requests per minute
	limiter := NewRateLimiter(5, time.Minute)

	callCount := 0
	handler := RateLimit(limiter)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
	}))

	// Make 5 requests - all should pass
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code, "request %d should succeed", i+1)
	}

	assert.Equal(t, 5, callCount)
}

func TestRateLimit_BlocksRequestsOverLimit(t *testing.T) {
	// Allow 3 requests per minute
	limiter := NewRateLimiter(3, time.Minute)

	callCount := 0
	handler := RateLimit(limiter)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
	}))

	// Make 5 requests - only first 3 should pass
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if i < 3 {
			assert.Equal(t, http.StatusOK, rec.Code, "request %d should succeed", i+1)
		} else {
			assert.Equal(t, http.StatusTooManyRequests, rec.Code, "request %d should be rate limited", i+1)
			assert.Contains(t, rec.Body.String(), "too many requests")
		}
	}

	assert.Equal(t, 3, callCount, "handler should only be called 3 times")
}

func TestRateLimit_TracksByIP(t *testing.T) {
	// Allow 2 requests per minute per IP
	limiter := NewRateLimiter(2, time.Minute)

	callCount := 0
	handler := RateLimit(limiter)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
	}))

	// IP 1: 2 requests should pass
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code)
	}

	// IP 1: 3rd request should be blocked
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)

	// IP 2: should have its own limit - requests should pass
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = "192.168.1.2:12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code)
	}

	assert.Equal(t, 4, callCount, "handler should be called 4 times total (2 per IP)")
}

func TestRateLimit_ResetsAfterWindow(t *testing.T) {
	// Allow 2 requests per 100ms window
	limiter := NewRateLimiter(2, 100*time.Millisecond)

	callCount := 0
	handler := RateLimit(limiter)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
	}))

	// Exhaust the limit
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code)
	}

	// This should be blocked
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)

	// Wait for window to reset
	time.Sleep(150 * time.Millisecond)

	// Should be allowed again
	req = httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	assert.Equal(t, 3, callCount)
}

func TestRateLimit_HandlesXForwardedFor(t *testing.T) {
	limiter := NewRateLimiter(2, time.Minute)

	callCount := 0
	handler := RateLimit(limiter)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
	}))

	// Use X-Forwarded-For header (common with proxies/load balancers)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = "10.0.0.1:12345" // Proxy IP
		req.Header.Set("X-Forwarded-For", "203.0.113.195")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code)
	}

	// 3rd request from same X-Forwarded-For should be blocked
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	req.Header.Set("X-Forwarded-For", "203.0.113.195")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)

	// Different X-Forwarded-For should pass
	req = httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	req.Header.Set("X-Forwarded-For", "203.0.113.196")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	assert.Equal(t, 3, callCount)
}

func TestRateLimit_ReturnsRetryAfterHeader(t *testing.T) {
	limiter := NewRateLimiter(1, time.Minute)

	handler := RateLimit(limiter)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First request passes
	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	// Second request is blocked and should have Retry-After header
	req = httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.NotEmpty(t, rec.Header().Get("Retry-After"), "should have Retry-After header")
}
