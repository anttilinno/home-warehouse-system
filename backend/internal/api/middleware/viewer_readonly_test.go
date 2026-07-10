package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func withRole(role string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := context.WithValue(req.Context(), RoleContextKey, role)
	return req.WithContext(ctx)
}

func TestViewerReadOnly(t *testing.T) {
	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})
	handler := ViewerReadOnly()(next)

	tests := []struct {
		name       string
		role       string
		method     string
		wantStatus int
		wantNext   bool
	}{
		{"viewer GET passes", roleViewer, http.MethodGet, http.StatusOK, true},
		{"viewer HEAD passes", roleViewer, http.MethodHead, http.StatusOK, true},
		{"viewer OPTIONS passes", roleViewer, http.MethodOptions, http.StatusOK, true},
		{"viewer POST blocked", roleViewer, http.MethodPost, http.StatusForbidden, false},
		{"viewer PUT blocked", roleViewer, http.MethodPut, http.StatusForbidden, false},
		{"viewer PATCH blocked", roleViewer, http.MethodPatch, http.StatusForbidden, false},
		{"viewer DELETE blocked", roleViewer, http.MethodDelete, http.StatusForbidden, false},
		{"member POST passes", "member", http.MethodPost, http.StatusOK, true},
		{"admin POST passes", "admin", http.MethodPost, http.StatusOK, true},
		{"owner DELETE passes", "owner", http.MethodDelete, http.StatusOK, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nextCalled = false
			req := withRole(tt.role)
			req.Method = tt.method
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
			assert.Equal(t, tt.wantNext, nextCalled)
		})
	}
}

func TestViewerReadOnly_NoRoleInContext(t *testing.T) {
	// A request with no role in context (e.g. an unauthenticated path that somehow
	// reaches here) must not be blocked by this middleware — auth is another
	// middleware's job. Fail open on the role check, not on the write check.
	nextCalled := false
	handler := ViewerReadOnly()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.True(t, nextCalled)
	assert.Equal(t, http.StatusOK, rec.Code)
}
