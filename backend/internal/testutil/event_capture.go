package testutil

import (
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// EventCapture helps capture events from broadcaster for testing
type EventCapture struct {
	broadcaster    *events.Broadcaster
	workspaceID    uuid.UUID
	userID         uuid.UUID
	client         *events.Client
	capturedEvents []events.Event
	mu             sync.Mutex
	done           chan bool
}

// NewEventCapture creates a new event capture helper
func NewEventCapture(workspaceID, userID uuid.UUID) *EventCapture {
	broadcaster := events.NewBroadcaster()
	return &EventCapture{
		broadcaster:    broadcaster,
		workspaceID:    workspaceID,
		userID:         userID,
		capturedEvents: make([]events.Event, 0),
		done:           make(chan bool),
	}
}

// Start begins capturing events
func (ec *EventCapture) Start() {
	ec.client = ec.broadcaster.Register(ec.workspaceID, ec.userID)
	go func() {
		for {
			select {
			case event, ok := <-ec.client.Channel:
				if !ok {
					return
				}
				ec.mu.Lock()
				ec.capturedEvents = append(ec.capturedEvents, event)
				ec.mu.Unlock()
			case <-ec.done:
				return
			}
		}
	}()
	time.Sleep(10 * time.Millisecond) // Give goroutine time to start
}

// Stop stops capturing events
func (ec *EventCapture) Stop() {
	close(ec.done)
	if ec.client != nil {
		ec.broadcaster.Unregister(ec.workspaceID, ec.client.ID)
	}
}

// GetBroadcaster returns the underlying broadcaster
func (ec *EventCapture) GetBroadcaster() *events.Broadcaster {
	return ec.broadcaster
}

// GetLastEvent returns the most recent captured event
func (ec *EventCapture) GetLastEvent() *events.Event {
	ec.mu.Lock()
	defer ec.mu.Unlock()
	if len(ec.capturedEvents) == 0 {
		return nil
	}
	return &ec.capturedEvents[len(ec.capturedEvents)-1]
}

// GetEventCount returns the number of captured events
func (ec *EventCapture) GetEventCount() int {
	ec.mu.Lock()
	defer ec.mu.Unlock()
	return len(ec.capturedEvents)
}

// WaitForEvents waits for at least count events to be captured, with a timeout
func (ec *EventCapture) WaitForEvents(count int, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if ec.GetEventCount() >= count {
			return true
		}
		time.Sleep(10 * time.Millisecond)
	}
	return false
}

// GetAllEvents returns all captured events
func (ec *EventCapture) GetAllEvents() []events.Event {
	ec.mu.Lock()
	defer ec.mu.Unlock()
	// Return a copy to avoid race conditions
	result := make([]events.Event, len(ec.capturedEvents))
	copy(result, ec.capturedEvents)
	return result
}
