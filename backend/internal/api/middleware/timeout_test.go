package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// =============================================================================
// TimeoutWithSkip Middleware Tests
// =============================================================================

func TestTimeoutWithSkip_AppliesTimeout_ToNormalRoute(t *testing.T) {
	handlerCalled := false
	handler := TimeoutWithSkip(100*time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		// Sleep longer than timeout to trigger timeout
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/items", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// The timeout middleware will cause the request context to be cancelled
	assert.True(t, handlerCalled)
}

func TestTimeoutWithSkip_SkipsTimeout_ForSSERoute(t *testing.T) {
	handlerCalled := false
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/events/sse", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.True(t, handlerCalled)
	// SSE should not have timeout deadline
	assert.False(t, hasDeadline)
}

func TestTimeoutWithSkip_SkipsTimeout_MultipleRoutes(t *testing.T) {
	tests := []struct {
		name           string
		path           string
		skipSuffixes   []string
		shouldTimeout  bool
	}{
		{"skip /sse", "/api/sse", []string{"/sse"}, false},
		{"skip /stream", "/api/stream", []string{"/stream"}, false},
		{"apply timeout to /items", "/api/items", []string{"/sse"}, true},
		{"multiple skips /sse matches", "/api/events/sse", []string{"/sse", "/stream"}, false},
		{"multiple skips /stream matches", "/api/v1/stream", []string{"/sse", "/stream"}, false},
		{"no match with multiple skips", "/api/data", []string{"/sse", "/stream"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var hasDeadline bool

			handler := TimeoutWithSkip(100*time.Millisecond, tt.skipSuffixes...)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, hasDeadline = r.Context().Deadline()
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if tt.shouldTimeout {
				assert.True(t, hasDeadline, "path %s should have timeout deadline", tt.path)
			} else {
				assert.False(t, hasDeadline, "path %s should not have timeout deadline", tt.path)
			}
		})
	}
}

func TestTimeoutWithSkip_SkipsTimeout_ExactSuffix(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contextDeadline, deadlineExists := r.Context().Deadline()
		hasDeadline = deadlineExists
		_ = contextDeadline // unused but captured
		w.WriteHeader(http.StatusOK)
	}))

	// Should match /sse suffix
	req := httptest.NewRequest(http.MethodGet, "/api/events/sse", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.False(t, hasDeadline)
}

func TestTimeoutWithSkip_SkipsTimeout_PartialSuffix(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond, "/events")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	// Should match /events suffix
	req := httptest.NewRequest(http.MethodGet, "/api/events", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.False(t, hasDeadline)
}

// =============================================================================
// Timeout Enforcement Tests
// =============================================================================

func TestTimeoutWithSkip_EnforcesTimeout_QuickRequest(t *testing.T) {
	handlerCalled := false
	handler := TimeoutWithSkip(1*time.Second)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		// Quick response within timeout
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.True(t, handlerCalled)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestTimeoutWithSkip_EmptySkipSuffixes(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/sse", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// No skip suffix specified, so even /sse should have timeout
	assert.True(t, hasDeadline)
}

func TestTimeoutWithSkip_CaseSensitiveSuffix(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond, "/SSE")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	// Path is lowercase /sse, suffix is uppercase /SSE - should NOT match
	req := httptest.NewRequest(http.MethodGet, "/api/sse", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.True(t, hasDeadline)
}

// =============================================================================
// Context Deadline Tests
// =============================================================================

func TestTimeoutWithSkip_ContextDeadline_IsSet(t *testing.T) {
	var deadline time.Time
	var hasDeadline bool
	var deadlineReasonable bool

	handler := TimeoutWithSkip(1*time.Second)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		deadline, hasDeadline = r.Context().Deadline()
		// Check that deadline is in the future
		deadlineReasonable = deadline.After(time.Now())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.True(t, hasDeadline)
	assert.True(t, deadlineReasonable)
}

func TestTimeoutWithSkip_ContextDeadline_NotSet_ForSkippedRoute(t *testing.T) {
	var deadline time.Time
	var hasDeadline bool

	handler := TimeoutWithSkip(1*time.Second, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		deadline, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.False(t, hasDeadline)
	assert.Equal(t, time.Time{}, deadline)
}

// =============================================================================
// Multiple Skip Suffixes Tests
// =============================================================================

func TestTimeoutWithSkip_MultipleSkipSuffixes_FirstMatches(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond, "/sse", "/stream", "/ws")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/sse", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.False(t, hasDeadline)
}

func TestTimeoutWithSkip_MultipleSkipSuffixes_SecondMatches(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond, "/sse", "/stream", "/ws")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/stream", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.False(t, hasDeadline)
}

func TestTimeoutWithSkip_MultipleSkipSuffixes_ThirdMatches(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond, "/sse", "/stream", "/ws")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/ws", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.False(t, hasDeadline)
}

func TestTimeoutWithSkip_MultipleSkipSuffixes_NoneMatch(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(100*time.Millisecond, "/sse", "/stream", "/ws")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/items", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.True(t, hasDeadline)
}

// =============================================================================
// Handler Execution Tests
// =============================================================================

func TestTimeoutWithSkip_CallsNextHandler_WithTimeout(t *testing.T) {
	handlerCalled := false

	handler := TimeoutWithSkip(1*time.Second)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.True(t, handlerCalled)
}

func TestTimeoutWithSkip_CallsNextHandler_WithoutTimeout(t *testing.T) {
	handlerCalled := false

	handler := TimeoutWithSkip(1*time.Second, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.True(t, handlerCalled)
}

func TestTimeoutWithSkip_ResponseStatus_PreservedWithTimeout(t *testing.T) {
	handler := TimeoutWithSkip(1*time.Second)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusAccepted, rec.Code)
}

func TestTimeoutWithSkip_ResponseStatus_PreservedWithoutTimeout(t *testing.T) {
	handler := TimeoutWithSkip(1*time.Second, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

// =============================================================================
// Different HTTP Methods Tests
// =============================================================================

func TestTimeoutWithSkip_AppliesTimeout_ToGET(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(1*time.Second)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.True(t, hasDeadline)
}

func TestTimeoutWithSkip_AppliesTimeout_ToPOST(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(1*time.Second)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/items", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.True(t, hasDeadline)
}

func TestTimeoutWithSkip_SkipsTimeout_ForDifferentMethods(t *testing.T) {
	methods := []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			var hasDeadline bool

			handler := TimeoutWithSkip(1*time.Second, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, hasDeadline = r.Context().Deadline()
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(method, "/sse", nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			assert.False(t, hasDeadline)
		})
	}
}

// =============================================================================
// Path Matching Tests
// =============================================================================

func TestTimeoutWithSkip_PathMatching_ExactSuffix(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(1*time.Second, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.False(t, hasDeadline)
}

func TestTimeoutWithSkip_PathMatching_WithPrefix(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(1*time.Second, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/namespace/sse", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.False(t, hasDeadline)
}

func TestTimeoutWithSkip_PathMatching_SuffixNotMatched(t *testing.T) {
	var hasDeadline bool

	handler := TimeoutWithSkip(1*time.Second, "/sse")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, hasDeadline = r.Context().Deadline()
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/sse-backup", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// /sse-backup has /sse but doesn't END with /sse
	assert.True(t, hasDeadline)
}
