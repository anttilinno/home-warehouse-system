package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// StructuredLogger Middleware Tests
// =============================================================================

func TestStructuredLogger_BasicRequest(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	callCount := 0
	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, 1, callCount)
	assert.Equal(t, http.StatusOK, rec.Code)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err, "log should be valid JSON")

	// Verify log fields
	assert.Equal(t, "GET", logEntry["method"])
	assert.Equal(t, "/test", logEntry["path"])
	assert.Equal(t, float64(200), logEntry["status"])
	assert.Contains(t, logEntry, "duration_ms")
	assert.Equal(t, "request completed", logEntry["msg"])
	assert.Equal(t, "INFO", logEntry["level"])
}

func TestStructuredLogger_WithUserContext(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	userID := uuid.New()
	user := &AuthUser{
		ID:          userID,
		Email:       "test@example.com",
		IsSuperuser: false,
	}

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	// Add user to context
	ctx := context.WithValue(req.Context(), UserContextKey, user)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify user context is logged
	assert.Equal(t, userID.String(), logEntry["user_id"])
	assert.Equal(t, "test@example.com", logEntry["user_email"])
	assert.NotContains(t, logEntry, "is_superuser") // false values not logged
}

func TestStructuredLogger_WithSuperuser(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	user := &AuthUser{
		ID:          uuid.New(),
		Email:       "admin@example.com",
		IsSuperuser: true,
	}

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(req.Context(), UserContextKey, user)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify superuser flag is logged
	assert.Equal(t, true, logEntry["is_superuser"])
}

func TestStructuredLogger_WithWorkspaceContext(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	workspaceID := uuid.New()

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(req.Context(), WorkspaceContextKey, workspaceID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify workspace context is logged
	assert.Equal(t, workspaceID.String(), logEntry["workspace_id"])
}

func TestStructuredLogger_WithRoleContext(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(req.Context(), RoleContextKey, "admin")
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify role context is logged
	assert.Equal(t, "admin", logEntry["workspace_role"])
}

func TestStructuredLogger_WithFullContext(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	userID := uuid.New()
	workspaceID := uuid.New()

	user := &AuthUser{
		ID:          userID,
		Email:       "member@example.com",
		IsSuperuser: false,
	}

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/items", nil)
	ctx := context.WithValue(req.Context(), UserContextKey, user)
	ctx = context.WithValue(ctx, WorkspaceContextKey, workspaceID)
	ctx = context.WithValue(ctx, RoleContextKey, "member")
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify all context is logged
	assert.Equal(t, "POST", logEntry["method"])
	assert.Equal(t, "/api/items", logEntry["path"])
	assert.Equal(t, float64(200), logEntry["status"])
	assert.Equal(t, userID.String(), logEntry["user_id"])
	assert.Equal(t, "member@example.com", logEntry["user_email"])
	assert.Equal(t, workspaceID.String(), logEntry["workspace_id"])
	assert.Equal(t, "member", logEntry["workspace_role"])
	assert.Contains(t, logEntry, "duration_ms")
}

func TestStructuredLogger_ClientError(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify warning level for client errors
	assert.Equal(t, float64(400), logEntry["status"])
	assert.Equal(t, "WARN", logEntry["level"])
	assert.Equal(t, "client error", logEntry["msg"])
}

func TestStructuredLogger_ServerError(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify error level for server errors
	assert.Equal(t, float64(500), logEntry["status"])
	assert.Equal(t, "ERROR", logEntry["level"])
	assert.Equal(t, "server error", logEntry["msg"])
}

func TestStructuredLogger_WithRequestID(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := middleware.RequestID(StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify request ID is logged
	assert.NotEmpty(t, logEntry["request_id"])
}

func TestStructuredLogger_MeasuresDuration(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simulate some work
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify duration is logged
	duration, ok := logEntry["duration_ms"].(float64)
	require.True(t, ok, "duration_ms should be a number")
	assert.GreaterOrEqual(t, duration, 0.0)
}

// =============================================================================
// NewLogger Function Tests
// =============================================================================

func TestNewLogger_DebugMode(t *testing.T) {
	logger := NewLogger(true)
	assert.NotNil(t, logger)

	// Capture output
	var buf bytes.Buffer
	logger = slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{
		Level:     slog.LevelInfo,
		AddSource: true,
	}))

	logger.Info("test message")

	// Text format should contain readable output
	output := buf.String()
	assert.Contains(t, output, "test message")
	assert.Contains(t, output, "level=INFO")
}

func TestNewLogger_ProductionMode(t *testing.T) {
	logger := NewLogger(false)
	assert.NotNil(t, logger)

	// Capture output
	var buf bytes.Buffer
	logger = slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{
		Level:     slog.LevelInfo,
		AddSource: false,
	}))

	logger.Info("test message", "key", "value")

	// JSON format should be parseable
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	assert.Equal(t, "test message", logEntry["msg"])
	assert.Equal(t, "INFO", logEntry["level"])
	assert.Equal(t, "value", logEntry["key"])
}

func TestStructuredLogger_LogsRemoteAddr(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	// Parse log output
	var logEntry map[string]interface{}
	err := json.Unmarshal(buf.Bytes(), &logEntry)
	require.NoError(t, err)

	// Verify remote_addr is logged
	assert.NotEmpty(t, logEntry["remote_addr"])
	assert.True(t, strings.Contains(logEntry["remote_addr"].(string), "192.168.1"))
}
