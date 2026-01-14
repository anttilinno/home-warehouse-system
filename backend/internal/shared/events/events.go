package events

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Event represents a domain event that has occurred.
type Event interface {
	EventName() string
	OccurredAt() time.Time
	WorkspaceID() uuid.UUID
}

// EventHandler is a function that handles an event.
type EventHandler func(ctx context.Context, event Event) error

// EventBus manages event publication and subscription.
type EventBus interface {
	Publish(ctx context.Context, event Event) error
	Subscribe(eventName string, handler EventHandler)
	SubscribeAll(handler EventHandler)
}

// InMemoryEventBus is a simple in-memory event bus implementation.
// Events are processed synchronously in the order they are published.
type InMemoryEventBus struct {
	handlers    map[string][]EventHandler
	allHandlers []EventHandler
	mu          sync.RWMutex
	logger      *slog.Logger
}

// NewInMemoryEventBus creates a new in-memory event bus.
func NewInMemoryEventBus(logger *slog.Logger) *InMemoryEventBus {
	return &InMemoryEventBus{
		handlers:    make(map[string][]EventHandler),
		allHandlers: make([]EventHandler, 0),
		logger:      logger,
	}
}

// Publish publishes an event to all subscribed handlers.
// Handlers are called synchronously in the order they were subscribed.
// If a handler returns an error, it is logged but does not stop other handlers.
func (b *InMemoryEventBus) Publish(ctx context.Context, event Event) error {
	b.mu.RLock()
	defer b.mu.RUnlock()

	eventName := event.EventName()

	// Call handlers subscribed to this specific event
	if handlers, ok := b.handlers[eventName]; ok {
		for _, handler := range handlers {
			if err := handler(ctx, event); err != nil {
				b.logger.Error("event handler failed",
					"event", eventName,
					"error", err,
					"workspace_id", event.WorkspaceID(),
				)
				// Continue processing other handlers even if one fails
			}
		}
	}

	// Call handlers subscribed to all events
	for _, handler := range b.allHandlers {
		if err := handler(ctx, event); err != nil {
			b.logger.Error("event handler (all) failed",
				"event", eventName,
				"error", err,
				"workspace_id", event.WorkspaceID(),
			)
			// Continue processing other handlers even if one fails
		}
	}

	return nil
}

// Subscribe adds a handler for a specific event name.
func (b *InMemoryEventBus) Subscribe(eventName string, handler EventHandler) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.handlers[eventName] = append(b.handlers[eventName], handler)
}

// SubscribeAll adds a handler that will be called for all events.
func (b *InMemoryEventBus) SubscribeAll(handler EventHandler) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.allHandlers = append(b.allHandlers, handler)
}

// BaseEvent provides common fields for all events.
type BaseEvent struct {
	workspaceID uuid.UUID
	occurredAt  time.Time
}

// NewBaseEvent creates a new base event.
func NewBaseEvent(workspaceID uuid.UUID) BaseEvent {
	return BaseEvent{
		workspaceID: workspaceID,
		occurredAt:  time.Now(),
	}
}

// WorkspaceID returns the workspace ID where the event occurred.
func (e BaseEvent) WorkspaceID() uuid.UUID {
	return e.workspaceID
}

// OccurredAt returns when the event occurred.
func (e BaseEvent) OccurredAt() time.Time {
	return e.occurredAt
}
