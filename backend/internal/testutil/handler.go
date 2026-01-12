package testutil

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// HandlerTestSetup provides common test infrastructure for handler tests
type HandlerTestSetup struct {
	Router      *chi.Mux
	API         huma.API
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
}

// NewHandlerTestSetup creates a new test setup with injected workspace context
func NewHandlerTestSetup() *HandlerTestSetup {
	r := chi.NewRouter()
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	// Inject workspace and user context middleware for testing
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := req.Context()
			ctx = context.WithValue(ctx, appMiddleware.WorkspaceContextKey, workspaceID)
			ctx = context.WithValue(ctx, appMiddleware.UserContextKey, userID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})

	config := huma.DefaultConfig("Test API", "1.0.0")
	api := humachi.New(r, config)

	return &HandlerTestSetup{
		Router:      r,
		API:         api,
		WorkspaceID: workspaceID,
		UserID:      userID,
	}
}

// Request makes an HTTP request with JSON body
func (h *HandlerTestSetup) Request(method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.Router.ServeHTTP(rec, req)
	return rec
}

// Get makes a GET request
func (h *HandlerTestSetup) Get(path string) *httptest.ResponseRecorder {
	return h.Request("GET", path, "")
}

// Post makes a POST request with JSON body
func (h *HandlerTestSetup) Post(path, body string) *httptest.ResponseRecorder {
	return h.Request("POST", path, body)
}

// Put makes a PUT request with JSON body
func (h *HandlerTestSetup) Put(path, body string) *httptest.ResponseRecorder {
	return h.Request("PUT", path, body)
}

// Patch makes a PATCH request with JSON body
func (h *HandlerTestSetup) Patch(path, body string) *httptest.ResponseRecorder {
	return h.Request("PATCH", path, body)
}

// Delete makes a DELETE request
func (h *HandlerTestSetup) Delete(path string) *httptest.ResponseRecorder {
	return h.Request("DELETE", path, "")
}

// ParseJSONResponse parses the response body as JSON into the given type
func ParseJSONResponse[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	var result T
	err := json.Unmarshal(rec.Body.Bytes(), &result)
	assert.NoError(t, err, "Failed to parse response body")
	return result
}

// AssertStatus asserts the response status code
func AssertStatus(t *testing.T, rec *httptest.ResponseRecorder, expected int) {
	assert.Equal(t, expected, rec.Code, "Response body: %s", rec.Body.String())
}

// AssertJSON asserts that the response contains the expected JSON (partial match)
func AssertJSON(t *testing.T, rec *httptest.ResponseRecorder, expected map[string]any) {
	var actual map[string]any
	err := json.Unmarshal(rec.Body.Bytes(), &actual)
	assert.NoError(t, err)

	for key, expectedValue := range expected {
		actualValue, exists := actual[key]
		assert.True(t, exists, "Expected key %s not found in response", key)
		assert.Equal(t, expectedValue, actualValue, "Value mismatch for key %s", key)
	}
}

// AssertErrorResponse asserts that the response is an error with the expected message
func AssertErrorResponse(t *testing.T, rec *httptest.ResponseRecorder, expectedStatus int, expectedMsg string) {
	AssertStatus(t, rec, expectedStatus)

	var errResp struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &errResp)
	assert.NoError(t, err)

	if expectedMsg != "" {
		assert.Contains(t, errResp.Message, expectedMsg)
	}
}
