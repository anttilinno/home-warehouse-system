package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func csrfHandler() (http.Handler, *bool) {
	called := false
	h := CSRFProtect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	return h, &called
}

func TestCSRFProtect_AllowsSafeMethods(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodHead, http.MethodOptions} {
		t.Run(method, func(t *testing.T) {
			h, called := csrfHandler()
			req := httptest.NewRequest(method, "/test", nil)
			req.Header.Set("Sec-Fetch-Site", "cross-site") // even cross-site reads pass
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			assert.True(t, *called)
		})
	}
}

func TestCSRFProtect_BlocksCrossSiteMutation(t *testing.T) {
	h, called := csrfHandler()
	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.False(t, *called)
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestCSRFProtect_AllowsSameOriginMutation(t *testing.T) {
	for _, site := range []string{"same-origin", "same-site", "none"} {
		t.Run(site, func(t *testing.T) {
			h, called := csrfHandler()
			req := httptest.NewRequest(http.MethodPost, "/test", nil)
			req.Header.Set("Sec-Fetch-Site", site)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			assert.True(t, *called)
		})
	}
}

func TestCSRFProtect_SkipsBearerTokenRequests(t *testing.T) {
	h, called := csrfHandler()
	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	req.Header.Set("Authorization", "Bearer some-token")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	// Bearer requests are not cookie-authenticated; CSRF does not apply
	assert.True(t, *called)
}

func TestCSRFProtect_OriginFallback(t *testing.T) {
	t.Run("disallowed origin without Sec-Fetch-Site is blocked", func(t *testing.T) {
		h, called := csrfHandler()
		req := httptest.NewRequest(http.MethodDelete, "/test", nil)
		req.Header.Set("Origin", "https://evil.example.com")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		assert.False(t, *called)
		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("allowed origin without Sec-Fetch-Site passes", func(t *testing.T) {
		h, called := csrfHandler()
		req := httptest.NewRequest(http.MethodPost, "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		assert.True(t, *called)
	})
}

func TestCSRFProtect_AllowsAllowlistedCrossSiteOrigin(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")

	h, called := csrfHandler()
	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	req.Header.Set("Sec-Fetch-Site", "cross-site")
	req.Header.Set("Origin", "https://app.example.com")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.True(t, *called)
}

func TestCSRFProtect_AllowsHeaderlessClients(t *testing.T) {
	// curl / native clients send neither Sec-Fetch-Site nor Origin —
	// these requests cannot be forged by a victim's browser.
	h, called := csrfHandler()
	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.True(t, *called)
}
