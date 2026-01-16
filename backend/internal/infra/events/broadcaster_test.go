package events

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestBroadcaster_RegisterAndUnregister(t *testing.T) {
	b := NewBroadcaster()
	workspaceID := uuid.New()
	userID := uuid.New()

	// Register a client
	client := b.Register(workspaceID, userID)
	assert.NotNil(t, client)
	assert.Equal(t, workspaceID, client.WorkspaceID)
	assert.Equal(t, userID, client.UserID)
	assert.NotEqual(t, uuid.Nil, client.ID)
	assert.NotNil(t, client.Channel)

	// Verify stats
	stats := b.GetStats()
	assert.Equal(t, 1, stats["total_clients"])
	assert.Equal(t, 1, stats["active_workspaces"])

	// Unregister the client
	b.Unregister(workspaceID, client.ID)

	// Verify stats after unregister
	stats = b.GetStats()
	assert.Equal(t, 0, stats["total_clients"])
	assert.Equal(t, 0, stats["active_workspaces"])
}

func TestBroadcaster_PublishToSingleWorkspace(t *testing.T) {
	b := NewBroadcaster()
	workspaceID := uuid.New()
	userID := uuid.New()

	client := b.Register(workspaceID, userID)

	event := Event{
		Type:       "test.event",
		EntityType: "test",
		UserID:     userID,
	}

	// Publish event in a goroutine
	go b.Publish(workspaceID, event)

	// Receive event
	select {
	case received := <-client.Channel:
		assert.Equal(t, "test.event", received.Type)
		assert.Equal(t, "test", received.EntityType)
		assert.Equal(t, workspaceID, received.WorkspaceID)
		assert.Equal(t, userID, received.UserID)
		assert.False(t, received.Timestamp.IsZero())
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Client did not receive event")
	}
}

func TestBroadcaster_WorkspaceIsolation(t *testing.T) {
	b := NewBroadcaster()
	workspace1 := uuid.New()
	workspace2 := uuid.New()
	userID := uuid.New()

	client1 := b.Register(workspace1, userID)
	client2 := b.Register(workspace2, userID)

	event := Event{
		Type:       "test.event",
		EntityType: "test",
		UserID:     userID,
	}

	// Publish to workspace1
	b.Publish(workspace1, event)

	// Client1 should receive event
	select {
	case <-client1.Channel:
		// Success
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Client1 did not receive event")
	}

	// Client2 should NOT receive event
	select {
	case <-client2.Channel:
		t.Fatal("Client2 should not receive event from workspace1")
	case <-time.After(100 * time.Millisecond):
		// Success - client2 did not receive event
	}
}

func TestBroadcaster_MultipleClients(t *testing.T) {
	b := NewBroadcaster()
	workspaceID := uuid.New()
	userID1 := uuid.New()
	userID2 := uuid.New()

	client1 := b.Register(workspaceID, userID1)
	client2 := b.Register(workspaceID, userID2)

	// Verify stats
	stats := b.GetStats()
	assert.Equal(t, 2, stats["total_clients"])
	assert.Equal(t, 1, stats["active_workspaces"])

	event := Event{
		Type:       "test.event",
		EntityType: "test",
		UserID:     userID1,
	}

	// Publish event
	b.Publish(workspaceID, event)

	// Both clients should receive event
	receivedCount := 0
	for i := 0; i < 2; i++ {
		select {
		case <-client1.Channel:
			receivedCount++
		case <-client2.Channel:
			receivedCount++
		case <-time.After(100 * time.Millisecond):
			t.Fatal("Not all clients received event")
		}
	}

	assert.Equal(t, 2, receivedCount)
}

func TestBroadcaster_PublishToNonExistentWorkspace(t *testing.T) {
	b := NewBroadcaster()
	nonExistentWorkspace := uuid.New()
	userID := uuid.New()

	event := Event{
		Type:       "test.event",
		EntityType: "test",
		UserID:     userID,
	}

	// Should not panic
	assert.NotPanics(t, func() {
		b.Publish(nonExistentWorkspace, event)
	})
}

func TestBroadcaster_ChannelBuffer(t *testing.T) {
	b := NewBroadcaster()
	workspaceID := uuid.New()
	userID := uuid.New()

	client := b.Register(workspaceID, userID)

	// Publish 101 events (buffer is 100)
	for i := 0; i < 101; i++ {
		event := Event{
			Type:       "test.event",
			EntityType: "test",
			UserID:     userID,
		}
		b.Publish(workspaceID, event)
	}

	// Should have received at least some events without blocking
	// Note: The 101st event may be dropped due to full buffer
	receivedCount := 0
	for {
		select {
		case <-client.Channel:
			receivedCount++
		case <-time.After(10 * time.Millisecond):
			// No more events
			assert.Greater(t, receivedCount, 0)
			return
		}
	}
}

func TestBroadcaster_UnregisterClosesChannel(t *testing.T) {
	b := NewBroadcaster()
	workspaceID := uuid.New()
	userID := uuid.New()

	client := b.Register(workspaceID, userID)

	// Unregister should close the channel
	b.Unregister(workspaceID, client.ID)

	// Channel should be closed
	_, ok := <-client.Channel
	assert.False(t, ok, "Channel should be closed after unregister")
}

func TestBroadcaster_GetStats(t *testing.T) {
	b := NewBroadcaster()
	workspace1 := uuid.New()
	workspace2 := uuid.New()
	userID := uuid.New()

	// Register clients across multiple workspaces
	b.Register(workspace1, userID)
	b.Register(workspace1, userID)
	b.Register(workspace2, userID)

	stats := b.GetStats()
	assert.Equal(t, 3, stats["total_clients"])
	assert.Equal(t, 2, stats["active_workspaces"])

	clientsPerWorkspace := stats["clients_per_workspace"].(map[string]int)
	assert.Equal(t, 2, clientsPerWorkspace[workspace1.String()])
	assert.Equal(t, 1, clientsPerWorkspace[workspace2.String()])
}
