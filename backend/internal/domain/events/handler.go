package events

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// Handler handles SSE HTTP requests
type Handler struct {
	broadcaster *events.Broadcaster
}

// NewHandler creates a new SSE handler
func NewHandler(broadcaster *events.Broadcaster) *Handler {
	return &Handler{broadcaster: broadcaster}
}

// RegisterRoutes registers SSE routes on a Chi router
// This uses Chi directly instead of Huma because SSE streaming requires low-level control
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/sse", h.StreamEvents)
}

// StreamEvents handles SSE connection
// GET /workspaces/{workspace_id}/sse
func (h *Handler) StreamEvents(w http.ResponseWriter, r *http.Request) {
	// Get workspace and user from context (set by middleware)
	workspaceID, ok := appMiddleware.GetWorkspaceID(r.Context())
	if !ok {
		http.Error(w, "workspace context required", http.StatusUnauthorized)
		return
	}

	authUser, ok := appMiddleware.GetAuthUser(r.Context())
	if !ok {
		http.Error(w, "user context required", http.StatusUnauthorized)
		return
	}
	userID := authUser.ID

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

	// Flush immediately to establish connection
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Register client
	client := h.broadcaster.Register(workspaceID, userID)
	defer h.broadcaster.Unregister(workspaceID, client.ID)

	// Send initial connection event
	fmt.Fprintf(w, "event: connected\ndata: {\"client_id\":\"%s\"}\n\n", client.ID)
	flusher.Flush()

	// Send keepalive every 30 seconds
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Listen for events and send to client
	for {
		select {
		case <-r.Context().Done():
			// Client disconnected
			return

		case event, ok := <-client.Channel:
			if !ok {
				// Channel closed
				return
			}

			// Marshal event to JSON
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}

			// Send SSE event
			// Format: event: <type>\ndata: <json>\n\n
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
			flusher.Flush()

		case <-ticker.C:
			// Send keepalive comment (ignored by EventSource API)
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}
