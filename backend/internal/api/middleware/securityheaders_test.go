package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

// =============================================================================
// SecurityHeaders Middleware Tests
// =============================================================================

func TestSecurityHeaders_SetsAllHeaders(t *testing.T) {
	handlerCalled := false

	handler := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/items", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.True(t, handlerCalled)
	assert.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))
}
