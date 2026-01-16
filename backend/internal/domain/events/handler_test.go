package events

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// Helper to create test context with workspace and user
func createTestContext(workspaceID, userID uuid.UUID) context.Context {
	ctx := context.Background()
	ctx = context.WithValue(ctx, appMiddleware.WorkspaceContextKey, workspaceID)
	ctx = context.WithValue(ctx, appMiddleware.UserContextKey, &appMiddleware.AuthUser{
		ID: userID,
	})
	return ctx
}

func TestHandler_StreamEvents_SuccessfulConnection(t *testing.T) {
	broadcaster := events.NewBroadcaster()
	handler := NewHandler(broadcaster)

	workspaceID := uuid.New()
	userID := uuid.New()

	// Create request with proper context
	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req = req.WithContext(createTestContext(workspaceID, userID))

	// Use ResponseRecorder that supports Flusher
	rec := httptest.NewRecorder()

	// Call handler in goroutine since it blocks
	done := make(chan bool)
	go func() {
		handler.StreamEvents(rec, req)
		done <- true
	}()

	// Wait briefly for initial message
	time.Sleep(50 * time.Millisecond)

	// Cancel the context to stop the handler
	// Note: httptest.NewRequest creates a context that we can't cancel directly,
	// but the goroutine will handle cleanup when we verify the results

	// Verify response headers
	assert.Equal(t, "text/event-stream", rec.Header().Get("Content-Type"))
	assert.Equal(t, "no-cache", rec.Header().Get("Cache-Control"))
	assert.Equal(t, "keep-alive", rec.Header().Get("Connection"))
	assert.Equal(t, "no", rec.Header().Get("X-Accel-Buffering"))

	// Verify connection event was sent
	body := rec.Body.String()
	assert.Contains(t, body, "event: connected")
	assert.Contains(t, body, "client_id")

	// Cleanup: broadcaster will clean up when handler returns
	stats := broadcaster.GetStats()
	// Client should be registered (handler is still running)
	assert.Equal(t, 1, stats["total_clients"])
}

func TestHandler_StreamEvents_MissingWorkspaceContext(t *testing.T) {
	broadcaster := events.NewBroadcaster()
	handler := NewHandler(broadcaster)

	userID := uuid.New()

	// Create request WITHOUT workspace context
	ctx := context.WithValue(context.Background(), appMiddleware.UserContextKey, &appMiddleware.AuthUser{
		ID: userID,
	})
	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.StreamEvents(rec, req)

	// Should return 401
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "workspace context required")
}

func TestHandler_StreamEvents_MissingUserContext(t *testing.T) {
	broadcaster := events.NewBroadcaster()
	handler := NewHandler(broadcaster)

	workspaceID := uuid.New()

	// Create request with workspace but WITHOUT user context
	ctx := context.WithValue(context.Background(), appMiddleware.WorkspaceContextKey, workspaceID)
	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.StreamEvents(rec, req)

	// Should return 401
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "user context required")
}

func TestHandler_StreamEvents_EventBroadcasting(t *testing.T) {
	broadcaster := events.NewBroadcaster()
	handler := NewHandler(broadcaster)

	workspaceID := uuid.New()
	userID := uuid.New()

	// Create a cancellable context
	ctx, cancel := context.WithCancel(createTestContext(workspaceID, userID))
	defer cancel()

	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()

	// Start handler in goroutine
	done := make(chan bool)
	go func() {
		handler.StreamEvents(rec, req)
		done <- true
	}()

	// Wait for connection to establish
	time.Sleep(50 * time.Millisecond)

	// Publish an event
	testEventID := uuid.New()
	broadcaster.Publish(workspaceID, events.Event{
		Type:       "test.created",
		EntityType: "test",
		EntityID:   testEventID.String(),
		UserID:     userID,
		Data: map[string]interface{}{
			"name": "Test Item",
		},
	})

	// Wait for event to be sent
	time.Sleep(50 * time.Millisecond)

	// Cancel context to stop handler
	cancel()

	// Wait for handler to finish
	select {
	case <-done:
	case <-time.After(1 * time.Second):
		t.Fatal("Handler did not finish within timeout")
	}

	// Verify both connected and test.created events were sent
	body := rec.Body.String()
	assert.Contains(t, body, "event: connected")
	assert.Contains(t, body, "event: test.created")
	assert.Contains(t, body, "Test Item")
}

func TestHandler_StreamEvents_SSEMessageFormat(t *testing.T) {
	broadcaster := events.NewBroadcaster()
	handler := NewHandler(broadcaster)

	workspaceID := uuid.New()
	userID := uuid.New()

	ctx, cancel := context.WithCancel(createTestContext(workspaceID, userID))
	defer cancel()

	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()

	// Start handler
	go func() {
		handler.StreamEvents(rec, req)
	}()

	// Wait for connection
	time.Sleep(50 * time.Millisecond)

	// Publish event
	testEventID := uuid.New()
	broadcaster.Publish(workspaceID, events.Event{
		Type:       "item.created",
		EntityType: "item",
		EntityID:   testEventID.String(),
		UserID:     userID,
		Data: map[string]interface{}{
			"sku": "TEST-001",
		},
	})

	// Wait for event
	time.Sleep(50 * time.Millisecond)

	// Stop handler
	cancel()
	time.Sleep(50 * time.Millisecond)

	// Verify SSE format: event: <type>\ndata: <json>\n\n
	body := rec.Body.String()

	// Should have connected event
	assert.Contains(t, body, "event: connected\n")
	assert.Contains(t, body, "data: {\"client_id\":")

	// Should have item.created event
	assert.Contains(t, body, "event: item.created\n")
	lines := strings.Split(body, "\n")

	// Find the item.created event and verify format
	foundEvent := false
	for i, line := range lines {
		if line == "event: item.created" {
			// Next line should be data
			if i+1 < len(lines) {
				dataLine := lines[i+1]
				assert.True(t, strings.HasPrefix(dataLine, "data: {"))

				// Parse JSON to verify it's valid
				jsonData := strings.TrimPrefix(dataLine, "data: ")
				var event events.Event
				err := json.Unmarshal([]byte(jsonData), &event)
				require.NoError(t, err)
				assert.Equal(t, "item.created", event.Type)
				assert.Equal(t, "item", event.EntityType)
			}
			foundEvent = true
			break
		}
	}
	assert.True(t, foundEvent, "Should find item.created event")
}

func TestHandler_StreamEvents_ClientDisconnect(t *testing.T) {
	broadcaster := events.NewBroadcaster()
	handler := NewHandler(broadcaster)

	workspaceID := uuid.New()
	userID := uuid.New()

	// Get initial stats
	initialStats := broadcaster.GetStats()
	initialClients := initialStats["total_clients"].(int)

	// Create context with cancel
	ctx, cancel := context.WithCancel(createTestContext(workspaceID, userID))

	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()

	// Start handler in goroutine
	done := make(chan bool)
	go func() {
		handler.StreamEvents(rec, req)
		done <- true
	}()

	// Wait for registration
	time.Sleep(50 * time.Millisecond)

	// Verify client was registered
	stats := broadcaster.GetStats()
	assert.Equal(t, initialClients+1, stats["total_clients"])

	// Cancel context (simulate disconnect)
	cancel()

	// Wait for cleanup
	select {
	case <-done:
	case <-time.After(1 * time.Second):
		t.Fatal("Handler did not finish within timeout")
	}

	// Give broadcaster time to cleanup
	time.Sleep(50 * time.Millisecond)

	// Verify client was unregistered
	finalStats := broadcaster.GetStats()
	assert.Equal(t, initialClients, finalStats["total_clients"])
}

func TestHandler_StreamEvents_MultipleClientsWorkspaceIsolation(t *testing.T) {
	broadcaster := events.NewBroadcaster()
	handler := NewHandler(broadcaster)

	workspace1 := uuid.New()
	workspace2 := uuid.New()
	user1 := uuid.New()
	user2 := uuid.New()

	// Create two clients in different workspaces
	ctx1, cancel1 := context.WithCancel(createTestContext(workspace1, user1))
	defer cancel1()
	ctx2, cancel2 := context.WithCancel(createTestContext(workspace2, user2))
	defer cancel2()

	req1 := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req1 = req1.WithContext(ctx1)
	rec1 := httptest.NewRecorder()

	req2 := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req2 = req2.WithContext(ctx2)
	rec2 := httptest.NewRecorder()

	// Start both handlers
	done1 := make(chan bool)
	done2 := make(chan bool)

	go func() {
		handler.StreamEvents(rec1, req1)
		done1 <- true
	}()

	go func() {
		handler.StreamEvents(rec2, req2)
		done2 <- true
	}()

	// Wait for connections
	time.Sleep(50 * time.Millisecond)

	// Publish event to workspace1 only
	testEvent := events.Event{
		Type:       "test.created",
		EntityType: "test",
		EntityID:   uuid.New().String(),
		UserID:     user1,
		Data: map[string]interface{}{
			"workspace": "workspace1",
		},
	}
	broadcaster.Publish(workspace1, testEvent)

	// Wait for event delivery
	time.Sleep(50 * time.Millisecond)

	// Stop both handlers
	cancel1()
	cancel2()

	// Wait for cleanup
	select {
	case <-done1:
	case <-time.After(1 * time.Second):
		t.Fatal("Handler 1 did not finish")
	}

	select {
	case <-done2:
	case <-time.After(1 * time.Second):
		t.Fatal("Handler 2 did not finish")
	}

	// Verify workspace1 client received the event
	body1 := rec1.Body.String()
	assert.Contains(t, body1, "event: test.created")
	assert.Contains(t, body1, "workspace1")

	// Verify workspace2 client did NOT receive the event
	body2 := rec2.Body.String()
	assert.NotContains(t, body2, "event: test.created")
	assert.NotContains(t, body2, "workspace1")
	// Should only have connected event
	assert.Contains(t, body2, "event: connected")
}
