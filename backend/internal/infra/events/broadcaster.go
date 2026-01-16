package events

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Event represents a workspace event
type Event struct {
	Type        string                 `json:"type"`
	EntityID    string                 `json:"entity_id,omitempty"`
	EntityType  string                 `json:"entity_type"`
	WorkspaceID uuid.UUID              `json:"workspace_id"`
	UserID      uuid.UUID              `json:"user_id"`
	Timestamp   time.Time              `json:"timestamp"`
	Data        map[string]interface{} `json:"data,omitempty"`
}

// Client represents an SSE connection
type Client struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
	Channel     chan Event
}

// Broadcaster manages SSE connections and event broadcasting
type Broadcaster struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[uuid.UUID]*Client // workspace_id -> client_id -> client
}

// NewBroadcaster creates a new event broadcaster
func NewBroadcaster() *Broadcaster {
	return &Broadcaster{
		clients: make(map[uuid.UUID]map[uuid.UUID]*Client),
	}
}

// Register adds a new client connection
func (b *Broadcaster) Register(workspaceID, userID uuid.UUID) *Client {
	b.mu.Lock()
	defer b.mu.Unlock()

	client := &Client{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		UserID:      userID,
		Channel:     make(chan Event, 100), // Buffer to prevent blocking
	}

	if b.clients[workspaceID] == nil {
		b.clients[workspaceID] = make(map[uuid.UUID]*Client)
	}
	b.clients[workspaceID][client.ID] = client

	return client
}

// Unregister removes a client connection
func (b *Broadcaster) Unregister(workspaceID, clientID uuid.UUID) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if workspace, ok := b.clients[workspaceID]; ok {
		if client, ok := workspace[clientID]; ok {
			close(client.Channel)
			delete(workspace, clientID)
		}

		// Clean up empty workspace map
		if len(workspace) == 0 {
			delete(b.clients, workspaceID)
		}
	}
}

// Publish broadcasts an event to all clients in a workspace
func (b *Broadcaster) Publish(workspaceID uuid.UUID, event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	event.WorkspaceID = workspaceID
	event.Timestamp = time.Now().UTC()

	workspace, ok := b.clients[workspaceID]
	if !ok {
		return // No clients for this workspace
	}

	for _, client := range workspace {
		// Don't send event to the user who triggered it (optional)
		// if client.UserID == event.UserID {
		// 	continue
		// }

		// Non-blocking send
		select {
		case client.Channel <- event:
		default:
			// Channel full, skip this client
			fmt.Printf("Warning: client %s channel full, dropping event\n", client.ID)
		}
	}
}

// GetStats returns broadcaster statistics
func (b *Broadcaster) GetStats() map[string]interface{} {
	b.mu.RLock()
	defer b.mu.RUnlock()

	totalClients := 0
	workspaces := make(map[string]int)

	for workspaceID, clients := range b.clients {
		count := len(clients)
		totalClients += count
		workspaces[workspaceID.String()] = count
	}

	return map[string]interface{}{
		"total_clients":         totalClients,
		"active_workspaces":     len(b.clients),
		"clients_per_workspace": workspaces,
	}
}
