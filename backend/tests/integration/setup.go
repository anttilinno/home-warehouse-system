package integration

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/api"
	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// TestServer wraps the test server and provides helper methods.
type TestServer struct {
	t      *testing.T
	Router chi.Router
	Pool   *pgxpool.Pool
	Server *httptest.Server
	Token  string // JWT token for authenticated requests
}

// NewTestServer creates a new test server with the full API.
func NewTestServer(t *testing.T) *TestServer {
	t.Helper()

	pool := testdb.SetupTestDB(t)

	cfg := &config.Config{
		JWTSecret:          "test-secret-key-for-integration-tests",
		JWTExpirationHours: 24,
		DebugMode:          true,
	}

	router := api.NewRouter(pool, cfg)
	server := httptest.NewServer(router)

	t.Cleanup(func() {
		server.Close()
	})

	return &TestServer{
		t:      t,
		Router: router,
		Pool:   pool,
		Server: server,
	}
}

// SetToken sets the JWT token for authenticated requests.
func (ts *TestServer) SetToken(token string) {
	ts.Token = token
}

// Request makes an HTTP request to the test server.
func (ts *TestServer) Request(method, path string, body interface{}) *http.Response {
	ts.t.Helper()

	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			ts.t.Fatalf("failed to marshal request body: %v", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, ts.Server.URL+path, reqBody)
	if err != nil {
		ts.t.Fatalf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if ts.Token != "" {
		req.Header.Set("Authorization", "Bearer "+ts.Token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		ts.t.Fatalf("failed to make request: %v", err)
	}

	return resp
}

// Get makes a GET request.
func (ts *TestServer) Get(path string) *http.Response {
	return ts.Request(http.MethodGet, path, nil)
}

// Post makes a POST request.
func (ts *TestServer) Post(path string, body interface{}) *http.Response {
	return ts.Request(http.MethodPost, path, body)
}

// Put makes a PUT request.
func (ts *TestServer) Put(path string, body interface{}) *http.Response {
	return ts.Request(http.MethodPut, path, body)
}

// Patch makes a PATCH request.
func (ts *TestServer) Patch(path string, body interface{}) *http.Response {
	return ts.Request(http.MethodPatch, path, body)
}

// Delete makes a DELETE request.
func (ts *TestServer) Delete(path string) *http.Response {
	return ts.Request(http.MethodDelete, path, nil)
}

// ParseResponse parses the response body into the given struct.
func ParseResponse[T any](t *testing.T, resp *http.Response) T {
	t.Helper()

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read response body: %v", err)
	}

	var result T
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("failed to unmarshal response body: %v\nBody: %s", err, string(body))
	}

	return result
}

// ParseErrorResponse parses an error response.
func ParseErrorResponse(t *testing.T, resp *http.Response) ErrorResponse {
	t.Helper()
	return ParseResponse[ErrorResponse](t, resp)
}

// ErrorResponse represents an API error response.
type ErrorResponse struct {
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail"`
}

// RequireStatus checks that the response has the expected status code.
func RequireStatus(t *testing.T, resp *http.Response, expected int) {
	t.Helper()
	if resp.StatusCode != expected {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected status %d, got %d. Body: %s", expected, resp.StatusCode, string(body))
	}
}
